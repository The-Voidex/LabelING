"""生成 LabelING 的托盘 ICO 与 Apple Touch 图标。

图形与 frontend/public/favicon.svg 对应：深色圆角底、纸张、铅笔、手绘圆。
运行：uv run python ..\\scripts\\make_icons.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SUPERSAMPLE = 16
SIZE = 64 * SUPERSAMPLE

INK = "#27241E"
PAPER = "#F8F2E5"
FOLD = "#E8DAC2"
GRAPHITE = "#2A2721"
PENCIL = "#E8A33C"
PENCIL_LIGHT = "#F2B95B"
WOOD = "#EBC58E"
ERASER = "#D97757"


def px(value: float) -> int:
    return round(value * SUPERSAMPLE)


def point(value: tuple[float, float]) -> tuple[int, int]:
    return (px(value[0]), px(value[1]))


def rounded_rect(draw: ImageDraw.ImageDraw, box, radius: float, fill: str) -> None:
    draw.rounded_rectangle(
        tuple(px(value) for value in box),
        radius=px(radius),
        fill=fill,
    )


def polygon(draw: ImageDraw.ImageDraw, points, fill: str) -> None:
    draw.polygon([point(item) for item in points], fill=fill)


def build_icon() -> Image.Image:
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    rounded_rect(draw, (0, 0, 64, 64), 15, INK)
    polygon(draw, [(14, 9), (41, 9), (50, 18), (50, 51), (14, 51)], PAPER)
    rounded_rect(draw, (10, 9, 50, 55), 4, PAPER)
    polygon(draw, [(41, 9), (50, 18), (50, 9)], INK)
    polygon(draw, [(41, 9), (50, 18), (44.6, 18)], FOLD)

    draw.ellipse(
        (px(17), px(24), px(43), px(50)),
        outline=GRAPHITE,
        width=px(4.4),
    )

    pencil_body = [(40.86, 20.76), (53.81, 7.81), (59.19, 13.19), (46.24, 26.14)]
    pencil_light = [(40.86, 20.76), (53.81, 7.81), (56.5, 10.5), (43.55, 23.45)]
    polygon(draw, pencil_body, PENCIL)
    polygon(draw, pencil_light, PENCIL_LIGHT)
    polygon(draw, [(40.58, 26.42), (43.55, 23.45), (40.86, 20.76), (39.8, 25.64)], WOOD)
    polygon(draw, [(39.8, 25.64), (40.58, 26.42), (38.6, 28.4)], GRAPHITE)
    polygon(draw, [(53.81, 7.81), (59.19, 13.19), (57.05, 15.33), (51.67, 9.95)], ERASER)

    return image.resize((256, 256), Image.Resampling.LANCZOS)


def main() -> None:
    icon = build_icon()
    ico_path = ROOT / "scripts" / "labeling.ico"
    png_path = ROOT / "frontend" / "public" / "apple-touch-icon.png"
    icon.save(png_path, format="PNG")
    icon.save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print(f"已生成 {png_path}")
    print(f"已生成 {ico_path}")


if __name__ == "__main__":
    main()
