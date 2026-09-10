"""
Unit test script to verify FarmGrid engine logic, formulas, and edge cases.
"""

from datetime import datetime, timedelta, timezone
from backend.engine import (
    FarmGridEngine,
    FeasibilityRequest,
    PriorityScoreRequest,
    ExistingBookingDTO,
)


def run_tests():
    print("--- 1. Testing Haversine Distance & Geofence ---")
    # Base: Chicago (41.8781, -87.6298)
    # Plot Near: Evanston (42.0451, -87.6877) ~ 19 km
    # Plot Far: Rockford (42.2711, -89.0940) ~ 125 km
    base_lat, base_lng = 41.8781, -87.6298
    near_lat, near_lng = 42.0451, -87.6877
    far_lat, far_lng = 42.2711, -89.0940

    dist_near = FarmGridEngine.calculate_haversine_distance(base_lat, base_lng, near_lat, near_lng)
    dist_far = FarmGridEngine.calculate_haversine_distance(base_lat, base_lng, far_lat, far_lng)
    print(f"Distance to near plot: {dist_near} km (Expected ~19 km)")
    print(f"Distance to far plot: {dist_far} km (Expected ~125 km)")
    assert 17.0 <= dist_near <= 21.0, "Near distance assertion failed"
    assert dist_far > 100.0, "Far distance assertion failed"

    print("\n--- 2. Testing Transit Buffer Calculation ---")
    # At 30 km/h, 15 km = 30 min transit + 30 min maintenance = 60 min total
    transit_m, maint_m, total_m = FarmGridEngine.calculate_transit_buffer(15.0)
    print(f"For 15km: transit={transit_m}m, maint={maint_m}m, total={total_m}m")
    assert transit_m == 30.0
    assert maint_m == 30.0
    assert total_m == 60.0

    print("\n--- 3. Testing Feasibility & Geofencing ---")
    now = datetime.now(timezone.utc)
    
    # Test A: Far plot beyond 50km
    req_far = FeasibilityRequest(
        resource_id="res-1",
        resource_base_lat=base_lat,
        resource_base_lng=base_lng,
        resource_max_radius_km=50.0,
        plot_lat=far_lat,
        plot_lng=far_lng,
        start_time=now + timedelta(hours=2),
        end_time=now + timedelta(hours=6),
        existing_bookings=[],
    )
    res_far = FarmGridEngine.check_slot_feasibility(req_far)
    print(f"Far plot feasible: {res_far.is_feasible}, reason: {res_far.conflict_reason}")
    assert not res_far.is_feasible
    assert not res_far.geofence_passed

    # Test B: Near plot with direct booking collision
    existing = [
        ExistingBookingDTO(
            id="book-collision",
            resource_id="res-1",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=4),
            plot_lat=near_lat,
            plot_lng=near_lng,
            status="confirmed",
        )
    ]
    req_colliding = FeasibilityRequest(
        resource_id="res-1",
        resource_base_lat=base_lat,
        resource_base_lng=base_lng,
        resource_max_radius_km=50.0,
        plot_lat=near_lat,
        plot_lng=near_lng,
        start_time=now + timedelta(hours=3),
        end_time=now + timedelta(hours=7),
        existing_bookings=existing,
    )
    res_colliding = FarmGridEngine.check_slot_feasibility(req_colliding)
    print(f"Direct collision feasible: {res_colliding.is_feasible}, reason: {res_colliding.conflict_reason}")
    assert not res_colliding.is_feasible
    assert res_colliding.conflict_detected

    # Test C: Transit buffer collision
    # Preceding booking ends at now + 2h at a plot 20km away.
    # Transit buffer needed = (20 / 30)*60 + 30 = 40 + 30 = 70 min.
    # Candidate starts at now + 2h 30m (only 30 min gap). Should fail buffer!
    existing_transit = [
        ExistingBookingDTO(
            id="book-preceding",
            resource_id="res-1",
            start_time=now,
            end_time=now + timedelta(hours=2),
            plot_lat=base_lat,
            plot_lng=base_lng,
            status="confirmed",
        )
    ]
    req_tight = FeasibilityRequest(
        resource_id="res-1",
        resource_base_lat=base_lat,
        resource_base_lng=base_lng,
        resource_max_radius_km=50.0,
        plot_lat=near_lat,
        plot_lng=near_lng,
        start_time=now + timedelta(hours=2, minutes=30),
        end_time=now + timedelta(hours=5),
        existing_bookings=existing_transit,
    )
    res_tight = FarmGridEngine.check_slot_feasibility(req_tight)
    print(f"Transit buffer collision feasible: {res_tight.is_feasible}, reason: {res_tight.conflict_reason}")
    assert not res_tight.is_feasible

    print("\n--- 4. Testing Deterministic Priority Engine (0-100) ---")
    # Critical High Priority Scenario:
    # Urgent start in 4 hours, 28mm imminent rain + storm alert, Harvest-Ready crop, 18h wait, 5km distance, harvesting intent, 5.0 condition
    high_req = PriorityScoreRequest(
        start_time=now + timedelta(hours=4),
        request_timestamp=now,
        imminent_rainfall_mm=28.0,
        severe_weather_alert=True,
        crop_stage="Harvest-Ready",
        queue_wait_hours=18.0,
        distance_km=5.0,
        intent="harvesting",
        resource_condition_rating=5.0,
    )
    high_res = FarmGridEngine.compute_priority_score(high_req)
    print(f"High Priority Total: {high_res.total_priority_score} pts")
    print(f"Breakdown: Urgency={high_res.urgency_deadline_pts}, Weather={high_res.weather_risk_pts}, "
          f"Crop={high_res.crop_vulnerability_pts}, AntiStarvation={high_res.anti_starvation_pts}, "
          f"Proximity={high_res.logistics_proximity_pts}, Intent={high_res.intent_condition_pts}")
    assert high_res.total_priority_score >= 85.0

    # Low Priority Trivial Scenario:
    # Towing intent, 5 days away, 0mm rain, vegetative crop, 0h wait, 45km distance, 3.0 condition
    low_req = PriorityScoreRequest(
        start_time=now + timedelta(days=5),
        request_timestamp=now,
        imminent_rainfall_mm=0.0,
        severe_weather_alert=False,
        crop_stage="Vegetative",
        queue_wait_hours=0.0,
        distance_km=45.0,
        intent="towing",
        resource_condition_rating=3.0,
    )
    low_res = FarmGridEngine.compute_priority_score(low_req)
    print(f"\nLow Priority Total: {low_res.total_priority_score} pts")
    print(f"Breakdown: Urgency={low_res.urgency_deadline_pts}, Weather={low_res.weather_risk_pts}, "
          f"Crop={low_res.crop_vulnerability_pts}, AntiStarvation={low_res.anti_starvation_pts}, "
          f"Proximity={low_res.logistics_proximity_pts}, Intent={low_res.intent_condition_pts}")
    assert low_res.total_priority_score < 30.0

    print("\nALL ENGINE TESTS PASSED!")


if __name__ == "__main__":
    run_tests()
