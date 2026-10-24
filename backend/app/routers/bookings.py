"""
Booking schedule arbitration, elapsed auto-removal, and 30-minute buffer lock router.
"""

from fastapi import APIRouter, HTTPException
from ..schemas.booking import (
    ScheduleArbitrationRequest,
    ScheduleArbitrationResponse,
    PruneElapsedRequest,
    PruneElapsedResponse,
)
from ..services.booking_service import BookingService

router = APIRouter(prefix="/api/v1/bookings", tags=["Bookings & Arbitration"])


@router.post("/prune-elapsed", response_model=PruneElapsedResponse)
def prune_elapsed_bookings(req: PruneElapsedRequest):
    """
    Filter out elapsed bookings (endTime <= reference_now) and return only active bookings.
    """
    try:
        active_bookings, removed_ids = BookingService.prune_elapsed_bookings(
            bookings=req.bookings,
            now=req.reference_now,
        )
        return PruneElapsedResponse(
            active_bookings=active_bookings,
            removed_elapsed_ids=removed_ids,
            removed_count=len(removed_ids),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/schedule", response_model=ScheduleArbitrationResponse)
def arbitrate_booking_schedule(req: ScheduleArbitrationRequest):
    """
    Arbitrate a new booking request against the resource's active schedule:
    1. Automatically prunes elapsed bookings (endTime <= now).
    2. Protects ongoing and 30-minute-buffer-mobilizing bookings from any priority preemption.
    3. Compares priority strictly against remaining future schedules (> 30 mins in the future).
    """
    try:
        result = BookingService.arbitrate_and_sequence_bookings(
            candidate_booking=req.candidate_booking,
            existing_bookings=req.existing_bookings,
            now=req.reference_now,
            default_buffer_minutes=req.default_buffer_minutes,
        )
        return ScheduleArbitrationResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
