"""
FarmGrid Deterministic Resource Allocation Engine
Implements Haversine Geofencing, Inter-Farm Transit Buffers,
Mathematical Interval Overlap Detection, and 0-100 Priority Scoring.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
import math
from typing import Any, Dict, List, Optional, Tuple

try:
    from pydantic import BaseModel, Field
except ImportError:
    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def dict(self):
            return self.__dict__
        def model_dump(self):
            return self.__dict__
    def Field(default=None, **kwargs):
        return default


# ==============================================================================
# PYDANTIC SCHEMAS & DTOS
# ==============================================================================

class GeoPoint(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")


class CropStageEnum(str):
    HARVEST_READY = "Harvest-Ready"
    RIPENING = "Ripening"
    FLOWERING = "Flowering"
    VEGETATIVE = "Vegetative"
    POST_HARVEST = "Post-Harvest"


class IntentEnum(str):
    HARVESTING = "harvesting"
    TILLAGE = "tillage"
    SPRAYING = "spraying"
    IRRIGATION = "irrigation"
    STORAGE_HAUL = "storage_haul"
    TOWING = "towing"


class ExistingBookingDTO(BaseModel):
    id: str
    resource_id: str
    start_time: datetime
    end_time: datetime
    plot_lat: float
    plot_lng: float
    status: str = "confirmed"  # confirmed, pending, etc.


class FeasibilityRequest(BaseModel):
    resource_id: str
    resource_base_lat: float
    resource_base_lng: float
    resource_max_radius_km: float = 50.0
    plot_lat: float
    plot_lng: float
    start_time: datetime
    end_time: datetime
    existing_bookings: List[ExistingBookingDTO] = Field(default_factory=list)


class PriorityScoreRequest(BaseModel):
    # Urgency parameters
    start_time: datetime
    request_timestamp: Optional[datetime] = None  # defaults to current UTC time if None
    
    # Weather parameters
    imminent_rainfall_mm: float = Field(default=0.0, ge=0.0, description="Expected precipitation in mm within 48h")
    severe_weather_alert: bool = Field(default=False, description="Whether an active storm/frost warning is active")
    
    # Crop parameters
    crop_stage: str = Field(default="Harvest-Ready", description="Crop developmental stage")
    
    # Anti-starvation queue parameter
    queue_wait_hours: float = Field(default=0.0, ge=0.0, description="Hours request has been awaiting allocation")
    
    # Logistics parameters
    distance_km: float = Field(default=10.0, ge=0.0, description="Distance between resource and plot")
    
    # Intent and equipment condition
    intent: str = Field(default="harvesting", description="Intended operation: harvesting, tillage, towing, etc.")
    resource_condition_rating: float = Field(default=4.5, ge=1.0, le=5.0, description="1.0 to 5.0 condition rating")


class PriorityScoreBreakdown(BaseModel):
    urgency_deadline_pts: float
    weather_risk_pts: float
    crop_vulnerability_pts: float
    anti_starvation_pts: float
    logistics_proximity_pts: float
    intent_condition_pts: float
    total_priority_score: float
    details: Dict[str, Any]


class FeasibilityResult(BaseModel):
    is_feasible: bool
    distance_km: float
    geofence_passed: bool
    transit_buffer_minutes: float
    maintenance_buffer_minutes: float
    total_turnaround_minutes: float
    conflict_detected: bool
    conflict_reason: Optional[str] = None
    earliest_available_start: Optional[datetime] = None


# ==============================================================================
# DETERMINISTIC ALLOCATION ENGINE
# ==============================================================================

class FarmGridEngine:
    RURAL_TRANSIT_SPEED_KMH: float = 30.0
    MANDATORY_PREP_BUFFER_MINUTES: float = 30.0
    DEFAULT_MAX_RADIUS_KM: float = 50.0

    @staticmethod
    def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate the great-circle distance between two points on the Earth
        using the Haversine formula. Returns distance in kilometers.
        """
        R = 6371.0  # Earth's mean radius in kilometers

        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (
            math.sin(delta_phi / 2.0) ** 2
            + math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
        )
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        distance = R * c
        return round(distance, 3)

    @classmethod
    def calculate_transit_buffer(cls, distance_km: float) -> Tuple[float, float, float]:
        """
        Calculates transit time based on rural transport velocity (30 km/h)
        plus mandatory 30-minute maintenance/prep buffer.
        Returns: (transit_minutes, maintenance_minutes, total_buffer_minutes)
        """
        transit_hours = distance_km / cls.RURAL_TRANSIT_SPEED_KMH
        transit_minutes = round(transit_hours * 60.0, 1)
        maintenance_minutes = cls.MANDATORY_PREP_BUFFER_MINUTES
        total_buffer_minutes = transit_minutes + maintenance_minutes
        return (transit_minutes, maintenance_minutes, total_buffer_minutes)

    @classmethod
    def check_slot_feasibility(cls, request: FeasibilityRequest) -> FeasibilityResult:
        """
        Verifies:
        1. 50km geofence compliance from equipment base coordinates to plot.
        2. Direct mathematical interval overlap with existing confirmed bookings.
        3. Inter-farm transit buffer feasibility with preceding and succeeding bookings.
        """
        # 1. Enforce strict geofence
        distance_from_base = cls.calculate_haversine_distance(
            request.resource_base_lat,
            request.resource_base_lng,
            request.plot_lat,
            request.plot_lng,
        )

        max_radius = request.resource_max_radius_km or cls.DEFAULT_MAX_RADIUS_KM
        geofence_passed = distance_from_base <= max_radius

        transit_min, maint_min, total_buffer_min = cls.calculate_transit_buffer(distance_from_base)

        if not geofence_passed:
            return FeasibilityResult(
                is_feasible=False,
                distance_km=distance_from_base,
                geofence_passed=False,
                transit_buffer_minutes=transit_min,
                maintenance_buffer_minutes=maint_min,
                total_turnaround_minutes=total_buffer_min,
                conflict_detected=True,
                conflict_reason=f"Plot distance ({distance_from_base} km) strictly violates the {max_radius} km geofence boundary.",
                earliest_available_start=None,
            )

        if request.end_time <= request.start_time:
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

        # 2. Filter active bookings and test mathematical interval overlap & buffers
        active_bookings = [
            b for b in request.existing_bookings
            if b.status in ("confirmed", "in_use", "pending")
        ]

        # Sort existing bookings chronologically
        active_bookings.sort(key=lambda b: b.start_time)

        req_start = request.start_time
        req_end = request.end_time

        for b in active_bookings:
            # Check A: Direct interval overlap: max(S1, S2) < min(E1, E2)
            has_direct_overlap = max(req_start, b.start_time) < min(req_end, b.end_time)
            if has_direct_overlap:
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
                        f"({b.start_time.strftime('%Y-%m-%d %H:%M')} to {b.end_time.strftime('%Y-%m-%d %H:%M')} UTC)."
                    ),
                    earliest_available_start=b.end_time + timedelta(minutes=total_buffer_min),
                )

            # Check B: If existing booking precedes candidate request, verify transit buffer
            if b.end_time <= req_start:
                inter_farm_dist = cls.calculate_haversine_distance(
                    b.plot_lat, b.plot_lng, request.plot_lat, request.plot_lng
                )
                _, _, needed_buffer = cls.calculate_transit_buffer(inter_farm_dist)
                actual_gap_minutes = (req_start - b.end_time).total_seconds() / 60.0

                if actual_gap_minutes < needed_buffer:
                    earliest_feasible = b.end_time + timedelta(minutes=needed_buffer)
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
                            f"{b.end_time.strftime('%H:%M')} UTC. Requires {needed_buffer:.0f} min transit/prep "
                            f"for {inter_farm_dist:.1f} km inter-farm transit (only {actual_gap_minutes:.0f} min available)."
                        ),
                        earliest_available_start=earliest_feasible,
                    )

            # Check C: If candidate request precedes existing booking, verify onward transit buffer
            if req_end <= b.start_time:
                inter_farm_dist = cls.calculate_haversine_distance(
                    request.plot_lat, request.plot_lng, b.plot_lat, b.plot_lng
                )
                _, _, needed_buffer = cls.calculate_transit_buffer(inter_farm_dist)
                actual_gap_minutes = (b.start_time - req_end).total_seconds() / 60.0

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
                            f"{b.start_time.strftime('%H:%M')} UTC. Inter-farm transit to that plot ({inter_farm_dist:.1f} km) "
                            f"demands {needed_buffer:.0f} min buffer, but available gap is only {actual_gap_minutes:.0f} min."
                        ),
                        earliest_available_start=None,
                    )

        # Passed all geometric and buffer constraints
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
        )

    @classmethod
    def compute_priority_score(cls, params: PriorityScoreRequest) -> PriorityScoreBreakdown:
        """
        Deterministic 0–100 Priority Engine:
        1. Urgency / Deadline Proximity: 25 pts
        2. Weather Risk Exposure: 25 pts
        3. Crop Vulnerability / Stage: 20 pts
        4. Anti-Starvation Queue Wait Time: 15 pts
        5. Logistics Proximity (<=50km): 10 pts
        6. Equipment Condition & Intent Alignment: 5 pts
        """
        now = params.request_timestamp or datetime.utcnow()
        hours_until_start = max(0.0, (params.start_time - now).total_seconds() / 3600.0)

        # ----------------------------------------------------------------------
        # 1. Urgency / Deadline Proximity (25 pts max)
        # Closer operation windows receive higher urgency points.
        # ----------------------------------------------------------------------
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

        # ----------------------------------------------------------------------
        # 2. Weather Risk Exposure (25 pts max)
        # Precipitation and imminent frost/storm alerts escalate priority.
        # ----------------------------------------------------------------------
        rain_pts = min(20.0, (params.imminent_rainfall_mm / 25.0) * 20.0)
        alert_pts = 5.0 if params.severe_weather_alert else 0.0
        weather_pts = round(min(25.0, rain_pts + alert_pts), 2)

        # ----------------------------------------------------------------------
        # 3. Crop Vulnerability / Stage (20 pts max)
        # Harvest-Ready crops rot/shatter without equipment; peak weighting.
        # ----------------------------------------------------------------------
        stage_map = {
            "harvest-ready": 20.0,
            "ripening": 16.0,
            "flowering": 12.0,
            "vegetative": 7.0,
            "post-harvest": 3.0,
        }
        normalized_stage = params.crop_stage.strip().lower()
        crop_pts = round(stage_map.get(normalized_stage, 10.0), 2)

        # ----------------------------------------------------------------------
        # 4. Anti-Starvation Queue Wait Time (15 pts max)
        # Accumulates 1 pt per 2 hours of unfulfilled waiting (caps at 30h = 15pts).
        # ----------------------------------------------------------------------
        starvation_pts = min(15.0, (params.queue_wait_hours / 30.0) * 15.0)
        starvation_pts = round(max(0.0, starvation_pts), 2)

        # ----------------------------------------------------------------------
        # 5. Logistics Proximity (10 pts max)
        # Closer farms within the 50km geofence consume less fuel and transit time.
        # ----------------------------------------------------------------------
        if params.distance_km >= cls.DEFAULT_MAX_RADIUS_KM:
            proximity_pts = 0.0
        else:
            proximity_pts = 10.0 * (1.0 - (params.distance_km / cls.DEFAULT_MAX_RADIUS_KM))
        proximity_pts = round(min(10.0, max(0.0, proximity_pts)), 2)

        # ----------------------------------------------------------------------
        # 6. Equipment Condition & Intent Alignment (5 pts max)
        # Deprioritizes trivial intents (towing) and rewards critical cultivation.
        # ----------------------------------------------------------------------
        intent_base_map = {
            "harvesting": 3.0,
            "tillage": 2.8,
            "emergency_drainage": 3.0,
            "spraying": 2.2,
            "irrigation": 2.0,
            "storage_haul": 1.2,
            "towing": 0.4,  # Penalized non-critical baseline
        }
        normalized_intent = params.intent.strip().lower()
        base_intent_score = intent_base_map.get(normalized_intent, 1.5)

        # Condition rating bonus: up to 2.0 pts
        condition_modifier = (params.resource_condition_rating / 5.0) * 2.0
        intent_condition_pts = round(min(5.0, base_intent_score + condition_modifier), 2)

        # ----------------------------------------------------------------------
        # Total Deterministic Priority Score (0–100)
        # ----------------------------------------------------------------------
        total_score = round(
            urgency_pts
            + weather_pts
            + crop_pts
            + starvation_pts
            + proximity_pts
            + intent_condition_pts,
            2,
        )

        return PriorityScoreBreakdown(
            urgency_deadline_pts=urgency_pts,
            weather_risk_pts=weather_pts,
            crop_vulnerability_pts=crop_pts,
            anti_starvation_pts=starvation_pts,
            logistics_proximity_pts=proximity_pts,
            intent_condition_pts=intent_condition_pts,
            total_priority_score=total_score,
            details={
                "hours_until_start": round(hours_until_start, 1),
                "imminent_rainfall_mm": params.imminent_rainfall_mm,
                "crop_stage": params.crop_stage,
                "queue_wait_hours": params.queue_wait_hours,
                "distance_km": params.distance_km,
                "intent": params.intent,
                "resource_condition_rating": params.resource_condition_rating,
            },
        )
