from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.main import create_app


@pytest.fixture()
def settings(tmp_path):
    return Settings(data_dir=tmp_path / "data", frontend_dist=tmp_path / "dist")


@pytest.fixture()
def client(settings):
    app = create_app(settings)
    with TestClient(app) as test_client:
        test_client.headers.update({"X-LabelING-Client": "web"})
        yield test_client


@pytest.fixture()
def image_folder(tmp_path):
    folder = tmp_path / "dataset"
    folder.mkdir()
    colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff"]
    for index, color in enumerate(colors):
        Image.new("RGB", (120, 80), color).save(folder / f"sample_{index}.png")
    return folder


@pytest.fixture()
def project_id(client):
    response = client.post("/api/projects", json={"name": "测试项目"})
    assert response.status_code == 201
    return response.json()["id"]


@pytest.fixture()
def label_class_id(client, project_id):
    response = client.post(
        f"/api/projects/{project_id}/classes",
        json={"name": "红色目标", "prompt": "红色的矩形目标"},
    )
    assert response.status_code == 201
    return response.json()["id"]


@pytest.fixture()
def imported_images(client, project_id, image_folder):
    response = client.post(
        f"/api/projects/{project_id}/import",
        json={"folder_path": str(image_folder), "mode": "copy", "recursive": False},
    )
    assert response.status_code == 200
    data = client.get(f"/api/projects/{project_id}/images?page_size=200").json()
    return data["items"]
