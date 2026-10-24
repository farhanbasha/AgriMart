"""
Service layer exports and unified AgriMartEngine facade.
"""

from backend.app.core.security import parse_iso_datetime
from backend.app.services.geo_service import GeoService
from backend.app.services.feasibility_service import FeasibilityService
from backend.app.services.priority_service import PriorityService
from backend.app.services.booking_service import BookingService
from backend.app.services.ai_service import AgriMartAIAgent
from backend.app.services.sms_service import AgriMartSMSService
from backend.app.services.auth_service import AuthService


class AgriMartEngine(
    GeoService,
    FeasibilityService,
    PriorityService,
    BookingService,
):
    """
    Unified facade combining GeoService, FeasibilityService,
    PriorityService, and BookingService.
    """

    parse_iso_datetime = staticmethod(parse_iso_datetime)


__all__ = [
    "GeoService",
    "FeasibilityService",
    "PriorityService",
    "BookingService",
    "AgriMartEngine",
    "AgriMartAIAgent",
    "AgriMartSMSService",
    "AuthService",
]
