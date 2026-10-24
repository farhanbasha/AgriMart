"""
Disruption simulation and cascade re-allocation router.
"""

from fastapi import APIRouter, HTTPException
from ..schemas.ai_agent import DisruptionSimulateRequest, DisruptionSimulationOutput
from ..services.ai_service import AgriMartAIAgent

router = APIRouter(tags=["Disruptions"])


@router.post("/api/disruptions/simulate", response_model=DisruptionSimulationOutput)
def simulate_disruption(req: DisruptionSimulateRequest):
    """
    Agent 3: Simulate equipment breakdown or sudden rain alert and
    re-allocate affected bookings across the fleet.
    """
    try:
        return AgriMartAIAgent.simulate_disruption(
            disruption_type=req.disruption_type,
            affected_machine_id=req.affected_machine_id,
            duration_hours=req.duration_hours,
            current_schedule_json=req.current_schedule_json,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
