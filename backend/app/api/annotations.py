from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.db import get_session
from app.errors import AppError
from app.models import Annotation, ImageAsset, LabelClass, Project, utcnow
from app.schemas import (
    AnnotationRead,
    AnnotationsPut,
    BatchConfirmResult,
    BatchRequest,
    BatchUnconfirmResult,
)

router = APIRouter(tags=["annotations"])

EPSILON = 1e-6


def _get_image(session: Session, image_id: int) -> ImageAsset:
    image = session.get(ImageAsset, image_id)
    if image is None:
        raise AppError("图片不存在", status_code=404, code="image_not_found")
    return image


def _normalize_box(x1: float, y1: float, x2: float, y2: float) -> tuple[float, float, float, float]:
    if x1 > x2:
        x1, x2 = x2, x1
    if y1 > y2:
        y1, y2 = y2, y1
    x1 = min(1.0, max(0.0, x1))
    y1 = min(1.0, max(0.0, y1))
    x2 = min(1.0, max(0.0, x2))
    y2 = min(1.0, max(0.0, y2))
    if x2 - x1 <= EPSILON or y2 - y1 <= EPSILON:
        raise AppError("标注框坐标无效，宽高必须大于 0", code="invalid_box")
    return x1, y1, x2, y2


def _same_geometry(old: Annotation, new) -> bool:
    return (
        old.class_id == new.class_id
        and abs(old.x1 - new.x1) < EPSILON
        and abs(old.y1 - new.y1) < EPSILON
        and abs(old.x2 - new.x2) < EPSILON
        and abs(old.y2 - new.y2) < EPSILON
    )


def apply_annotations(
    session: Session, image: ImageAsset, payload: AnnotationsPut
) -> list[Annotation]:
    if image.missing:
        raise AppError("图片文件缺失，无法保存标注", code="image_missing")

    project_classes = {
        item.id
        for item in session.exec(
            select(LabelClass).where(LabelClass.project_id == image.project_id)
        ).all()
    }
    old_annotations = session.exec(
        select(Annotation).where(Annotation.image_id == image.id).order_by(Annotation.id)
    ).all()
    old_by_id = {item.id: item for item in old_annotations}
    keep_ids: set[int] = set()
    changed = False

    for incoming in payload.annotations:
        if incoming.class_id not in project_classes:
            raise AppError("标注使用了不存在的类别", code="invalid_class")
        normalized = _normalize_box(incoming.x1, incoming.y1, incoming.x2, incoming.y2)
        incoming.x1, incoming.y1, incoming.x2, incoming.y2 = normalized

        if incoming.id is not None:
            old = old_by_id.get(incoming.id)
            if old is None:
                raise AppError("标注不存在或不属于该图片", code="invalid_annotation_id")
            keep_ids.add(incoming.id)
            if _same_geometry(old, incoming):
                old.updated_at = utcnow()
                session.add(old)
            else:
                changed = True
                old.class_id = incoming.class_id
                old.x1, old.y1, old.x2, old.y2 = normalized
                old.source = "human"
                old.confidence = None
                old.updated_at = utcnow()
                session.add(old)
        else:
            changed = True
            session.add(
                Annotation(
                    image_id=image.id,
                    class_id=incoming.class_id,
                    x1=incoming.x1,
                    y1=incoming.y1,
                    x2=incoming.x2,
                    y2=incoming.y2,
                    source="human",
                    confidence=None,
                )
            )

    for old in old_annotations:
        if old.id not in keep_ids:
            changed = True
            session.delete(old)

    remaining = len(keep_ids) + sum(1 for item in payload.annotations if item.id is None)
    if changed:
        image.status = "labeled" if remaining > 0 else "unlabeled"
    elif image.status == "confirmed" and remaining == 0:
        image.status = "unlabeled"
    elif image.status != "confirmed":
        image.status = "labeled" if remaining > 0 else "unlabeled"
    image.updated_at = utcnow()
    session.add(image)
    session.commit()
    return session.exec(
        select(Annotation).where(Annotation.image_id == image.id).order_by(Annotation.id)
    ).all()


def confirm_image(session: Session, image: ImageAsset) -> bool:
    if image.missing:
        return False
    annotations = session.exec(
        select(Annotation).where(Annotation.image_id == image.id)
    ).all()
    if not annotations:
        return False
    for item in annotations:
        item.source = "human"
        item.updated_at = utcnow()
        session.add(item)
    image.status = "confirmed"
    image.updated_at = utcnow()
    session.add(image)
    session.commit()
    return True


@router.get("/images/{image_id}/annotations", response_model=list[AnnotationRead])
def list_annotations(
    image_id: int, session: Session = Depends(get_session)
) -> list[Annotation]:
    _get_image(session, image_id)
    return session.exec(
        select(Annotation).where(Annotation.image_id == image_id).order_by(Annotation.id)
    ).all()


@router.put("/images/{image_id}/annotations", response_model=list[AnnotationRead])
def put_annotations(
    image_id: int,
    payload: AnnotationsPut,
    session: Session = Depends(get_session),
) -> list[Annotation]:
    image = _get_image(session, image_id)
    return apply_annotations(session, image, payload)


@router.post("/images/{image_id}/confirm", status_code=204)
def confirm(image_id: int, session: Session = Depends(get_session)) -> None:
    image = _get_image(session, image_id)
    if image.missing:
        raise AppError("图片文件缺失，无法确认", code="image_missing")
    if not confirm_image(session, image):
        raise AppError("没有可确认的标注", code="no_annotations")


@router.post("/images/{image_id}/unconfirm", status_code=204)
def unconfirm(image_id: int, session: Session = Depends(get_session)) -> None:
    image = _get_image(session, image_id)
    count = len(
        session.exec(select(Annotation).where(Annotation.image_id == image.id)).all()
    )
    if count == 0:
        raise AppError("该图片没有标注，无法撤销确认", code="no_annotations")
    image.status = "labeled"
    image.updated_at = utcnow()
    session.add(image)
    session.commit()


@router.post("/projects/{project_id}/images/batch-confirm", response_model=BatchConfirmResult)
def batch_confirm(
    project_id: int,
    payload: BatchRequest,
    session: Session = Depends(get_session),
) -> BatchConfirmResult:
    if session.get(Project, project_id) is None:
        raise AppError("项目不存在", status_code=404, code="project_not_found")
    confirmed = 0
    skipped = 0
    for image_id in payload.image_ids:
        image = session.get(ImageAsset, image_id)
        if image is None or image.project_id != project_id:
            skipped += 1
            continue
        if confirm_image(session, image):
            confirmed += 1
        else:
            skipped += 1
    return BatchConfirmResult(confirmed=confirmed, skipped=skipped)


@router.post("/projects/{project_id}/images/batch-unconfirm", response_model=BatchUnconfirmResult)
def batch_unconfirm(
    project_id: int,
    payload: BatchRequest,
    session: Session = Depends(get_session),
) -> BatchUnconfirmResult:
    if session.get(Project, project_id) is None:
        raise AppError("项目不存在", status_code=404, code="project_not_found")
    unconfirmed = 0
    skipped = 0
    for image_id in payload.image_ids:
        image = session.get(ImageAsset, image_id)
        if image is None or image.project_id != project_id:
            skipped += 1
            continue
        count = len(
            session.exec(select(Annotation).where(Annotation.image_id == image.id)).all()
        )
        if count == 0:
            skipped += 1
            continue
        image.status = "labeled"
        image.updated_at = utcnow()
        session.add(image)
        session.commit()
        unconfirmed += 1
    return BatchUnconfirmResult(unconfirmed=unconfirmed, skipped=skipped)
