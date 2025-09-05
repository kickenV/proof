import os
import threading
import time
from pathlib import Path

from flask import Flask, render_template, request, jsonify
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

    def insert_claim_line(full_text: str, line: str) -> str:
        start = full_text.find("Active Claims")
        if start == -1:
            raise ValueError("Active Claims section not found")
        blk_start = full_text.find("Blockers", start)
        if blk_start == -1:
            raise ValueError("Blockers section not found after Active Claims")
        claims_section = full_text[start:blk_start]
        # Remove placeholder line if present
        placeholder = "(Empty"
        if placeholder in claims_section:
            claims_section = claims_section.replace("(Empty — agents must add entries here before starting work)", "").rstrip() + "\n"
        # Ensure a newline after the header
        header_end = claims_section.find("\n")
        if header_end == -1:
            header_end = len(claims_section)
        before = full_text[:start]
        after = full_text[blk_start:]
        # Keep the section title and any existing lines, then append the new claim line
        normalized = claims_section.rstrip() + ("\n" if not claims_section.endswith("\n") else "")
        if not normalized.endswith("\n"):
            normalized += "\n"
        updated_section = normalized + line.strip() + "\n"
        return before + updated_section + after

    @app.post("/api/claim")
    def api_claim():
        token = os.environ.get("ORCH_WRITE_TOKEN")
        data = request.get_json(silent=True) or {}
        provided = data.get("token", "")
        if not token or provided != token:
            return jsonify({"ok": False, "error": "unauthorized"}), 401
        task_id = (data.get("taskId") or "").strip()
        agent = (data.get("agent") or "").strip()
        start_utc = (data.get("startUtc") or "").strip()
        eta = (data.get("eta") or "").strip()
        scope = (data.get("scope") or "").strip()
        branch = (data.get("branch") or "").strip()
        # Basic validation
        if not task_id.startswith("CP-"):
            return jsonify({"ok": False, "error": "invalid taskId"}), 400
        if not agent or not start_utc or not eta or not scope or not branch:
            return jsonify({"ok": False, "error": "missing fields"}), 400

        # Check for existing claim on the same Task ID
        full_text = read_orchestrator_file()
        sections = parse_sections(full_text)
        if task_id in sections.get("active_claims", ""):
            return jsonify({"ok": False, "error": "task already claimed"}), 409
        line = f"{task_id} | {agent} | {start_utc} | {eta} | {scope} | {branch}"
        try:
            updated = insert_claim_line(full_text, line)
            ORCH_FILE.write_text(updated, encoding="utf-8")
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

        # Notify clients
        socketio.emit("orchestrator_update", parse_sections(updated))
        return jsonify({"ok": True})

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
