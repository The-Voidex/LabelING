from __future__ import annotations


def test_preview_and_copy_import(client, project_id, image_folder):
    preview = client.post(
        f"/api/projects/{project_id}/import/preview",
        json={"folder_path": str(image_folder), "mode": "copy", "recursive": False},
    )
    assert preview.status_code == 200
    assert preview.json()["found"] == 5
    assert preview.json()["duplicates"] == 0

    result = client.post(
        f"/api/projects/{project_id}/import",
        json={"folder_path": str(image_folder), "mode": "copy", "recursive": False},
    )
    assert result.status_code == 200
    assert result.json() == {"imported": 5, "skipped_duplicates": 0, "failed": 0}

    page = client.get(f"/api/projects/{project_id}/images").json()
    assert page["total"] == 5
    assert all(item["storage_mode"] == "copy" for item in page["items"])

    again = client.post(
        f"/api/projects/{project_id}/import",
        json={"folder_path": str(image_folder), "mode": "copy", "recursive": False},
    )
    assert again.json()["skipped_duplicates"] == 5


def test_reference_import_keeps_original(client, project_id, image_folder):
    result = client.post(
        f"/api/projects/{project_id}/import",
        json={"folder_path": str(image_folder), "mode": "reference", "recursive": False},
    )
    assert result.json()["imported"] == 5
    page = client.get(f"/api/projects/{project_id}/images").json()
    assert all(item["storage_mode"] == "reference" for item in page["items"])
    assert all(
        item["original_path"].startswith(str(image_folder)) for item in page["items"]
    )


def test_import_rejects_bad_folder(client, project_id):
    response = client.post(
        f"/api/projects/{project_id}/import",
        json={"folder_path": "Z:/不存在的目录", "mode": "copy", "recursive": False},
    )
    assert response.status_code == 400
    assert "不存在" in response.json()["error"]["message"]


def test_fs_list(client, image_folder):
    response = client.get("/api/fs/list", params={"path": str(image_folder)})
    assert response.status_code == 200
    assert response.json()["image_count"] == 5
    assert len(response.json()["images"]) == 5
