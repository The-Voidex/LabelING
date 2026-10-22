from __future__ import annotations


def test_project_crud(client):
    response = client.post("/api/projects", json={"name": "装甲板检测", "description": "RM 训练集"})
    assert response.status_code == 201
    project = response.json()
    assert project["name"] == "装甲板检测"
    assert project["image_count"] == 0
    assert project["class_count"] == 0
    project_id = project["id"]

    listing = client.get("/api/projects")
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    renamed = client.patch(f"/api/projects/{project_id}", json={"name": "装甲板检测 v2"})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "装甲板检测 v2"

    stats = client.get(f"/api/projects/{project_id}/stats")
    assert stats.status_code == 200
    assert stats.json() == {
        "unlabeled": 0,
        "labeled": 0,
        "confirmed": 0,
        "missing": 0,
        "total": 0,
    }

    deleted = client.delete(f"/api/projects/{project_id}")
    assert deleted.status_code == 204
    assert client.get(f"/api/projects/{project_id}").status_code == 404


def test_project_name_required(client):
    response = client.post("/api/projects", json={"name": ""})
    assert response.status_code == 422
    assert "参数校验失败" in response.json()["error"]["message"]
