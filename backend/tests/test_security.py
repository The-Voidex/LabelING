from __future__ import annotations

from pathlib import Path


def test_json_api_requires_client_header(client):
    client.headers.pop("X-LabelING-Client")
    try:
        blocked = client.post("/api/projects", json={"name": "偷偷创建"})
        assert blocked.status_code == 403
        assert "客户端标识" in blocked.json()["error"]["message"]

        health = client.get("/api/health")
        assert health.status_code == 200
    finally:
        client.headers.update({"X-LabelING-Client": "web"})


def test_image_and_export_paths_are_exempt(client, project_id, imported_images):
    image = imported_images[0]
    client.put(
        f"/api/images/{image['id']}/annotations",
        json={
            "annotations": [
                {
                    "class_id": client.post(
                        f"/api/projects/{project_id}/classes", json={"name": "类别"}
                    ).json()["id"],
                    "x1": 0.1,
                    "y1": 0.1,
                    "x2": 0.5,
                    "y2": 0.5,
                }
            ]
        },
    )
    client.headers.pop("X-LabelING-Client")
    try:
        file_response = client.get(f"/api/images/{image['id']}/file")
        assert file_response.status_code == 200
        thumb = client.get(f"/api/images/{image['id']}/thumbnail")
        assert thumb.status_code == 200
        export = client.get(
            f"/api/projects/{project_id}/export",
            params={"format": "yolo", "include_images": "false"},
        )
        assert export.status_code == 200
    finally:
        client.headers.update({"X-LabelING-Client": "web"})


def test_cors_allows_dev_origin(client):
    response = client.options(
        "/api/projects",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-labeling-client",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_static_frontend_serving(settings, client):
    dist = Path(settings.frontend_dist)
    dist.mkdir(parents=True, exist_ok=True)
    (dist / "index.html").write_text("<html><body>LabelING 界面</body></html>", encoding="utf-8")
    assets = dist / "assets"
    assets.mkdir(exist_ok=True)
    (assets / "app.js").write_text("console.log('labeling')", encoding="utf-8")

    from fastapi.testclient import TestClient

    from app.main import create_app

    app = create_app(settings)
    with TestClient(app) as static_client:
        root = static_client.get("/")
        assert root.status_code == 200
        assert "LabelING 界面" in root.text

        spa = static_client.get("/projects/1")
        assert spa.status_code == 200
        assert "LabelING 界面" in spa.text

        asset = static_client.get("/assets/app.js")
        assert asset.status_code == 200

        api_missing = static_client.get(
            "/api/unknown", headers={"X-LabelING-Client": "web"}
        )
        assert api_missing.status_code == 404


def test_frontend_not_built_message(settings, client):
    from fastapi.testclient import TestClient

    from app.main import create_app

    settings.frontend_dist = Path(settings.data_dir) / "missing-dist"
    app = create_app(settings)
    with TestClient(app) as bare_client:
        response = bare_client.get("/")
        assert response.status_code == 200
        assert "前端尚未构建" in response.text
