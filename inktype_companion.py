"""
InkType Companion Bridge (Windows)
===================================
A lightweight, zero-latency desktop companion that:
1. Sits in a 1/4 screen floating window (Always-on-Top).
2. Monitors the previously active chat window (Claude, Gemini, WhatsApp, Notepad, etc.).
3. Receives transcribed text from the handwriting pad.
4. Smoothly focuses the chat window and injects the text via Windows Clipboard & Ctrl+V.
"""

import sys
import os
import json
import time
import threading
import subprocess
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
import ctypes
import ctypes.wintypes

# Win32 APIs (Pre-installed on this machine)
import win32gui
import win32con
import win32api
import win32process
import win32clipboard

PORT = 48123
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HTML_PATH = os.path.join(SCRIPT_DIR, "public", "handwriting-pad.html")

# State tracking
last_target_hwnd = None
last_target_title = "Active Window"
pad_hwnd = None
running = True


def get_active_window_info():
    global last_target_hwnd, last_target_title, pad_hwnd
    try:
        fg_hwnd = win32gui.GetForegroundWindow()
        if fg_hwnd and fg_hwnd != pad_hwnd:
            title = win32gui.GetWindowText(fg_hwnd).strip()
            # Ignore desktop, task switching, or our own window
            if title and title not in ["Task Switching", "Taskbar", "QuickPad", "Handwriting QuickPad", "InkType"]:
                # If title contains 'QuickPad', it's our window
                if "QuickPad" not in title and "InkType" not in title:
                    last_target_hwnd = fg_hwnd
                    last_target_title = title
    except Exception:
        pass


def window_tracker_loop():
    """Background thread that continuously tracks which window the user was working in."""
    while running:
        get_active_window_info()
        time.sleep(0.12)


def keep_pad_topmost_loop():
    """Background thread that keeps the QuickPad window Always-on-Top without stealing focus."""
    global pad_hwnd
    user32 = ctypes.windll.user32
    while running:
        try:
            if not pad_hwnd or not win32gui.IsWindow(pad_hwnd):
                # Search for window by title
                hwnd = win32gui.FindWindowW(None, "Handwriting QuickPad")
                if hwnd:
                    pad_hwnd = hwnd
            if pad_hwnd and win32gui.IsWindow(pad_hwnd):
                # SWP_NOSIZE (1) | SWP_NOMOVE (2) | SWP_NOACTIVATE (16) | SWP_SHOWWINDOW (64) = 83
                flags = win32con.SWP_NOSIZE | win32con.SWP_NOMOVE | win32con.SWP_NOACTIVATE | win32con.SWP_SHOWWINDOW
                win32gui.SetWindowPos(pad_hwnd, win32con.HWND_TOPMOST, 0, 0, 0, 0, flags)
        except Exception:
            pass
        time.sleep(1.0)


def paste_text_to_target(text: str, auto_send: bool = False) -> bool:
    """Delivers text to the target window using Windows Clipboard and Ctrl+V."""
    global last_target_hwnd, pad_hwnd

    # 1. Copy text to Windows Clipboard
    try:
        win32clipboard.OpenClipboard()
        win32clipboard.EmptyClipboard()
        win32clipboard.SetClipboardData(win32con.CF_UNICODETEXT, text)
        win32clipboard.CloseClipboard()
    except Exception as e:
        print(f"[InkType] Clipboard error: {e}")
        return False

    # 2. Focus the target window
    target = last_target_hwnd
    user32 = ctypes.windll.user32
    if target and win32gui.IsWindow(target):
        try:
            current_thread = win32api.GetCurrentThreadId()
            target_thread, _ = win32process.GetWindowThreadProcessId(target)

            # Use AttachThreadInput to bypass Windows foreground lock restriction
            user32.AttachThreadInput(current_thread, target_thread, True)
            user32.ShowWindow(target, win32con.SW_RESTORE)
            user32.SetForegroundWindow(target)
            user32.AttachThreadInput(current_thread, target_thread, False)
        except Exception as e:
            print(f"[InkType] Focus warning: {e}")
            try:
                win32gui.SetForegroundWindow(target)
            except Exception:
                pass
    else:
        # Fallback: Alt+Tab to switch to previous window
        win32api.keybd_event(win32con.VK_MENU, 0, 0, 0)
        win32api.keybd_event(win32con.VK_TAB, 0, 0, 0)
        time.sleep(0.02)
        win32api.keybd_event(win32con.VK_TAB, 0, win32con.KEYEVENTF_KEYUP, 0)
        win32api.keybd_event(win32con.VK_MENU, 0, win32con.KEYEVENTF_KEYUP, 0)

    time.sleep(0.08)

    # 3. Send Ctrl+V
    win32api.keybd_event(win32con.VK_CONTROL, 0, 0, 0)
    win32api.keybd_event(ord('V'), 0, 0, 0)
    time.sleep(0.02)
    win32api.keybd_event(ord('V'), 0, win32con.KEYEVENTF_KEYUP, 0)
    win32api.keybd_event(win32con.VK_CONTROL, 0, win32con.KEYEVENTF_KEYUP, 0)

    # 4. Optional Auto-Send (simulate Enter key)
    if auto_send:
        time.sleep(0.06)
        win32api.keybd_event(win32con.VK_RETURN, 0, 0, 0)
        time.sleep(0.02)
        win32api.keybd_event(win32con.VK_RETURN, 0, win32con.KEYEVENTF_KEYUP, 0)

    # 5. Keep pad window on top without stealing focus back
    if pad_hwnd and win32gui.IsWindow(pad_hwnd):
        flags = win32con.SWP_NOSIZE | win32con.SWP_NOMOVE | win32con.SWP_NOACTIVATE | win32con.SWP_SHOWWINDOW
        win32gui.SetWindowPos(pad_hwnd, win32con.HWND_TOPMOST, 0, 0, 0, 0, flags)

    print(f"[InkType] Successfully pasted {len(text)} chars to '{last_target_title}'")
    return True


