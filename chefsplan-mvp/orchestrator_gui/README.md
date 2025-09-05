ChefsPlan Orchestrator GUI (tmux-like)

Purpose
- Live, read-only view of the root AGENTS_ORCHESTRATOR.txt in four panels: Task Board, Active Claims, Blockers, Activity Log.

Requirements
- Python 3.10+
- pip packages: flask, flask-socketio, simple-websocket

Windows PowerShell quickstart

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install flask flask-socketio simple-websocket
python orchestrator_gui/app.py
```

Open http://127.0.0.1:5000 in a browser.

Notes
- View-only; all coordination remains in AGENTS_ORCHESTRATOR.txt.
- The app watches the file and live-updates the panels.