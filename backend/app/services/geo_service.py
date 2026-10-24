"""
Spatial Geofencing & Rural Transit Buffer Service.
Computes Haversine great-circle distances and inter-farm mobilization buffers.
"""

import math
from typing import Tuple
from backend.app.core.config import settings


class GeoService:
    """Spatial distance and rural equipment transit calculations."""

    RURAL_TRANSIT_SPEED_KMH: float = settings.RURAL_TRANSIT_SPEED_KMH
    MANDATORY_PREP_BUFFER_MINUTES: float = settings.MANDATORY_PREP_BUFFER_MINUTES
    DEFAULT_MAX_RADIUS_KM: float = settings.DEFAULT_MAX_RADIUS_KM

    @classmethod
    def calculate_haversine_distance(
        cls, lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        """
        Calculates great-circle distance in kilometers between two GPS points
        using the Haversine formula.
        """
        radius_km = settings.EARTH_RADIUS_KM
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (
            math.sin(delta_phi / 2.0) ** 2
            + math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
        )
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return round(radius_km * c, 3)

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
        total_buffer_minutes = round(transit_minutes + maintenance_minutes, 1)
        return (transit_minutes, maintenance_minutes, total_buffer_minutes)
