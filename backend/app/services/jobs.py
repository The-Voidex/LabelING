from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass

from sqlalchemy.engine import Engine
from sqlmodel import Session, func, select

from app.models import (
    Annotation,
    ImageAsset,
    JobItem,
    LabelClass,
    ModelConfig,
    PrelabelJob,
    Project,
    utcnow,
)
from app.providers.base import ClassSpec, ModelConfigSpec, Provider, ProviderError, normalize_params
from app.providers.registry import get_provider
from app.services.images import image_path

RETRYABLE_KINDS = {"rate_limit", "timeout", "server_error", "network"}


@dataclass
class JobContext:
    job_id: int
    project_id: int
    image_ids: list[int]
    class_ids: list[int] | None
    class_specs: list[ClassSpec]
    index_to_class_id: dict[int, int]
    provider: Provider
    config_spec: ModelConfigSpec
    concurrency: int


class PrelabelJobRunner:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine
        self._tasks: dict[int, asyncio.Task] = {}
        self._cancel_events: dict[int, asyncio.Event] = {}

    def start(self, job_id: int) -> None:
        if job_id in self._tasks:
            return
        event = asyncio.Event()
        self._cancel_events[job_id] = event
        task = asyncio.create_task(self._run(job_id, event))
        self._tasks[job_id] = task
        task.add_done_callback(lambda _task: self._cleanup(job_id))

    def _cleanup(self, job_id: int) -> None:
        self._tasks.pop(job_id, None)
        self._cancel_events.pop(job_id, None)

    def cancel(self, job_id: int) -> None:
        event = self._cancel_events.get(job_id)
        if event is not None:
            event.set()
        with Session(self.engine) as session:
            job = session.get(PrelabelJob, job_id)
            if job is None:
                return
            job.cancel_requested = True
            if event is None and job.status in ("queued", "running"):
                job.status = "cancelled"
                job.finished_at = utcnow()
                job.error_summary = "任务已取消"
                for item in session.exec(
                    select(JobItem).where(
                        JobItem.job_id == job_id,
                        JobItem.status.in_(["pending", "running"]),
                    )
                ).all():
                    item.status = "cancelled"
                    item.error_message = "任务已取消"
                    session.add(item)
            session.add(job)
            session.commit()

    def recover_stale_jobs(self) -> None:
        with Session(self.engine) as session:
            stale = session.exec(
                select(PrelabelJob).where(PrelabelJob.status.in_(["queued", "running"]))
            ).all()
            for job in stale:
                job.status = "failed"
                job.error_summary = "服务重启，任务已中断"
                job.finished_at = utcnow()
                session.add(job)
                for item in session.exec(
                    select(JobItem).where(
                        JobItem.job_id == job.id,
                        JobItem.status.in_(["pending", "running"]),
                    )
                ).all():
                    item.status = "failed"
                    item.error_message = "服务重启，任务已中断"
                    session.add(item)
            session.commit()

    async def shutdown(self) -> None:
        for event in self._cancel_events.values():
            event.set()
        tasks = list(self._tasks.values())
        if not tasks:
            return
        _done, pending = await asyncio.wait(tasks, timeout=5)
        for task in pending:
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)

    def _load_context(self, job_id: int) -> JobContext:
        with Session(self.engine) as session:
            job = session.get(PrelabelJob, job_id)
            if job is None:
                raise RuntimeError("任务不存在")
            project = session.get(Project, job.project_id)
            if project is None:
                raise RuntimeError("项目不存在")
            if project.model_config_id is None:
                raise RuntimeError("项目未选择模型配置")
            config = session.get(ModelConfig, project.model_config_id)
            if config is None:
                raise RuntimeError("项目选择的模型配置不存在")
            classes = session.exec(
                select(LabelClass)
                .where(LabelClass.project_id == job.project_id)
                .order_by(LabelClass.order_index, LabelClass.id)
            ).all()
            if job.class_ids is not None:
                wanted = set(job.class_ids)
                classes = [item for item in classes if item.id in wanted]
            if not classes:
                raise RuntimeError("没有可用的类别")
            class_specs = [
                ClassSpec(index=index, name=item.name, prompt=item.prompt)
                for index, item in enumerate(classes)
            ]
            index_to_class_id = {index: item.id for index, item in enumerate(classes)}
            provider = get_provider(config.provider_type)
            config_spec = ModelConfigSpec(
                provider_type=config.provider_type,
                base_url=config.base_url,
                api_key=config.api_key,
                model_name=config.model_name,
                params=normalize_params(config.params),
            )
            return JobContext(
                job_id=job.id,
                project_id=job.project_id,
                image_ids=list(job.image_ids),
                class_ids=job.class_ids,
                class_specs=class_specs,
                index_to_class_id=index_to_class_id,
                provider=provider,
                config_spec=config_spec,
                concurrency=max(1, int(config_spec.params.get("concurrency", 2))),
            )

    async def _run(self, job_id: int, cancel_event: asyncio.Event) -> None:
        try:
            context = self._load_context(job_id)
        except Exception as exc:
            self._fail_job_start(job_id, str(exc))
            return

        with Session(self.engine) as session:
            job = session.get(PrelabelJob, job_id)
            if job is None or job.status not in ("queued", "running"):
                return
            job.status = "running"
            job.started_at = utcnow()
            session.add(job)
            session.commit()

        queue: asyncio.Queue[int] = asyncio.Queue()
        for image_id in dict.fromkeys(context.image_ids):
            queue.put_nowait(image_id)

        async def worker() -> None:
            while not cancel_event.is_set():
                try:
                    image_id = queue.get_nowait()
                except asyncio.QueueEmpty:
                    return
                try:
                    await self._process_image(context, image_id, cancel_event)
                except Exception as exc:  # pragma: no cover - 防御意外写入异常
                    self._record_failure(
                        context.job_id, image_id, f"处理图片时发生异常：{exc}"
                    )

        worker_count = max(1, min(context.concurrency, len(context.image_ids)))
        await asyncio.gather(*(worker() for _ in range(worker_count)))
        self._finalize_job(job_id, cancel_event.is_set())

    def _fail_job_start(self, job_id: int, message: str) -> None:
        with Session(self.engine) as session:
            job = session.get(PrelabelJob, job_id)
            if job is None:
                return
            job.status = "failed"
            job.error_summary = message
            job.finished_at = utcnow()
            session.add(job)
            for item in session.exec(
                select(JobItem).where(
                    JobItem.job_id == job_id,
                    JobItem.status.in_(["pending", "running"]),
                )
            ).all():
                item.status = "failed"
                item.error_message = message
                session.add(item)
            session.commit()

    async def _process_image(
        self, context: JobContext, image_id: int, cancel_event: asyncio.Event
    ) -> None:
        self._set_item_running(context.job_id, image_id)
        with Session(self.engine) as session:
            image = session.get(ImageAsset, image_id)
            if image is None or image.project_id != context.project_id:
                self._record_failure(context.job_id, image_id, "图片不存在或不属于该项目")
                return
            source = image_path(image)
            if not source.exists():
                image.missing = True
                image.updated_at = utcnow()
                session.add(image)
                session.commit()
                self._record_failure(context.job_id, image_id, "图片文件缺失，已标记为缺失")
                return
            try:
                image_bytes = source.read_bytes()
            except OSError as exc:
                self._record_failure(context.job_id, image_id, f"无法读取图片：{exc}")
                return

        started = time.perf_counter()
        attempt = 0
        result = None
        while True:
            try:
                result = await context.provider.detect(
                    image_bytes, context.class_specs, context.config_spec
                )
                break
            except ProviderError as exc:
                if (
                    exc.kind in RETRYABLE_KINDS
                    and attempt < 2
                    and not cancel_event.is_set()
                ):
                    attempt += 1
                    await asyncio.sleep(1.0 if attempt == 1 else 3.0)
                    continue
                latency = int((time.perf_counter() - started) * 1000)
                self._record_failure(
                    context.job_id, image_id, exc.message, exc.raw, latency
                )
                return
            except Exception as exc:  # pragma: no cover - 防御未知异常
                latency = int((time.perf_counter() - started) * 1000)
                self._record_failure(
                    context.job_id, image_id, f"模型调用异常：{exc}", "", latency
                )
                return

        latency = int((time.perf_counter() - started) * 1000)
        if cancel_event.is_set():
            self._set_item_status(context.job_id, image_id, "cancelled", "任务已取消", latency)
            return
        try:
            self._apply_success(context, image_id, result, latency)
        except Exception as exc:  # pragma: no cover - 防御意外写入异常
            self._record_failure(
                context.job_id, image_id, f"写入预标注结果失败：{exc}", "", latency
            )

    def _set_item_running(self, job_id: int, image_id: int) -> None:
        with Session(self.engine) as session:
            item = session.exec(
                select(JobItem).where(JobItem.job_id == job_id, JobItem.image_id == image_id)
            ).first()
            if item is not None:
                item.status = "running"
                session.add(item)
                session.commit()

    def _set_item_status(
        self,
        job_id: int,
        image_id: int,
        status: str,
        message: str = "",
        latency: int | None = None,
    ) -> None:
        with Session(self.engine) as session:
            item = session.exec(
                select(JobItem).where(JobItem.job_id == job_id, JobItem.image_id == image_id)
            ).first()
            if item is not None:
                item.status = status
                item.error_message = message
                item.latency_ms = latency
                session.add(item)
                session.commit()

    def _record_failure(
        self,
        job_id: int,
        image_id: int,
        message: str,
        raw: str = "",
        latency: int | None = None,
    ) -> None:
        with Session(self.engine) as session:
            item = session.exec(
                select(JobItem).where(JobItem.job_id == job_id, JobItem.image_id == image_id)
            ).first()
            if item is not None:
                item.status = "failed"
                item.error_message = message
                item.raw_excerpt = (raw or "")[:2000]
                item.latency_ms = latency
                session.add(item)
            job = session.get(PrelabelJob, job_id)
            if job is not None:
                job.processed += 1
                job.failed += 1
                session.add(job)
            session.commit()

    def _apply_success(self, context: JobContext, image_id: int, result, latency: int) -> None:
        with Session(self.engine) as session:
            image = session.get(ImageAsset, image_id)
            if image is None:
                self._record_failure(context.job_id, image_id, "图片不存在")
                return
            query = select(Annotation).where(
                Annotation.image_id == image_id, Annotation.source == "ai"
            )
            if context.class_ids is not None:
                query = query.where(Annotation.class_id.in_(context.class_ids))
            old_ai = session.exec(query).all()
            changed = bool(old_ai)
            for annotation in old_ai:
                session.delete(annotation)
            for detection in result.detections:
                class_id = context.index_to_class_id.get(detection.class_index)
                if class_id is None:
                    continue
                session.add(
                    Annotation(
                        image_id=image_id,
                        class_id=class_id,
                        x1=detection.x1,
                        y1=detection.y1,
                        x2=detection.x2,
                        y2=detection.y2,
                        source="ai",
                        confidence=detection.confidence,
                    )
                )
                changed = True
            session.flush()
            remaining = session.exec(
                select(func.count()).select_from(Annotation).where(Annotation.image_id == image_id)
            ).one()
            if changed or image.status != "confirmed":
                image.status = "labeled" if remaining else "unlabeled"
                image.updated_at = utcnow()
                session.add(image)

            item = session.exec(
                select(JobItem).where(
                    JobItem.job_id == context.job_id, JobItem.image_id == image_id
                )
            ).first()
            if item is not None:
                item.status = "succeeded"
                item.latency_ms = latency
                session.add(item)
            job = session.get(PrelabelJob, context.job_id)
            if job is not None:
                job.processed += 1
                job.succeeded += 1
                job.prompt_tokens += int(result.prompt_tokens or 0)
                job.completion_tokens += int(result.completion_tokens or 0)
                session.add(job)
            session.commit()

    def _finalize_job(self, job_id: int, cancelled: bool) -> None:
        with Session(self.engine) as session:
            job = session.get(PrelabelJob, job_id)
            if job is None:
                return
            if cancelled or job.cancel_requested:
                job.status = "cancelled"
                job.error_summary = "任务已取消"
                for item in session.exec(
                    select(JobItem).where(
                        JobItem.job_id == job_id,
                        JobItem.status.in_(["pending", "running"]),
                    )
                ).all():
                    item.status = "cancelled"
                    item.error_message = "任务已取消"
                    session.add(item)
            elif job.succeeded == 0 and job.failed > 0:
                job.status = "failed"
                job.error_summary = "全部图片处理失败"
            else:
                job.status = "completed"
                if job.failed:
                    job.error_summary = f"{job.failed} 张图片处理失败"
            job.finished_at = utcnow()
            session.add(job)
            session.commit()
