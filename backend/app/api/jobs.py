from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlmodel import Session, select

from app.db import get_session
from app.errors import AppError
from app.models import ImageAsset, JobItem, LabelClass, ModelConfig, PrelabelJob, Project
from app.schemas import JobCreate, JobErrorItem, JobRead

router = APIRouter(tags=["jobs"])


def _get_job(session: Session, job_id: int) -> PrelabelJob:
    job = session.get(PrelabelJob, job_id)
    if job is None:
        raise AppError("预标注任务不存在", status_code=404, code="job_not_found")
    return job


def _job_read(session: Session, job: PrelabelJob, include_errors: bool = True) -> JobRead:
    errors: list[JobErrorItem] = []
    if include_errors:
        items = session.exec(
            select(JobItem)
            .where(JobItem.job_id == job.id, JobItem.status == "failed")
            .order_by(JobItem.id.desc())
            .limit(100)
        ).all()
        errors = [
            JobErrorItem(
                image_id=item.image_id,
                error_message=item.error_message,
                raw_excerpt=item.raw_excerpt,
                latency_ms=item.latency_ms,
            )
            for item in items
        ]
    return JobRead(
        id=job.id,
        project_id=job.project_id,
        status=job.status,
        total=job.total,
        processed=job.processed,
        succeeded=job.succeeded,
        failed=job.failed,
        cancel_requested=job.cancel_requested,
        error_summary=job.error_summary,
        prompt_tokens=job.prompt_tokens,
        completion_tokens=job.completion_tokens,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
        errors=errors,
    )


@router.post("/projects/{project_id}/prelabel-jobs", response_model=JobRead, status_code=201)
async def create_job(
    project_id: int,
    payload: JobCreate,
    request: Request,
    session: Session = Depends(get_session),
) -> JobRead:
    project = session.get(Project, project_id)
    if project is None:
        raise AppError("项目不存在", status_code=404, code="project_not_found")
    if project.model_config_id is None:
        raise AppError(
            "请先在项目设置中选择模型", status_code=400, code="model_not_configured"
        )
    config = session.get(ModelConfig, project.model_config_id)
    if config is None:
        raise AppError("项目选择的模型配置不存在", code="model_config_not_found")

    image_ids = list(dict.fromkeys(payload.image_ids))
    images = session.exec(
        select(ImageAsset).where(
            ImageAsset.project_id == project_id, ImageAsset.id.in_(image_ids)
        )
    ).all()
    if len(images) != len(image_ids):
        raise AppError("部分图片不存在或不属于该项目", code="invalid_images")

    class_ids = payload.class_ids
    if class_ids is not None:
        class_ids = list(dict.fromkeys(class_ids))
        if not class_ids:
            raise AppError("请选择至少一个类别", code="empty_classes")
        classes = session.exec(
            select(LabelClass).where(
                LabelClass.project_id == project_id, LabelClass.id.in_(class_ids)
            )
        ).all()
        if len(classes) != len(class_ids):
            raise AppError("部分类别不存在或不属于该项目", code="invalid_classes")

    job = PrelabelJob(
        project_id=project_id,
        status="queued",
        image_ids=image_ids,
        class_ids=class_ids,
        total=len(image_ids),
    )
    session.add(job)
    session.flush()
    for image_id in image_ids:
        session.add(JobItem(job_id=job.id, image_id=image_id, status="pending"))
    session.commit()
    session.refresh(job)

    request.app.state.runner.start(job.id)
    return _job_read(session, job, include_errors=False)


@router.get("/projects/{project_id}/prelabel-jobs", response_model=list[JobRead])
def list_jobs(project_id: int, session: Session = Depends(get_session)) -> list[JobRead]:
    if session.get(Project, project_id) is None:
        raise AppError("项目不存在", status_code=404, code="project_not_found")
    jobs = session.exec(
        select(PrelabelJob)
        .where(PrelabelJob.project_id == project_id)
        .order_by(PrelabelJob.id.desc())
        .limit(50)
    ).all()
    return [_job_read(session, job, include_errors=False) for job in jobs]


@router.get("/prelabel-jobs/{job_id}", response_model=JobRead)
def get_job(job_id: int, session: Session = Depends(get_session)) -> JobRead:
    return _job_read(session, _get_job(session, job_id))


@router.post("/prelabel-jobs/{job_id}/cancel", response_model=JobRead)
async def cancel_job(
    job_id: int, request: Request, session: Session = Depends(get_session)
) -> JobRead:
    job = _get_job(session, job_id)
    if job.status in ("completed", "failed", "cancelled"):
        return _job_read(session, job)
    request.app.state.runner.cancel(job_id)
    session.expire_all()
    return _job_read(session, _get_job(session, job_id))
