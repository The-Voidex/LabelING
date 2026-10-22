from __future__ import annotations

import hashlib
import re
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps
from sqlmodel import Session, select

from app.config import Settings
from app.db import project_image_dir
from app.errors import AppError
from app.models import ImageAsset, utcnow

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
MAX_IMAGES = 5000
_INVALID_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


@dataclass
class ScannedImage:
    path: Path
    name: str
    size: int
    sha256: str
    width: int
    height: int


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _read_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as raw:
        image = ImageOps.exif_transpose(raw)
        return image.size


def _iter_candidates(folder: Path, recursive: bool) -> list[Path]:
    iterator = folder.rglob("*") if recursive else folder.glob("*")
    candidates = [
        path
        for path in iterator
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    candidates.sort(key=lambda item: str(item).lower())
    return candidates


def validate_folder(folder_path: str) -> Path:
    folder = Path(folder_path).expanduser()
    if not folder.exists():
        raise AppError("文件夹不存在，请检查路径", code="folder_not_found")
    if not folder.is_dir():
        raise AppError("路径不是文件夹", code="not_a_folder")
    return folder


def scan_folder(folder: Path, recursive: bool) -> tuple[list[ScannedImage], int, bool]:
    candidates = _iter_candidates(folder, recursive)
    if len(candidates) > MAX_IMAGES:
        return [], len(candidates), True

    scanned: list[ScannedImage] = []
    unreadable = 0
    for path in candidates:
        try:
            width, height = _read_size(path)
            scanned.append(
                ScannedImage(
                    path=path,
                    name=path.name,
                    size=path.stat().st_size,
                    sha256=_hash_file(path),
                    width=width,
                    height=height,
                )
            )
        except Exception:
            unreadable += 1
    return scanned, unreadable, False


def _safe_name(name: str) -> str:
    cleaned = _INVALID_CHARS.sub("_", name).strip(" .") or "image"
    return cleaned[:120]


def preview_import(
    session: Session, project_id: int, folder_path: str, recursive: bool
) -> dict[str, int | bool]:
    folder = validate_folder(folder_path)
    scanned, unreadable, exceeded = scan_folder(folder, recursive)
    if exceeded:
        total_candidates = len(_iter_candidates(folder, recursive))
        return {
            "found": total_candidates,
            "duplicates": 0,
            "total_bytes": 0,
            "limit_exceeded": True,
            "unreadable": 0,
        }
    existing = set(
        session.exec(
            select(ImageAsset.sha256).where(ImageAsset.project_id == project_id)
        ).all()
    )
    seen: set[str] = set()
    duplicates = 0
    total_bytes = 0
    for item in scanned:
        total_bytes += item.size
        if item.sha256 in existing or item.sha256 in seen:
            duplicates += 1
        else:
            seen.add(item.sha256)
    return {
        "found": len(scanned) + unreadable,
        "duplicates": duplicates,
        "total_bytes": total_bytes,
        "limit_exceeded": False,
        "unreadable": unreadable,
    }


def import_images(
    session: Session,
    settings: Settings,
    project_id: int,
    folder_path: str,
    mode: str,
    recursive: bool,
) -> dict[str, int]:
    folder = validate_folder(folder_path)
    scanned, unreadable, exceeded = scan_folder(folder, recursive)
    if exceeded:
        raise AppError(f"单次导入最多 {MAX_IMAGES} 张图片，请分批导入", code="too_many_images")

    existing = set(
        session.exec(
            select(ImageAsset.sha256).where(ImageAsset.project_id == project_id)
        ).all()
    )
    seen: set[str] = set()
    imported = 0
    skipped = 0
    failed = 0

    target_dir = project_image_dir(settings, project_id)
    if mode == "copy":
        target_dir.mkdir(parents=True, exist_ok=True)

    for item in scanned:
        if item.sha256 in existing or item.sha256 in seen:
            skipped += 1
            continue
        seen.add(item.sha256)
        stored_path: str | None = None
        try:
            if mode == "copy":
                destination = target_dir / f"{uuid.uuid4().hex[:8]}_{_safe_name(item.name)}"
                shutil.copy2(item.path, destination)
                stored_path = str(destination.resolve())
            image = ImageAsset(
                project_id=project_id,
                storage_mode=mode,
                stored_path=stored_path,
                original_path=str(item.path.resolve()),
                sha256=item.sha256,
                width=item.width,
                height=item.height,
                status="unlabeled",
                missing=False,
            )
            session.add(image)
            imported += 1
        except Exception:
            failed += 1
    session.commit()
    if unreadable:
        failed += unreadable
    return {"imported": imported, "skipped_duplicates": skipped, "failed": failed}
