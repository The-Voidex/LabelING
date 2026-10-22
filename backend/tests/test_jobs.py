from __future__ import annotations

import time

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.main import create_app
from app.models import JobItem, PrelabelJob


def _create_mock_config(client, delay: float = 0.0) -> int:
    response = client.post(
        "/api/model-configs",
        json={
            "name": "模拟模型",
            "provider_type": "mock",
            "params": {"mock_delay_s": delay},
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def _select_model(client, project_id: int, config_id: int) -> None:
    response = client.patch(
        f"/api/projects/{project_id}", json={"model_config_id": config_id}
    )
    assert response.status_code == 200


def _wait_job(client, job_id: int, timeout: float = 10.0) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        data = client.get(f"/api/prelabel-jobs/{job_id}").json()
        if data["status"] in ("completed", "failed", "cancelled"):
            return data
        time.sleep(0.05)
    raise AssertionError(f"任务未在 {timeout} 秒内完成")


def test_prelabel_job_creates_ai_boxes(client, project_id, label_class_id, imported_images):
    config_id = _create_mock_config(client)
    _select_model(client, project_id, config_id)
    image_ids = [item["id"] for item in imported_images[:3]]

    response = client.post(
        f"/api/projects/{project_id}/prelabel-jobs", json={"image_ids": image_ids}
    )
    assert response.status_code == 201
    job = _wait_job(client, response.json()["id"])
    assert job["status"] == "completed"
    assert job["succeeded"] == 3
    assert job["failed"] == 0

    for image_id in image_ids:
        annotations = client.get(f"/api/images/{image_id}/annotations").json()
        assert len(annotations) == 1
        assert annotations[0]["source"] == "ai"
        assert client.get(f"/api/images/{image_id}").json()["status"] == "labeled"


def test_rerun_replaces_ai_boxes_and_keeps_human(
    client, project_id, label_class_id, imported_images
):
    config_id = _create_mock_config(client)
    _select_model(client, project_id, config_id)
    image = imported_images[0]
    client.put(
        f"/api/images/{image['id']}/annotations",
        json={
            "annotations": [
                {"class_id": label_class_id, "x1": 0.7, "y1": 0.7, "x2": 0.9, "y2": 0.9}
            ]
        },
    )

    for _ in range(2):
        response = client.post(
            f"/api/projects/{project_id}/prelabel-jobs",
            json={"image_ids": [image["id"]]},
        )
        _wait_job(client, response.json()["id"])

    annotations = client.get(f"/api/images/{image['id']}/annotations").json()
    sources = sorted(item["source"] for item in annotations)
    assert sources == ["ai", "human"]
    assert len(annotations) == 2


def test_class_subset_rerun(
    client, project_id, imported_images
):
    first_class = client.post(
        f"/api/projects/{project_id}/classes", json={"name": "类别一"}
    ).json()
    second_class = client.post(
        f"/api/projects/{project_id}/classes", json={"name": "类别二"}
    ).json()
    config_id = _create_mock_config(client)
    _select_model(client, project_id, config_id)
    image = imported_images[0]

    response = client.post(
        f"/api/projects/{project_id}/prelabel-jobs",
        json={"image_ids": [image["id"]]},
    )
    _wait_job(client, response.json()["id"])
    annotations = client.get(f"/api/images/{image['id']}/annotations").json()
    assert len(annotations) == 2

    response = client.post(
        f"/api/projects/{project_id}/prelabel-jobs",
        json={"image_ids": [image["id"]], "class_ids": [first_class["id"]]},
    )
    _wait_job(client, response.json()["id"])
    annotations = client.get(f"/api/images/{image['id']}/annotations").json()
    assert len(annotations) == 2
    assert sorted(item["class_id"] for item in annotations) == sorted(
        [first_class["id"], second_class["id"]]
    )


def test_job_requires_configured_model(client, project_id, imported_images):
    response = client.post(
        f"/api/projects/{project_id}/prelabel-jobs",
        json={"image_ids": [imported_images[0]["id"]]},
    )
    assert response.status_code == 400
    assert "模型" in response.json()["error"]["message"]


def test_cancel_job(client, project_id, label_class_id, imported_images):
    config_id = _create_mock_config(client, delay=0.3)
    _select_model(client, project_id, config_id)
    image_ids = [item["id"] for item in imported_images]

    response = client.post(
        f"/api/projects/{project_id}/prelabel-jobs", json={"image_ids": image_ids}
    )
    job_id = response.json()["id"]
    time.sleep(0.05)
    cancelled = client.post(f"/api/prelabel-jobs/{job_id}/cancel")
    assert cancelled.status_code == 200
    job = _wait_job(client, job_id, timeout=5)
    assert job["status"] == "cancelled"


def test_recover_stale_job(settings, client, project_id, label_class_id, imported_images):
    config_id = _create_mock_config(client)
    _select_model(client, project_id, config_id)
    image_id = imported_images[0]["id"]

    with Session(client.app.state.engine) as session:
        job = PrelabelJob(
            project_id=project_id,
            status="running",
            image_ids=[image_id],
            total=1,
        )
        session.add(job)
        session.flush()
        session.add(JobItem(job_id=job.id, image_id=image_id, status="running"))
        session.commit()
        job_id = job.id

    second_app = create_app(settings)
    with TestClient(second_app) as second_client:
        second_client.headers.update({"X-LabelING-Client": "web"})
        recovered = second_client.get(f"/api/prelabel-jobs/{job_id}").json()
        assert recovered["status"] == "failed"
        assert "服务重启" in recovered["error_summary"]
