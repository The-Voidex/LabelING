from __future__ import annotations

import ctypes
import json
import logging
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path

import pystray
import uvicorn
from PIL import Image, ImageDraw

from app.config import REPO_ROOT, Settings, bundle_root, is_frozen
from app.main import create_app

APP_TITLE = "LabelING"
HOST = "127.0.0.1"
PORT_START = 8000
PORT_END = 8030
MUTEX_NAME = "Local\\LabelING.Desktop.SingleInstance"
ERROR_ALREADY_EXISTS = 183

logger = logging.getLogger("labeling.desktop")


class SingleInstanceLock:
    def __init__(self) -> None:
        self.handle: int | None = None

    def acquire(self) -> bool:
        if sys.platform != "win32":
            return True
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.CreateMutexW.argtypes = [
            ctypes.c_void_p,
            ctypes.c_bool,
            ctypes.c_wchar_p,
        ]
        kernel32.CreateMutexW.restype = ctypes.c_void_p
        kernel32.CloseHandle.argtypes = [ctypes.c_void_p]
        kernel32.CloseHandle.restype = ctypes.c_bool
        handle = kernel32.CreateMutexW(None, False, MUTEX_NAME)
        if not handle:
            return True
        self.handle = handle
        if ctypes.get_last_error() == ERROR_ALREADY_EXISTS:
            kernel32.CloseHandle(handle)
            self.handle = None
            return False
        return True

    def release(self) -> None:
        if self.handle is None or sys.platform != "win32":
            return
        kernel32 = ctypes.WinDLL("kernel32")
        kernel32.CloseHandle.argtypes = [ctypes.c_void_p]
        kernel32.CloseHandle(self.handle)
        self.handle = None


def configure_logging(log_path: Path) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(
        log_path,
        maxBytes=2_000_000,
        backupCount=2,
        encoding="utf-8",
    )
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    )
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    for existing in list(root.handlers):
        root.removeHandler(existing)
    root.addHandler(handler)
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        log = logging.getLogger(name)
        log.handlers.clear()
        log.propagate = True
        log.setLevel(logging.INFO)


def show_message(message: str, title: str = APP_TITLE, error: bool = False) -> None:
    if sys.platform == "win32":
        flags = 0x10 if error else 0x40
        ctypes.windll.user32.MessageBoxW(None, message, title, flags)
    else:
        print(f"{title}: {message}", file=sys.stderr)


def instance_file(settings: Settings) -> Path:
    return settings.data_dir / "instance.json"


def read_instance(settings: Settings) -> dict | None:
    path = instance_file(settings)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return None


def write_instance(settings: Settings, port: int) -> None:
    path = instance_file(settings)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "pid": os.getpid(),
        "port": port,
        "url": f"http://{HOST}:{port}",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def remove_instance(settings: Settings) -> None:
    path = instance_file(settings)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if payload.get("pid") != os.getpid():
            return
    except (OSError, ValueError, TypeError):
        pass
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


def service_is_healthy(port: int) -> bool:
    try:
        with urllib.request.urlopen(
            f"http://{HOST}:{port}/api/health", timeout=0.7
        ) as response:
            return response.status == 200
    except Exception:
        return False


def open_existing_instance(settings: Settings, timeout: float = 7.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        payload = read_instance(settings)
        if payload:
            port = payload.get("port")
            url = payload.get("url")
            if isinstance(port, int) and isinstance(url, str) and service_is_healthy(port):
                webbrowser.open(url)
                return True
        time.sleep(0.25)
    return False


def find_free_port() -> int:
    for port in range(PORT_START, PORT_END + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind((HOST, port))
            except OSError:
                continue
            return port
    raise RuntimeError(f"没有找到可用端口（{PORT_START}-{PORT_END}）")


def load_tray_image() -> Image.Image:
    path = (
        bundle_root() / "assets" / "labeling.ico"
        if is_frozen()
        else REPO_ROOT / "scripts" / "labeling.ico"
    )
    try:
        with Image.open(path) as image:
            return image.convert("RGBA").copy()
    except Exception:
        image = Image.new("RGBA", (64, 64), (39, 36, 30, 255))
        draw = ImageDraw.Draw(image)
        draw.ellipse((14, 14, 50, 50), outline=(248, 242, 229, 255), width=5)
        return image


def open_folder(path: Path) -> None:
    if sys.platform == "win32":
        os.startfile(str(path))  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])


