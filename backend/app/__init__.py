"""
AgriMart FastAPI Application Package.
"""
import sys
from pathlib import Path

# Ensure project root (e.g. D:\FarmGrid) is on sys.path so 'backend.app...' imports resolve
_PROJECT_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

__version__ = "2.0.0"
