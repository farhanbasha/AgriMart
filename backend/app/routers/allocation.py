"""
Spatial feasibility, priority scoring, and single-slot allocation router.
"""

from fastapi import APIRouter, HTTPException
from ..schemas.allocation import (
    FeasibilityRequest,
    FeasibilityResult,
    PriorityScoreRequest,
    PriorityScoreBreakdown,
    EvaluateSlotRequest,
    EvaluateSlotResponse,
)
from ..services.feasibility_service import FeasibilityService
from ..services.priority_service import PriorityService

router = APIRouter(prefix="/api/v1", tags=["Allocation & Priority"])


@router.post("/feasibility", response_model=FeasibilityResult)
def evaluate_feasibility(req: FeasibilityRequest):
    """Evaluate Haversine distance, transit buffers, and temporal overlaps."""
    try:
        return FeasibilityService.check_slot_feasibility(req)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/priority", response_model=PriorityScoreBreakdown)
def evaluate_priority(req: PriorityScoreRequest):
    """Calculate the deterministic 0-100 multi-factor priority score."""
    try:
        return PriorityService.compute_priority_score(req)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/evaluate-and-allocate", response_model=EvaluateSlotResponse)
def evaluate_and_allocate(req: EvaluateSlotRequest):
    """Combined endpoint for single-slot feasibility and priority scoring."""
    try:
        feasibility = FeasibilityService.check_slot_feasibility(req.feasibility)
        priority = PriorityService.compute_priority_score(req.priority_inputs)

        if not feasibility.is_feasible:
            summary = f"REJECTED: {feasibility.conflict_reason}"
        else:
            summary = (
                f"APPROVED: Spatial & temporal constraints passed ({feasibility.distance_km} km). "
                f"Priority Score: {priority.total_priority_score}/100."
            )

        return EvaluateSlotResponse(
            feasibility=feasibility,
            priority=priority,
            decision_summary=summary,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
