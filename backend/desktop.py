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
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path

import pystray
import uvicorn
import webview
from PIL import Image, ImageDraw

from app.config import REPO_ROOT, Settings, bundle_root, is_frozen
from app.main import create_app

APP_TITLE = "LabelING"
HOST = "127.0.0.1"
PORT_START = 8000
PORT_END = 8030
MUTEX_NAME = "Local\\LabelING.Desktop.SingleInstance"
ERROR_ALREADY_EXISTS = 183
WINDOW_BACKGROUND = "#f3efe6"
WEBVIEW2_DOWNLOAD_URL = (
    "https://developer.microsoft.com/zh-cn/microsoft-edge/webview2/"
)

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


class DesktopState:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.exiting = False
        self.window: webview.Window | None = None
        self.icon: pystray.Icon | None = None
        self.hide_notified = False

    def begin_exit(self) -> bool:
        with self._lock:
            if self.exiting:
                return False
            self.exiting = True
            return True


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


def activate_window_for_pid(pid: int) -> bool:
    if sys.platform != "win32":
        return False

    user32 = ctypes.windll.user32
    callback_type = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
    user32.EnumWindows.argtypes = [callback_type, ctypes.c_void_p]
    user32.GetWindowThreadProcessId.argtypes = [
        ctypes.c_void_p,
        ctypes.POINTER(ctypes.c_ulong),
    ]
    user32.GetWindowTextLengthW.argtypes = [ctypes.c_void_p]
    user32.GetWindowTextW.argtypes = [
        ctypes.c_void_p,
        ctypes.c_wchar_p,
        ctypes.c_int,
    ]
    user32.ShowWindow.argtypes = [ctypes.c_void_p, ctypes.c_int]
    user32.IsIconic.argtypes = [ctypes.c_void_p]
    user32.SetForegroundWindow.argtypes = [ctypes.c_void_p]

    handles: list[int] = []

    def visit(hwnd: int | None, _param: int | None) -> bool:
        owner = ctypes.c_ulong()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(owner))
        if owner.value != pid:
            return True
        length = user32.GetWindowTextLengthW(hwnd)
        if length <= 0:
            return True
        title = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, title, length + 1)
        if title.value == APP_TITLE:
            handles.append(hwnd)
            return False
        return True

    user32.EnumWindows(callback_type(visit), 0)
    if not handles:
        return False

    hwnd = handles[0]
    user32.ShowWindow(hwnd, 5)  # SW_SHOW
    if user32.IsIconic(hwnd):
        user32.ShowWindow(hwnd, 9)  # SW_RESTORE
    user32.SetForegroundWindow(hwnd)
    return True


