from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

from app.config import Settings
from app.db import project_thumb_dir
from app.models import ImageAsset
from app.services.images import image_path

THUMB_SIZE = (320, 320)


def thumbnail_path(settings: Settings, image: ImageAsset) -> Path:
    return project_thumb_dir(settings, image.project_id) / f"{image.id}.webp"


def ensure_thumbnail(settings: Settings, image: ImageAsset) -> Path:
    source = image_path(image)
    if not source.exists():
        raise FileNotFoundError(str(source))
    target = thumbnail_path(settings, image)
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as raw:
        img = ImageOps.exif_transpose(raw).convert("RGB")
        img.thumbnail(THUMB_SIZE)
        img.save(target, "WEBP", quality=80)
    return target
