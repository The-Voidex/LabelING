from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, Field

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseModel):
    data_dir: Path = Field(default_factory=lambda: REPO_ROOT / "data")
    frontend_dist: Path = Field(default_factory=lambda: REPO_ROOT / "frontend" / "dist")
    host: str = "127.0.0.1"
    port: int = 8000
    dev_origin: str = "http://localhost:5173"

    @classmethod
    def from_env(cls) -> "Settings":
        data_dir = Path(os.environ.get("LABELING_DATA_DIR", REPO_ROOT / "data"))
        return cls(data_dir=data_dir)

    @property
    def projects_dir(self) -> Path:
        return self.data_dir / "projects"

    @property
    def exports_dir(self) -> Path:
        return self.data_dir / "exports"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "labeling.db"

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        self.exports_dir.mkdir(parents=True, exist_ok=True)
