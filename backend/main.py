"""
Entrypoint shim for running the server directly from the backend directory
(e.g., `uvicorn main:app --reload` or `fastapi dev`).
"""

import sys
from pathlib import Path

# Add project root and backend dir to sys.path so both 'backend.app...' and 'app...' resolve
_BACKEND_DIR = str(Path(__file__).resolve().parent)
_PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)

for _p in (_PROJECT_ROOT, _BACKEND_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from backend.app.main import app
except ModuleNotFoundError:
    from app.main import app

__all__ = ["app"]

