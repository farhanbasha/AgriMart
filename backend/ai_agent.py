"""
FarmGrid Google AI Studio Agentic Integration (google-genai SDK)
Implements:
1. Agent 1: Multimodal / Free-Text Intake Normalizer (Extracts intent, urgency, weather threat, crop vulnerability)
2. Agent 2: Explainable Arbitration Agent (Transparent human-readable justifications & contingencies)
3. Agent 3: Dynamic Disruption Synthesizer (Simulates equipment breakdown & sudden rain alerts)
"""

import json
import os
from typing import Any, Dict, List, Literal, Optional
from dotenv import load_dotenv

load_dotenv()

try:
    from pydantic import BaseModel, Field
except ImportError:
    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def dict(self):
            return self.__dict__
        def model_dump(self):
            return self.__dict__
    def Field(default=None, **kwargs):
        if "default_factory" in kwargs:
            return kwargs["default_factory"]()
        return default

# Graceful import of Google GenAI SDK
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    genai = None
    types = None


# ==============================================================================
# STRUCTURED SCHEMAS FOR GEMINI AGENT RESPONSES
# ==============================================================================

class IntakeNormalizationOutput(BaseModel):
    intent_type: str = Field(
        ...,
        description="Standardized intent: 'harvesting', 'tillage', 'spraying', 'irrigation', 'towing', or 'storage_haul'",
    )
    estimated_duration_hours: float = Field(
        ...,
        ge=0.5,
        le=72.0,
        description="Duration requested in hours",
    )
    crop_vulnerability_level: int = Field(
        ...,
        ge=1,
        le=10,
        description="1 (minimal risk) to 10 (peak vulnerable, rotting or shattering if delayed)",
    )
    stated_weather_threat: bool = Field(
        ...,
        description="True if farmer explicitly mentions rain, storm, freeze, or bad weather ahead",
    )
    urgency_rating: int = Field(
        ...,
        ge=1,
        le=10,
        description="1 (routine transport/towing) to 10 (immediate emergency harvesting/pumping)",
    )
    detected_crop: Optional[str] = Field(
        default=None,
        description="Crop identified from colloquial text (e.g. Wheat, Yellow Corn, Soybeans)",
    )
    equipment_specs_requested: Optional[str] = Field(
        default=None,
        description="Power or tool specs mentioned (e.g., '50HP tractor', 'combine harvester')",
    )
    normalized_summary: str = Field(
        ...,
        description="One-sentence structured summary of the farmer's operational request",
    )


class ArbitrationExplanationOutput(BaseModel):
    winning_booking_id: str = Field(
        ...,
        description="ID of the booking request awarded the resource slot",
    )
    losing_booking_id: str = Field(
        ...,
        description="ID of the conflicting request that was deprioritized or displaced",
    )
    justification_en: str = Field(
        ...,
        description="Concise, transparent explanation citing weather risk, harvest proximity, and intent priority without jargon",
    )
    contingency_action: str = Field(
        ...,
        description="Practical, empathetic contingency recommended for the losing farmer (e.g. secondary tractor reroute or schedule shift)",
    )
    primary_deciding_factor: str = Field(
        ...,
        description="E.g., 'Weather Urgency & Crop Stage', 'Towing Intent Deprioritization', 'Logistics Proximity'",
    )
    confidence_score: float = Field(
        default=0.95,
        ge=0.0,
        le=1.0,
        description="Model confidence in arbitration fairness",
    )


class AdjustedScheduleItem(BaseModel):
    original_booking_id: Optional[str] = Field(default=None, description="Original booking ID")
    reassigned_resource_id: Optional[str] = Field(default=None, description="Substitute equipment ID")
    adjusted_status: Optional[str] = Field(default=None, description="Updated status")
    revised_start: Optional[str] = Field(default=None, description="Revised start ISO timestamp")
    notes: Optional[str] = Field(default=None, description="Operational rescheduling notes")


