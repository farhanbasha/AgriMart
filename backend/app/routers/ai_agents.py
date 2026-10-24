"""
AI Agents router for intake parsing, contextual urgency evaluation, and arbitration explanations.
"""

from fastapi import APIRouter, HTTPException
from ..schemas.ai_agent import (
    UrgencyEvaluateRequest,
    UrgencyJustificationOutput,
    IntakeParseRequest,
    IntakeNormalizationOutput,
    ArbitrateConflictRequest,
    ArbitrationExplanationOutput,
)
from ..services.ai_service import AgriMartAIAgent

router = APIRouter(prefix="/api/v1", tags=["AI Agents"])


@router.post("/urgency/evaluate", response_model=UrgencyJustificationOutput)
def evaluate_contextual_urgency(req: UrgencyEvaluateRequest):
    """Agent 4: Evaluate agronomic and weather urgency notes into a 0-10 priority bonus."""
    try:
        return AgriMartAIAgent.evaluate_urgency_justification(
            justification_text=req.justification_text,
            crop_stage=req.crop_stage,
            rainfall_mm=req.rainfall_mm,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/intake/parse", response_model=IntakeNormalizationOutput)
def parse_intake(req: IntakeParseRequest):
    """Agent 1: Normalize unstructured multi-dialect farmer intake requests."""
    try:
        return AgriMartAIAgent.normalize_farmer_intake(req.raw_text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/arbitration/explain", response_model=ArbitrationExplanationOutput)
def explain_arbitration(req: ArbitrateConflictRequest):
    """Agent 2: Generate transparent explanations for schedule arbitration."""
    try:
        return AgriMartAIAgent.generate_arbitration_explanation(req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
