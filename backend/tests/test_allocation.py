"""
Unit tests for spatial feasibility (GeoService, FeasibilityService) and PriorityService.
"""

import unittest
from datetime import datetime, timedelta, timezone
import sys
from pathlib import Path
_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
from backend.app.schemas.allocation import (
    ExistingBookingDTO,
    FeasibilityRequest,
    PriorityScoreRequest,
)
from backend.app.services.geo_service import GeoService
from backend.app.services.feasibility_service import FeasibilityService
from backend.app.services.priority_service import PriorityService


class TestAllocationServices(unittest.TestCase):
    def test_haversine_distance(self):
        dist = GeoService.calculate_haversine_distance(30.9010, 75.8573, 30.9500, 75.9000)
        self.assertAlmostEqual(dist, 6.8, delta=0.5)

    def test_feasibility_geofence_rejection(self):
        now = datetime.now(timezone.utc)
        req = FeasibilityRequest(
            resource_id="res-1",
            resource_base_lat=30.0000,
            resource_base_lng=75.0000,
            resource_max_radius_km=10.0,
            plot_lat=31.0000,
            plot_lng=76.0000,
            start_time=now + timedelta(hours=2),
            end_time=now + timedelta(hours=4),
        )
        result = FeasibilityService.check_slot_feasibility(req)
        self.assertFalse(result.is_feasible)
        self.assertFalse(result.geofence_passed)
        self.assertIn("geofence boundary", result.conflict_reason or "")

    def test_feasibility_buffer_violation(self):
        now = datetime.now(timezone.utc)
        existing = ExistingBookingDTO(
            id="b-101",
            resource_id="res-1",
            plot_lat=30.9010,
            plot_lng=75.8573,
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=3),
            status="confirmed",
        )
        req = FeasibilityRequest(
            resource_id="res-1",
            resource_base_lat=30.9000,
            resource_base_lng=75.8500,
            resource_max_radius_km=25.0,
            plot_lat=30.9500,
            plot_lng=75.9000,
            start_time=now + timedelta(hours=3, minutes=15),
            end_time=now + timedelta(hours=5),
            existing_bookings=[existing],
            reference_now=now,
        )
        result = FeasibilityService.check_slot_feasibility(req)
        self.assertFalse(result.is_feasible)
        self.assertTrue(result.conflict_detected)
        self.assertIn("Transit buffer violation", result.conflict_reason or "")

    def test_custom_lender_serviceable_distance_cutoff(self):
        """
        Tests lender customizable max serviceable distance:
        e.g., 30 km limit rejects plot at 35 km; 40 km limit allows plot at 35 km but rejects at 45 km.
        """
        now = datetime.now(timezone.utc)
        # Base at (30.0000, 75.0000)
        # Point A (~20 km away): (30.1500, 75.1000)
        # Point B (~35 km away): (30.2800, 75.1800)
        # Point C (~45 km away): (30.3600, 75.2500)
        dist_b = GeoService.calculate_haversine_distance(30.0, 75.0, 30.28, 75.18)
        self.assertTrue(32.0 <= dist_b <= 38.0, f"Distance B is {dist_b}")

        # 1. 30 km max service distance: Point B (>30 km) must fail
        req_30km = FeasibilityRequest(
            resource_id="res-tractor-30",
            resource_base_lat=30.0,
            resource_base_lng=75.0,
            resource_max_radius_km=30.0,
            plot_lat=30.28,
            plot_lng=75.18,
            start_time=now + timedelta(hours=2),
            end_time=now + timedelta(hours=4),
        )
        res_30km = FeasibilityService.check_slot_feasibility(req_30km)
        self.assertFalse(res_30km.is_feasible)
        self.assertFalse(res_30km.geofence_passed)
        self.assertIn("30.0 km geofence boundary", res_30km.conflict_reason)

        # 2. 40 km max service distance: Point B (<40 km) must pass geofence
        req_40km = FeasibilityRequest(
            resource_id="res-tractor-40",
            resource_base_lat=30.0,
            resource_base_lng=75.0,
            resource_max_radius_km=40.0,
            plot_lat=30.28,
            plot_lng=75.18,
            start_time=now + timedelta(hours=2),
            end_time=now + timedelta(hours=4),
        )
        res_40km = FeasibilityService.check_slot_feasibility(req_40km)
        self.assertTrue(res_40km.geofence_passed)

        # 3. 40 km max service distance: Point C (>40 km) must fail
        dist_c = GeoService.calculate_haversine_distance(30.0, 75.0, 30.36, 75.25)
        self.assertTrue(dist_c > 40.0, f"Distance C is {dist_c}")
        req_40km_far = FeasibilityRequest(
            resource_id="res-tractor-40",
            resource_base_lat=30.0,
            resource_base_lng=75.0,
            resource_max_radius_km=40.0,
            plot_lat=30.36,
            plot_lng=75.25,
            start_time=now + timedelta(hours=2),
            end_time=now + timedelta(hours=4),
        )
        res_40km_far = FeasibilityService.check_slot_feasibility(req_40km_far)
        self.assertFalse(res_40km_far.is_feasible)
        self.assertFalse(res_40km_far.geofence_passed)
        self.assertIn("40.0 km geofence boundary", res_40km_far.conflict_reason)

    def test_priority_score_emergency_vs_luxury(self):
        now = datetime.now(timezone.utc)
        emergency_req = PriorityScoreRequest(
            start_time=now + timedelta(hours=3),
            request_timestamp=now,
            imminent_rainfall_mm=30.0,
            severe_weather_alert=True,
            crop_stage="Harvest-Ready",
            queue_wait_hours=28.0,
            distance_km=3.0,
            intent="harvesting",
            resource_condition_rating=4.8,
            urgency_justification_bonus=9.5,
        )
        emergency_res = PriorityService.compute_priority_score(emergency_req)
        self.assertGreaterEqual(emergency_res.total_priority_score, 90.0)

        luxury_req = PriorityScoreRequest(
            start_time=now + timedelta(days=6),
            request_timestamp=now,
            imminent_rainfall_mm=0.0,
            severe_weather_alert=False,
            crop_stage="Post-Harvest",
            queue_wait_hours=0.0,
            distance_km=42.0,
            intent="towing",
            resource_condition_rating=3.0,
        )
        luxury_res = PriorityService.compute_priority_score(luxury_req)
        self.assertLessEqual(luxury_res.total_priority_score, 20.0)


if __name__ == "__main__":
    unittest.main()
