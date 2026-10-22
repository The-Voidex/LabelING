from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse
from sqlmodel import Session
from starlette.background import BackgroundTask

from app.db import get_session
from app.errors import AppError
from app.models import Project
from app.services.export_service import build_export

router = APIRouter(tags=["export"])


@router.get("/projects/{project_id}/export")
def export_project(
    project_id: int,
    request: Request,
    fmt: Literal["yolo", "coco"] = Query(default="yolo", alias="format"),
    scope: Literal["annotated", "confirmed"] = "annotated",
    include_images: bool = True,
    session: Session = Depends(get_session),
) -> FileResponse:
    project = session.get(Project, project_id)
    if project is None:
        raise AppError("项目不存在", status_code=404, code="project_not_found")
    zip_path = build_export(
        session,
        request.app.state.settings,
        project,
        fmt,
        scope,
        include_images,
    )

    def cleanup() -> None:
        zip_path.unlink(missing_ok=True)

    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=f"labeling_{project_id}_{fmt}.zip",
        background=BackgroundTask(cleanup),
    )
