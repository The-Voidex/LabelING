from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path

import yaml


def _put_box(client, image_id: int, class_id: int, box: tuple[float, float, float, float]):
    current = client.get(f"/api/images/{image_id}/annotations").json()
    annotations = [
        {
            "id": item["id"],
            "class_id": item["class_id"],
            "x1": item["x1"],
            "y1": item["y1"],
            "x2": item["x2"],
            "y2": item["y2"],
            "confidence": item.get("confidence"),
        }
        for item in current
    ]
    annotations.append(
        {
            "class_id": class_id,
            "x1": box[0],
            "y1": box[1],
            "x2": box[2],
            "y2": box[3],
        }
    )
    response = client.put(
        f"/api/images/{image_id}/annotations",
        json={"annotations": annotations},
    )
    assert response.status_code == 200


def _zip(response) -> zipfile.ZipFile:
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    return zipfile.ZipFile(io.BytesIO(response.content))


def _prepare(client, project_id, imported_images):
    first = client.post(
        f"/api/projects/{project_id}/classes",
        json={"name": "类别一", "prompt": "第一类"},
    ).json()
    second = client.post(
        f"/api/projects/{project_id}/classes",
        json={"name": "类别二", "prompt": "第二类"},
    ).json()
    image_a, image_b = imported_images[0], imported_images[1]
    _put_box(client, image_a["id"], first["id"], (0.1, 0.2, 0.6, 0.8))
    _put_box(client, image_a["id"], second["id"], (0.5, 0.5, 0.9, 0.9))
    _put_box(client, image_b["id"], first["id"], (0.2, 0.2, 0.4, 0.4))
    return first, second, image_a, image_b


def test_export_yolo(client, project_id, imported_images):
    _prepare(client, project_id, imported_images)
    response = client.get(
        f"/api/projects/{project_id}/export",
        params={"format": "yolo", "scope": "annotated", "include_images": "true"},
    )
    archive = _zip(response)
    names = archive.namelist()
    assert "data.yaml" in names
    assert "classes.txt" in names
    assert "manifest.json" in names
    assert "README.txt" in names
    assert "images/sample_0.png" in names
    assert "labels/sample_0.txt" in names

    data = yaml.safe_load(archive.read("data.yaml").decode("utf-8"))
    assert data["nc"] == 2
    assert data["names"] == ["类别一", "类别二"]

    first_label = archive.read("labels/sample_0.txt").decode("utf-8")
    assert "0 0.350000 0.500000 0.500000 0.600000" in first_label
    assert len(first_label.strip().splitlines()) == 2

    manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
    assert manifest["format"] == "yolo"
    assert manifest["image_count"] == 2
    assert manifest["annotation_count"] == 3
    assert manifest["skipped_missing"] == []


def test_export_coco(client, project_id, imported_images):
    _prepare(client, project_id, imported_images)
    response = client.get(
        f"/api/projects/{project_id}/export",
        params={"format": "coco", "scope": "annotated", "include_images": "false"},
    )
    archive = _zip(response)
    assert "annotations.json" in archive.namelist()
    assert not any(name.startswith("images/") for name in archive.namelist())

    coco = json.loads(archive.read("annotations.json").decode("utf-8"))
    assert len(coco["images"]) == 2
    assert len(coco["annotations"]) == 3
    assert [item["name"] for item in coco["categories"]] == ["类别一", "类别二"]
    first_annotation = coco["annotations"][0]
    assert first_annotation["bbox"] == [12.0, 16.0, 60.0, 48.0]
    assert first_annotation["area"] == 2880.0
    assert first_annotation["iscrowd"] == 0
    assert coco["images"][0]["file_name"] == "sample_0.png"


def test_export_confirmed_only(client, project_id, imported_images):
    _prepare(client, project_id, imported_images)
    image_b = imported_images[1]
    assert client.post(f"/api/images/{image_b['id']}/confirm").status_code == 204

    response = client.get(
        f"/api/projects/{project_id}/export",
        params={"format": "yolo", "scope": "confirmed", "include_images": "true"},
    )
    archive = _zip(response)
    manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
    assert manifest["image_count"] == 1
    assert manifest["annotation_count"] == 1
    assert any(name.startswith("images/") for name in archive.namelist())


def test_export_skips_missing(client, project_id, image_folder):
    client.post(
        f"/api/projects/{project_id}/import",
        json={"folder_path": str(image_folder), "mode": "reference", "recursive": False},
    )
    items = client.get(f"/api/projects/{project_id}/images").json()["items"]
    label_class = client.post(
        f"/api/projects/{project_id}/classes", json={"name": "目标"}
    ).json()
    _put_box(client, items[0]["id"], label_class["id"], (0.1, 0.1, 0.5, 0.5))
    _put_box(client, items[1]["id"], label_class["id"], (0.1, 0.1, 0.5, 0.5))
    Path(items[0]["original_path"]).unlink()

    response = client.get(
        f"/api/projects/{project_id}/export",
        params={"format": "yolo", "scope": "annotated", "include_images": "false"},
    )
    archive = _zip(response)
    manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
    assert manifest["image_count"] == 1
    assert len(manifest["skipped_missing"]) == 1
    assert manifest["skipped_missing"][0]["image_id"] == items[0]["id"]


def test_export_requires_annotations(client, project_id, imported_images):
    response = client.get(
        f"/api/projects/{project_id}/export", params={"format": "yolo"}
    )
    assert response.status_code == 400
    assert "没有可导出" in response.json()["error"]["message"]
