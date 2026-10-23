from __future__ import annotations

from pathlib import Path

from app.api import system as system_api


def test_system_status(client):
    response = client.get("/api/system/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "running"
    assert data["url"].startswith("http://127.0.0.1:")
    assert data["pid"] > 0
    assert data["uptime_seconds"] >= 0
    assert data["data_dir"]


def test_system_status_requires_client_header(client):
    client.headers.pop("X-LabelING-Client")
    try:
        response = client.get("/api/system/status")
        assert response.status_code == 403
    finally:
        client.headers.update({"X-LabelING-Client": "web"})


def test_shutdown_requests_server_exit(client):
    class FakeServer:
        should_exit = False

    server = FakeServer()
    client.app.state.uvicorn_server = server
    response = client.post("/api/system/shutdown")
    assert response.status_code == 202
    assert response.json() == {"ok": True}
    assert server.should_exit is True


def test_open_data_dir_uses_native_opener(client, monkeypatch):
    opened: list[str] = []
    monkeypatch.setattr(
        system_api.os,
        "startfile",
        lambda path: opened.append(path),
        raising=False,
    )
    monkeypatch.setattr(
        system_api.subprocess,
        "Popen",
        lambda args, **kwargs: opened.append(str(args[1])),
    )

    response = client.post("/api/system/open-data-dir")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert Path(data["path"]).is_dir()
    assert opened == [data["path"]]