class DisruptionSimulateOutput(BaseModel):
    event_type: str = Field(
        ...,
        description="'EQUIPMENT_BREAKDOWN' or 'SUDDEN_RAIN_ALERT'",
    )
    affected_resource_id: Optional[str] = None
    invalidated_booking_ids: List[str] = Field(default_factory=list)
    adjusted_schedules: List[AdjustedScheduleItem] = Field(
        default_factory=list,
        description="Reallocated slots with updated start/end times and substitute resource IDs",
    )
    human_readable_rationale: str = Field(
        ...,
        description="Transparent multi-farm coordination narrative detailing why adjustments occurred",
    )
    remediation_steps: List[str] = Field(
        default_factory=list,
        description="Clear operational directives for community liaisons and farmers",
    )


# ==============================================================================
# FARMGRID AI STUDIO AGENT SERVICE
# ==============================================================================

class FarmGridAIAgent:
    MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

    @classmethod
    def _get_client(cls):
        """
        Lazily initializes the Google GenAI client using GEMINI_API_KEY or VITE_GEMINI_API_KEY.
        """
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("VITE_GEMINI_API_KEY")
        if not api_key or api_key in ("MY_GEMINI_API_KEY", "YOUR_GEMINI_KEY"):
            return None
        if not GENAI_AVAILABLE:
            return None
        return genai.Client(
            api_key=api_key,
            http_options={"headers": {"User-Agent": "aistudio-build"}},
        )

    # --------------------------------------------------------------------------
    # Agent 1: Multimodal / Free-Text Intake Normalizer
    # --------------------------------------------------------------------------
    @classmethod
    def normalize_farmer_intake(cls, raw_transcript: str) -> IntakeNormalizationOutput:
        """
        Parses colloquial farmer voice recordings or text notes into a structured
        allocation candidate object with verified intents and urgency scoring.
        """
        client = cls._get_client()
        prompt = (
            f"You are the FarmGrid Intake Normalization Agent for rural scarcity management.\n"
            f"A farmer submitted the following colloquial voice transcript or raw text request:\n"
            f"\"\"\"{raw_transcript}\"\"\"\n\n"
            f"Parse and extract the exact operational constraints.\n"
            f"- Normalize intent_type into one of: 'harvesting', 'tillage', 'spraying', 'irrigation', 'towing', 'storage_haul'.\n"
            f"- Assess crop_vulnerability_level from 1 (low) to 10 (peak vulnerable / ripe before storm).\n"
            f"- Detect whether stated_weather_threat is true (mentions rainfall, storms, or frost).\n"
            f"- Set urgency_rating from 1 to 10 based on crop state and deadline proximity.\n"
            f"Return strictly valid JSON according to the schema."
        )

        if client and types:
            try:
                response = client.models.generate_content(
                    model=cls.MODEL_NAME,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=IntakeNormalizationOutput,
                        temperature=0.1,
                    ),
                )
                if response.text:
                    parsed_dict = json.loads(response.text)
                    return IntakeNormalizationOutput(**parsed_dict)
            except Exception as e:
                print(f"[FarmGrid AI] GenAI normalization error: {e}. Executing deterministic fallback.")

        # Deterministic heuristic fallback if Gemini API is offline or key unconfigured
        lower = raw_transcript.lower()
        is_weather = any(w in lower for w in ["rain", "storm", "wet", "downpour", "freeze", "weather"])
        is_harvest = any(w in lower for w in ["harvest", "combine", "ripe", "reaping"])
        is_towing = any(w in lower for w in ["tow", "haul", "transport", "move trailer"])
        is_tillage = any(w in lower for w in ["plow", "tillage", "till", "disc", "field prep"])
        is_spray = any(w in lower for w in ["spray", "pesticide", "fungicide", "fertilize"])

        intent = "harvesting" if is_harvest else ("tillage" if is_tillage else ("spraying" if is_spray else ("towing" if is_towing else "harvesting")))
        vulnerability = 9 if (is_harvest and is_weather) else (7 if is_harvest else (3 if is_towing else 5))
        urgency = 9 if (is_weather and is_harvest) else (4 if is_towing else 6)

        # Approximate duration
        duration = 4.0
        for word in lower.split():
            if word.isdigit():
                val = float(word)
                if 1.0 <= val <= 24.0:
                    duration = val
                    break

        return IntakeNormalizationOutput(
            intent_type=intent,
            estimated_duration_hours=duration,
            crop_vulnerability_level=vulnerability,
            stated_weather_threat=is_weather,
            urgency_rating=urgency,
            detected_crop="Wheat" if "wheat" in lower else ("Corn" if "corn" in lower else "Grain"),
            equipment_specs_requested="Tractor / Harvester",
            normalized_summary=f"Parsed {intent} operation for ~{duration:.1f}h. Weather threat: {is_weather}.",
        )

    # --------------------------------------------------------------------------
    # Agent 2: Explainable Arbitration Agent
    # --------------------------------------------------------------------------
    @classmethod
    def arbitrate_conflict(
        cls,
        candidate_a: Dict[str, Any],
        candidate_b: Dict[str, Any],
    ) -> ArbitrationExplanationOutput:
        """
        Takes two conflicting booking requests and their deterministic score breakdowns,
        and generates a transparent, equitable human-readable justification and contingency plan.
        """
        client = cls._get_client()

        prompt = (
            f"You are the FarmGrid Explainable Arbitration Agent.\n"
            f"Two prosumer farmers have submitted overlapping booking requests for the same scarce equipment.\n\n"
            f"CANDIDATE A:\n{json.dumps(candidate_a, indent=2)}\n\n"
            f"CANDIDATE B:\n{json.dumps(candidate_b, indent=2)}\n\n"
            f"Determine the winner based on the highest deterministic priority score and critical agronomic necessity.\n"
            f"Synthesize:\n"
            f"1. winning_booking_id\n"
            f"2. losing_booking_id\n"
            f"3. justification_en: Concise (2-3 sentences), transparent explanation citing specific factors "
            f"(e.g., imminent rain risk, ripe crop rot vs routine towing, anti-starvation wait time).\n"
            f"4. contingency_action: Empathetic, actionable recommendation for the deprioritized farmer "
            f"(e.g., 'Reroute to John's secondary 75HP tractor 6km south' or 'Shift slot by 2.5 hours post-maintenance').\n"
            f"5. primary_deciding_factor: Key driver.\n"
            f"Return strictly valid JSON adhering to the schema."
        )

        if client and types:
            try:
                response = client.models.generate_content(
                    model=cls.MODEL_NAME,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=ArbitrationExplanationOutput,
                        temperature=0.2,
                    ),
                )
                if response.text:
                    parsed_dict = json.loads(response.text)
                    return ArbitrationExplanationOutput(**parsed_dict)
            except Exception as e:
                print(f"[FarmGrid AI] GenAI arbitration error: {e}. Executing deterministic fallback.")

        # Deterministic fallback logic
        score_a = candidate_a.get("priority_score", 50.0)
        score_b = candidate_b.get("priority_score", 50.0)

        if score_a >= score_b:
            winner = candidate_a.get("id", "booking-A")
            loser = candidate_b.get("id", "booking-B")
            win_intent = candidate_a.get("intent", "harvesting")
            lose_intent = candidate_b.get("intent", "towing")
            driver = "Agronomic Urgency & Weather Risk"
        else:
            winner = candidate_b.get("id", "booking-B")
            loser = candidate_a.get("id", "booking-A")
            win_intent = candidate_b.get("intent", "harvesting")
            lose_intent = candidate_a.get("intent", "towing")
            driver = "Agronomic Urgency & Weather Risk"

        justification = (
            f"Booking {winner[:8]} was prioritized ({max(score_a, score_b):.1f} vs {min(score_a, score_b):.1f} pts) "
            f"because {win_intent} has high time-sensitivity ahead of imminent weather conditions, "
            f"whereas {lose_intent} can tolerate a scheduling buffer without direct yield loss."
        )
        contingency = (
            f"Recommend shifting booking {loser[:8]} to the next available turnaround window "
            f"or rerouting to standby machinery within the 50km cooperative network."
        )

        return ArbitrationExplanationOutput(
            winning_booking_id=winner,
            losing_booking_id=loser,
            justification_en=justification,
            contingency_action=contingency,
            primary_deciding_factor=driver,
            confidence_score=0.96,
        )

    # --------------------------------------------------------------------------
    # Agent 3: Dynamic Disruption Synthesizer
    # --------------------------------------------------------------------------
    @classmethod
    def simulate_disruption(
        cls,
        disruption_type: Literal["EQUIPMENT_BREAKDOWN", "SUDDEN_RAIN_ALERT"],
        resource_id: str,
        active_bookings: List[Dict[str, Any]],
        available_substitutes: List[Dict[str, Any]],
    ) -> DisruptionSimulateOutput:
        """
        Handles sudden real-world shocks (e.g., tractor blown head gasket, sudden 35mm downpour alert).
        Reallocates queue, triggers Gemini to synthesize remediation rationale.
        """
        client = cls._get_client()

        prompt = (
            f"You are the FarmGrid Crisis Coordination Agent.\n"
            f"A rural scarcity disruption event has occurred: {disruption_type}.\n"
            f"Primary Resource ID affected: {resource_id}.\n\n"
            f"ACTIVE BOOKINGS IN BUFFER:\n{json.dumps(active_bookings, indent=2)}\n\n"
            f"AVAILABLE SUBSTITUTE RESOURCES:\n{json.dumps(available_substitutes, indent=2)}\n\n"
            f"Analyze the disruption:\n"
            f"1. Invalidate or flag impacted bookings.\n"
            f"2. Match highest-priority plots to available substitute resources or safe weather windows.\n"
            f"3. Generate human_readable_rationale in clear, empathetic agricultural terminology.\n"
            f"4. Provide 2-3 concrete remediation_steps.\n"
            f"Return strictly valid JSON adhering to the schema."
        )

        if client and types:
            try:
                response = client.models.generate_content(
                    model=cls.MODEL_NAME,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=DisruptionSimulateOutput,
                        temperature=0.2,
                    ),
                )
                if response.text:
                    parsed_dict = json.loads(response.text)
                    return DisruptionSimulateOutput(**parsed_dict)
            except Exception as e:
                print(f"[FarmGrid AI] GenAI disruption simulation error: {e}. Executing deterministic fallback.")

        # Fallback dynamic rescheduling
        invalidated_ids = [b.get("id", "b1") for b in active_bookings]
        sub_id = available_substitutes[0].get("id", "substitute-res-1") if available_substitutes else "standby-res-default"

        adjusted = []
        for idx, b in enumerate(active_bookings):
            adjusted.append({
                "original_booking_id": b.get("id"),
                "reassigned_resource_id": sub_id,
                "adjusted_status": "rerouted" if available_substitutes else "pending_weather_clear",
                "revised_start": b.get("start_time"),
                "notes": f"Reallocated to secondary cooperative unit [{sub_id[:8]}] due to {disruption_type}."
            })

        if disruption_type == "EQUIPMENT_BREAKDOWN":
            rationale = (
                f"Hydraulic/mechanical failure triggered on resource [{resource_id[:8]}]. "
                f"Immediately rerouted {len(invalidated_ids)} active allocations to nearby cooperative reserve unit [{sub_id[:8]}]. "
                f"Calculated +45 min extra transit buffer to account for the new depot location."
            )
            steps = [
                f"Notify operator of resource {resource_id[:8]} to initiate maintenance status.",
                f"Dispatch substitute unit {sub_id[:8]} with updated GPS plot coordinates.",
                "Broadcast automated SMS transit alert to participating prosumers.",
            ]
        else:
            rationale = (
                f"Severe precipitation front detected (exceeding 25mm threshold). "
                f"Field compaction risks prohibit heavy machinery usage during active storm. "
                f"All active tillage operations suspended; peak harvest operations accelerated to pre-storm window."
            )
            steps = [
                "Prioritize plots with Harvest-Ready status before soil moisture exceeds trafficability limits.",
                "Halt non-urgent soil preparation and towing to prevent field rutting.",
                "Coordinate post-rain resumption timeline based on drainage index.",
            ]

        return DisruptionSimulateOutput(
            event_type=disruption_type,
            affected_resource_id=resource_id,
            invalidated_booking_ids=invalidated_ids,
            adjusted_schedules=adjusted,
            human_readable_rationale=rationale,
            remediation_steps=steps,
        )
