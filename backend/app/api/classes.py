from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, func, select

from app.db import get_session
from app.errors import AppError
from app.models import Annotation, ImageAsset, LabelClass, Project, utcnow
from app.schemas import ClassCreate, ClassRead, ClassReorder, ClassUpdate

router = APIRouter(tags=["classes"])

PALETTE = [
    "#5b8cff",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#a855f7",
    "#06b6d4",
    "#ec4899",
    "#84cc16",
    "#f97316",
    "#14b8a6",
]


def _get_project(session: Session, project_id: int) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise AppError("项目不存在", status_code=404, code="project_not_found")
    return project


def _get_class(session: Session, class_id: int) -> LabelClass:
    label_class = session.get(LabelClass, class_id)
    if label_class is None:
        raise AppError("类别不存在", status_code=404, code="class_not_found")
    return label_class


def _counts(session: Session, project_id: int) -> dict[int, int]:
    rows = session.exec(
        select(Annotation.class_id, func.count())
        .join(LabelClass, LabelClass.id == Annotation.class_id)
        .where(LabelClass.project_id == project_id)
        .group_by(Annotation.class_id)
    ).all()
    return {class_id: count for class_id, count in rows}


def _to_read(label_class: LabelClass, count: int = 0) -> ClassRead:
    return ClassRead(
        id=label_class.id,
        project_id=label_class.project_id,
        name=label_class.name,
        color=label_class.color,
        prompt=label_class.prompt,
        order_index=label_class.order_index,
        annotation_count=count,
    )


def _ensure_unique_name(
    session: Session, project_id: int, name: str, exclude_id: int | None = None
) -> None:
    statement = select(LabelClass).where(
        LabelClass.project_id == project_id, LabelClass.name == name
    )
    existing = session.exec(statement).first()
    if existing is not None and existing.id != exclude_id:
        raise AppError("类别名称已存在", status_code=409, code="duplicate_class_name")


@router.get("/projects/{project_id}/classes", response_model=list[ClassRead])
def list_classes(project_id: int, session: Session = Depends(get_session)) -> list[ClassRead]:
    _get_project(session, project_id)
    classes = session.exec(
        select(LabelClass)
        .where(LabelClass.project_id == project_id)
        .order_by(LabelClass.order_index, LabelClass.id)
    ).all()
    counts = _counts(session, project_id)
    return [_to_read(item, counts.get(item.id, 0)) for item in classes]


@router.post("/projects/{project_id}/classes", response_model=ClassRead, status_code=201)
def create_class(
    project_id: int, payload: ClassCreate, session: Session = Depends(get_session)
) -> ClassRead:
    _get_project(session, project_id)
    name = payload.name.strip()
    if not name:
        raise AppError("类别名称不能为空")
    _ensure_unique_name(session, project_id, name)
    used_colors = {
        row.color
        for row in session.exec(
            select(LabelClass).where(LabelClass.project_id == project_id)
        ).all()
    }
    color = payload.color
    if not color:
        color = next((item for item in PALETTE if item not in used_colors), PALETTE[0])
    max_order = session.exec(
        select(func.max(LabelClass.order_index)).where(LabelClass.project_id == project_id)
    ).one()
    label_class = LabelClass(
        project_id=project_id,
        name=name,
        color=color,
        prompt=payload.prompt.strip(),
        order_index=(max_order if max_order is not None else -1) + 1,
    )
    session.add(label_class)
    session.commit()
    session.refresh(label_class)
    return _to_read(label_class)


@router.patch("/classes/{class_id}", response_model=ClassRead)
def update_class(
    class_id: int, payload: ClassUpdate, session: Session = Depends(get_session)
) -> ClassRead:
    label_class = _get_class(session, class_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        if not name:
            raise AppError("类别名称不能为空")
        _ensure_unique_name(session, label_class.project_id, name, exclude_id=class_id)
        label_class.name = name
    if "color" in data and data["color"]:
        label_class.color = data["color"]
    if "prompt" in data and data["prompt"] is not None:
        label_class.prompt = data["prompt"].strip()
    session.add(label_class)
    session.commit()
    session.refresh(label_class)
    count = session.exec(
        select(func.count()).select_from(Annotation).where(Annotation.class_id == class_id)
    ).one()
    return _to_read(label_class, count)


@router.delete("/classes/{class_id}", status_code=204)
def delete_class(
    class_id: int,
    force: bool = Query(default=False),
    session: Session = Depends(get_session),
) -> None:
    label_class = _get_class(session, class_id)
    annotations = session.exec(
        select(Annotation).where(Annotation.class_id == class_id)
    ).all()
    count = len(annotations)
    if count > 0 and not force:
        raise AppError(
            f"该类别已有 {count} 个标注，删除会同时删除这些标注",
            status_code=409,
            code="class_in_use",
        )
    affected_images = {item.image_id for item in annotations}
    session.delete(label_class)
    session.flush()
    for image_id in affected_images:
        remaining = session.exec(
            select(func.count())
            .select_from(Annotation)
            .where(Annotation.image_id == image_id)
        ).one()
        image = session.get(ImageAsset, image_id)
        if image is not None:
            image.status = "labeled" if remaining > 0 else "unlabeled"
            image.updated_at = utcnow()
            session.add(image)
    session.commit()
    return None


@router.post("/projects/{project_id}/classes/reorder", response_model=list[ClassRead])
def reorder_classes(
    project_id: int, payload: ClassReorder, session: Session = Depends(get_session)
) -> list[ClassRead]:
    _get_project(session, project_id)
    classes = session.exec(
        select(LabelClass).where(LabelClass.project_id == project_id)
    ).all()
    by_id = {item.id: item for item in classes}
    if len(payload.class_ids) != len(classes) or set(payload.class_ids) != set(by_id):
        raise AppError("类别列表不完整或包含其他项目的类别")
    for index, class_id in enumerate(payload.class_ids):
        by_id[class_id].order_index = index
        session.add(by_id[class_id])
    session.commit()
    counts = _counts(session, project_id)
    ordered = [by_id[class_id] for class_id in payload.class_ids]
    return [_to_read(item, counts.get(item.id, 0)) for item in ordered]
