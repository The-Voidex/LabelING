from __future__ import annotations


def _create_project(client, name: str = "测试项目") -> int:
    response = client.post("/api/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()["id"]


def test_delete_class_with_annotations_requires_force(
    client, project_id, label_class_id, imported_images
):
    image = imported_images[0]
    client.put(
        f"/api/images/{image['id']}/annotations",
        json={
            "annotations": [
                {"class_id": label_class_id, "x1": 0.1, "y1": 0.1, "x2": 0.5, "y2": 0.5}
            ]
        },
    )
    blocked = client.delete(f"/api/classes/{label_class_id}")
    assert blocked.status_code == 409

    forced = client.delete(f"/api/classes/{label_class_id}", params={"force": "true"})
    assert forced.status_code == 204
    assert client.get(f"/api/images/{image['id']}/annotations").json() == []
    assert client.get(f"/api/images/{image['id']}").json()["status"] == "unlabeled"

    project_id = _create_project(client)
    first = client.post(
        f"/api/projects/{project_id}/classes",
        json={"name": "装甲板", "prompt": "带 LED 灯条的矩形装甲板"},
    )
    assert first.status_code == 201
    assert first.json()["color"].startswith("#")
    assert first.json()["order_index"] == 0

    second = client.post(
        f"/api/projects/{project_id}/classes", json={"name": "能量机关", "prompt": ""}
    )
    assert second.status_code == 201
    assert second.json()["order_index"] == 1

    duplicate = client.post(f"/api/projects/{project_id}/classes", json={"name": "装甲板"})
    assert duplicate.status_code == 409

    classes = client.get(f"/api/projects/{project_id}/classes").json()
    assert [item["name"] for item in classes] == ["装甲板", "能量机关"]

    reordered = client.post(
        f"/api/projects/{project_id}/classes/reorder",
        json={"class_ids": [second.json()["id"], first.json()["id"]]},
    )
    assert reordered.status_code == 200
    assert [item["name"] for item in reordered.json()] == ["能量机关", "装甲板"]

    updated = client.patch(
        f"/api/classes/{first.json()['id']}",
        json={"name": "装甲板 2", "color": "#ff0000", "prompt": "新的描述"},
    )
    assert updated.status_code == 200
    assert updated.json()["color"] == "#ff0000"
    assert updated.json()["prompt"] == "新的描述"

    deleted = client.delete(f"/api/classes/{second.json()['id']}")
    assert deleted.status_code == 204
