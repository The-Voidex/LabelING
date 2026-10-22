from __future__ import annotations

import json
import shutil
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml
from sqlmodel import Session, select

from app.config import Settings
from app.errors import AppError
from app.models import Annotation, ImageAsset, LabelClass, Project
from app.services.images import image_path


def _unique_names(images: list[ImageAsset]) -> dict[int, str]:
    counts: dict[str, int] = {}
    for image in images:
        name = Path(image.original_path).name
        counts[name] = counts.get(name, 0) + 1
    mapping: dict[int, str] = {}
    for image in images:
        name = Path(image.original_path).name
        if counts[name] > 1:
            suffix = Path(name).suffix
            stem = Path(name).stem
            mapping[image.id] = f"{stem}_{image.id}{suffix}"
        else:
            mapping[image.id] = name
    return mapping


def _collect(session: Session, project: Project, scope: str):
    images = session.exec(
        select(ImageAsset).where(ImageAsset.project_id == project.id).order_by(ImageAsset.id)
    ).all()
    annotations = session.exec(
        select(Annotation)
        .join(ImageAsset, ImageAsset.id == Annotation.image_id)
        .where(ImageAsset.project_id == project.id)
        .order_by(Annotation.id)
    ).all()
    classes = session.exec(
        select(LabelClass)
        .where(LabelClass.project_id == project.id)
        .order_by(LabelClass.order_index, LabelClass.id)
    ).all()
    by_image: dict[int, list[Annotation]] = {}
    for annotation in annotations:
        by_image.setdefault(annotation.image_id, []).append(annotation)

    selected: list[ImageAsset] = []
    skipped_missing: list[dict[str, Any]] = []
    for image in images:
        if not by_image.get(image.id):
            continue
        if scope == "confirmed" and image.status != "confirmed":
            continue
        source = image_path(image)
        if not source.exists():
            skipped_missing.append({"image_id": image.id, "file_name": Path(image.original_path).name})
            continue
        selected.append(image)
    return selected, by_image, classes, skipped_missing


