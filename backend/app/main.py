"""
AgriMart FastAPI Application Entrypoint.
Registers CORS middleware and mounts modular domain routers.
"""

import os
import sys
import types
from pathlib import Path

# Ensure paths and dynamic package alias exist for all deployment environments (local & Vercel)
_APP_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _APP_DIR.parent
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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .internal import admin
from .routers import allocation, bookings, ai_agents, disruptions, sms, auth

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Modular Python FastAPI backend for AgriMart: spatial geofencing, "
        "deterministic 0-100 Fair Turn priority scoring, elapsed booking auto-removal, "
        "ongoing + 30-minute buffer lock protection, Gemini AI agents, Twilio SMS gateway, "
        "and RBAC JWT Authentication."
    ),
    version=settings.VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.CORS_ORIGINS),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Internal & Health Router
app.include_router(admin.router)

# Mount Domain Routers
app.include_router(auth.router)
app.include_router(allocation.router)
app.include_router(bookings.router)
app.include_router(ai_agents.router)
app.include_router(disruptions.router)
app.include_router(sms.router)


@app.get("/", tags=["Root"])
@app.get("/api", tags=["Root"])
@app.get("/api/", tags=["Root"])
def root_index():
    """Root landing endpoint with service metadata and documentation links."""
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs_url": "/api/docs",
        "openapi_url": "/api/openapi.json",
        "health_check": "/api/health",
        "diagnostics": "/api/internal/diagnostics",
    }


handler = app

__all__ = ["app", "handler"]



if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
