from __future__ import annotations

from app.providers.base import ClassSpec
from app.providers.prompt import build_prompt


def test_prompt_contains_classes_and_schema():
    system, user = build_prompt(
        [ClassSpec(0, "装甲板", "带 LED 的矩形装甲板"), ClassSpec(1, "能量机关", "")]
    )
    assert "JSON" in system
    assert "装甲板" in user
    assert "带 LED 的矩形装甲板" in user
    assert "能量机关" in user
    assert "0–1000" in user
    assert '"detections"' in user


def test_empty_description_falls_back_to_name():
    _system, user = build_prompt([ClassSpec(0, "装甲板", "  ")])
    assert "描述：装甲板" in user
