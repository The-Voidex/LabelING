from __future__ import annotations

import asyncio

from app.providers.base import (
    ClassSpec,
    DetectResult,
    Detection,
    ModelConfigSpec,
    TestResult,
)


class MockProvider:
    """开发与测试用的模拟模型，不发起任何网络请求。"""

    async def detect(
        self, image_bytes: bytes, classes: list[ClassSpec], config: ModelConfigSpec
    ) -> DetectResult:
        delay = float(config.params.get("mock_delay_s") or 0)
        if delay > 0:
            await asyncio.sleep(delay)
        detections: list[Detection] = []
        for position, item in enumerate(classes):
            column = position % 3
            row = position // 3
            x1 = 0.05 + column * 0.3
            y1 = 0.05 + row * 0.24
            x2 = min(0.95, x1 + 0.2)
            y2 = min(0.95, y1 + 0.18)
            detections.append(
                Detection(
                    class_index=item.index,
                    x1=x1,
                    y1=y1,
                    x2=x2,
                    y2=y2,
                    confidence=round(0.9 - position * 0.01, 2),
                )
            )
        return DetectResult(
            detections=detections,
            prompt_tokens=0,
            completion_tokens=0,
            raw_text="模拟模型返回",
        )

    async def test(self, config: ModelConfigSpec) -> TestResult:
        return TestResult(
            ok=True,
            message="模拟模型可用，将返回固定位置的测试框",
            latency_ms=0,
            parsed_count=1,
        )

    async def list_models(self, config: ModelConfigSpec) -> list[str]:
        return ["mock-vision"]
