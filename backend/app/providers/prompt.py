from __future__ import annotations

from app.providers.base import ClassSpec

SYSTEM_PROMPT = "你是一名严谨的目标检测数据标注助手。你只输出 JSON，不输出任何解释。"


def build_prompt(classes: list[ClassSpec]) -> tuple[str, str]:
    lines = []
    for item in classes:
        description = item.prompt.strip() or item.name
        lines.append(f"{item.index}. 名称：{item.name}；描述：{description}")
    class_block = "\n".join(lines)
    user = f"""请检测图片中属于下列类别的所有目标：
类别列表：
{class_block}

要求：
1. 只检测以上类别，不要输出未列出的类别。
2. bbox 为相对坐标，取值范围 0–1000，格式 [x1,y1,x2,y2]，从左上角到右下角。
3. 只标注完整可见的目标；置信度低于 0.2 的目标不要输出。
4. 同一目标只输出一次，不要输出重复框。
5. confidence 为 0–1 的小数，表示你对该框的把握。
6. 只输出 JSON，不要使用 Markdown 代码块。格式如下：
{{"detections":[{{"class_id":0,"bbox":[x1,y1,x2,y2],"confidence":0.9}}]}}
如果没有检测到任何目标，输出 {{"detections":[]}}。"""
    return SYSTEM_PROMPT, user
