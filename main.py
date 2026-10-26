"""
AgriMart Root FastAPI Shim.
Allows running `fastapi dev`, `uvicorn main:app --reload`, or deploying to Vercel directly from the project root.
"""

import os
import sys
import types
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
_BACKEND_DIR = _ROOT / "backend"
_APP_DIR = _BACKEND_DIR / "app"

for _p in (str(_ROOT), str(_BACKEND_DIR), str(_APP_DIR)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# Ensure 'backend' is registered in sys.modules so 'from backend.app...' always resolves
if "backend" not in sys.modules:
    try:
        import backend
    except ImportError:
        _backend_pkg = types.ModuleType("backend")
        _backend_pkg.__path__ = [str(_BACKEND_DIR)]
        _backend_pkg.__file__ = str(_BACKEND_DIR / "__init__.py")
        sys.modules["backend"] = _backend_pkg

if "backend.app" not in sys.modules:
    try:
        import backend.app
    except ImportError:
        _app_pkg = types.ModuleType("backend.app")
        _app_pkg.__path__ = [str(_APP_DIR)]
        _app_pkg.__file__ = str(_APP_DIR / "__init__.py")
        sys.modules["backend.app"] = _app_pkg
        if "backend" in sys.modules and hasattr(sys.modules["backend"], "__dict__"):
            setattr(sys.modules["backend"], "app", _app_pkg)

# Import the FastAPI application instance at top-level
try:
    from backend.app.main import app
except Exception:
    from app.main import app

# Top-level ASGI/WSGI handler for Vercel, AWS Lambda, or other serverless runtimes
handler = app

__all__ = ["app", "handler"]
