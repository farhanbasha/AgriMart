"""
Booking Lifecycle, Elapsed Time Auto-Removal, Ongoing 30m Buffer Lock,
and Remaining-Schedule Priority Arbitration Service.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from backend.app.core.config import settings
from backend.app.core.security import ensure_utc, parse_iso_datetime, to_iso_z
from backend.app.services.feasibility_service import FeasibilityService


class BookingService:
    """
    Handles schedule lifecycle rules:
    1. Elapsed bookings (endTime <= now) are automatically pruned.
    2. Ongoing or 30-minute pre-start buffer locked bookings
       ((startTime - 30 mins) <= now < endTime) are strictly locked and
       NEVER disturbed or compared by priority against incoming bookings.
    3. Incoming bookings that overlap a locked ongoing schedule are shifted past
       (locked.endTime + transitBuffer) and arbitrated strictly against
       remaining future unlocked schedules.
    """

    ONGOING_LOCK_BUFFER_MINUTES: float = settings.ONGOING_LOCK_BUFFER_MINUTES

    @classmethod
    def is_booking_elapsed(
        cls, end_time: Any, now: Optional[datetime] = None
    ) -> bool:
        """Returns True if the booking's scheduled end_time has already elapsed (end_time <= now)."""
        ref_now = ensure_utc(now) if now else datetime.now(timezone.utc)
        parsed_end = parse_iso_datetime(end_time)
        return parsed_end <= ref_now

    @classmethod
    def prune_elapsed_bookings(
        cls,
        bookings: List[Dict[str, Any]],
        now: Optional[datetime] = None,
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Removes all bookings whose endTime has elapsed (endTime <= now).
        Returns (active_non_elapsed_bookings, removed_booking_ids).
        """
        ref_now = ensure_utc(now) if now else datetime.now(timezone.utc)
        kept: List[Dict[str, Any]] = []
        removed_ids: List[str] = []

        for b in bookings:
            end_raw = b.get("endTime") or b.get("end_time")
            b_id = str(b.get("id", ""))
            if not end_raw:
                kept.append(b)
                continue
            try:
                if cls.is_booking_elapsed(end_raw, ref_now):
                    if b_id:
                        removed_ids.append(b_id)
                else:
                    kept.append(b)
            except Exception:
                kept.append(b)

        return kept, removed_ids

    @staticmethod
    def _intervals_collide_with_buffer(
        s1: datetime,
        e1: datetime,
        s2: datetime,
        e2: datetime,
        buffer_minutes: float,
    ) -> bool:
        """Returns True if [s1, e1] and [s2, e2] overlap or violate buffer_minutes between them."""
        if max(s1, s2) < min(e1, e2):
            return True
        if e1 <= s2 and (s2 - e1).total_seconds() / 60.0 < buffer_minutes:
            return True
        if e2 <= s1 and (s1 - e2).total_seconds() / 60.0 < buffer_minutes:
            return True
        return False

    @classmethod
    def arbitrate_and_sequence_bookings(
        cls,
        candidate_booking: Dict[str, Any],
        existing_bookings: List[Dict[str, Any]],
        now: Optional[datetime] = None,
        default_buffer_minutes: float = 30.0,
    ) -> Dict[str, Any]:
        """
        Full Smart Schedule Arbitration Engine:
        1. Prunes elapsed bookings (endTime <= now).
        2. Protects ongoing & 30-minute buffer locked bookings ((startTime - 30m) <= now < endTime)
           so they are NEVER preempted or compared in priority.
        3. Advances candidate past locked.endTime + buffer and arbitrates priority strictly
           against remaining (unlocked) future schedules.
        """
        ref_now = ensure_utc(now) if now else datetime.now(timezone.utc)

        # 1. Prune all elapsed bookings
        non_elapsed_bookings, removed_elapsed_ids = cls.prune_elapsed_bookings(
            existing_bookings, ref_now
        )

        resource_id = candidate_booking.get("resourceId") or candidate_booking.get(
            "resource_id"
        )
        cand_id = str(
            candidate_booking.get("id") or f"book-{int(ref_now.timestamp() * 1000)}"
        )
        cand_start = parse_iso_datetime(
            candidate_booking.get("startTime") or candidate_booking.get("start_time")
        )
        cand_end = parse_iso_datetime(
            candidate_booking.get("endTime") or candidate_booking.get("end_time")
        )
        cand_duration = cand_end - cand_start
        if cand_duration.total_seconds() <= 0:
            cand_duration = timedelta(hours=4)
            cand_end = cand_start + cand_duration

        cand_buffer_min = float(
            candidate_booking.get("transitBufferMinutes")
            or candidate_booking.get("transit_buffer_minutes")
            or default_buffer_minutes
        )

        # 2. Filter active bookings for the same resource
        resource_bookings: List[Dict[str, Any]] = []
        for b in non_elapsed_bookings:
            b_res_id = b.get("resourceId") or b.get("resource_id")
            b_status = b.get("status", "confirmed")
            b_id = str(b.get("id", ""))
            if b_res_id == resource_id and b_status != "cancelled" and b_id != cand_id:
                resource_bookings.append(dict(b))

        # 3. Partition into LOCKED (Ongoing / within 30m buffer) vs UNLOCKED (Remaining future)
        locked_bookings: List[Dict[str, Any]] = []
        unlocked_bookings: List[Dict[str, Any]] = []

        for b in resource_bookings:
            b_start = parse_iso_datetime(b.get("startTime") or b.get("start_time"))
            b_end = parse_iso_datetime(b.get("endTime") or b.get("end_time"))
            if FeasibilityService.is_booking_locked_ongoing(
                b_start, b_end, ref_now, cls.ONGOING_LOCK_BUFFER_MINUTES
            ):
                locked_bookings.append(b)
            else:
                unlocked_bookings.append(b)

        locked_bookings.sort(
            key=lambda x: parse_iso_datetime(x.get("startTime") or x.get("start_time"))
        )
        unlocked_bookings.sort(
            key=lambda x: parse_iso_datetime(x.get("startTime") or x.get("start_time"))
        )

        # 4. Check if candidate collides with any locked ongoing booking
        colliding_locked: List[Dict[str, Any]] = []
        for lb in locked_bookings:
            lb_start = parse_iso_datetime(lb.get("startTime") or lb.get("start_time"))
            lb_end = parse_iso_datetime(lb.get("endTime") or lb.get("end_time"))
            lb_buf = max(
                cand_buffer_min,
                float(
                    lb.get("transitBufferMinutes")
                    or lb.get("transit_buffer_minutes")
                    or default_buffer_minutes
                ),
            )
            if cls._intervals_collide_with_buffer(
                cand_start, cand_end, lb_start, lb_end, lb_buf
            ):
                colliding_locked.append(lb)

        anchor_start: Optional[datetime] = None
        if colliding_locked:
            latest_locked_end = max(
                parse_iso_datetime(lb.get("endTime") or lb.get("end_time"))
                + timedelta(
                    minutes=max(
                        cand_buffer_min,
                        float(
                            lb.get("transitBufferMinutes")
                            or lb.get("transit_buffer_minutes")
                            or default_buffer_minutes
                        ),
                    )
                )
                for lb in colliding_locked
            )
            anchor_start = latest_locked_end

        tentative_cand_start = (
            max(cand_start, anchor_start) if anchor_start else cand_start
        )
        tentative_cand_end = tentative_cand_start + cand_duration

        # 5. Collect all UNLOCKED (remaining future) bookings that collide with candidate or shifted window
        competing_unlocked: List[Dict[str, Any]] = []
        competing_ids = set()
        cluster_start = tentative_cand_start
        cluster_end = tentative_cand_end

        changed = True
        while changed:
            changed = False
            for ub in unlocked_bookings:
                ub_id = str(ub.get("id", ""))
                if ub_id in competing_ids:
                    continue
                ub_start = parse_iso_datetime(ub.get("startTime") or ub.get("start_time"))
                ub_end = parse_iso_datetime(ub.get("endTime") or ub.get("end_time"))
                ub_dur = ub_end - ub_start
                ub_buf = max(
                    cand_buffer_min,
                    float(
                        ub.get("transitBufferMinutes")
                        or ub.get("transit_buffer_minutes")
                        or default_buffer_minutes
                    ),
                )
                collides_shifted = cls._intervals_collide_with_buffer(
                    cluster_start, cluster_end, ub_start, ub_end, ub_buf
                )
                collides_original = cls._intervals_collide_with_buffer(
                    cand_start, cand_end, ub_start, ub_end, ub_buf
                )
                if collides_shifted or collides_original:
                    competing_unlocked.append(ub)
                    competing_ids.add(ub_id)
                    cluster_start = min(cluster_start, ub_start)
                    if anchor_start:
                        cluster_start = max(cluster_start, anchor_start)
                    cluster_end = (
                        max(cluster_end, ub_end) + ub_dur + timedelta(minutes=ub_buf)
                    )
                    changed = True

        # Case A: Zero collision
        if not colliding_locked and not competing_unlocked:
            confirmed_cand = dict(candidate_booking)
            confirmed_cand["startTime"] = to_iso_z(cand_start)
            confirmed_cand["endTime"] = to_iso_z(cand_end)
            confirmed_cand["status"] = "confirmed"
            return {
                "has_conflict": False,
                "was_shifted_by_locked_ongoing": False,
                "locked_ongoing_bookings": [],
                "sequenced_bookings": [confirmed_cand],
                "removed_elapsed_ids": removed_elapsed_ids,
                "conflict_record": None,
            }

        # Case B: Collided ONLY with a Locked Ongoing booking
        if colliding_locked and not competing_unlocked:
            shifted_cand = dict(candidate_booking)
            shifted_cand["startTime"] = to_iso_z(tentative_cand_start)
            shifted_cand["endTime"] = to_iso_z(tentative_cand_end)
            shifted_cand["status"] = "confirmed"
            locked_names = ", ".join(
                str(lb.get("farmerName") or lb.get("farmer_name") or "Active Farmer")
                for lb in colliding_locked
            )
            shifted_cand["allocatedSlotExplanation"] = (
                f"Ongoing schedule ({locked_names}) is locked (currently active / within 30-min buffer). "
                f"Your booking is scheduled for the next immediate slot with +{int(cand_buffer_min)}m turnaround buffer."
            )
            return {
                "has_conflict": False,
                "was_shifted_by_locked_ongoing": True,
                "locked_ongoing_bookings": colliding_locked,
                "sequenced_bookings": [shifted_cand],
                "removed_elapsed_ids": removed_elapsed_ids,
                "conflict_record": None,
            }

        # Case C: Competes strictly against REMAINING (unlocked) future schedules
        cand_copy = dict(candidate_booking)
        competing_pool = [cand_copy] + [dict(u) for u in competing_unlocked]
        competing_pool.sort(
            key=lambda b: float(
                b.get("priorityScore") or b.get("priority_score") or 0.0
            ),
            reverse=True,
        )

        earliest_pool_start = min(
            parse_iso_datetime(b.get("startTime") or b.get("start_time"))
            for b in competing_pool
        )
        baseline_start = (
            max(earliest_pool_start, anchor_start)
            if anchor_start
            else earliest_pool_start
        )

        sequenced: List[Dict[str, Any]] = []
        prev_end: Optional[datetime] = None

        for idx, item in enumerate(competing_pool):
            b_copy = dict(item)
            orig_s = parse_iso_datetime(
                b_copy.get("startTime") or b_copy.get("start_time")
            )
            orig_e = parse_iso_datetime(
                b_copy.get("endTime") or b_copy.get("end_time")
            )
            dur = orig_e - orig_s
            if dur.total_seconds() <= 0:
                dur = timedelta(hours=4)
            buf_min = float(
                b_copy.get("transitBufferMinutes")
                or b_copy.get("transit_buffer_minutes")
                or default_buffer_minutes
            )

            if idx == 0:
                new_s = max(orig_s, baseline_start) if anchor_start else baseline_start
            else:
                earliest_next = prev_end + timedelta(minutes=buf_min)  # type: ignore
                new_s = max(orig_s, earliest_next)
                if new_s < earliest_next:
                    new_s = earliest_next

            new_e = new_s + dur
            prev_end = new_e

            b_copy["startTime"] = to_iso_z(new_s)
            b_copy["endTime"] = to_iso_z(new_e)
            b_copy["status"] = "confirmed"
            score_val = float(
                b_copy.get("priorityScore") or b_copy.get("priority_score") or 0.0
            )

            if idx == 0:
                if colliding_locked:
                    b_copy["allocatedSlotExplanation"] = (
                        f"Allocated: 1st Priority Turn among remaining schedules (Score: {score_val}/100) "
                        f"immediately following locked ongoing shift."
                    )
                else:
                    b_copy["allocatedSlotExplanation"] = (
                        f"Allocated: 1st Priority Turn (Fair Turn Score: {score_val}/100)"
                    )
            else:
                prev_farmer = (
                    sequenced[idx - 1].get("farmerName")
                    or sequenced[idx - 1].get("farmer_name")
                    or "Preceding Farmer"
                )
                b_copy["allocatedSlotExplanation"] = (
                    f"Allocated: Turn #{idx + 1} after {prev_farmer} (Sequential Auto-Schedule)"
                )

            sequenced.append(b_copy)

        winner = sequenced[0]
        runner_up = sequenced[1] if len(sequenced) > 1 else sequenced[0]
        win_score = float(
            winner.get("priorityScore") or winner.get("priority_score") or 0.0
        )
        run_score = float(
            runner_up.get("priorityScore") or runner_up.get("priority_score") or 0.0
        )
        win_breakdown = winner.get("scoreBreakdown") or {}
        run_breakdown = runner_up.get("scoreBreakdown") or {}

        if float(win_breakdown.get("weatherRiskPts", 0)) > float(
            run_breakdown.get("weatherRiskPts", 0)
        ):
            primary_factor = "Imminent Rainfall & Weather Threat"
        elif float(win_breakdown.get("urgencyJustificationPts", 0)) >= 5.0:
            primary_factor = "Emergency Urgency Justification & Spoilage Prevention"
        else:
            primary_factor = "Biological Crop Vulnerability & Shatter Risk"

        locked_note = (
            " Ongoing/buffer-locked shift was preserved untouched; priority arbitration evaluated only remaining schedules."
            if colliding_locked
            else ""
        )

        conflict_record = {
            "id": f"conflict-{int(ref_now.timestamp() * 1000)}",
            "resourceId": resource_id,
            "resourceName": winner.get("resourceName")
            or candidate_booking.get("resourceName")
            or "Equipment",
            "bookingA": winner,
            "bookingB": runner_up,
            "winningBookingId": winner.get("id"),
            "losingBookingId": runner_up.get("id"),
            "justificationEn": (
                f"Fair Turn Priority Decision: {winner.get('farmerName', 'Farmer A')} ({win_score}/100) "
                f"received 1st Priority Turn over {runner_up.get('farmerName', 'Farmer B')} ({run_score}/100). "
                f"Subsequent requests automatically scheduled to consecutive non-overlapping slots. "
                f"Deciding factors: {primary_factor} (+{round(win_score - run_score, 1)} pts advantage).{locked_note}"
            ),
            "contingencyAction": (
                f"Sequential scheduling active: {runner_up.get('farmerName', 'Farmer B')} has been automatically "
                f"allocated the next available consecutive slot without time collision."
            ),
            "primaryDecidingFactor": primary_factor,
            "resolvedAt": to_iso_z(ref_now),
            "rankedBookings": sequenced,
        }

        return {
            "has_conflict": True,
            "was_shifted_by_locked_ongoing": len(colliding_locked) > 0,
            "locked_ongoing_bookings": colliding_locked,
            "sequenced_bookings": sequenced,
            "removed_elapsed_ids": removed_elapsed_ids,
            "conflict_record": conflict_record,
        }
