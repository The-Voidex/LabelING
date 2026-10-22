from __future__ import annotations

from pathlib import Path

from PIL import Image


def test_list_images_and_status_filter(client, project_id, imported_images):
    page = client.get(f"/api/projects/{project_id}/images?status=unlabeled").json()
    assert page["total"] == 5

    confirmed = client.get(f"/api/projects/{project_id}/images?status=confirmed").json()
    assert confirmed["total"] == 0

    searched = client.get(f"/api/projects/{project_id}/images?q=sample_1").json()
    assert searched["total"] == 1

    nav = client.get(f"/api/projects/{project_id}/images/nav").json()
    assert len(nav) == 5
    assert nav[0]["file_name"] == "sample_0.png"
    assert nav[0]["status"] == "unlabeled"


def test_file_and_thumbnail(client, imported_images):
    image = imported_images[0]
    file_response = client.get(f"/api/images/{image['id']}/file")
    assert file_response.status_code == 200
    assert file_response.headers["content-type"].startswith("image/")

    thumb = client.get(f"/api/images/{image['id']}/thumbnail")
    assert thumb.status_code == 200
    assert thumb.headers["content-type"] == "image/webp"
    assert thumb.content[:4] == b"RIFF"


def test_missing_file_marks_image(client, project_id, image_folder):
    result = client.post(
        f"/api/projects/{project_id}/import",
        json={"folder_path": str(image_folder), "mode": "reference", "recursive": False},
    )
    assert result.json()["imported"] == 5
    items = client.get(f"/api/projects/{project_id}/images").json()["items"]
    image = items[0]
    Path(image["original_path"]).unlink()

    file_response = client.get(f"/api/images/{image['id']}/file")
    assert file_response.status_code == 404
    detail = client.get(f"/api/images/{image['id']}").json()
    assert detail["missing"] is True

    replacement = Path(image_folder) / "replacement.png"
    Image.new("RGB", (64, 64), "#123456").save(replacement)
    relocated = client.patch(
        f"/api/images/{image['id']}", json={"path": str(replacement)}
    )
    assert relocated.status_code == 200
    assert relocated.json()["missing"] is False
    assert relocated.json()["width"] == 64


def test_batch_delete(client, project_id, imported_images):
    ids = [item["id"] for item in imported_images[:2]]
    response = client.post(
        f"/api/projects/{project_id}/images/batch-delete", json={"image_ids": ids}
    )
    assert response.status_code == 200
    assert response.json()["deleted"] == 2
    remaining = client.get(f"/api/projects/{project_id}/images").json()
    assert remaining["total"] == 3
