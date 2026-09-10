"""
FarmGrid FastAPI Service
Endpoints for Slot Feasibility Testing and Deterministic Allocation Priority Scoring.
"""

from datetime import datetime, timezone
import os
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.engine import (
    FarmGridEngine,
    FeasibilityRequest,
    FeasibilityResult,
    PriorityScoreRequest,
    PriorityScoreBreakdown,
    ExistingBookingDTO,
)
from backend.ai_agent import (
    FarmGridAIAgent,
    IntakeNormalizationOutput,
    ArbitrationExplanationOutput,
    DisruptionSimulateOutput,
)

app = FastAPI(
    title="FarmGrid API",
    description="Intelligent Agricultural Resource Coordination & Scarcity Optimization Engine with Google AI Studio",
    version="1.0.0",
)

# Configure CORS
origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# COMBINED EVALUATION CONTRACT
# ==============================================================================

class EvaluateSlotRequest(BaseModel):
    resource_id: str
    resource_name: str = "Tractor / Harvester"
    resource_base_lat: float
    resource_base_lng: float
    resource_max_radius_km: float = 50.0
    resource_condition_rating: float = Field(default=4.5, ge=1.0, le=5.0)
    
    plot_id: str
    plot_name: str = "Plot Alpha"
    plot_lat: float
    plot_lng: float
    crop_stage: str = "Harvest-Ready"
    
    intent: str = Field(default="harvesting", description="harvesting, tillage, towing, spraying, irrigation")
    start_time: datetime
    end_time: datetime
    
    imminent_rainfall_mm: float = 0.0
    severe_weather_alert: bool = False
    queue_wait_hours: float = 0.0
    
    existing_bookings: List[ExistingBookingDTO] = Field(default_factory=list)


class EvaluateSlotResponse(BaseModel):
    feasibility: FeasibilityResult
    priority: PriorityScoreBreakdown
    decision_summary: str


class IntakeParseRequest(BaseModel):
    raw_text: str = Field(
        ...,
        example="Need 50HP tractor tomorrow 6 AM for 4 hours, heavy rain coming, wheat ready for harvest",
    )


class ArbitrateConflictRequest(BaseModel):
    candidate_a: Dict[str, Any]
    candidate_b: Dict[str, Any]


class DisruptionSimulateRequest(BaseModel):
    event_type: str = Field(
        ...,
        description="'EQUIPMENT_BREAKDOWN' or 'SUDDEN_RAIN_ALERT'",
        example="EQUIPMENT_BREAKDOWN",
    )
    resource_id: str = Field(..., example="99999999-9999-9999-9999-999999999999")
    active_bookings: List[Dict[str, Any]] = Field(default_factory=list)
    available_substitutes: List[Dict[str, Any]] = Field(default_factory=list)


# ==============================================================================
# ENDPOINTS
# ==============================================================================

