from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter

from app.errors import AppError
from app.services.importer import SUPPORTED_EXTENSIONS

router = APIRouter(prefix="/fs", tags=["fs"])

MAX_ENTRIES = 500


@router.get("/list")
def list_directory(path: str | None = None) -> dict:
    base = Path(path).expanduser() if path else Path.home()
    if not base.is_absolute():
        base = Path.home() / base
    if not base.exists():
        raise AppError("文件夹不存在，请检查路径", code="folder_not_found")
    if not base.is_dir():
        raise AppError("路径不是文件夹", code="not_a_folder")

    try:
        entries = list(base.iterdir())
    except OSError:
        raise AppError("无法读取该文件夹，请检查访问权限", code="folder_not_readable")

    directories = []
    images = []
    for entry in entries:
        try:
            is_dir = entry.is_dir()
        except OSError:
            continue
        if is_dir:
            directories.append({"name": entry.name, "path": str(entry)})
        elif entry.suffix.lower() in SUPPORTED_EXTENSIONS and entry.is_file():
            images.append(
                {"name": entry.name, "path": str(entry), "size": entry.stat().st_size}
            )

    directories.sort(key=lambda item: item["name"].lower())
    images.sort(key=lambda item: item["name"].lower())
    truncated = len(directories) > MAX_ENTRIES or len(images) > MAX_ENTRIES
    parent = str(base.parent) if base.parent != base else None
    return {
        "path": str(base),
        "parent": parent,
        "dirs": directories[:MAX_ENTRIES],
        "images": images[:MAX_ENTRIES],
        "image_count": len(images),
        "truncated": truncated,
    }
