"""
Unit tests for FastAPI application bootstrap, route registration, and internal health check.
"""

import unittest
import sys
from pathlib import Path
_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
from backend.app.main import app
from backend.app.internal.admin import health_check, internal_diagnostics
from backend.app.routers import allocation, bookings, ai_agents, disruptions, sms, auth


class TestMainApp(unittest.TestCase):
    def test_health_check_endpoint(self):
        response = health_check()
        self.assertEqual(response["status"], "ok")
        self.assertEqual(response["service"], "AgriMart Allocation Engine")
        self.assertTrue(response["features"]["elapsed_booking_auto_prune"])
        self.assertTrue(response["features"]["ongoing_and_30m_buffer_lock"])

    def test_internal_diagnostics_endpoint(self):
        diag = internal_diagnostics()
        self.assertEqual(diag["operational_rules"]["ongoing_buffer_minutes"], 30.0)
        self.assertIn("database", diag)

    def test_registered_routers_and_endpoints(self):
        self.assertEqual(app.title, "AgriMart Cooperative Engine & AI API")
        self.assertEqual(auth.router.prefix, "/api/v1/auth")
        self.assertEqual(allocation.router.prefix, "/api/v1")
        self.assertEqual(bookings.router.prefix, "/api/v1/bookings")
        self.assertEqual(ai_agents.router.prefix, "/api/v1")
        self.assertEqual(sms.router.prefix, "/api/v1/sms")
        self.assertTrue(callable(auth.register))
        self.assertTrue(callable(auth.login))
        self.assertTrue(callable(auth.google_auth))
        self.assertTrue(callable(allocation.evaluate_feasibility))
        self.assertTrue(callable(bookings.arbitrate_booking_schedule))
        self.assertTrue(callable(ai_agents.parse_intake))
        self.assertTrue(callable(disruptions.simulate_disruption))
        self.assertTrue(callable(sms.send_sms_endpoint))


if __name__ == "__main__":
    unittest.main()