def activate_existing_instance(settings: Settings, timeout: float = 8.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        payload = read_instance(settings)
        if payload:
            pid = payload.get("pid")
            port = payload.get("port")
            if (
                isinstance(pid, int)
                and isinstance(port, int)
                and service_is_healthy(port)
            ):
                if sys.platform != "win32" or activate_window_for_pid(pid):
                    return True
        time.sleep(0.2)
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


def icon_path() -> Path:
    if is_frozen():
        return bundle_root() / "assets" / "labeling.ico"
    return REPO_ROOT / "scripts" / "labeling.ico"


def load_tray_image() -> Image.Image:
    try:
        with Image.open(icon_path()) as image:
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


def webview2_available() -> bool:
    if sys.platform != "win32":
        return True
    if os.environ.get("WEBVIEW2_RUNTIME_PATH"):
        return True
    try:
        import winreg

        with winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full",
        ) as key:
            release, _ = winreg.QueryValueEx(key, "Release")
        if release < 394802:  # .NET Framework 4.6.2
            return False

        client_keys = (
            "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
            "{2CD8A007-E189-409D-A2C8-9AF4EF3C72AA}",
            "{0D50BFEC-CD6A-4F9A-964C-C7416E3ACB10}",
            "{65C35B14-6C1D-4122-AC46-7148CC9D6497}",
        )
        locations = (
            (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\EdgeUpdate\Clients"),
            (
                winreg.HKEY_LOCAL_MACHINE,
                r"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients",
            ),
        )
        for client in client_keys:
            for hive, prefix in locations:
                try:
                    with winreg.OpenKey(hive, prefix + "\\" + client) as key:
                        version, _ = winreg.QueryValueEx(key, "pv")
                except OSError:
                    continue
                if version and str(version) != "0.0.0.0":
                    return True
        return False
    except OSError:
        return False


def wait_until_started(server: uvicorn.Server, thread: threading.Thread) -> None:
    deadline = time.monotonic() + 20
    while not server.started:
        if not thread.is_alive():
            raise RuntimeError("本地服务线程意外退出")
        if time.monotonic() > deadline:
            server.should_exit = True
            raise RuntimeError("本地服务启动超时")
        time.sleep(0.1)


def show_window(state: DesktopState) -> None:
    if sys.platform == "win32" and activate_window_for_pid(os.getpid()):
        return
    window = state.window
    if window is not None:
        try:
            window.show()
        except Exception:
            logger.exception("显示窗口失败")


def close_window_and_tray(state: DesktopState) -> None:
    window = state.window
    if window is not None:
        try:
            window.destroy()
        except Exception:
            logger.exception("关闭窗口失败")
    icon = state.icon
    if icon is not None:
        try:
            icon.stop()
        except Exception:
            logger.exception("关闭托盘图标失败")


def request_exit(state: DesktopState, server: uvicorn.Server) -> None:
    if not state.begin_exit():
        return
    logger.info("收到彻底退出请求")
    server.should_exit = True
    close_window_and_tray(state)


def handle_window_closing(state: DesktopState) -> bool:
    if state.exiting:
        return True

    icon = state.icon
    if icon is None or not getattr(icon, "visible", False):
        return True

    try:
        window = state.window
        if window is not None:
            window.hide()
        if not state.hide_notified:
            state.hide_notified = True
            icon.notify(
                "LabelING 已收起到系统托盘。右键托盘图标选择「彻底退出」可完全关闭。",
                APP_TITLE,
            )
    except Exception:
        logger.exception("隐藏窗口失败")
        return True
    return False


def create_tray(
    state: DesktopState,
    server: uvicorn.Server,
    data_dir: Path,
    port: int,
) -> pystray.Icon:
    icon = pystray.Icon(
        "labeling",
        load_tray_image(),
        f"{APP_TITLE} · 运行中",
        pystray.Menu(
            pystray.MenuItem(
                "打开 LabelING",
                lambda _icon, _item: show_window(state),
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
                lambda _icon, _item: open_folder(data_dir),
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                "彻底退出",
                lambda _icon, _item: request_exit(state, server),
            ),
        ),
    )
    state.icon = icon
    return icon


def watch_server(
    state: DesktopState,
    server_thread: threading.Thread,
) -> None:
    server_thread.join()
    if not state.begin_exit():
        return
    logger.error("本地服务线程意外退出，关闭窗口与托盘")
    close_window_and_tray(state)


def run_app() -> None:
    settings = Settings.from_env()
    settings.ensure_dirs()
    configure_logging(settings.log_dir / "labeling.log")

    lock = SingleInstanceLock()
    if not lock.acquire():
        if not activate_existing_instance(settings):
            show_message(
                "LabelING 似乎已经在启动或运行中，但暂时无法连接。\n"
                "请稍后重试，或双击任务栏托盘中的 LabelING 图标。"
            )
        return

    if read_instance(settings) and activate_existing_instance(settings, timeout=0.5):
        lock.release()
        return

    if not webview2_available():
        lock.release()
        show_message(
            "LabelING 需要 Microsoft Edge WebView2 运行时才能显示窗口。\n\n"
            f"请安装后重新启动：\n{WEBVIEW2_DOWNLOAD_URL}",
            error=True,
        )
        return

    server: uvicorn.Server | None = None
    server_thread: threading.Thread | None = None
    state = DesktopState()

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

        icon = create_tray(state, server, runtime_settings.data_dir, port)

        def run_tray() -> None:
            try:
                icon.run()
            except Exception:
                logger.exception("托盘图标运行失败，关闭窗口时可直接退出")

        tray_thread = threading.Thread(
            target=run_tray,
            name="labeling-tray",
            daemon=True,
        )
        tray_thread.start()

        window = webview.create_window(
            APP_TITLE,
            url,
            width=1280,
            height=840,
            min_size=(1024, 640),
            background_color=WINDOW_BACKGROUND,
            text_select=True,
            confirm_close=False,
        )
        state.window = window

        def on_closing() -> bool:
            return handle_window_closing(state)

        window.events.closing += on_closing

        def start_watchdog() -> None:
            threading.Thread(
                target=watch_server,
                args=(state, server_thread),
                name="labeling-watchdog",
                daemon=True,
            ).start()

        webview.settings["ALLOW_DOWNLOADS"] = True
        webview.start(start_watchdog, gui="edgechromium", icon=str(icon_path()))
    finally:
        state.begin_exit()
        if server is not None:
            server.should_exit = True
        if server_thread is not None and server_thread.is_alive():
            server_thread.join(timeout=10)
        if state.icon is not None:
            try:
                state.icon.stop()
            except Exception:
                logger.exception("关闭托盘失败")
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