def wait_until_started(server: uvicorn.Server, thread: threading.Thread) -> None:
    deadline = time.monotonic() + 20
    while not server.started:
        if not thread.is_alive():
            raise RuntimeError("本地服务线程意外退出")
        if time.monotonic() > deadline:
            server.should_exit = True
            raise RuntimeError("本地服务启动超时")
        time.sleep(0.1)


def run_app() -> None:
    settings = Settings.from_env()
    settings.ensure_dirs()
    configure_logging(settings.log_dir / "labeling.log")

    lock = SingleInstanceLock()
    if not lock.acquire():
        if not open_existing_instance(settings):
            show_message(
                "LabelING 似乎已经在启动或运行中，但暂时无法连接。\n"
                "请稍后重试，或从托盘图标打开界面。"
            )
        return

    if read_instance(settings) and open_existing_instance(settings, timeout=0.5):
        lock.release()
        return

    server: uvicorn.Server | None = None
    server_thread: threading.Thread | None = None

    try:
        port = find_free_port()
        runtime_settings = settings.model_copy(update={"port": port})
        app = create_app(runtime_settings)
        config = uvicorn.Config(
            app,
            host=HOST,
            port=port,
            log_config=None,
            access_log=True,
        )
        server = uvicorn.Server(config)
        app.state.uvicorn_server = server
        server_thread = threading.Thread(
            target=server.run,
            name="labeling-uvicorn",
            daemon=True,
        )
        server_thread.start()
        wait_until_started(server, server_thread)

        url = f"http://{HOST}:{port}"
        write_instance(runtime_settings, port)
        logger.info("LabelING 已启动：%s（数据目录 %s）", url, runtime_settings.data_dir)

        icon = pystray.Icon(
            "labeling",
            load_tray_image(),
            APP_TITLE,
            pystray.Menu(
                pystray.MenuItem(
                    "打开 LabelING",
                    lambda _icon, _item: webbrowser.open(url),
                    default=True,
                ),
                pystray.MenuItem(
                    f"运行中 · {HOST}:{port}",
                    None,
                    enabled=False,
                ),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem(
                    "打开数据文件夹",
                    lambda _icon, _item: open_folder(runtime_settings.data_dir),
                ),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem(
                    "关闭服务并退出",
                    lambda _icon, _item: setattr(server, "should_exit", True),
                ),
            ),
        )

        def open_browser_later() -> None:
            time.sleep(0.6)
            try:
                webbrowser.open(url)
            except Exception:
                logger.exception("无法自动打开浏览器")

        def stop_tray_when_server_stops() -> None:
            time.sleep(0.8)
            if server_thread is not None:
                server_thread.join()
            logger.info("本地服务已停止，退出托盘")
            try:
                icon.stop()
            except Exception:
                logger.exception("关闭托盘失败")

        threading.Thread(target=open_browser_later, daemon=True).start()
        threading.Thread(target=stop_tray_when_server_stops, daemon=True).start()
        icon.run()
    finally:
        if server is not None:
            server.should_exit = True
        if server_thread is not None and server_thread.is_alive():
            server_thread.join(timeout=10)
        remove_instance(settings)
        lock.release()
        logger.info("LabelING 已退出")


def main() -> None:
    try:
        run_app()
    except Exception as exc:
        fallback = Settings.from_env()
        try:
            fallback.ensure_dirs()
            configure_logging(fallback.log_dir / "labeling.log")
            logger.exception("Desktop 启动失败")
        except Exception:
            pass
        show_message(f"LabelING 启动失败：\n{exc}", error=True)
        if is_frozen():
            sys.exit(1)
        raise


if __name__ == "__main__":
    main()
