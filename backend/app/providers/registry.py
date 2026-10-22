from __future__ import annotations

from app.errors import AppError
from app.providers.base import Provider
from app.providers.mock import MockProvider
from app.providers.openai_compat import OpenAICompatProvider

_PROVIDERS: dict[str, Provider] = {
    "openai_compat": OpenAICompatProvider(),
    "mock": MockProvider(),
}


def get_provider(provider_type: str) -> Provider:
    provider = _PROVIDERS.get(provider_type)
    if provider is None:
        raise AppError(f"不支持的模型接口类型：{provider_type}", code="unknown_provider")
    return provider
