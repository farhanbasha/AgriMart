"""
Booking and ConflictRecord domain models.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class BookingModel:
    id: str
    resource_id: str
    resource_name: str
    farmer_id: str
    farmer_name: str
    plot_id: str
    plot_name: str
    plot_lat: float
    plot_lng: float
    crop_stage: str
    intent: str
    start_time: str
    end_time: str
    priority_score: float
    status: str = "confirmed"
    transit_buffer_minutes: float = 30.0
    distance_km: float = 0.0
    score_breakdown: Dict[str, Any] = field(default_factory=dict)
    urgency_justification: Optional[str] = None
    allocated_slot_explanation: Optional[str] = None
    total_cost_rupees: Optional[float] = None


@dataclass
class ConflictRecordModel:
    id: str
    resource_id: str
    resource_name: str
    booking_a: Dict[str, Any]
    booking_b: Dict[str, Any]
    winning_booking_id: str
    losing_booking_id: str
    justification_en: str
    contingency_action: str
    primary_deciding_factor: str
    resolved_at: str
    ranked_bookings: List[Dict[str, Any]] = field(default_factory=list)
