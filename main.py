"""
AgriMart Root FastAPI Shim.
Allows running `fastapi dev` or `uvicorn main:app --reload` directly from the project root.
"""

import sys
from pathlib import Path

_ROOT = str(Path(__file__).resolve().parent)
_BACKEND = str(Path(__file__).resolve().parent / "backend")

for _p in (_ROOT, _BACKEND):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from backend.app.main import app

__all__ = ["app"]
