"""
Unit tests for all 4 AgriMartAIAgent capabilities (Intake, Urgency, Arbitration, Disruption).
"""

import json
import unittest
from unittest.mock import patch
import sys
from pathlib import Path
_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
from backend.app.schemas.ai_agent import ArbitrateConflictRequest
from backend.app.services.ai_service import AgriMartAIAgent


class TestAgriMartAIAgents(unittest.TestCase):
    def setUp(self):
        self.client_patcher = patch.object(AgriMartAIAgent, "_get_client", return_value=None)
        self.client_patcher.start()

    def tearDown(self):
        self.client_patcher.stop()
    def test_agent_1_intake_normalization(self):
        raw_text = (
            "Bhaiya mere khet mein kal subah 6 ghante katayi ke liye "
            "harvester chahiye, baarish aane wali hai!"
        )
        result = AgriMartAIAgent.normalize_farmer_intake(raw_text)
        self.assertEqual(result.intent, "harvesting")
        self.assertTrue(result.weather_threat_detected)
        self.assertGreaterEqual(result.urgency_rating, 7)

    def test_agent_2_arbitration_explanation(self):
        req = ArbitrateConflictRequest(
            resource_name="John Deere Combine Harvester",
            winning_farmer_name="Anita Devi",
            winning_plot_name="North Canal Plot #4",
            winning_intent="harvesting",
            winning_crop_stage="Harvest-Ready",
            winning_score=88.5,
            winning_weather_pts=22.0,
            winning_urgency_pts=24.0,
            losing_farmer_name="Suresh Patel",
            losing_plot_name="East Ridge Plot #2",
            losing_intent="tillage",
            losing_crop_stage="Post-Harvest",
            losing_score=42.0,
            next_available_slot_iso="2026-10-11T15:00:00Z",
        )
        result = AgriMartAIAgent.generate_arbitration_explanation(req)
        self.assertIn("88.5", result.winning_farmer_justification_en)
        self.assertTrue(len(result.losing_farmer_explanation_en) > 20)
        self.assertTrue(len(result.contingency_recommendation) > 10)
        self.assertTrue(len(result.fairness_audit_note) > 10)

    def test_agent_3_disruption_simulation(self):
        schedule_state = {
            "bookings": [
                {
                    "id": "b-1",
                    "farmerName": "Kisan One",
                    "startTime": "2026-10-12T10:00:00Z",
                    "endTime": "2026-10-12T12:00:00Z",
                    "resourceId": "res-1",
                }
            ]
        }
        res = AgriMartAIAgent.simulate_disruption(
            disruption_type="EQUIPMENT_BREAKDOWN",
            affected_machine_id="res-1",
            duration_hours=4.0,
            current_schedule_json=json.dumps(schedule_state),
        )
        self.assertTrue(len(res.system_action_taken) > 10)
        self.assertGreaterEqual(len(res.reallocated_bookings), 1)
        self.assertGreaterEqual(len(res.sms_notifications), 1)

    def test_agent_4_urgency_evaluation(self):
        result = AgriMartAIAgent.evaluate_urgency_justification(
            justification_text="Heavy unseasonal rain forecast tomorrow, ripe wheat grain shattering risk.",
            crop_stage="Harvest-Ready",
            rainfall_mm=28.0,
        )
        self.assertIn(result.threatLevel, ["CRITICAL", "HIGH", "MODERATE", "LOW"])
        self.assertGreater(result.urgencyScoreBonus, 0.0)
        self.assertGreater(result.verified_urgency_multiplier, 1.0)


if __name__ == "__main__":
    unittest.main()
