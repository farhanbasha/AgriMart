"""
Pydantic schemas for Schedule Arbitration, Ongoing 30m Buffer Lock, and Elapsed Booking Pruning.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ScheduleArbitrationRequest(BaseModel):
    candidate_booking: Dict[str, Any] = Field(
        ...,
        description="The new candidate booking object being requested by a farmer.",
    )
    existing_bookings: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="All existing bookings currently in the system.",
    )
    reference_now: Optional[datetime] = Field(
        default=None,
        description="Optional reference UTC timestamp (defaults to current server UTC time).",
    )
    default_buffer_minutes: float = Field(default=30.0, ge=0.0, le=240.0)


class ScheduleArbitrationResponse(BaseModel):
    has_conflict: bool
    was_shifted_by_locked_ongoing: bool
    locked_ongoing_bookings: List[Dict[str, Any]]
    sequenced_bookings: List[Dict[str, Any]]
    removed_elapsed_ids: List[str]
    conflict_record: Optional[Dict[str, Any]] = None


class PruneElapsedRequest(BaseModel):
    bookings: List[Dict[str, Any]] = Field(default_factory=list)
    reference_now: Optional[datetime] = None


class PruneElapsedResponse(BaseModel):
    active_bookings: List[Dict[str, Any]]
    removed_elapsed_ids: List[str]
    removed_count: int
