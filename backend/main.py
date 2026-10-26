"""
Entrypoint shim for running the server directly from the backend directory
(e.g., `uvicorn main:app --reload`, `fastapi dev`, or Vercel Serverless / Services).
"""

import os
import sys
import types
from pathlib import Path

# Ensure paths and dynamic package alias exist for all deployment environments
_BACKEND_DIR = Path(__file__).resolve().parent
_APP_DIR = _BACKEND_DIR / "app"
_PROJECT_ROOT = _BACKEND_DIR.parent

for _p in (str(_PROJECT_ROOT), str(_BACKEND_DIR), str(_APP_DIR)):
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
