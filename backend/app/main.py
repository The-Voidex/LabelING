from __future__ import annotations

import logging
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import annotations as annotations_api
from app.api import classes as classes_api
from app.api import export as export_api
from app.api import fs as fs_api
from app.api import images as images_api
from app.api import jobs as jobs_api
from app.api import projects as projects_api
from app.api import providers as providers_api
from app.config import Settings
from app.db import create_engine_for, init_db
from app.errors import error_payload, install_error_handlers
from app.services.jobs import PrelabelJobRunner

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

health_router = APIRouter()

CLIENT_HEADER = "X-LabelING-Client"
CLIENT_HEADER_VALUE = "web"
EXEMPT_PATHS = {"/api/health", "/api/docs", "/api/openapi.json"}
EXEMPT_PATTERNS = [
    re.compile(r"^/api/images/\d+/(file|thumbnail)$"),
    re.compile(r"^/api/projects/\d+/export$"),
]


@health_router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _install_frontend(app: FastAPI, settings: Settings) -> None:
    dist = settings.frontend_dist
    index = dist / "index.html"

    if not index.exists():

        @app.get("/", include_in_schema=False)
        def not_built() -> HTMLResponse:
            return HTMLResponse(
                """<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" />
                <title>LabelING</title></head>
                <body style="font-family: sans-serif; background:#0e1014; color:#e9ebf1;
                display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0">
                <div style="text-align:center">
                <h1 style="font-size:20px">LabelING 前端尚未构建</h1>
                <p style="color:#98a0b3">请在 frontend 目录运行 <code>npm run build</code>，
                然后重新启动服务。</p>
                </div></body></html>"""
            )

        return

    assets = dist / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> FileResponse:
        if full_path.startswith("api"):
            raise HTTPException(status_code=404)
        if full_path:
            candidate = (dist / full_path).resolve()
            try:
                candidate.relative_to(dist.resolve())
            except ValueError:
                return FileResponse(index)
            if candidate.is_file():
                return FileResponse(candidate)
        return FileResponse(index)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        runner = PrelabelJobRunner(app.state.engine)
        app.state.runner = runner
        runner.recover_stale_jobs()
        yield
        await runner.shutdown()

    app = FastAPI(
        title="LabelING",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.engine = create_engine_for(settings)
    init_db(app.state.engine)
    install_error_handlers(app)

    app.include_router(health_router, prefix="/api")
    app.include_router(projects_api.router, prefix="/api")
    app.include_router(classes_api.router, prefix="/api")
    app.include_router(fs_api.router, prefix="/api")
    app.include_router(images_api.router, prefix="/api")
    app.include_router(annotations_api.router, prefix="/api")
    app.include_router(providers_api.router, prefix="/api")
    app.include_router(jobs_api.router, prefix="/api")
    app.include_router(export_api.router, prefix="/api")

    @app.middleware("http")
    async def require_client_header(request, call_next):
        path = request.url.path
        if request.method == "OPTIONS":
            return await call_next(request)
        if (
            path.startswith("/api")
            and path not in EXEMPT_PATHS
            and not any(pattern.match(path) for pattern in EXEMPT_PATTERNS)
            and request.headers.get(CLIENT_HEADER) != CLIENT_HEADER_VALUE
        ):
            return JSONResponse(
                status_code=403,
                content=error_payload(
                    "missing_client_header",
                    "缺少客户端标识，请通过 LabelING 界面访问",
                ),
            )
        return await call_next(request)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.dev_origin, "http://127.0.0.1:5173"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    _install_frontend(app, settings)
    return app


app = create_app()
