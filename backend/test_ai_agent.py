"""
Unit tests for FarmGrid AI Agentic Integration
Verifies Agent 1 (Intake Normalizer), Agent 2 (Arbitration Explainer), and Disruption Simulation.
"""

from backend.ai_agent import FarmGridAIAgent


def run_ai_tests():
    print("--- 1. Testing Agent 1: Multimodal / Text Intake Normalizer ---")
    raw_colloquial = "Need 50HP tractor tomorrow 6 AM for 4 hours, heavy rain coming, wheat ready for harvest"
    intake_res = FarmGridAIAgent.normalize_farmer_intake(raw_colloquial)
    print(f"Parsed Intent: {intake_res.intent_type}")
    print(f"Duration: {intake_res.estimated_duration_hours}h")
    print(f"Crop Vulnerability: {intake_res.crop_vulnerability_level}/10")
    print(f"Weather Threat Stated: {intake_res.stated_weather_threat}")
    print(f"Urgency Rating: {intake_res.urgency_rating}/10")
    print(f"Summary: {intake_res.normalized_summary}")

    assert intake_res.intent_type in ["harvesting", "tillage", "spraying", "irrigation", "towing", "storage_haul"]
    assert intake_res.stated_weather_threat is True
    assert intake_res.crop_vulnerability_level >= 7
    assert intake_res.urgency_rating >= 7

    print("\n--- 2. Testing Agent 2: Explainable Arbitration Agent ---")
    cand_a = {
        "id": "book-harvest-urgent",
        "farmer_name": "Elena Rostova",
        "intent": "harvesting",
        "crop_stage": "Harvest-Ready",
        "priority_score": 92.5,
        "imminent_rainfall_mm": 24.0,
        "distance_km": 12.0,
    }
    cand_b = {
        "id": "book-towing-routine",
        "farmer_name": "Marcus Vance",
        "intent": "towing",
        "crop_stage": "Vegetative",
        "priority_score": 24.0,
        "imminent_rainfall_mm": 0.0,
        "distance_km": 35.0,
    }

    arbitration_res = FarmGridAIAgent.arbitrate_conflict(cand_a, cand_b)
    print(f"Winning Booking ID: {arbitration_res.winning_booking_id}")
    print(f"Losing Booking ID: {arbitration_res.losing_booking_id}")
    print(f"Justification (EN): {arbitration_res.justification_en}")
    print(f"Contingency Action: {arbitration_res.contingency_action}")
    print(f"Primary Deciding Factor: {arbitration_res.primary_deciding_factor}")

    assert arbitration_res.winning_booking_id == "book-harvest-urgent"
    assert arbitration_res.losing_booking_id == "book-towing-routine"
    assert len(arbitration_res.justification_en) > 20
    assert len(arbitration_res.contingency_action) > 15

    print("\n--- 3. Testing Dynamic Disruption Simulation ---")
    # Breakdown scenario
    breakdown_res = FarmGridAIAgent.simulate_disruption(
        disruption_type="EQUIPMENT_BREAKDOWN",
        resource_id="res-harvester-101",
        active_bookings=[
            {"id": "b-active-1", "plot_name": "North Field", "start_time": "2026-09-11T08:00:00Z"},
            {"id": "b-active-2", "plot_name": "South Ridge", "start_time": "2026-09-11T13:00:00Z"},
        ],
        available_substitutes=[
            {"id": "res-harvester-sub-202", "name": "Reserve Combine 75HP", "distance_km": 14.5}
        ],
    )
    print(f"Disruption Event: {breakdown_res.event_type}")
    print(f"Invalidated Bookings: {breakdown_res.invalidated_booking_ids}")
    print(f"Adjusted Schedules: {len(breakdown_res.adjusted_schedules)} slots")
    print(f"Coordination Rationale: {breakdown_res.human_readable_rationale}")
    print(f"Remediation Directives: {breakdown_res.remediation_steps}")

    assert breakdown_res.event_type == "EQUIPMENT_BREAKDOWN"
    assert len(breakdown_res.invalidated_booking_ids) == 2
    assert len(breakdown_res.adjusted_schedules) == 2

    # Sudden rain alert scenario
    rain_res = FarmGridAIAgent.simulate_disruption(
        disruption_type="SUDDEN_RAIN_ALERT",
        resource_id="res-tractor-303",
        active_bookings=[
            {"id": "b-active-3", "plot_name": "Creek Corn", "start_time": "2026-09-11T10:00:00Z"}
        ],
        available_substitutes=[],
    )
    print(f"\nDisruption Event: {rain_res.event_type}")
    print(f"Rain Coordination Rationale: {rain_res.human_readable_rationale}")
    assert rain_res.event_type == "SUDDEN_RAIN_ALERT"

    print("\nALL AI AGENT TESTS PASSED!")


if __name__ == "__main__":
    run_ai_tests()
