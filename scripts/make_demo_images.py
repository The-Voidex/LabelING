"""生成用于体验 LabelING 的演示图片。"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "demo_images"

BACKGROUNDS = ["#1c2230", "#232a3b", "#1a2430", "#252333"]
COLORS = ["#e53935", "#43a047", "#1e88e5", "#fb8c00", "#8e24aa", "#00acc1"]


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for index in range(8):
        image = Image.new("RGB", (640, 480), BACKGROUNDS[index % len(BACKGROUNDS)])
        draw = ImageDraw.Draw(image)
        for item in range(3):
            left = 60 + item * 185 + (index % 2) * 20
            top = 90 + (index % 3) * 60
            color = COLORS[(index + item) % len(COLORS)]
            draw.rectangle([left, top, left + 130, top + 110], fill=color)
            draw.rectangle(
                [left + 18, top + 22, left + 112, top + 88],
                outline="#ffffff",
                width=3,
            )
        image.save(OUTPUT / f"demo_{index + 1:02d}.png")
    print(f"已生成 8 张演示图片：{OUTPUT}")


if __name__ == "__main__":
    main()
