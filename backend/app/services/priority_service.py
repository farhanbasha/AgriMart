"""
Deterministic 0-100 Fair Turn Priority Scoring Service.
Evaluates urgency, weather risk, crop vulnerability, anti-starvation wait,
logistics proximity, and equipment condition.
"""

from datetime import datetime, timezone
from backend.app.core.config import settings
from backend.app.core.security import ensure_utc
from backend.app.schemas.allocation import (
    PriorityScoreBreakdown,
    PriorityScoreRequest,
)


class PriorityService:
    """Computes the deterministic 0-100 Fair Turn priority score."""

    DEFAULT_MAX_RADIUS_KM: float = settings.DEFAULT_MAX_RADIUS_KM

    @classmethod
    def compute_priority_score(
        cls, params: PriorityScoreRequest
    ) -> PriorityScoreBreakdown:
        """
        Deterministic 0-100 Priority Engine:
        1. Urgency / Deadline Proximity (& optional Justification Bonus): 25 pts max
        2. Weather Risk Exposure: 25 pts max
        3. Crop Vulnerability / Stage: 20 pts max
        4. Anti-Starvation Queue Wait Time: 15 pts max
        5. Logistics Proximity (<=50km): 10 pts max
        6. Equipment Condition & Intent Alignment: 5 pts max
        """
        now = (
            ensure_utc(params.request_timestamp)
            if params.request_timestamp
            else datetime.now(timezone.utc)
        )
        start_utc = ensure_utc(params.start_time)
        hours_until_start = max(0.0, (start_utc - now).total_seconds() / 3600.0)

        # 1. Urgency / Deadline Proximity (25 pts max)
        urgency_bonus = 0.0
        if params.urgency_justification_bonus is not None:
            if hours_until_start <= 6.0:
                base_urgency = 15.0
            elif hours_until_start <= 12.0:
                base_urgency = 13.0
            elif hours_until_start <= 24.0:
                base_urgency = 10.0
            elif hours_until_start <= 48.0:
                base_urgency = 7.0
            elif hours_until_start <= 72.0:
                base_urgency = 4.0
            else:
                base_urgency = max(1.0, 15.0 - (hours_until_start / 168.0) * 14.0)
            urgency_bonus = round(
                min(10.0, max(0.0, params.urgency_justification_bonus)), 2
            )
            urgency_pts = round(min(25.0, max(0.0, base_urgency + urgency_bonus)), 2)
        else:
            if hours_until_start <= 6.0:
                urgency_pts = 25.0
            elif hours_until_start <= 12.0:
                urgency_pts = 22.0
            elif hours_until_start <= 24.0:
                urgency_pts = 18.0
            elif hours_until_start <= 48.0:
                urgency_pts = 12.0
            elif hours_until_start <= 72.0:
                urgency_pts = 7.0
            else:
                urgency_pts = max(2.0, 25.0 - (hours_until_start / 168.0) * 23.0)
            urgency_pts = round(min(25.0, max(0.0, urgency_pts)), 2)

        # 2. Weather Risk Exposure (25 pts max)
        rain_pts = min(20.0, (params.imminent_rainfall_mm / 25.0) * 20.0)
        alert_pts = 5.0 if params.severe_weather_alert else 0.0
        weather_pts = round(min(25.0, rain_pts + alert_pts), 2)

        # 3. Crop Vulnerability / Stage (20 pts max)
        stage_map = {
            "harvest-ready": 20.0,
            "ripening": 16.0,
            "flowering": 12.0,
            "vegetative": 7.0,
            "post-harvest": 3.0,
        }
        normalized_stage = params.crop_stage.strip().lower()
        crop_pts = round(stage_map.get(normalized_stage, 10.0), 2)

        # 4. Anti-Starvation Queue Wait Time (15 pts max)
        starvation_pts = round(
            min(15.0, max(0.0, (params.queue_wait_hours / 30.0) * 15.0)), 2
        )

        # 5. Logistics Proximity (10 pts max)
        if params.distance_km >= cls.DEFAULT_MAX_RADIUS_KM:
            proximity_pts = 0.0
        else:
            proximity_pts = 10.0 * (
                1.0 - (params.distance_km / cls.DEFAULT_MAX_RADIUS_KM)
            )
        proximity_pts = round(min(10.0, max(0.0, proximity_pts)), 2)

        # 6. Equipment Condition & Intent Alignment (5 pts max)
        intent_base_map = {
            "harvesting": 4.5,
            "spraying": 3.5,
            "seeding": 3.0,
            "irrigation": 2.5,
            "tillage": 2.0,
            "labour_weeding": 1.5,
            "storage_haul": 1.0,
            "towing": 0.5,
        }
        normalized_intent = params.intent.strip().lower()
        base_intent = intent_base_map.get(normalized_intent, 1.5)
        condition_bonus = (params.resource_condition_rating / 5.0) * 0.5
        intent_pts = round(min(5.0, max(0.0, base_intent + condition_bonus)), 2)

        total_score = round(
            urgency_pts
            + weather_pts
            + crop_pts
            + starvation_pts
            + proximity_pts
            + intent_pts,
            2,
        )

        return PriorityScoreBreakdown(
            urgency_deadline_pts=urgency_pts,
            urgency_justification_pts=urgency_bonus,
            weather_risk_pts=weather_pts,
            crop_vulnerability_pts=crop_pts,
            anti_starvation_pts=starvation_pts,
            logistics_proximity_pts=proximity_pts,
            intent_condition_pts=intent_pts,
            total_priority_score=total_score,
        )
