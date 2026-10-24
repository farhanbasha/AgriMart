"""
Pydantic schemas for Feasibility, Geofencing, and Deterministic 0-100 Priority Scoring.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ExistingBookingDTO(BaseModel):
    id: str
    resource_id: str
    start_time: datetime
    end_time: datetime
    plot_lat: float
    plot_lng: float
    status: str = "confirmed"


class FeasibilityRequest(BaseModel):
    resource_id: str
    resource_base_lat: float = Field(..., ge=-90.0, le=90.0)
    resource_base_lng: float = Field(..., ge=-180.0, le=180.0)
    resource_max_radius_km: float = Field(default=50.0, gt=0.0, le=200.0)
    plot_lat: float = Field(..., ge=-90.0, le=90.0)
    plot_lng: float = Field(..., ge=-180.0, le=180.0)
    start_time: datetime
    end_time: datetime
    existing_bookings: List[ExistingBookingDTO] = Field(default_factory=list)
    reference_now: Optional[datetime] = None


class FeasibilityResult(BaseModel):
    is_feasible: bool
    distance_km: float
    geofence_passed: bool
    transit_buffer_minutes: float
    maintenance_buffer_minutes: float
    total_turnaround_minutes: float
    conflict_detected: bool
    conflict_reason: Optional[str] = None
    earliest_available_start: Optional[datetime] = None
    has_locked_ongoing_conflict: bool = False
    locked_booking_ids: List[str] = Field(default_factory=list)


class PriorityScoreRequest(BaseModel):
    start_time: datetime
    request_timestamp: Optional[datetime] = None
    imminent_rainfall_mm: float = Field(default=0.0, ge=0.0)
    severe_weather_alert: bool = False
    crop_stage: str = Field(
        default="Ripening",
        description="One of: Vegetative, Flowering, Ripening, Harvest-Ready, Post-Harvest",
    )
    queue_wait_hours: float = Field(default=0.0, ge=0.0)
    distance_km: float = Field(..., ge=0.0)
    intent: str = Field(
        default="harvesting",
        description="harvesting, spraying, seeding, irrigation, tillage, storage_haul, towing",
    )
    resource_condition_rating: float = Field(default=4.5, ge=1.0, le=5.0)
    urgency_justification_bonus: Optional[float] = Field(default=None, ge=0.0, le=10.0)


class PriorityScoreBreakdown(BaseModel):
    urgency_deadline_pts: float
    urgency_justification_pts: float = 0.0
    weather_risk_pts: float
    crop_vulnerability_pts: float
    anti_starvation_pts: float
    logistics_proximity_pts: float
    intent_condition_pts: float
    total_priority_score: float


class EvaluateSlotRequest(BaseModel):
    feasibility: FeasibilityRequest
    priority_inputs: PriorityScoreRequest


class EvaluateSlotResponse(BaseModel):
    feasibility: FeasibilityResult
    priority: PriorityScoreBreakdown
    decision_summary: str
