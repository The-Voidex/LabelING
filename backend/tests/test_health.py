from fastapi.testclient import TestClient


def test_health(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unknown_route_returns_chinese_error(client: TestClient):
    response = client.get("/api/nope")
    assert response.status_code == 404
    assert "不存在" in response.json()["error"]["message"]
