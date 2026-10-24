"""
Farmer & Equipment Owner domain entity model with RBAC and Authentication attributes.
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class UserProfileModel:
    id: str
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    village: Optional[str] = None
    state: Optional[str] = None
    password_hash: Optional[str] = None
    google_id: Optional[str] = None
    avatar_url: Optional[str] = None
    trust_score: float = 100.0
    role_flags: List[str] = field(default_factory=lambda: ["borrower", "lender"])