@app.get("/api/health", tags=["System"])
def health_check():
    return {
        "status": "online",
        "service": "FarmGrid Allocation Engine",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post(
    "/api/v1/feasibility",
    response_model=FeasibilityResult,
    tags=["Allocation Engine"],
    summary="Verify 50km geofence, turnaround transit buffer, and schedule conflicts",
)
def test_slot_feasibility(request: FeasibilityRequest):
    try:
        return FarmGridEngine.check_slot_feasibility(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Feasibility calculation error: {str(e)}",
        )


@app.post(
    "/api/v1/priority",
    response_model=PriorityScoreBreakdown,
    tags=["Allocation Engine"],
    summary="Compute deterministic 0-100 priority score with benchmark weights",
)
def compute_priority(request: PriorityScoreRequest):
    try:
        return FarmGridEngine.compute_priority_score(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Priority scoring error: {str(e)}",
        )


@app.post(
    "/api/v1/evaluate-and-allocate",
    response_model=EvaluateSlotResponse,
    tags=["Allocation Engine"],
    summary="Evaluate full candidate booking against geofence, buffers, and priority scoring",
)
def evaluate_slot_and_score(request: EvaluateSlotRequest):
    # 1. Evaluate spatial feasibility & buffers
    feasibility_req = FeasibilityRequest(
        resource_id=request.resource_id,
        resource_base_lat=request.resource_base_lat,
        resource_base_lng=request.resource_base_lng,
        resource_max_radius_km=request.resource_max_radius_km,
        plot_lat=request.plot_lat,
        plot_lng=request.plot_lng,
        start_time=request.start_time,
        end_time=request.end_time,
        existing_bookings=request.existing_bookings,
    )
    feasibility_res = FarmGridEngine.check_slot_feasibility(feasibility_req)

    # 2. Compute 0-100 priority score
    priority_req = PriorityScoreRequest(
        start_time=request.start_time,
        imminent_rainfall_mm=request.imminent_rainfall_mm,
        severe_weather_alert=request.severe_weather_alert,
        crop_stage=request.crop_stage,
        queue_wait_hours=request.queue_wait_hours,
        distance_km=feasibility_res.distance_km,
        intent=request.intent,
        resource_condition_rating=request.resource_condition_rating,
    )
    priority_res = FarmGridEngine.compute_priority_score(priority_req)

    # 3. Formulate human-readable decision summary
    if not feasibility_res.is_feasible:
        summary = (
            f"REJECTED: {feasibility_res.conflict_reason} "
            f"(Computed Priority Score: {priority_res.total_priority_score}/100)"
        )
    else:
        summary = (
            f"APPROVED: Feasible slot. Distance is {feasibility_res.distance_km:.1f} km "
            f"(Transit/Prep Buffer: {feasibility_res.total_turnaround_minutes:.0f} min). "
            f"Priority Score: {priority_res.total_priority_score}/100 "
            f"(Urgency: {priority_res.urgency_deadline_pts}pts, Weather: {priority_res.weather_risk_pts}pts, "
            f"Crop: {priority_res.crop_vulnerability_pts}pts)."
        )

    return EvaluateSlotResponse(
        feasibility=feasibility_res,
        priority=priority_res,
        decision_summary=summary,
    )


# ==============================================================================
# GOOGLE AI STUDIO (GEMINI) AGENTIC ENDPOINTS
# ==============================================================================

@app.post(
    "/api/v1/intake/parse",
    response_model=IntakeNormalizationOutput,
    tags=["Agentic AI Layer"],
    summary="Agent 1: Parse colloquial voice or text intake into structured operational constraints",
)
def parse_intake(request: IntakeParseRequest):
    try:
        return FarmGridAIAgent.normalize_farmer_intake(request.raw_text)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Intake parsing error: {str(e)}",
        )


@app.post(
    "/api/v1/arbitration/explain",
    response_model=ArbitrationExplanationOutput,
    tags=["Agentic AI Layer"],
    summary="Agent 2: Synthesize human-readable arbitration justification and contingency recommendations",
)
def explain_arbitration(request: ArbitrateConflictRequest):
    try:
        return FarmGridAIAgent.arbitrate_conflict(
            candidate_a=request.candidate_a,
            candidate_b=request.candidate_b,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Arbitration explanation error: {str(e)}",
        )


@app.post(
    "/api/disruptions/simulate",
    response_model=DisruptionSimulateOutput,
    tags=["Agentic AI Layer"],
    summary="Simulate breakdown or rain alert, trigger Gemini dynamic re-scheduling and narrative rationale",
)
def simulate_disruption_endpoint(request: DisruptionSimulateRequest):
    if request.event_type not in ("EQUIPMENT_BREAKDOWN", "SUDDEN_RAIN_ALERT"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="event_type must be either 'EQUIPMENT_BREAKDOWN' or 'SUDDEN_RAIN_ALERT'",
        )
    try:
        return FarmGridAIAgent.simulate_disruption(
            disruption_type=request.event_type,
            resource_id=request.resource_id,
            active_bookings=request.active_bookings,
            available_substitutes=request.available_substitutes,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Disruption simulation error: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
