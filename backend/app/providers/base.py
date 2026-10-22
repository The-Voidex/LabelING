from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class ClassSpec:
    index: int
    name: str
    prompt: str = ""


@dataclass
class Detection:
    class_index: int
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float


@dataclass
class DetectResult:
    detections: list[Detection]
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    raw_text: str = ""


@dataclass
class ModelConfigSpec:
    provider_type: str
    base_url: str = ""
    api_key: str = ""
    model_name: str = ""
    params: dict[str, Any] = field(default_factory=dict)


@dataclass
class TestResult:
    ok: bool
    message: str
    latency_ms: int = 0
    parsed_count: int = 0
    http_status: int | None = None
    raw_excerpt: str = ""


class ProviderError(Exception):
    def __init__(
        self,
        kind: str,
        message: str,
        status_code: int | None = None,
        raw: str = "",
    ) -> None:
        super().__init__(message)
        self.kind = kind
        self.message = message
        self.status_code = status_code
        self.raw = raw


class Provider(Protocol):
    async def detect(
        self, image_bytes: bytes, classes: list[ClassSpec], config: ModelConfigSpec
    ) -> DetectResult: ...

    async def test(self, config: ModelConfigSpec) -> TestResult: ...


DEFAULT_PARAMS: dict[str, Any] = {
    "concurrency": 2,
    "max_image_side": 1280,
    "temperature": 0.0,
    "timeout_s": 120.0,
    "max_tokens": 2048,
    "json_mode": False,
    "extra_headers": {},
    "extra_instructions": "",
}


def _clamp_int(value: Any, low: int, high: int, default: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    return max(low, min(high, number))


def _clamp_float(value: Any, low: float, high: float, default: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return max(low, min(high, number))


def normalize_params(raw: dict[str, Any] | None) -> dict[str, Any]:
    raw = raw or {}
    params = dict(DEFAULT_PARAMS)
    params["concurrency"] = _clamp_int(raw.get("concurrency"), 1, 16, 2)
    params["max_image_side"] = _clamp_int(raw.get("max_image_side"), 256, 4096, 1280)
    params["temperature"] = _clamp_float(raw.get("temperature"), 0.0, 2.0, 0.0)
    params["timeout_s"] = _clamp_float(raw.get("timeout_s"), 5.0, 600.0, 120.0)
    params["max_tokens"] = _clamp_int(raw.get("max_tokens"), 128, 16384, 2048)
    params["json_mode"] = bool(raw.get("json_mode", False))
    headers = raw.get("extra_headers")
    params["extra_headers"] = (
        {str(key): str(value) for key, value in headers.items()}
        if isinstance(headers, dict)
        else {}
    )
    params["extra_instructions"] = str(raw.get("extra_instructions") or "")
    for key, value in raw.items():
        if key not in params:
            params[key] = value
    return params
