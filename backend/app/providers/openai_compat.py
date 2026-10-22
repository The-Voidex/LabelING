from __future__ import annotations

import base64
import io
import time

import httpx
from PIL import Image, ImageDraw, ImageOps

from app.providers.base import (
    ClassSpec,
    DetectResult,
    ModelConfigSpec,
    ProviderError,
    TestResult,
)
from app.providers.parser import parse_response
from app.providers.prompt import build_prompt


def _prepare_image(image_bytes: bytes, max_side: int) -> tuple[str, int, int]:
    try:
        with Image.open(io.BytesIO(image_bytes)) as raw:
            image = ImageOps.exif_transpose(raw).convert("RGB")
    except Exception as exc:
        raise ProviderError("bad_image", "图片无法读取，可能已损坏") from exc
    original_width, original_height = image.size
    image.thumbnail((max_side, max_side))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return encoded, original_width, original_height


def _endpoint(base_url: str) -> str:
    base = (base_url or "").strip().rstrip("/")
    if not base:
        raise ProviderError("config", "请填写 Base URL")
    if base.endswith("/chat/completions"):
        return base
    return f"{base}/chat/completions"


def _test_image() -> bytes:
    image = Image.new("RGB", (512, 384), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle([140, 110, 380, 290], fill="#e53935")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


class OpenAICompatProvider:
    async def detect(
        self, image_bytes: bytes, classes: list[ClassSpec], config: ModelConfigSpec
    ) -> DetectResult:
        if not config.model_name.strip():
            raise ProviderError("config", "请填写模型名称")
        url = _endpoint(config.base_url)
        image_b64, width, height = _prepare_image(
            image_bytes, int(config.params.get("max_image_side", 1280))
        )
        system_prompt, user_prompt = build_prompt(classes)
        extra = str(config.params.get("extra_instructions") or "").strip()
        if extra:
            user_prompt = f"{user_prompt}\n\n附加要求：{extra}"

        payload: dict = {
            "model": config.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                        },
                    ],
                },
            ],
            "temperature": float(config.params.get("temperature", 0.0)),
            "max_tokens": int(config.params.get("max_tokens", 2048)),
        }
        if config.params.get("json_mode"):
            payload["response_format"] = {"type": "json_object"}

        headers = {"Content-Type": "application/json"}
        if config.api_key.strip():
            headers["Authorization"] = f"Bearer {config.api_key.strip()}"
        extra_headers = config.params.get("extra_headers") or {}
        if isinstance(extra_headers, dict):
            for key, value in extra_headers.items():
                headers[str(key)] = str(value)

        timeout = float(config.params.get("timeout_s", 120.0))
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
            except httpx.TimeoutException as exc:
                raise ProviderError("timeout", "模型请求超时，请稍后重试") from exc
            except httpx.RequestError as exc:
                raise ProviderError("network", f"无法连接模型接口：{exc}") from exc

        raw_text = response.text or ""
        if response.status_code in (401, 403):
            raise ProviderError(
                "auth", "模型鉴权失败，请检查 API Key", response.status_code, raw_text[:2000]
            )
        if response.status_code == 429:
            raise ProviderError(
                "rate_limit",
                "模型接口触发限流，请降低并发或稍后重试",
                response.status_code,
                raw_text[:2000],
            )
        if response.status_code >= 500:
            raise ProviderError(
                "server_error",
                f"模型服务返回错误（HTTP {response.status_code}）",
                response.status_code,
                raw_text[:2000],
            )
        if response.status_code >= 400:
            detail = ""
            try:
                error_body = response.json()
                detail = str(
                    (error_body.get("error") or {}).get("message")
                    if isinstance(error_body, dict)
                    else ""
                )
            except Exception:
                detail = ""
            raise ProviderError(
                "bad_request",
                f"模型请求被拒绝（HTTP {response.status_code}）{('：' + detail) if detail else ''}",
                response.status_code,
                raw_text[:2000],
            )

        try:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
        except Exception as exc:
            raise ProviderError(
                "bad_response", "模型返回结构无法识别", response.status_code, raw_text[:2000]
            ) from exc
        if isinstance(content, list):
            content = "\n".join(
                str(part.get("text", ""))
                for part in content
                if isinstance(part, dict) and part.get("type") in ("text", "output_text")
            )
        if not isinstance(content, str) or not content.strip():
            raise ProviderError(
                "bad_response", "模型返回内容为空", response.status_code, raw_text[:2000]
            )

        parsed = parse_response(content, (width, height), classes)
        if parsed.error:
            raise ProviderError("bad_response", parsed.error, response.status_code, content[:2000])

        usage = data.get("usage") or {}
        return DetectResult(
            detections=parsed.detections,
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
            raw_text=content[:2000],
        )

    async def test(self, config: ModelConfigSpec) -> TestResult:
        started = time.perf_counter()
        try:
            result = await self.detect(
                _test_image(),
                [ClassSpec(index=0, name="红色矩形", prompt="图片中央的红色矩形")],
                config,
            )
        except ProviderError as exc:
            return TestResult(
                ok=False,
                message=exc.message,
                latency_ms=int((time.perf_counter() - started) * 1000),
                http_status=exc.status_code,
                raw_excerpt=exc.raw[:500],
            )
        except Exception as exc:  # pragma: no cover - 防御网络库异常
            return TestResult(
                ok=False,
                message=f"连接测试失败：{exc}",
                latency_ms=int((time.perf_counter() - started) * 1000),
            )
        latency = int((time.perf_counter() - started) * 1000)
        if not result.detections:
            return TestResult(
                ok=True,
                message="连接成功，但未解析到检测框，请检查模型是否支持视觉与坐标输出",
                latency_ms=latency,
                parsed_count=0,
            )
        return TestResult(
            ok=True,
            message=f"连接成功，解析到 {len(result.detections)} 个检测框",
            latency_ms=latency,
            parsed_count=len(result.detections),
        )
