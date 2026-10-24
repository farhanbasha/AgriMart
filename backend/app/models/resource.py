"""
Equipment / Shared Machinery / Labour Resource domain model.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class ResourceModel:
    id: str
    owner_id: str
    owner_name: str
    category: str
    name: str
    specs: str
    hourly_rate: float
    rate_unit: str = "per_hour"
    condition_rating: float = 4.8
    operational_status: str = "available"
    base_lat: float = 29.6857
    base_lng: float = 76.9905
    max_radius_km: float = 50.0
    owner_phone: Optional[str] = None
    village: Optional[str] = None
    state: Optional[str] = None
