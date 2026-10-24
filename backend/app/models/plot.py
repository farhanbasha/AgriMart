"""
Agricultural Land Plot & Weather Telemetry domain models.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class WeatherTelemetryModel:
    rainfall_mm: float = 0.0
    rain_probability_percent: int = 10
    severe_alert: bool = False
    description: str = "Normal farm weather."


@dataclass
class PlotModel:
    id: str
    farmer_id: str
    farmer_name: str
    plot_name: str
    acres: float
    crop_type: str
    crop_stage: str
    latitude: float
    longitude: float
    village: Optional[str] = None
    state: Optional[str] = None
    weather: Optional[WeatherTelemetryModel] = None
