from __future__ import annotations

import os
import signal
import subprocess
import sys
import time

from fastapi import APIRouter, BackgroundTasks, Request

from app.errors import AppError

router = APIRouter(tags=["system"])

VERSION = "1.2.0"
_LOCAL_HOSTS = {"127.0.0.1", "::1", "localhost", "testclient"}


def _require_local_client(request: Request) -> None:
    host = request.client.host if request.client else ""
    if host not in _LOCAL_HOSTS:
        raise AppError("仅允许在本机操作", 403, "local_only")


@router.get("/system/status")
def system_status(request: Request) -> dict[str, object]:
    _require_local_client(request)
    settings = request.app.state.settings
    started_at = getattr(request.app.state, "started_at", time.time())
    return {
        "status": "running",
        "version": VERSION,
        "pid": os.getpid(),
        "started_at": started_at,
        "uptime_seconds": max(0, int(time.time() - started_at)),
        "url": f"http://{settings.host}:{settings.port}",
        "data_dir": str(settings.data_dir),
        "host": settings.host,
        "port": settings.port,
    }


@router.post("/system/shutdown", status_code=202)
def shutdown(request: Request, background: BackgroundTasks) -> dict[str, bool]:
    _require_local_client(request)
    server = getattr(request.app.state, "uvicorn_server", None)

    def stop() -> None:
        if server is not None:
            server.should_exit = True
        else:
            os.kill(os.getpid(), signal.SIGINT)

    background.add_task(stop)
    return {"ok": True}


@router.post("/system/open-data-dir")
def open_data_dir(request: Request) -> dict[str, object]:
    _require_local_client(request)
    path = request.app.state.settings.data_dir
    path.mkdir(parents=True, exist_ok=True)
    try:
        if sys.platform == "win32":
            os.startfile(str(path))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(path)])
        else:
            subprocess.Popen(["xdg-open", str(path)])
    except OSError as exc:
        raise AppError("无法打开数据目录", 500, "open_failed", str(exc)) from exc
    return {"ok": True, "path": str(path)}
