"""
Application settings, environment variables, and operational constants.
"""

import os
from dataclasses import dataclass, field
from typing import List
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    """Centralized configuration for the AgriMart FastAPI backend."""

    PROJECT_NAME: str = "AgriMart Cooperative Engine & AI API"
    SERVICE_NAME: str = "AgriMart Allocation Engine"
    VERSION: str = "2.0.0"
    API_V1_PREFIX: str = "/api/v1"

    # Physical & Operational Constants
    RURAL_TRANSIT_SPEED_KMH: float = 30.0
    MANDATORY_PREP_BUFFER_MINUTES: float = 30.0
    ONGOING_LOCK_BUFFER_MINUTES: float = 30.0
    DEFAULT_MAX_RADIUS_KM: float = 50.0
    EARTH_RADIUS_KM: float = 6371.0

    # External API Keys & Credentials
    GEMINI_API_KEY: str = field(
        default_factory=lambda: (
            os.environ.get("GEMINI_API_KEY")
            or os.environ.get("VITE_GEMINI_API_KEY")
            or ""
        ).strip()
    )
    GEMINI_MODELS: List[str] = field(
        default_factory=lambda: [
            "gemini-3.6-flash",
            "gemini-3.7-flash",
            "gemini-flash-latest",
        ]
    )

    TWILIO_ACCOUNT_SID: str = field(
        default_factory=lambda: (
            os.environ.get("TWILIO_ACCOUNT_SID")
            or os.environ.get("VITE_TWILIO_ACCOUNT_SID")
            or ""
        ).strip()
    )
    TWILIO_AUTH_TOKEN: str = field(
        default_factory=lambda: (
            os.environ.get("TWILIO_AUTH_TOKEN")
            or os.environ.get("VITE_TWILIO_AUTH_TOKEN")
            or ""
        ).strip()
    )
    TWILIO_PHONE_NUMBER: str = field(
        default_factory=lambda: (
            os.environ.get("TWILIO_PHONE_NUMBER")
            or os.environ.get("VITE_TWILIO_PHONE_NUMBER")
            or ""
        ).strip()
    )

    SUPABASE_URL: str = field(
        default_factory=lambda: (
            os.environ.get("SUPABASE_URL")
            or os.environ.get("VITE_SUPABASE_URL")
            or ""
        ).strip()
    )
    SUPABASE_ANON_KEY: str = field(
        default_factory=lambda: (
            os.environ.get("SUPABASE_ANON_KEY")
            or os.environ.get("VITE_SUPABASE_ANON_KEY")
            or ""
        ).strip()
    )

    # JWT Authentication & RBAC
    JWT_SECRET_KEY: str = field(
        default_factory=lambda: (
            os.environ.get("JWT_SECRET_KEY")
            or "agrimart_secret_jwt_cooperative_key_2026_secured_dev_prod"
        ).strip()
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = field(
        default_factory=lambda: int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))
    )

    # Google OAuth 2.0 Client Credentials
    GOOGLE_CLIENT_ID: str = field(
        default_factory=lambda: (
            os.environ.get("GOOGLE_CLIENT_ID")
            or os.environ.get("VITE_GOOGLE_CLIENT_ID")
            or ""
        ).strip()
    )

    CORS_ORIGINS: List[str] = field(default_factory=lambda: ["*"])

    @property
    def is_gemini_configured(self) -> bool:
        return bool(
            self.GEMINI_API_KEY
            and self.GEMINI_API_KEY != "YOUR_GEMINI_KEY"
            and len(self.GEMINI_API_KEY) > 10
        )

    @property
    def is_sms_configured(self) -> bool:
        return bool(
            self.TWILIO_ACCOUNT_SID
            and self.TWILIO_AUTH_TOKEN
            and self.TWILIO_PHONE_NUMBER
        )


settings = Settings()
