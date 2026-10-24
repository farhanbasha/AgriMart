"""
Unit tests for BookingService:
1. Automatic removal of elapsed bookings (endTime <= now).
2. Ongoing & 30-Minute Buffer Lock Protection (e.g., Sunday 10:00 AM - 12:00 PM score 70
   cannot be displaced or compared in priority at 9:30 AM even by a score 80 request).
3. Priority comparison strictly against remaining future schedules (> 30 mins away).
"""

import unittest
from datetime import datetime, timezone
import sys
from pathlib import Path
_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
from backend.app.services.booking_service import BookingService


class TestBookingsService(unittest.TestCase):
    def test_elapsed_bookings_auto_pruned(self):
        ref_now = datetime(2026, 10, 11, 9, 30, 0, tzinfo=timezone.utc)
        bookings = [
            {
                "id": "elapsed-booking-1",
                "resourceId": "res-tractor-1",
                "farmerId": "f-old",
                "farmerName": "Old Farmer",
                "startTime": "2026-10-11T06:00:00Z",
                "endTime": "2026-10-11T08:00:00Z",
                "priorityScore": 95,
                "status": "confirmed",
            },
            {
                "id": "active-booking-2",
                "resourceId": "res-tractor-1",
                "farmerId": "f-active",
                "farmerName": "Active Farmer",
                "startTime": "2026-10-11T10:00:00Z",
                "endTime": "2026-10-11T12:00:00Z",
                "priorityScore": 70,
                "status": "confirmed",
            },
        ]

        kept, removed_ids = BookingService.prune_elapsed_bookings(
            bookings=bookings,
            now=ref_now,
        )
        self.assertEqual(removed_ids, ["elapsed-booking-1"])
        self.assertEqual(len(kept), 1)
        self.assertEqual(kept[0]["id"], "active-booking-2")

    def test_30_min_buffer_lock_and_remaining_schedule_arbitration(self):
        """
        Exact User Scenario:
        - Tractor booked Sunday 10:00 AM - 12:00 PM with priority score 70.
        - Another future booking on the same tractor at 12:30 PM - 2:30 PM with priority score 65.
        - At 9:30 AM (inside the 30-min mobilization buffer of the 10:00 AM slot), a new farmer
          requests 9:30 AM - 11:59 AM with priority score 80.
        - Expected:
          1. The elapsed 06:00 AM - 08:00 AM booking is automatically removed.
          2. The 10:00 AM - 12:00 PM booking (score 70) is locked because 09:30 AM is within
             its 30-minute mobilization buffer ((10:00 AM - 30m) <= 09:30 AM < 12:00 PM) and
             MUST NOT be disturbed or compared in priority.
          3. The new request (score 80) is shifted after the locked slot + 30m buffer (12:30 PM)
             and compared strictly against the remaining schedule (12:30 PM - 2:30 PM, score 65),
             winning 1st turn at 12:30 PM while the score 65 booking is sequenced after it.
        """
        sunday_930am = datetime(2026, 10, 11, 9, 30, 0, tzinfo=timezone.utc)
        existing_bookings = [
            {
                "id": "b-elapsed",
                "resourceId": "res-tractor-1",
                "farmerId": "f-0",
                "farmerName": "Past Farmer",
                "startTime": "2026-10-11T06:00:00Z",
                "endTime": "2026-10-11T08:00:00Z",
                "priorityScore": 90,
                "status": "confirmed",
            },
            {
                "id": "b-locked-10am",
                "resourceId": "res-tractor-1",
                "farmerId": "f-1",
                "farmerName": "Ramesh Kumar",
                "startTime": "2026-10-11T10:00:00Z",
                "endTime": "2026-10-11T12:00:00Z",
                "priorityScore": 70,
                "status": "confirmed",
            },
            {
                "id": "b-remaining-1230pm",
                "resourceId": "res-tractor-1",
                "farmerId": "f-2",
                "farmerName": "Suresh Patel",
                "startTime": "2026-10-11T12:30:00Z",
                "endTime": "2026-10-11T14:30:00Z",
                "priorityScore": 65,
                "status": "confirmed",
            },
        ]

        candidate_booking = {
            "id": "b-candidate-80",
            "resourceId": "res-tractor-1",
            "resourceName": "Mahindra Arjun 605 DI",
            "farmerId": "f-new",
            "farmerName": "Anita Devi",
            "startTime": "2026-10-11T09:30:00Z",
            "endTime": "2026-10-11T11:30:00Z",
            "priorityScore": 80,
            "status": "confirmed",
        }

        result = BookingService.arbitrate_and_sequence_bookings(
            candidate_booking=candidate_booking,
            existing_bookings=existing_bookings,
            now=sunday_930am,
            default_buffer_minutes=30.0,
        )

        # 1. Elapsed booking automatically removed
        self.assertIn("b-elapsed", result["removed_elapsed_ids"])

        # 2. 10:00 AM - 12:00 PM booking (score 70) is protected by 30m buffer lock at 9:30 AM
        self.assertTrue(result["was_shifted_by_locked_ongoing"])
        locked_ids = [b["id"] for b in result["locked_ongoing_bookings"]]
        self.assertEqual(locked_ids, ["b-locked-10am"])

        # Locked booking is NOT in sequenced_bookings (never re-ordered or displaced)
        sequenced_ids = [b["id"] for b in result["sequenced_bookings"]]
        self.assertNotIn("b-locked-10am", sequenced_ids)

        # 3. Candidate (score 80) competes strictly against remaining b-remaining-1230pm (score 65)
        self.assertEqual(sequenced_ids, ["b-candidate-80", "b-remaining-1230pm"])
        self.assertEqual(
            result["sequenced_bookings"][0]["startTime"], "2026-10-11T12:30:00.000Z"
        )
        self.assertEqual(
            result["sequenced_bookings"][0]["endTime"], "2026-10-11T14:30:00.000Z"
        )
        self.assertEqual(
            result["sequenced_bookings"][1]["startTime"], "2026-10-11T15:00:00.000Z"
        )


if __name__ == "__main__":
    unittest.main()
