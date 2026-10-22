from __future__ import annotations

import mimetypes
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import FileResponse
from PIL import Image, ImageOps
from sqlmodel import Session, func, or_, select

from app.db import get_session, project_image_dir
from app.errors import AppError
from app.models import ImageAsset, Project, utcnow
from app.schemas import (
    BatchDeleteResult,
    BatchRequest,
    ImageNavItem,
    ImagePage,
    ImageRead,
    ImageRelocate,
    ImportPreview,
    ImportRequest,
    ImportResult,
)
from app.services.images import delete_image, image_path
from app.services.importer import _hash_file, _safe_name, import_images, preview_import
from app.services.thumbnails import ensure_thumbnail

router = APIRouter(tags=["images"])


def _get_project(session: Session, project_id: int) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise AppError("项目不存在", status_code=404, code="project_not_found")
    return project


def _get_image(session: Session, image_id: int) -> ImageAsset:
    image = session.get(ImageAsset, image_id)
    if image is None:
        raise AppError("图片不存在", status_code=404, code="image_not_found")
    return image


def _to_read(image: ImageAsset) -> ImageRead:
    return ImageRead(
        id=image.id,
        project_id=image.project_id,
        file_name=Path(image.original_path).name,
        original_path=image.original_path,
        storage_mode=image.storage_mode,
        width=image.width,
        height=image.height,
        status=image.status,
        missing=image.missing,
        sha256=image.sha256,
        thumbnail_url=f"/api/images/{image.id}/thumbnail",
        file_url=f"/api/images/{image.id}/file",
        created_at=image.created_at,
        updated_at=image.updated_at,
    )


