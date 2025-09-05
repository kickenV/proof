import os
import threading
import time
from pathlib import Path

from flask import Flask, render_template
from flask_socketio import SocketIO


BASE_DIR = Path(__file__).resolve().parent.parent
ORCH_FILE = BASE_DIR / "AGENTS_ORCHESTRATOR.txt"


def read_orchestrator_file() -> str:
    try:
        return ORCH_FILE.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        return f"ERROR reading AGENTS_ORCHESTRATOR.txt: {e}"


def extract_block(text: str, start_marker: str, end_marker: str | None = None) -> str:
    start_idx = text.find(start_marker)
    if start_idx == -1:
        return ""
    if end_marker is None:
        return text[start_idx:]
    end_idx = text.find(end_marker, start_idx)
    if end_idx == -1:
        return text[start_idx:]
    return text[start_idx:end_idx]


def parse_sections(full_text: str) -> dict:
    return {
        "task_board": extract_block(full_text, "Task Board", "Active Claims").strip(),
        "active_claims": extract_block(full_text, "Active Claims", "Blockers").strip(),
        "blockers": extract_block(full_text, "Blockers", "Activity Log").strip(),
        "activity_log": extract_block(full_text, "Activity Log").strip(),
    }


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev")
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

    @app.route("/")
    def index():
        return render_template("index.html")

    def watcher():
        last_mtime = 0.0
        while True:
            try:
                stat = ORCH_FILE.stat()
                if stat.st_mtime != last_mtime:
                    last_mtime = stat.st_mtime
                    data = parse_sections(read_orchestrator_file())
                    socketio.emit("orchestrator_update", data)
            except FileNotFoundError:
                socketio.emit("orchestrator_update", {
                    "task_board": "AGENTS_ORCHESTRATOR.txt not found",
                    "active_claims": "",
                    "blockers": "",
                    "activity_log": "",
                })
            time.sleep(1.5)

    @socketio.on("connect")
    def on_connect():
        data = parse_sections(read_orchestrator_file())
        socketio.emit("orchestrator_update", data)

    thread = threading.Thread(target=watcher, daemon=True)
    thread.start()

    return app, socketio


if __name__ == "__main__":
    app, socketio = create_app()
    port = int(os.environ.get("PORT", "5000"))
    socketio.run(app, host="127.0.0.1", port=port)
