from __future__ import annotations

import httpx

from app.providers.base import ModelConfigSpec
from app.providers.discovery import rank_models
from app.providers.openai_compat import OpenAICompatProvider


def test_rank_models_prefers_requested_default():
    models, recommended = rank_models(
        ["deepseek-chat", "deepseek-flash", "deepseek-v4-pro"],
        "deepseek-flash",
    )
    assert recommended == "deepseek-flash"
    assert models[0] == "deepseek-flash"


def test_rank_models_prefers_vision_hint_without_default():
    _, recommended = rank_models(["glm-4-plus", "glm-4v-plus", "glm-4.5"])
    assert recommended == "glm-4v-plus"


def test_rank_models_handles_empty_list():
    assert rank_models([], None) == ([], None)


def test_rank_models_deduplicates_models():
    models, _ = rank_models(["a", "a", "b"], None)
    assert models == ["a", "b"]


async def test_openai_provider_lists_models(monkeypatch):
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["authorization"] = request.headers.get("authorization", "")
        return httpx.Response(
            200,
            json={"data": [{"id": "deepseek-chat"}, {"id": "deepseek-flash"}]},
        )

    real_client = httpx.AsyncClient

    def client_factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(*args, **kwargs)

    monkeypatch.setattr(
        "app.providers.openai_compat.httpx.AsyncClient", client_factory
    )
    models = await OpenAICompatProvider().list_models(
        ModelConfigSpec(
            provider_type="openai_compat",
            base_url="https://api.deepseek.com/chat/completions",
            api_key="sk-test",
        )
    )
    assert models == ["deepseek-chat", "deepseek-flash"]
    assert seen["url"] == "https://api.deepseek.com/models"
    assert seen["authorization"] == "Bearer sk-test"
