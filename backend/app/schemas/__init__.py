"""
Pydantic Request & Response Schemas for AgriMart FastAPI endpoints.
"""

from backend.app.schemas.allocation import (
    ExistingBookingDTO,
    FeasibilityRequest,
    FeasibilityResult,
    PriorityScoreRequest,
    PriorityScoreBreakdown,
    EvaluateSlotRequest,
    EvaluateSlotResponse,
)
from backend.app.schemas.booking import (
    ScheduleArbitrationRequest,
    ScheduleArbitrationResponse,
    PruneElapsedRequest,
    PruneElapsedResponse,
)
from backend.app.schemas.ai_agent import (
    IntakeParseRequest,
    IntakeNormalizationOutput,
    UrgencyEvaluateRequest,
    UrgencyJustificationOutput,
    ArbitrateConflictRequest,
    ArbitrationExplanationOutput,
    DisruptionSimulateRequest,
    DisruptionSimulationOutput,
    ReallocatedBookingItem,
    SMSNotificationItem,
)
from backend.app.schemas.sms import (
    SMSDispatchRequest,
    SMSDispatchResponse,
)
from backend.app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    GoogleAuthRequest,
    UserDTO,
    TokenResponse,
    PermissionsResponse,
)

__all__ = [
    "RegisterRequest",
    "LoginRequest",
    "GoogleAuthRequest",
    "UserDTO",
    "TokenResponse",
    "PermissionsResponse",
    "ExistingBookingDTO",
    "FeasibilityRequest",
    "FeasibilityResult",
    "PriorityScoreRequest",
    "PriorityScoreBreakdown",
    "EvaluateSlotRequest",
    "EvaluateSlotResponse",
    "ScheduleArbitrationRequest",
    "ScheduleArbitrationResponse",
    "PruneElapsedRequest",
    "PruneElapsedResponse",
    "IntakeParseRequest",
    "IntakeNormalizationOutput",
    "UrgencyEvaluateRequest",
    "UrgencyJustificationOutput",
    "ArbitrateConflictRequest",
    "ArbitrationExplanationOutput",
    "DisruptionSimulateRequest",
    "DisruptionSimulationOutput",
    "ReallocatedBookingItem",
    "SMSNotificationItem",
    "SMSDispatchRequest",
    "SMSDispatchResponse",
]
