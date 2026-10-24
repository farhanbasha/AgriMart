"""
Pydantic schemas for Google Gemini AI Agents (Intake, Urgency, Arbitration, and Crisis Disruption).
"""

from typing import List
from pydantic import BaseModel, Field


class IntakeParseRequest(BaseModel):
    raw_text: str = Field(
        ...,
        min_length=3,
        max_length=2000,
        description="Farmer's natural language or voice-to-text request",
    )


class IntakeNormalizationOutput(BaseModel):
    intent: str = Field(
        ...,
        description="One of: harvesting, tillage, spraying, irrigation, towing, storage_haul, seeding",
    )
    duration_hours: float = Field(..., ge=0.5, le=72)
    crop_stage: str = Field(
        ...,
        description="One of: Vegetative, Flowering, Ripening, Harvest-Ready, Post-Harvest",
    )
    weather_threat_detected: bool
    urgency_rating: int = Field(..., ge=1, le=10)
    detected_crop: str
    concise_summary: str


class UrgencyEvaluateRequest(BaseModel):
    justification_text: str = Field(default="", max_length=2000)
    crop_stage: str = Field(default="Ripening")
    rainfall_mm: float = Field(default=0.0, ge=0.0)


class UrgencyJustificationOutput(BaseModel):
    urgencyScoreBonus: float = Field(..., ge=0.0, le=10.0)
    urgencyRating: int = Field(..., ge=1, le=10)
    threatLevel: str = Field(
        ..., description="One of: CRITICAL, HIGH, MODERATE, LOW"
    )
    detectedThreats: List[str]
    cropLossRisk: str
    aiAnalysisSummary: str
    verified_urgency_multiplier: float = Field(default=1.0, ge=1.0, le=2.0)
    credibility_score: float = Field(default=80.0, ge=0.0, le=100.0)
    ai_reasoning: str = Field(default="")
    flagged_for_review: bool = Field(default=False)


class ArbitrateConflictRequest(BaseModel):
    resource_name: str
    winning_farmer_name: str
    winning_plot_name: str
    winning_intent: str
    winning_crop_stage: str
    winning_score: float
    winning_weather_pts: float
    winning_urgency_pts: float
    losing_farmer_name: str
    losing_plot_name: str
    losing_intent: str
    losing_crop_stage: str
    losing_score: float
    next_available_slot_iso: str
    alternative_resource_name: str = "Community Backup Unit #2"


class ArbitrationExplanationOutput(BaseModel):
    winning_farmer_justification_en: str
    losing_farmer_explanation_en: str
    contingency_recommendation: str
    fairness_audit_note: str


class DisruptionSimulateRequest(BaseModel):
    disruption_type: str = Field(
        ..., description="EQUIPMENT_BREAKDOWN or SUDDEN_RAIN_ALERT"
    )
    affected_machine_id: str
    duration_hours: float = Field(default=4.0, ge=0.5, le=72)
    current_schedule_json: str = Field(
        ..., description="JSON string of current active bookings and fleet state"
    )


class ReallocatedBookingItem(BaseModel):
    farmer_name: str
    original_slot: str
    new_slot: str
    assigned_machine: str
    status: str = Field(
        ..., description="Substitute Assigned, Delayed, or Unaffected"
    )


class SMSNotificationItem(BaseModel):
    recipient: str
    message: str


class DisruptionSimulationOutput(BaseModel):
    system_action_taken: str
    reallocated_bookings: List[ReallocatedBookingItem]
    sms_notifications: List[SMSNotificationItem]