def _write_manifest(
    target: Path,
    project: Project,
    fmt: str,
    scope: str,
    include_images: bool,
    images: list[ImageAsset],
    annotation_count: int,
    classes: list[LabelClass],
    skipped_missing: list[dict[str, Any]],
    renamed: dict[int, str],
) -> None:
    manifest = {
        "project_id": project.id,
        "project_name": project.name,
        "format": fmt,
        "scope": scope,
        "include_images": include_images,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "image_count": len(images),
        "annotation_count": annotation_count,
        "classes": [{"id": item.id, "name": item.name} for item in classes],
        "skipped_missing": skipped_missing,
        "files": [
            {
                "image_id": image.id,
                "original_name": Path(image.original_path).name,
                "exported_name": renamed[image.id],
            }
            for image in images
        ],
    }
    (target / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    lines = [
        f"数据集：{project.name}",
        f"导出格式：{'YOLO' if fmt == 'yolo' else 'COCO'}",
        f"筛选范围：{'仅已确认图片' if scope == 'confirmed' else '全部有标注的图片'}",
        f"图片数量：{len(images)}",
        f"标注框数量：{annotation_count}",
        f"类别数量：{len(classes)}",
        "",
        "类别映射：",
    ]
    for index, item in enumerate(classes):
        lines.append(f"  {index}. {item.name}")
    if skipped_missing:
        lines.append("")
        lines.append("以下图片因文件缺失未导出：")
        for item in skipped_missing:
            lines.append(f"  - {item['file_name']}（ID {item['image_id']}）")
    lines.append("")
    lines.append("由 LabelING 生成。")
    (target / "README.txt").write_text("\n".join(lines), encoding="utf-8")


def _copy_images(
    images: list[ImageAsset], renamed: dict[int, str], images_dir: Path
) -> None:
    images_dir.mkdir(parents=True, exist_ok=True)
    for image in images:
        shutil.copy2(image_path(image), images_dir / renamed[image.id])


def _safe_float(value: float) -> float:
    return round(max(0.0, min(1.0, value)), 6)


def _build_yolo(
    target: Path,
    project: Project,
    images: list[ImageAsset],
    by_image: dict[int, list[Annotation]],
    classes: list[LabelClass],
    include_images: bool,
    skipped_missing: list[dict[str, Any]],
    scope: str,
) -> None:
    renamed = _unique_names(images)
    class_index = {item.id: index for index, item in enumerate(classes)}
    annotation_count = 0

    labels_dir = target / "labels"
    labels_dir.mkdir(parents=True, exist_ok=True)
    for image in images:
        lines = []
        for annotation in by_image.get(image.id, []):
            index = class_index.get(annotation.class_id)
            if index is None:
                continue
            x1, y1 = _safe_float(annotation.x1), _safe_float(annotation.y1)
            x2, y2 = _safe_float(annotation.x2), _safe_float(annotation.y2)
            width = _safe_float(x2 - x1)
            height = _safe_float(y2 - y1)
            if width <= 0 or height <= 0:
                continue
            cx = _safe_float(x1 + width / 2)
            cy = _safe_float(y1 + height / 2)
            lines.append(f"{index} {cx:.6f} {cy:.6f} {width:.6f} {height:.6f}")
            annotation_count += 1
        stem = Path(renamed[image.id]).stem
        (labels_dir / f"{stem}.txt").write_text("\n".join(lines), encoding="utf-8")

    names = [item.name for item in classes]
    data = {
        "path": ".",
        "train": "images",
        "val": "images",
        "nc": len(classes),
        "names": names,
    }
    (target / "data.yaml").write_text(
        yaml.safe_dump(data, allow_unicode=True, sort_keys=False), encoding="utf-8"
    )
    (target / "classes.txt").write_text("\n".join(names), encoding="utf-8")
    if include_images:
        _copy_images(images, renamed, target / "images")
    _write_manifest(
        target,
        project,
        "yolo",
        scope,
        include_images,
        images,
        annotation_count,
        classes,
        skipped_missing,
        renamed,
    )


def _build_coco(
    target: Path,
    project: Project,
    images: list[ImageAsset],
    by_image: dict[int, list[Annotation]],
    classes: list[LabelClass],
    include_images: bool,
    skipped_missing: list[dict[str, Any]],
    scope: str,
) -> None:
    renamed = _unique_names(images)
    class_to_category = {item.id: index + 1 for index, item in enumerate(classes)}
    coco_images = []
    coco_annotations = []
    annotation_id = 1
    for image_id, image in enumerate(images, start=1):
        file_name = f"images/{renamed[image.id]}" if include_images else renamed[image.id]
        coco_images.append(
            {
                "id": image_id,
                "file_name": file_name,
                "width": image.width,
                "height": image.height,
            }
        )
        for annotation in by_image.get(image.id, []):
            category_id = class_to_category.get(annotation.class_id)
            if category_id is None:
                continue
            x = max(0.0, min(1.0, annotation.x1)) * image.width
            y = max(0.0, min(1.0, annotation.y1)) * image.height
            w = max(0.0, min(1.0, annotation.x2) - min(1.0, annotation.x1)) * image.width
            h = max(0.0, min(1.0, annotation.y2) - min(1.0, annotation.y1)) * image.height
            if w <= 0 or h <= 0:
                continue
            coco_annotations.append(
                {
                    "id": annotation_id,
                    "image_id": image_id,
                    "category_id": category_id,
                    "bbox": [round(x, 2), round(y, 2), round(w, 2), round(h, 2)],
                    "area": round(w * h, 2),
                    "iscrowd": 0,
                }
            )
            annotation_id += 1

    coco = {
        "info": {
            "description": project.name,
            "version": "1.0",
            "date_created": datetime.now(timezone.utc).isoformat(),
        },
        "licenses": [],
        "images": coco_images,
        "annotations": coco_annotations,
        "categories": [
            {"id": index + 1, "name": item.name, "supercategory": "object"}
            for index, item in enumerate(classes)
        ],
    }
    (target / "annotations.json").write_text(
        json.dumps(coco, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    if include_images:
        _copy_images(images, renamed, target / "images")
    _write_manifest(
        target,
        project,
        "coco",
        scope,
        include_images,
        images,
        len(coco_annotations),
        classes,
        skipped_missing,
        renamed,
    )


def build_export(
    session: Session,
    settings: Settings,
    project: Project,
    fmt: str,
    scope: str,
    include_images: bool,
) -> Path:
    if fmt not in ("yolo", "coco"):
        raise AppError("导出格式只能是 YOLO 或 COCO", code="invalid_format")
    if scope not in ("annotated", "confirmed"):
        raise AppError("导出范围无效", code="invalid_scope")

    images, by_image, classes, skipped_missing = _collect(session, project, scope)
    if not images:
        raise AppError("没有可导出的图片，请先完成标注", code="nothing_to_export")

    settings.exports_dir.mkdir(parents=True, exist_ok=True)
    work_dir = settings.exports_dir / f"export_{uuid.uuid4().hex}"
    work_dir.mkdir(parents=True, exist_ok=True)
    try:
        if fmt == "yolo":
            _build_yolo(
                work_dir,
                project,
                images,
                by_image,
                classes,
                include_images,
                skipped_missing,
                scope,
            )
        else:
            _build_coco(
                work_dir,
                project,
                images,
                by_image,
                classes,
                include_images,
                skipped_missing,
                scope,
            )
        zip_path = settings.exports_dir / f"labeling_{project.id}_{fmt}_{uuid.uuid4().hex[:8]}.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
            for file_path in work_dir.rglob("*"):
                if file_path.is_file():
                    archive.write(file_path, file_path.relative_to(work_dir))
        return zip_path
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
