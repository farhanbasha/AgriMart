"""
Supabase PostgreSQL database status and migration helpers.
"""

from pathlib import Path
from typing import Dict, Any
from backend.app.core.config import settings

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def get_database_status() -> Dict[str, Any]:
    """Returns current cloud database configuration status and available migrations."""
    migration_files = (
        sorted(p.name for p in MIGRATIONS_DIR.glob("*.sql"))
        if MIGRATIONS_DIR.exists()
        else []
    )
    return {
        "supabase_configured": bool(
            settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY
        ),
        "supabase_url": settings.SUPABASE_URL or None,
        "migrations": migration_files,
    }
