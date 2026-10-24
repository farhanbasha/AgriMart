"""
Feasibility & Turnaround Conflict Verification Service.
Validates 50km geofencing, time-slot overlaps, and inter-farm transit buffers.
"""

from datetime import datetime, timedelta
from typing import Any, List, Optional
from backend.app.core.config import settings
from backend.app.core.security import ensure_utc, parse_iso_datetime
from backend.app.schemas.allocation import (
    ExistingBookingDTO,
    FeasibilityRequest,
    FeasibilityResult,
)
from backend.app.services.geo_service import GeoService


class FeasibilityService:
    """Evaluates whether a requested booking slot is physically and temporally feasible."""

    ONGOING_LOCK_BUFFER_MINUTES: float = settings.ONGOING_LOCK_BUFFER_MINUTES

    @classmethod
    def is_booking_locked_ongoing(
        cls,
        start_time: Any,
        end_time: Any,
        now: Optional[datetime] = None,
        lock_buffer_minutes: Optional[float] = None,
    ) -> bool:
        """
        Returns True if a booking is currently ongoing OR within its 30-minute pre-start
        mobilization buffer window:
            (start_time - 30 minutes) <= now < end_time
        """
        from datetime import timezone

        ref_now = ensure_utc(now) if now else datetime.now(timezone.utc)
        parsed_start = parse_iso_datetime(start_time)
        parsed_end = parse_iso_datetime(end_time)
        buffer_min = (
            lock_buffer_minutes
            if lock_buffer_minutes is not None
            else cls.ONGOING_LOCK_BUFFER_MINUTES
        )
        lock_window_start = parsed_start - timedelta(minutes=buffer_min)
        return lock_window_start <= ref_now < parsed_end

    @classmethod
    def check_slot_feasibility(cls, request: FeasibilityRequest) -> FeasibilityResult:
        """
        Verifies:
        1. Geofencing: Plot must be <= resource_max_radius_km (strictly <= 50 km).
        2. Chronological validity: end_time > start_time.
        3. Elapsed bookings (end_time <= reference_now) are automatically ignored.
        4. No direct overlap with existing confirmed/in_use bookings.
        5. Sufficient transit + maintenance buffer between consecutive bookings.
        """
        distance_from_base = GeoService.calculate_haversine_distance(
            request.resource_base_lat,
            request.resource_base_lng,
            request.plot_lat,
            request.plot_lng,
        )
        transit_min, maint_min, total_buffer_min = GeoService.calculate_transit_buffer(
            distance_from_base
        )

        effective_radius = request.resource_max_radius_km or GeoService.DEFAULT_MAX_RADIUS_KM
        if distance_from_base > effective_radius:
            return FeasibilityResult(
                is_feasible=False,
                distance_km=distance_from_base,
                geofence_passed=False,
                transit_buffer_minutes=transit_min,
                maintenance_buffer_minutes=maint_min,
                total_turnaround_minutes=total_buffer_min,
                conflict_detected=True,
                conflict_reason=(
                    f"Plot distance ({distance_from_base} km) strictly violates the "
                    f"{effective_radius} km geofence boundary."
                ),
                earliest_available_start=None,
            )

        req_start = ensure_utc(request.start_time)
        req_end = ensure_utc(request.end_time)
        ref_now = ensure_utc(request.reference_now) if request.reference_now else None

        if req_end <= req_start:
            return FeasibilityResult(
                is_feasible=False,
                distance_km=distance_from_base,
                geofence_passed=True,
                transit_buffer_minutes=transit_min,
                maintenance_buffer_minutes=maint_min,
                total_turnaround_minutes=total_buffer_min,
                conflict_detected=True,
                conflict_reason="Booking end_time must be chronologically after start_time.",
                earliest_available_start=None,
            )

        active_bookings: List[ExistingBookingDTO] = []
        for b in request.existing_bookings:
            if b.status not in ("confirmed", "in_use", "pending"):
                continue
            b_end = ensure_utc(b.end_time)
            if ref_now and b_end <= ref_now:
                continue
            active_bookings.append(b)

        active_bookings.sort(key=lambda b: ensure_utc(b.start_time))

        for b in active_bookings:
            b_start = ensure_utc(b.start_time)
            b_end = ensure_utc(b.end_time)
            is_locked = (
                cls.is_booking_locked_ongoing(b_start, b_end, ref_now)
                if ref_now
                else False
            )

            # Check A: Direct interval overlap
            if max(req_start, b_start) < min(req_end, b_end):
                return FeasibilityResult(
                    is_feasible=False,
                    distance_km=distance_from_base,
                    geofence_passed=True,
                    transit_buffer_minutes=transit_min,
                    maintenance_buffer_minutes=maint_min,
                    total_turnaround_minutes=total_buffer_min,
                    conflict_detected=True,
                    conflict_reason=(
                        f"Direct schedule collision with Booking [{b.id[:8]}] "
                        f"({b_start.strftime('%Y-%m-%d %H:%M')} to {b_end.strftime('%Y-%m-%d %H:%M')} UTC)."
                    ),
                    earliest_available_start=b_end + timedelta(minutes=total_buffer_min),
                    has_locked_ongoing_conflict=is_locked,
                    locked_booking_ids=[b.id] if is_locked else [],
                )

            # Check B: Preceding booking transit buffer
            if b_end <= req_start:
                inter_farm_dist = GeoService.calculate_haversine_distance(
                    b.plot_lat, b.plot_lng, request.plot_lat, request.plot_lng
                )
                _, _, needed_buffer = GeoService.calculate_transit_buffer(inter_farm_dist)
                actual_gap_minutes = (req_start - b_end).total_seconds() / 60.0

                if actual_gap_minutes < needed_buffer:
                    return FeasibilityResult(
                        is_feasible=False,
                        distance_km=distance_from_base,
                        geofence_passed=True,
                        transit_buffer_minutes=transit_min,
                        maintenance_buffer_minutes=maint_min,
                        total_turnaround_minutes=total_buffer_min,
                        conflict_detected=True,
                        conflict_reason=(
                            f"Transit buffer violation: Preceding booking [{b.id[:8]}] ends at "
                            f"{b_end.strftime('%H:%M')} UTC. Requires {needed_buffer:.0f} min transit/prep "
                            f"for {inter_farm_dist:.1f} km inter-farm transit (only {actual_gap_minutes:.0f} min available)."
                        ),
                        earliest_available_start=b_end + timedelta(minutes=needed_buffer),
                        has_locked_ongoing_conflict=is_locked,
                        locked_booking_ids=[b.id] if is_locked else [],
                    )

            # Check C: Succeeding booking transit buffer
            if req_end <= b_start:
                inter_farm_dist = GeoService.calculate_haversine_distance(
                    request.plot_lat, request.plot_lng, b.plot_lat, b.plot_lng
                )
                _, _, needed_buffer = GeoService.calculate_transit_buffer(inter_farm_dist)
                actual_gap_minutes = (b_start - req_end).total_seconds() / 60.0

                if actual_gap_minutes < needed_buffer:
                    return FeasibilityResult(
                        is_feasible=False,
                        distance_km=distance_from_base,
                        geofence_passed=True,
                        transit_buffer_minutes=transit_min,
                        maintenance_buffer_minutes=maint_min,
                        total_turnaround_minutes=total_buffer_min,
                        conflict_detected=True,
                        conflict_reason=(
                            f"Transit buffer violation: Succeeding booking [{b.id[:8]}] starts at "
                            f"{b_start.strftime('%H:%M')} UTC. Inter-farm transit to that plot ({inter_farm_dist:.1f} km) "
                            f"demands {needed_buffer:.0f} min buffer, but available gap is only {actual_gap_minutes:.0f} min."
                        ),
                        earliest_available_start=None,
                        has_locked_ongoing_conflict=is_locked,
                        locked_booking_ids=[b.id] if is_locked else [],
                    )

        return FeasibilityResult(
            is_feasible=True,
            distance_km=distance_from_base,
            geofence_passed=True,
            transit_buffer_minutes=transit_min,
            maintenance_buffer_minutes=maint_min,
            total_turnaround_minutes=total_buffer_min,
            conflict_detected=False,
            conflict_reason=None,
            earliest_available_start=req_start,
            has_locked_ongoing_conflict=False,
            locked_booking_ids=[],
        )
