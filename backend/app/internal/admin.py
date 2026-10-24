"""
Internal administration, diagnostics, and health check router.
"""

from datetime import datetime, timezone
from fastapi import APIRouter
from ..core.config import settings
from ..db.database import get_database_status

router = APIRouter(tags=["Internal & Health"])


@router.get("/api/health")
def health_check():
    """Return service status, version, and active capabilities."""
    return {
        "status": "ok",
        "service": settings.SERVICE_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "features": {
            "elapsed_booking_auto_prune": True,
            "ongoing_and_30m_buffer_lock": True,
            "gemini_ai_enabled": settings.is_gemini_configured,
            "twilio_sms_configured": settings.is_sms_configured,
        },
    }


@router.get("/api/internal/diagnostics")
def internal_diagnostics():
    """Return detailed internal configuration and database diagnostics."""
    return {
        "service": settings.SERVICE_NAME,
        "version": settings.VERSION,
        "database": get_database_status(),
        "operational_rules": {
            "ongoing_buffer_minutes": settings.ONGOING_LOCK_BUFFER_MINUTES,
            "default_max_radius_km": settings.DEFAULT_MAX_RADIUS_KM,
            "base_prep_buffer_minutes": settings.MANDATORY_PREP_BUFFER_MINUTES,
            "tractor_transit_speed_kmh": settings.RURAL_TRANSIT_SPEED_KMH,
        },
    }
