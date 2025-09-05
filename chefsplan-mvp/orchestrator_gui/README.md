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

Write access (optional, guarded)
- Set an environment variable ORCH_WRITE_TOKEN to enable the claim form.
- The footer form will POST to /api/claim and append a single-line entry under "Active Claims" if authorized.

PowerShell example (one session)
```powershell
$env:ORCH_WRITE_TOKEN = "set-a-strong-token"
python orchestrator_gui/app.py
```