class InkTypeHandler(BaseHTTPRequestHandler):
    """Local HTTP Server to receive commands from the handwriting pad web UI."""

    def log_message(self, format, *args):
        # Silence standard HTTP logs for performance
        pass

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/status":
            self.send_response(200)
            self.send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            data = {"targetTitle": last_target_title}
            self.wfile.write(json.dumps(data).encode("utf-8"))
            return

        # Serve the HTML pad if accessed directly
        if parsed.path in ["/", "/handwriting-pad.html"]:
            if os.path.exists(HTML_PATH):
                with open(HTML_PATH, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_cors_headers()
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(content)
                return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/paste":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                payload = json.loads(body.decode("utf-8"))
                text = payload.get("text", "")
                auto_send = payload.get("autoSend", False)

                if text.strip():
                    success = paste_text_to_target(text, auto_send)
                    self.send_response(200)
                    self.send_cors_headers()
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "success": success,
                        "targetTitle": last_target_title
                    }).encode("utf-8"))
                    return
            except Exception as e:
                print(f"[InkType] API error: {e}")

        self.send_response(400)
        self.end_headers()


def launch_window():
    """Calculates exact 1/4 screen size and launches an isolated native app window."""
    global pad_hwnd

    # Calculate usable work area (excluding taskbars on any edge)
    try:
        rect = ctypes.wintypes.RECT()
        ctypes.windll.user32.SystemParametersInfoW(48, 0, ctypes.byref(rect), 0)
        work_w = rect.right - rect.left
        work_h = rect.bottom - rect.top
        pad_w = max(560, work_w // 2)
        pad_h = max(360, work_h // 2)
        pad_x = rect.right - pad_w
        pad_y = rect.bottom - pad_h
    except Exception:
        screen_w = win32api.GetSystemMetrics(win32con.SM_CXSCREEN)
        screen_h = win32api.GetSystemMetrics(win32con.SM_CYSCREEN)
        pad_w = max(560, screen_w // 2)
        pad_h = max(360, (screen_h - 48) // 2)
        pad_x = screen_w - pad_w
        pad_y = screen_h - pad_h - 48

    url = f"http://127.0.0.1:{PORT}/handwriting-pad.html"

    # Find Microsoft Edge executable for native borderless app window
    edge_paths = [
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%LocalAppData%\Microsoft\Edge\Application\msedge.exe"),
    ]
    edge_bin = next((p for p in edge_paths if os.path.exists(p)), None)

    if edge_bin:
        cmd = [
            edge_bin,
            f"--app={url}",
            f"--window-size={pad_w},{pad_h}",
            f"--window-position={pad_x},{pad_y}",
            "--disable-features=Translate,InterestFeedContent",
            "--app-window-name=InkTypeQuickPad",
        ]
        print(f"[InkType] Launching native pad ({pad_w}x{pad_h}) at position ({pad_x}, {pad_y})...")
        subprocess.Popen(cmd)
    else:
        print("[InkType] Opening in default browser...")
        webbrowser.open(url)


def main():
    print("=" * 60)
    print(" ✍️  InkType Handwriting Companion")
    print("=" * 60)
    print(" • Floating Always-on-Top pad in 1/4 of your screen")
    print(" • Zero-latency 120 FPS pen & mouse inking")
    print(" • Auto-pastes recognized text directly into Claude / WhatsApp / Gemini")
    print(f" • Local Bridge Server: http://127.0.0.1:{PORT}")
    print("=" * 60)

    # Start target window tracker in background
    tracker_thread = threading.Thread(target=window_tracker_loop, daemon=True)
    tracker_thread.start()

    # Start topmost watcher thread
    topmost_thread = threading.Thread(target=keep_pad_topmost_loop, daemon=True)
    topmost_thread.start()

    # Start local HTTP server
    server = HTTPServer(("127.0.0.1", PORT), InkTypeHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    # Launch the 1/4 screen window
    time.sleep(0.3)
    launch_window()

    print("[InkType] Running. Press Ctrl+C in this terminal to exit.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[InkType] Shutting down cleanly.")
        global running
        running = False
        server.shutdown()


if __name__ == "__main__":
    main()
