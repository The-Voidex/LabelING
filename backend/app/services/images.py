from __future__ import annotations

from pathlib import Path

from sqlmodel import Session

from app.models import ImageAsset


def image_path(image: ImageAsset) -> Path:
    if image.storage_mode == "copy" and image.stored_path:
        return Path(image.stored_path)
    return Path(image.original_path)


def delete_image(session: Session, image: ImageAsset) -> None:
    if image.storage_mode == "copy" and image.stored_path:
        path = Path(image.stored_path)
        if path.exists():
            path.unlink(missing_ok=True)
    session.delete(image)
    session.commit()


def batch_delete_images(session: Session, project_id: int, image_ids: list[int]) -> int:
    deleted = 0
    for image_id in image_ids:
        image = session.get(ImageAsset, image_id)
        if image is None or image.project_id != project_id:
            continue
        delete_image(session, image)
        deleted += 1
    return deleted
