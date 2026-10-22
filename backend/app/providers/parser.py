from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from app.providers.base import ClassSpec, Detection

FENCE_PATTERN = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)
LIST_KEYS = ("detections", "objects", "boxes", "results", "annotations")
INDEX_PREFIX = re.compile(r"^\s*\d+\s*[\.\、\-\:：]\s*")
EPSILON = 1e-6


@dataclass
class ParseResult:
    detections: list[Detection]
    error: str | None = None
    dropped: int = 0


def _extract_json(text: str) -> Any:
    cleaned = text.strip()
    fence = FENCE_PATTERN.search(cleaned)
    if fence:
        cleaned = fence.group(1).strip()
    decoder = json.JSONDecoder()
    for index, char in enumerate(cleaned):
        if char not in "[{":
            continue
        try:
            value, _ = decoder.raw_decode(cleaned[index:])
            return value
        except json.JSONDecodeError:
            continue
    return None


def _payload_items(value: Any) -> list[dict[str, Any]] | None:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        for key in LIST_KEYS:
            if key in value and isinstance(value[key], list):
                return [item for item in value[key] if isinstance(item, dict)]
        if any(key in value for key in ("bbox", "box", "bbox_2d", "coordinates")):
            return [value]
    return None


def _resolve_class(value: Any, classes: list[ClassSpec]) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        index = int(value)
        return index if 0 <= index < len(classes) else None
    if isinstance(value, str):
        text = value.strip()
        if text.isdigit():
            index = int(text)
            return index if 0 <= index < len(classes) else None
        normalized = INDEX_PREFIX.sub("", text).strip().lower()
        for item in classes:
            if item.name.strip().lower() in (text.lower(), normalized):
                return item.index
    return None


def _coerce_box(value: Any) -> list[float] | None:
    if isinstance(value, (list, tuple)) and len(value) == 4:
        try:
            return [float(item) for item in value]
        except (TypeError, ValueError):
            return None
    if isinstance(value, dict):
        if all(key in value for key in ("x1", "y1", "x2", "y2")):
            try:
                return [float(value["x1"]), float(value["y1"]), float(value["x2"]), float(value["y2"])]
            except (TypeError, ValueError):
                return None
        if all(key in value for key in ("x", "y", "width", "height")):
            try:
                x, y = float(value["x"]), float(value["y"])
                return [x, y, x + float(value["width"]), y + float(value["height"])]
            except (TypeError, ValueError):
                return None
    return None


def _iou(a: Detection, b: Detection) -> float:
    x1, y1 = max(a.x1, b.x1), max(a.y1, b.y1)
    x2, y2 = min(a.x2, b.x2), min(a.y2, b.y2)
    if x2 <= x1 or y2 <= y1:
        return 0.0
    intersection = (x2 - x1) * (y2 - y1)
    area_a = (a.x2 - a.x1) * (a.y2 - a.y1)
    area_b = (b.x2 - b.x1) * (b.y2 - b.y1)
    return intersection / (area_a + area_b - intersection + EPSILON)


def parse_response(
    text: str, image_size: tuple[int, int], classes: list[ClassSpec]
) -> ParseResult:
    value = _extract_json(text or "")
    if value is None:
        return ParseResult([], error="模型返回中未找到有效 JSON", dropped=0)
    items = _payload_items(value)
    if items is None:
        return ParseResult([], error="模型返回格式不符合检测结果结构", dropped=0)
    if not items:
        return ParseResult([], error=None, dropped=0)

    image_width, image_height = image_size
    raw_items: list[dict[str, Any]] = []
    dropped = 0
    max_coord = 0.0
    for item in items:
        class_index = None
        for key in ("class_id", "category_id", "class_index", "class", "label", "name"):
            if key in item:
                class_index = _resolve_class(item[key], classes)
                if class_index is not None:
                    break
        box_value = None
        for key in ("bbox", "box", "bbox_2d", "coordinates", "xyxy"):
            if key in item:
                box_value = _coerce_box(item[key])
                if box_value is not None:
                    break
        if class_index is None or box_value is None:
            dropped += 1
            continue
        confidence = item.get("confidence", item.get("score", item.get("conf", 0.5)))
        try:
            confidence_value = float(confidence)
        except (TypeError, ValueError):
            confidence_value = 0.5
        confidence_value = max(0.0, min(1.0, confidence_value))
        raw_items.append(
            {
                "class_index": class_index,
                "box": box_value,
                "confidence": confidence_value,
            }
        )
        max_coord = max(max_coord, *(abs(value) for value in box_value))

    if not raw_items:
        return ParseResult([], error="模型返回的结果中没有可解析的检测框", dropped=dropped)

    if max_coord <= 1.001:
        scale_x = scale_y = 1.0
    elif max_coord > 1000.5:
        scale_x = image_width or 1
        scale_y = image_height or 1
    else:
        scale_x = scale_y = 1000.0

    detections: list[Detection] = []
    for raw in raw_items:
        x1, y1, x2, y2 = (
            raw["box"][0] / scale_x,
            raw["box"][1] / scale_y,
            raw["box"][2] / scale_x,
            raw["box"][3] / scale_y,
        )
        if x1 > x2:
            x1, x2 = x2, x1
        if y1 > y2:
            y1, y2 = y2, y1
        x1, y1 = max(0.0, min(1.0, x1)), max(0.0, min(1.0, y1))
        x2, y2 = max(0.0, min(1.0, x2)), max(0.0, min(1.0, y2))
        if (x2 - x1) * image_width < 2 or (y2 - y1) * image_height < 2:
            dropped += 1
            continue
        detections.append(
            Detection(
                class_index=raw["class_index"],
                x1=x1,
                y1=y1,
                x2=x2,
                y2=y2,
                confidence=raw["confidence"],
            )
        )

    detections.sort(key=lambda item: item.confidence, reverse=True)
    kept: list[Detection] = []
    for detection in detections:
        if any(
            detection.class_index == other.class_index and _iou(detection, other) > 0.9
            for other in kept
        ):
            dropped += 1
            continue
        kept.append(detection)
        if len(kept) >= 500:
            dropped += len(detections) - len(kept)
            break

    if not kept:
        return ParseResult([], error="模型返回的检测框均无效", dropped=dropped)
    return ParseResult(kept, error=None, dropped=dropped)
