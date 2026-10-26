"""
AgriMart FastAPI Application Entrypoint.
Registers CORS middleware and mounts modular domain routers.
"""

import sys
from pathlib import Path

# Ensure project root is on sys.path so 'backend.app...' imports resolve
_PROJECT_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

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



if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
