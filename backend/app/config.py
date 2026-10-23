from __future__ import annotations

import os
import sys
from pathlib import Path

from pydantic import BaseModel, Field

REPO_ROOT = Path(__file__).resolve().parents[2]


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def bundle_root() -> Path:
    return Path(getattr(sys, "_MEIPASS", REPO_ROOT))


def default_data_dir() -> Path:
    override = os.environ.get("LABELING_DATA_DIR")
    if override:
        return Path(override)
    if is_frozen():
        base = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        return Path(base) / "LabelING"
    return REPO_ROOT / "data"


def default_frontend_dist() -> Path:
    if is_frozen():
        return bundle_root() / "frontend_dist"
    return REPO_ROOT / "frontend" / "dist"


class Settings(BaseModel):
    data_dir: Path = Field(default_factory=default_data_dir)
    frontend_dist: Path = Field(default_factory=default_frontend_dist)
    host: str = "127.0.0.1"
    port: int = 8000
    dev_origin: str = "http://localhost:5173"

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(data_dir=default_data_dir())

    @property
    def projects_dir(self) -> Path:
        return self.data_dir / "projects"

    @property
    def exports_dir(self) -> Path:
        return self.data_dir / "exports"

    @property
    def log_dir(self) -> Path:
        return self.data_dir / "logs"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "labeling.db"

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        self.exports_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)
