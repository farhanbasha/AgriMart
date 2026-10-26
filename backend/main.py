"""
Entrypoint shim for running the server directly from the backend directory
(e.g., `uvicorn main:app --reload`, `fastapi dev`, or Vercel Serverless / Services).
"""

import os
import sys
import types
import traceback
from pathlib import Path

# 1. Determine directories
_BACKEND_DIR = Path(__file__).resolve().parent
_APP_DIR = _BACKEND_DIR / "app"
_PROJECT_ROOT = _BACKEND_DIR.parent

# 2. Add paths to sys.path
for _p in (str(_PROJECT_ROOT), str(_BACKEND_DIR), str(_APP_DIR)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# 3. Ensure 'backend' is registered in sys.modules so 'from backend.app...' always resolves
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

# 4. Import the primary FastAPI application instance
app = None
_load_error = None

try:
    from backend.app.main import app as _main_app
    app = _main_app
except Exception as exc1:
    _load_error = exc1
    sys.stderr.write(f"[AgriMart] Primary import backend.app.main failed: {exc1}\n")
    traceback.print_exc(file=sys.stderr)
    try:
        from app.main import app as _sub_app
        app = _sub_app
    except Exception as exc2:
        _load_error = exc2
        sys.stderr.write(f"[AgriMart] Secondary import app.main failed: {exc2}\n")
        traceback.print_exc(file=sys.stderr)

# 5. Guaranteed fallback: If both imports failed, construct a fallback FastAPI app so
# Vercel/ASGI NEVER crashes with PYTHON_HANDLER_NOT_FOUND, and outputs diagnostics instead.
if app is None:
    try:
        from fastapi import FastAPI
        from fastapi.responses import JSONResponse

        app = FastAPI(title="AgriMart Fallback Service")

        @app.get("/{full_path:path}")
        async def fallback_catch_all(full_path: str):
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "service": "AgriMart FastAPI Backend",
                    "message": "Backend failed to load during initialization.",
                    "error": str(_load_error),
                    "path": full_path,
                },
            )
    except Exception as fatal_exc:
        sys.stderr.write(f"[AgriMart] Fatal ASGI initialization error: {fatal_exc}\n")
        async def app(scope, receive, send):
            if scope["type"] == "http":
                response_body = b'{"error": "Fatal server initialization error"}'
                await send({
                    "type": "http.response.start",
                    "status": 500,
                    "headers": [[b"content-type", b"application/json"]],
                })
                await send({
                    "type": "http.response.body",
                    "body": response_body,
                })

# 6. Ensure handler is always defined at module level
handler = app

__all__ = ["app", "handler"]
