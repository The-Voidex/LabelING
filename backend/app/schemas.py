from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    model_config_id: int | None = None


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    model_config_id: int | None = None
    model_name: str | None = None
    image_count: int = 0
    class_count: int = 0
    created_at: datetime
    updated_at: datetime


class ProjectStats(BaseModel):
    unlabeled: int = 0
    labeled: int = 0
    confirmed: int = 0
    missing: int = 0
    total: int = 0


class ClassCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    color: str | None = Field(default=None, max_length=32)
    prompt: str = ""


class ClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    color: str | None = Field(default=None, max_length=32)
    prompt: str | None = None


class ClassRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    color: str
    prompt: str
    order_index: int
    annotation_count: int = 0


class ClassReorder(BaseModel):
    class_ids: list[int]


class ImportRequest(BaseModel):
    folder_path: str = Field(min_length=1)
    mode: str = Field(default="copy", pattern="^(copy|reference)$")
    recursive: bool = True


class ImportPreview(BaseModel):
    found: int
    duplicates: int
    total_bytes: int
    limit_exceeded: bool = False
    unreadable: int = 0


class ImportResult(BaseModel):
    imported: int
    skipped_duplicates: int
    failed: int


class ImageRead(BaseModel):
    id: int
    project_id: int
    file_name: str
    original_path: str
    storage_mode: str
    width: int
    height: int
    status: str
    missing: bool
    sha256: str
    thumbnail_url: str
    file_url: str
    created_at: datetime
    updated_at: datetime


class ImagePage(BaseModel):
    items: list[ImageRead]
    total: int
    page: int
    page_size: int


class ImageNavItem(BaseModel):
    id: int
    file_name: str
    status: str
    missing: bool
    sha256: str


class ImageRelocate(BaseModel):
    path: str = Field(min_length=1)


class AnnotationIn(BaseModel):
    id: int | None = None
    class_id: int
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float | None = None


class AnnotationsPut(BaseModel):
    annotations: list[AnnotationIn]


class AnnotationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    image_id: int
    class_id: int
    x1: float
    y1: float
    x2: float
    y2: float
    source: str
    confidence: float | None = None


class BatchRequest(BaseModel):
    image_ids: list[int] = Field(min_length=1)


class BatchConfirmResult(BaseModel):
    confirmed: int = 0
    skipped: int = 0


class BatchUnconfirmResult(BaseModel):
    unconfirmed: int = 0
    skipped: int = 0


class BatchDeleteResult(BaseModel):
    deleted: int = 0


class ModelConfigCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    provider_type: str = "openai_compat"
    base_url: str = ""
    api_key: str = ""
    model_name: str = ""
    params: dict = Field(default_factory=dict)
    is_default: bool = False


class ModelConfigUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    provider_type: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    model_name: str | None = None
    params: dict | None = None
    is_default: bool | None = None


class ModelConfigRead(BaseModel):
    id: int
    name: str
    provider_type: str
    base_url: str
    api_key_masked: str
    has_api_key: bool
    model_name: str
    params: dict
    is_default: bool
    created_at: datetime
    updated_at: datetime


class ProviderTestResult(BaseModel):
    ok: bool
    message: str
    latency_ms: int = 0
    parsed_count: int = 0
    http_status: int | None = None
    raw_excerpt: str = ""


class JobCreate(BaseModel):
    image_ids: list[int] = Field(min_length=1)
    class_ids: list[int] | None = None


class JobErrorItem(BaseModel):
    image_id: int
    error_message: str
    raw_excerpt: str = ""
    latency_ms: int | None = None


class JobRead(BaseModel):
    id: int
    project_id: int
    status: str
    total: int
    processed: int
    succeeded: int
    failed: int
    cancel_requested: bool
    error_summary: str
    prompt_tokens: int
    completion_tokens: int
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    errors: list[JobErrorItem] = Field(default_factory=list)
