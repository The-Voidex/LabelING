from __future__ import annotations

import uvicorn

from app.config import Settings
from app.main import create_app


def main() -> None:
    settings = Settings.from_env()
    app = create_app(settings)
    config = uvicorn.Config(
        app,
        host=settings.host,
        port=settings.port,
        log_level="info",
    )
    server = uvicorn.Server(config)
    app.state.uvicorn_server = server
    server.run()


if __name__ == "__main__":
    main()
