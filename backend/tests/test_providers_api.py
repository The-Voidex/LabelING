from __future__ import annotations


def test_mock_config_crud_and_test(client):
    created = client.post(
        "/api/model-configs",
        json={"name": "模拟模型", "provider_type": "mock"},
    )
    assert created.status_code == 201
    config = created.json()
    assert config["api_key_masked"] == ""
    assert config["has_api_key"] is False
    assert config["params"]["concurrency"] == 2

    tested = client.post(f"/api/model-configs/{config['id']}/test")
    assert tested.status_code == 200
    assert tested.json()["ok"] is True

    updated = client.patch(
        f"/api/model-configs/{config['id']}", json={"name": "模拟模型 2"}
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "模拟模型 2"

    deleted = client.delete(f"/api/model-configs/{config['id']}")
    assert deleted.status_code == 204


def test_api_key_is_masked_and_preserved(client):
    created = client.post(
        "/api/model-configs",
        json={
            "name": "千问",
            "provider_type": "openai_compat",
            "base_url": "https://example.com/compatible-mode/v1",
            "api_key": "sk-1234567890abcdef",
            "model_name": "qwen-vl-max",
        },
    )
    assert created.status_code == 201
    config = created.json()
    assert config["api_key_masked"] == "sk-****cdef"
    assert config["has_api_key"] is True

    renamed = client.patch(f"/api/model-configs/{config['id']}", json={"name": "千问 VL"})
    assert renamed.json()["api_key_masked"] == "sk-****cdef"

    empty_key = client.patch(f"/api/model-configs/{config['id']}", json={"api_key": ""})
    assert empty_key.json()["has_api_key"] is True


def test_openai_config_requires_base_url(client):
    response = client.post(
        "/api/model-configs",
        json={"name": "不完整", "provider_type": "openai_compat", "model_name": "qwen"},
    )
    assert response.status_code == 400
    assert "接口地址" in response.json()["error"]["message"]


def test_delete_config_in_use(client):
    config = client.post(
        "/api/model-configs", json={"name": "模拟", "provider_type": "mock"}
    ).json()
    project = client.post("/api/projects", json={"name": "项目"}).json()
    client.patch(
        f"/api/projects/{project['id']}", json={"model_config_id": config["id"]}
    )
    response = client.delete(f"/api/model-configs/{config['id']}")
    assert response.status_code == 409
    assert "项目" in response.json()["error"]["message"]


def test_draft_test(client):
    response = client.post(
        "/api/model-configs/test-draft",
        json={"name": "草稿", "provider_type": "mock"},
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert response.json()["parsed_count"] == 1


def test_draft_test_uses_saved_key_when_blank(client, monkeypatch):
    captured: dict[str, str] = {}

    async def fake_test(self, spec):
        from app.providers.base import TestResult

        captured["key"] = spec.api_key
        return TestResult(ok=True, message="ok")

    monkeypatch.setattr(
        "app.providers.openai_compat.OpenAICompatProvider.test", fake_test
    )
    created = client.post(
        "/api/model-configs",
        json={
            "name": "已保存",
            "provider_type": "openai_compat",
            "base_url": "https://example.com/v1",
            "api_key": "sk-saved-key",
            "model_name": "vision-model",
        },
    )
    assert created.status_code == 201
    response = client.post(
        "/api/model-configs/test-draft",
        json={
            "name": "已保存",
            "provider_type": "openai_compat",
            "base_url": "https://example.com/v1",
            "api_key": "",
            "model_name": "vision-model",
            "config_id": created.json()["id"],
        },
    )
    assert response.status_code == 200
    assert captured["key"] == "sk-saved-key"


def test_discover_models_with_mock_provider(client):
    response = client.post(
        "/api/model-configs/discover-models",
        json={"provider_type": "mock", "base_url": "mock", "default_model": "mock-vision"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["models"] == ["mock-vision"]
    assert data["recommended"] == "mock-vision"
    assert data["count"] == 1


def test_discover_models_requires_base_url(client):
    response = client.post(
        "/api/model-configs/discover-models",
        json={"provider_type": "openai_compat", "base_url": ""},
    )
    assert response.status_code == 400
    assert "接口地址" in response.json()["error"]["message"]
