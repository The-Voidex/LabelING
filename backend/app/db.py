from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from fastapi import Request
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

from app.config import Settings


def create_engine_for(settings: Settings) -> Engine:
    settings.ensure_dirs()
    url = f"sqlite:///{settings.db_path}"
    engine = create_engine(
        url,
        connect_args={"check_same_thread": False, "timeout": 5},
    )

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

    return engine


def init_db(engine: Engine) -> None:
    SQLModel.metadata.create_all(engine)


def get_session(request: Request) -> Iterator[Session]:
    with Session(request.app.state.engine) as session:
        yield session


def get_engine(settings: Settings) -> Engine:
    return create_engine_for(settings)


def project_image_dir(settings: Settings, project_id: int) -> Path:
    return settings.projects_dir / str(project_id) / "images"


def project_thumb_dir(settings: Settings, project_id: int) -> Path:
    return settings.projects_dir / str(project_id) / "thumbs"