@router.get("/projects/{project_id}/images", response_model=ImagePage)
def list_images(
    project_id: int,
    status: str | None = None,
    q: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=60, ge=1, le=200),
    session: Session = Depends(get_session),
) -> ImagePage:
    _get_project(session, project_id)
    conditions = [ImageAsset.project_id == project_id]
    if status == "missing":
        conditions.append(ImageAsset.missing == True)  # noqa: E712
    elif status in {"unlabeled", "labeled", "confirmed"}:
        conditions.append(ImageAsset.status == status)
    if q:
        pattern = f"%{q.strip()}%"
        conditions.append(
            or_(
                ImageAsset.original_path.ilike(pattern),
                ImageAsset.stored_path.ilike(pattern),
            )
        )

    total = session.exec(
        select(func.count()).select_from(ImageAsset).where(*conditions)
    ).one()
    items = session.exec(
        select(ImageAsset)
        .where(*conditions)
        .order_by(ImageAsset.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return ImagePage(
        items=[_to_read(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/projects/{project_id}/images/nav", response_model=list[ImageNavItem])
def image_nav(project_id: int, session: Session = Depends(get_session)) -> list[ImageNavItem]:
    _get_project(session, project_id)
    items = session.exec(
        select(ImageAsset)
        .where(ImageAsset.project_id == project_id)
        .order_by(ImageAsset.id)
    ).all()
    return [
        ImageNavItem(
            id=item.id,
            file_name=Path(item.original_path).name,
            status=item.status,
            missing=item.missing,
            sha256=item.sha256,
        )
        for item in items
    ]


@router.post("/projects/{project_id}/import/preview", response_model=ImportPreview)
def import_preview(
    project_id: int,
    payload: ImportRequest,
    session: Session = Depends(get_session),
) -> ImportPreview:
    _get_project(session, project_id)
    result = preview_import(session, project_id, payload.folder_path, payload.recursive)
    return ImportPreview(**result)


@router.post("/projects/{project_id}/import", response_model=ImportResult)
def import_dataset(
    project_id: int,
    payload: ImportRequest,
    request: Request,
    session: Session = Depends(get_session),
) -> ImportResult:
    _get_project(session, project_id)
    result = import_images(
        session,
        request.app.state.settings,
        project_id,
        payload.folder_path,
        payload.mode,
        payload.recursive,
    )
    return ImportResult(**result)


@router.get("/images/{image_id}", response_model=ImageRead)
def get_image(image_id: int, session: Session = Depends(get_session)) -> ImageRead:
    image = _get_image(session, image_id)
    if not image_path(image).exists():
        if not image.missing:
            image.missing = True
            image.updated_at = utcnow()
            session.add(image)
            session.commit()
            session.refresh(image)
    return _to_read(image)


@router.get("/images/{image_id}/file")
def get_image_file(image_id: int, session: Session = Depends(get_session)) -> FileResponse:
    image = _get_image(session, image_id)
    path = image_path(image)
    if not path.exists():
        if not image.missing:
            image.missing = True
            image.updated_at = utcnow()
            session.add(image)
            session.commit()
        raise AppError("图片文件不存在，可能已被移动或删除", status_code=404, code="file_missing")
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type)


@router.get("/images/{image_id}/thumbnail")
def get_image_thumbnail(
    image_id: int, request: Request, session: Session = Depends(get_session)
) -> FileResponse:
    image = _get_image(session, image_id)
    try:
        target = ensure_thumbnail(request.app.state.settings, image)
    except FileNotFoundError:
        if not image.missing:
            image.missing = True
            image.updated_at = utcnow()
            session.add(image)
            session.commit()
        raise AppError("图片文件不存在，可能已被移动或删除", status_code=404, code="file_missing")
    except Exception:
        raise AppError("缩略图生成失败，图片可能已损坏", status_code=422, code="thumbnail_failed")
    return FileResponse(
        target,
        media_type="image/webp",
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.patch("/images/{image_id}", response_model=ImageRead)
def relocate_image(
    image_id: int,
    payload: ImageRelocate,
    request: Request,
    session: Session = Depends(get_session),
) -> ImageRead:
    image = _get_image(session, image_id)
    source = Path(payload.path).expanduser()
    if not source.exists() or not source.is_file():
        raise AppError("新路径不存在或不是文件", code="file_not_found")
    try:
        with Image.open(source) as raw:
            width, height = ImageOps.exif_transpose(raw).size
        sha256 = _hash_file(source)
    except Exception:
        raise AppError("该文件不是有效的图片", code="invalid_image")

    if image.storage_mode == "copy":
        target_dir = project_image_dir(request.app.state.settings, image.project_id)
        target_dir.mkdir(parents=True, exist_ok=True)
        old_path = Path(image.stored_path) if image.stored_path else None
        if old_path is not None and old_path.resolve() == source.resolve():
            new_path = old_path
        else:
            new_path = target_dir / f"{uuid.uuid4().hex[:8]}_{_safe_name(source.name)}"
            shutil.copy2(source, new_path)
            if old_path is not None and old_path.exists():
                old_path.unlink(missing_ok=True)
        image.stored_path = str(new_path.resolve())
        image.original_path = str(source.resolve())
    else:
        image.original_path = str(source.resolve())

    image.width = width
    image.height = height
    image.sha256 = sha256
    image.missing = False
    image.updated_at = utcnow()
    session.add(image)
    session.commit()
    session.refresh(image)
    return _to_read(image)


@router.delete("/images/{image_id}", status_code=204)
def remove_image(image_id: int, session: Session = Depends(get_session)) -> Response:
    image = _get_image(session, image_id)
    delete_image(session, image)
    return Response(status_code=204)


@router.post("/projects/{project_id}/images/batch-delete", response_model=BatchDeleteResult)
def batch_delete(
    project_id: int,
    payload: BatchRequest,
    session: Session = Depends(get_session),
) -> BatchDeleteResult:
    _get_project(session, project_id)
    deleted = 0
    for image_id in payload.image_ids:
        image = session.get(ImageAsset, image_id)
        if image is None or image.project_id != project_id:
            continue
        delete_image(session, image)
        deleted += 1
    return BatchDeleteResult(deleted=deleted)
