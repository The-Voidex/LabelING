from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Column, ForeignKey, Integer, Text, UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=200, index=True)
    description: str = Field(default="", sa_column=Column(Text, nullable=False, default=""))
    model_config_id: int | None = Field(
        default=None,
        sa_column=Column(
            Integer,
            ForeignKey("model_configs.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class LabelClass(SQLModel, table=True):
    __tablename__ = "classes"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_classes_project_name"),)

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    name: str = Field(max_length=200)
    color: str = Field(default="#5b8cff", max_length=32)
    prompt: str = Field(default="", sa_column=Column(Text, nullable=False, default=""))
    order_index: int = Field(default=0)
    created_at: datetime = Field(default_factory=utcnow)


class ImageAsset(SQLModel, table=True):
    __tablename__ = "images"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    storage_mode: str = Field(default="copy", max_length=16)
    stored_path: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    original_path: str = Field(sa_column=Column(Text, nullable=False))
    sha256: str = Field(max_length=64, index=True)
    width: int = Field(default=0)
    height: int = Field(default=0)
    status: str = Field(default="unlabeled", max_length=16, index=True)
    missing: bool = Field(default=False)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class Annotation(SQLModel, table=True):
    __tablename__ = "annotations"

    id: int | None = Field(default=None, primary_key=True)
    image_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("images.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    class_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    x1: float
    y1: float
    x2: float
    y2: float
    source: str = Field(default="human", max_length=8)
    confidence: float | None = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class PrelabelJob(SQLModel, table=True):
    __tablename__ = "prelabel_jobs"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    status: str = Field(default="queued", max_length=16, index=True)
    image_ids: list[int] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False, default=list)
    )
    class_ids: list[int] | None = Field(
        default=None, sa_column=Column(JSON, nullable=True)
    )
    total: int = Field(default=0)
    processed: int = Field(default=0)
    succeeded: int = Field(default=0)
    failed: int = Field(default=0)
    cancel_requested: bool = Field(default=False)
    error_summary: str = Field(default="", sa_column=Column(Text, nullable=False, default=""))
    prompt_tokens: int = Field(default=0)
    completion_tokens: int = Field(default=0)
    created_at: datetime = Field(default_factory=utcnow)
    started_at: datetime | None = Field(default=None)
    finished_at: datetime | None = Field(default=None)


class JobItem(SQLModel, table=True):
    __tablename__ = "job_items"

    id: int | None = Field(default=None, primary_key=True)
    job_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("prelabel_jobs.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    image_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("images.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    status: str = Field(default="pending", max_length=16)
    error_message: str = Field(default="", sa_column=Column(Text, nullable=False, default=""))
    raw_excerpt: str = Field(default="", sa_column=Column(Text, nullable=False, default=""))
    latency_ms: int | None = Field(default=None)


class ModelConfig(SQLModel, table=True):
    __tablename__ = "model_configs"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=200)
    provider_type: str = Field(default="openai_compat", max_length=32)
    base_url: str = Field(default="", sa_column=Column(Text, nullable=False, default=""))
    api_key: str = Field(default="", sa_column=Column(Text, nullable=False, default=""))
    model_name: str = Field(default="", max_length=200)
    params: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False, default=dict)
    )
    is_default: bool = Field(default=False)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
