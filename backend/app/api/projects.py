from __future__ import annotations

import shutil

from fastapi import APIRouter, Depends, Request, Response
from sqlmodel import Session, func, select

from app.db import get_session
from app.errors import AppError
from app.models import ImageAsset, LabelClass, ModelConfig, Project, utcnow
from app.schemas import ProjectCreate, ProjectRead, ProjectStats, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


def _project_read(session: Session, project: Project) -> ProjectRead:
    image_count = session.exec(
        select(func.count()).select_from(ImageAsset).where(ImageAsset.project_id == project.id)
    ).one()
    class_count = session.exec(
        select(func.count()).select_from(LabelClass).where(LabelClass.project_id == project.id)
    ).one()
    model_name = None
    if project.model_config_id is not None:
        config = session.get(ModelConfig, project.model_config_id)
        model_name = config.name if config else None
    return ProjectRead(
        id=project.id,
        name=project.name,
        description=project.description,
        model_config_id=project.model_config_id,
        model_name=model_name,
        image_count=image_count,
        class_count=class_count,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def _get_project(session: Session, project_id: int) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise AppError("项目不存在", status_code=404, code="project_not_found")
    return project


@router.get("", response_model=list[ProjectRead])
def list_projects(session: Session = Depends(get_session)) -> list[ProjectRead]:
    projects = session.exec(select(Project).order_by(Project.updated_at.desc())).all()
    return [_project_read(session, project) for project in projects]


@router.post("", response_model=ProjectRead, status_code=201)
def create_project(payload: ProjectCreate, session: Session = Depends(get_session)) -> ProjectRead:
    project = Project(name=payload.name.strip(), description=payload.description.strip())
    session.add(project)
    session.commit()
    session.refresh(project)
    return _project_read(session, project)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, session: Session = Depends(get_session)) -> ProjectRead:
    return _project_read(session, _get_project(session, project_id))


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int, payload: ProjectUpdate, session: Session = Depends(get_session)
) -> ProjectRead:
    project = _get_project(session, project_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        if not name:
            raise AppError("项目名称不能为空")
        project.name = name
    if "description" in data and data["description"] is not None:
        project.description = data["description"].strip()
    if "model_config_id" in data:
        config_id = data["model_config_id"]
        if config_id is not None and session.get(ModelConfig, config_id) is None:
            raise AppError("模型配置不存在", status_code=404, code="model_config_not_found")
        project.model_config_id = config_id
    project.updated_at = utcnow()
    session.add(project)
    session.commit()
    session.refresh(project)
    return _project_read(session, project)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int, request: Request, session: Session = Depends(get_session)
) -> Response:
    project = _get_project(session, project_id)
    session.delete(project)
    session.commit()
    settings = request.app.state.settings
    project_dir = settings.projects_dir / str(project_id)
    if project_dir.exists():
        shutil.rmtree(project_dir, ignore_errors=True)
    return Response(status_code=204)


@router.get("/{project_id}/stats", response_model=ProjectStats)
def project_stats(project_id: int, session: Session = Depends(get_session)) -> ProjectStats:
    _get_project(session, project_id)
    rows = session.exec(
        select(ImageAsset.status, func.count())
        .where(ImageAsset.project_id == project_id)
        .group_by(ImageAsset.status)
    ).all()
    counts = {status: count for status, count in rows}
    missing = session.exec(
        select(func.count())
        .select_from(ImageAsset)
        .where(ImageAsset.project_id == project_id, ImageAsset.missing == True)  # noqa: E712
    ).one()
    return ProjectStats(
        unlabeled=counts.get("unlabeled", 0),
        labeled=counts.get("labeled", 0),
        confirmed=counts.get("confirmed", 0),
        missing=missing,
        total=sum(counts.values()),
    )
