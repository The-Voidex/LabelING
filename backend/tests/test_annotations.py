from __future__ import annotations

from pathlib import Path

from PIL import Image
from sqlmodel import Session

from app.models import Annotation, ImageAsset


def _add_ai_box(client, image_id: int, class_id: int) -> int:
    with Session(client.app.state.engine) as session:
        annotation = Annotation(
            image_id=image_id,
            class_id=class_id,
            x1=0.1,
            y1=0.1,
            x2=0.5,
            y2=0.5,
            source="ai",
            confidence=0.9,
        )
        session.add(annotation)
        session.commit()
        session.refresh(annotation)
        return annotation.id


def _image_status(client, image_id: int) -> str:
    return client.get(f"/api/images/{image_id}").json()["status"]


def test_manual_box_becomes_human(client, imported_images, label_class_id):
    image = imported_images[0]
    response = client.put(
        f"/api/images/{image['id']}/annotations",
        json={
            "annotations": [
                {"class_id": label_class_id, "x1": 0.1, "y1": 0.2, "x2": 0.6, "y2": 0.8}
            ]
        },
    )
    assert response.status_code == 200
    annotations = response.json()
    assert len(annotations) == 1
    assert annotations[0]["source"] == "human"
    assert _image_status(client, image["id"]) == "labeled"


def test_unchanged_ai_box_stays_ai(client, imported_images, label_class_id):
    image = imported_images[0]
    ai_id = _add_ai_box(client, image["id"], label_class_id)
    current = client.get(f"/api/images/{image['id']}/annotations").json()
    response = client.put(
        f"/api/images/{image['id']}/annotations",
        json={
            "annotations": [
                {
                    "id": ai_id,
                    "class_id": label_class_id,
                    "x1": 0.1,
                    "y1": 0.1,
                    "x2": 0.5,
                    "y2": 0.5,
                }
            ]
        },
    )
    assert response.status_code == 200
    assert response.json()[0]["source"] == "ai"
    assert len(current) == 1


def test_modified_ai_box_becomes_human(client, imported_images, label_class_id):
    image = imported_images[0]
    ai_id = _add_ai_box(client, image["id"], label_class_id)
    response = client.put(
        f"/api/images/{image['id']}/annotations",
        json={
            "annotations": [
                {
                    "id": ai_id,
                    "class_id": label_class_id,
                    "x1": 0.1,
                    "y1": 0.1,
                    "x2": 0.7,
                    "y2": 0.7,
                }
            ]
        },
    )
    assert response.json()[0]["source"] == "human"
    assert response.json()[0]["confidence"] is None


def test_delete_all_boxes_sets_unlabeled(client, imported_images, label_class_id):
    image = imported_images[0]
    client.put(
        f"/api/images/{image['id']}/annotations",
        json={
            "annotations": [
                {"class_id": label_class_id, "x1": 0.1, "y1": 0.1, "x2": 0.5, "y2": 0.5}
            ]
        },
    )
    response = client.put(f"/api/images/{image['id']}/annotations", json={"annotations": []})
    assert response.json() == []
    assert _image_status(client, image["id"]) == "unlabeled"


def test_confirm_and_reopen(client, imported_images, label_class_id):
    image = imported_images[0]
    ai_id = _add_ai_box(client, image["id"], label_class_id)
    confirm = client.post(f"/api/images/{image['id']}/confirm")
    assert confirm.status_code == 204
    assert _image_status(client, image["id"]) == "confirmed"
    annotations = client.get(f"/api/images/{image['id']}/annotations").json()
    assert annotations[0]["source"] == "human"

    modified = client.put(
        f"/api/images/{image['id']}/annotations",
        json={
            "annotations": [
                {
                    "id": ai_id,
                    "class_id": label_class_id,
                    "x1": 0.2,
                    "y1": 0.2,
                    "x2": 0.6,
                    "y2": 0.6,
                }
            ]
        },
    )
    assert modified.status_code == 200
    assert _image_status(client, image["id"]) == "labeled"

    unconfirm = client.post(f"/api/images/{image['id']}/unconfirm")
    assert unconfirm.status_code == 204
    assert _image_status(client, image["id"]) == "labeled"


def test_confirm_requires_annotations(client, imported_images):
    image = imported_images[0]
    response = client.post(f"/api/images/{image['id']}/confirm")
    assert response.status_code == 400
    assert "没有可确认" in response.json()["error"]["message"]


def test_confirm_rejects_missing_image(client, project_id, image_folder, label_class_id):
    client.post(
        f"/api/projects/{project_id}/import",
        json={"folder_path": str(image_folder), "mode": "reference", "recursive": False},
    )
    items = client.get(f"/api/projects/{project_id}/images").json()["items"]
    image = items[0]
    with Session(client.app.state.engine) as session:
        record = session.get(ImageAsset, image["id"])
        assert record is not None
        session.add(
            Annotation(
                image_id=record.id,
                class_id=label_class_id,
                x1=0.1,
                y1=0.1,
                x2=0.5,
                y2=0.5,
                source="human",
            )
        )
        session.commit()
    Path(image["original_path"]).unlink()
    client.get(f"/api/images/{image['id']}/file")
    response = client.post(f"/api/images/{image['id']}/confirm")
    assert response.status_code == 400
    assert "缺失" in response.json()["error"]["message"]


def test_mixed_ai_and_new_human_boxes(client, imported_images, label_class_id):
    image = imported_images[0]
    first_ai = _add_ai_box(client, image["id"], label_class_id)
    second_ai = _add_ai_box(client, image["id"], label_class_id)
    response = client.put(
        f"/api/images/{image['id']}/annotations",
        json={
            "annotations": [
                {
                    "id": first_ai,
                    "class_id": label_class_id,
                    "x1": 0.1,
                    "y1": 0.1,
                    "x2": 0.5,
                    "y2": 0.5,
                },
                {
                    "class_id": label_class_id,
                    "x1": 0.6,
                    "y1": 0.6,
                    "x2": 0.9,
                    "y2": 0.9,
                },
            ]
        },
    )
    assert response.status_code == 200
    annotations = response.json()
    assert len(annotations) == 2
    sources = {item["id"]: item["source"] for item in annotations}
    assert sources[first_ai] == "ai"
    assert all(item["source"] == "human" for item in annotations if item["id"] != first_ai)
    assert second_ai not in sources


def test_batch_confirm_skips_empty(client, imported_images, label_class_id):
    first, second = imported_images[0], imported_images[1]
    client.put(
        f"/api/images/{first['id']}/annotations",
        json={
            "annotations": [
                {"class_id": label_class_id, "x1": 0.1, "y1": 0.1, "x2": 0.5, "y2": 0.5}
            ]
        },
    )
    response = client.post(
        f"/api/projects/{imported_images[0]['project_id']}/images/batch-confirm",
        json={"image_ids": [first["id"], second["id"]]},
    )
    assert response.status_code == 200
    assert response.json() == {"confirmed": 1, "skipped": 1}
