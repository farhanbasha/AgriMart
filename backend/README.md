# AgriMart Python FastAPI Backend

Modular, clean-architecture Python FastAPI backend for **AgriMart** — AI-Driven Agricultural Resource & Equipment Allocation Engine.

## Directory Structure

```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI application entrypoint & router registration
│   ├── dependencies.py          # Shared FastAPI dependency providers
│   ├── routers/                 # API Route Handlers
│   │   ├── __init__.py
│   │   ├── allocation.py        # /api/v1/feasibility, /api/v1/priority, /api/v1/evaluate-and-allocate
│   │   ├── bookings.py          # /api/v1/bookings/schedule, /api/v1/bookings/prune-elapsed
│   │   ├── ai_agents.py         # /api/v1/intake/parse, /api/v1/urgency/evaluate, /api/v1/arbitration/explain
│   │   ├── disruptions.py       # /api/disruptions/simulate
│   │   └── sms.py               # /api/v1/sms/send
│   ├── internal/
│   │   ├── __init__.py
│   │   └── admin.py             # /api/health & /api/internal/diagnostics
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py            # Environment settings & operational constants
│   │   └── security.py          # Phone normalization & UTC ISO-8601 time helpers
│   ├── models/                  # Domain Entity Models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── plot.py
│   │   ├── resource.py
│   │   └── booking.py
│   ├── schemas/                 # Pydantic Request/Response Contracts
│   │   ├── __init__.py
│   │   ├── allocation.py
│   │   ├── booking.py
│   │   ├── ai_agent.py
│   │   └── sms.py
│   ├── services/                # Pure Domain & Business Logic Services
│   │   ├── __init__.py
│   │   ├── geo_service.py       # Haversine & rural tractor transit buffer math
│   │   ├── feasibility_service.py # Geofence & temporal conflict checks
│   │   ├── priority_service.py  # 0-100 6-factor priority scoring
│   │   ├── booking_service.py   # Elapsed pruning + Ongoing & 30m Buffer Lock arbitration
│   │   ├── ai_service.py        # Gemini 2.5 Flash agents + deterministic fallbacks
│   │   └── sms_service.py       # Twilio REST SMS dispatch + local fallback
│   └── db/
│       ├── __init__.py
│       ├── database.py          # Supabase PostgreSQL / PostGIS status
│       └── migrations/
│           └── 001_initial_schema.sql
├── tests/                       # Modular Unit Tests
│   ├── __init__.py
│   ├── test_main.py
│   ├── test_allocation.py
│   ├── test_bookings.py
│   └── test_ai_agents.py
├── .gitignore
├── requirements.txt
├── README.md
└── run.sh
```

## Running the Backend

### Option A: From project root (`D:\FarmGrid`) [Recommended]

```bash
npm run backend
# or directly via uvicorn:
uvicorn backend.app.main:app --reload --port 8000
```

### Option B: From inside the `backend/` folder (`D:\FarmGrid\backend`)

```bash
uvicorn main:app --reload
# or
uvicorn app.main:app --reload
# or
fastapi dev
```

## Running Backend Unit Tests

```bash
npm run test:backend
```
