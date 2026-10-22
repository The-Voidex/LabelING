from __future__ import annotations

from app.providers.base import ClassSpec
from app.providers.parser import parse_response

CLASSES = [ClassSpec(0, "装甲板", "带灯条的装甲板"), ClassSpec(1, "能量机关", "")]


def test_standard_milli_coordinates():
    text = '{"detections":[{"class_id":0,"bbox":[100,200,500,600],"confidence":0.9}]}'
    result = parse_response(text, (1000, 1000), CLASSES)
    assert result.error is None
    detection = result.detections[0]
    assert (detection.x1, detection.y1, detection.x2, detection.y2) == (0.1, 0.2, 0.5, 0.6)
    assert detection.class_index == 0
    assert detection.confidence == 0.9


def test_code_fence_and_boxes_key():
    text = '```json\n{"boxes":[{"class_id":0,"bbox":[100,100,900,900],"confidence":0.8}]}\n```'
    result = parse_response(text, (1000, 1000), CLASSES)
    assert result.error is None
    assert len(result.detections) == 1


def test_normalized_coordinates():
    text = '{"detections":[{"class_id":1,"bbox":[0.1,0.2,0.6,0.8],"confidence":0.7}]}'
    result = parse_response(text, (640, 480), CLASSES)
    assert result.error is None
    assert result.detections[0].x2 == 0.6


def test_pixel_coordinates_over_1000():
    text = '{"detections":[{"class_id":0,"bbox":[200,150,1200,900],"confidence":0.9}]}'
    result = parse_response(text, (2000, 1500), CLASSES)
    assert result.detections[0].x1 == 0.1
    assert result.detections[0].x2 == 0.6
    assert result.detections[0].y2 == 0.6


def test_class_name_and_reversed_coordinates():
    text = '{"objects":[{"label":"能量机关","box":[800,900,100,100],"confidence":0.5}]}'
    result = parse_response(text, (1000, 1000), CLASSES)
    assert result.error is None
    detection = result.detections[0]
    assert detection.class_index == 1
    assert detection.x1 == 0.1
    assert detection.y1 == 0.1
    assert detection.x2 == 0.8
    assert detection.y2 == 0.9


def test_clamped_and_degenerate_boxes():
    text = '{"detections":[{"class_id":0,"bbox":[-100,-50,1200,1100],"confidence":0.9}]}'
    result = parse_response(text, (1000, 1000), CLASSES)
    assert result.detections[0].x1 == 0.0
    assert result.detections[0].x2 == 1.0

    tiny = '{"detections":[{"class_id":0,"bbox":[100,100,100.5,500],"confidence":0.9}]}'
    tiny_result = parse_response(tiny, (1000, 1000), CLASSES)
    assert tiny_result.error is not None
    assert tiny_result.detections == []


def test_deduplicate_overlapping_boxes():
    text = (
        '{"detections":['
        '{"class_id":0,"bbox":[100,100,500,500],"confidence":0.95},'
        '{"class_id":0,"bbox":[105,105,505,505],"confidence":0.8}'
        "]}"
    )
    result = parse_response(text, (1000, 1000), CLASSES)
    assert len(result.detections) == 1
    assert result.detections[0].confidence == 0.95
    assert result.dropped == 1


def test_empty_detections_is_valid():
    result = parse_response('{"detections":[]}', (640, 480), CLASSES)
    assert result.error is None
    assert result.detections == []


def test_invalid_text_returns_error():
    result = parse_response("我无法识别这张图片。", (640, 480), CLASSES)
    assert result.error is not None
    assert result.detections == []
