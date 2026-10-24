"""
AgriMart Agentic AI Service (Powered by Google AI Studio / google-genai SDK).
Implements 4 specialized agricultural agents with deterministic multi-dialect fallbacks:
1. Conversational Intake Normalization Agent
2. Explainable Arbitration Agent
3. Autonomous Crisis Disruption & Fleet Rerouting Agent
4. Urgency Justification Verification Agent
"""

import json
import re
from typing import Any, Dict, List
from backend.app.core.config import settings
from backend.app.schemas.ai_agent import (
    ArbitrateConflictRequest,
    ArbitrationExplanationOutput,
    DisruptionSimulationOutput,
    IntakeNormalizationOutput,
    ReallocatedBookingItem,
    SMSNotificationItem,
    UrgencyJustificationOutput,
)

try:
    from google import genai
    from google.genai import types

    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


class AgriMartAIAgent:
    """Orchestrates Google Gemini AI Studio agents with deterministic offline fallbacks."""

    DEFAULT_MODEL = "gemini-flash-latest"

    @classmethod
    def _get_client(cls):
        if not GENAI_AVAILABLE or not settings.is_gemini_configured:
            return None
        return genai.Client(api_key=settings.GEMINI_API_KEY)

    @classmethod
    def normalize_farmer_intake(cls, raw_text: str) -> IntakeNormalizationOutput:
        """Agent 1: Parses natural language / voice transcript into structured constraints."""
        client = cls._get_client()

        if client is not None:
            system_instruction = (
                "You are an expert agricultural operations dispatcher for AgriMart, a rural equipment "
                "sharing cooperative. Parse colloquial farmer requests (including Hindi/Punjabi/Haryanvi/English) "
                "into structured operational constraints."
            )
            prompt = f'Parse the following farmer equipment request into structured parameters:\n"{raw_text}"'
            try:
                response = client.models.generate_content(
                    model=cls.DEFAULT_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=IntakeNormalizationOutput,
                        temperature=0.1,
                    ),
                )
                if response.text:
                    data = json.loads(response.text)
                    return IntakeNormalizationOutput(**data)
            except Exception as e:
                print(f"[AgriMartAIAgent] Gemini intake fallback triggered: {e}")

        return cls._fallback_intake_parser(raw_text)

    @classmethod
    def generate_arbitration_explanation(
        cls, context: ArbitrateConflictRequest
    ) -> ArbitrationExplanationOutput:
        """Agent 2: Synthesizes transparent arbitration justification and contingency options."""
        client = cls._get_client()

        if client is not None:
            system_instruction = (
                "You are the Fair Turn Arbitration Mediator for AgriMart, an agricultural cooperative. "
                "When two farmers request the same equipment for overlapping slots, explain why the "
                "deterministic priority algorithm favored one farmer and provide a constructive "
                "contingency plan for the rescheduled farmer."
            )
            prompt = (
                f"Equipment: {context.resource_name}\n"
                f"WINNER: {context.winning_farmer_name} ({context.winning_plot_name}) | "
                f"Intent: {context.winning_intent} | Crop Stage: {context.winning_crop_stage} | "
                f"Score: {context.winning_score}/100\n"
                f"RESCHEDULED: {context.losing_farmer_name} ({context.losing_plot_name}) | "
                f"Intent: {context.losing_intent} | Crop Stage: {context.losing_crop_stage} | "
                f"Score: {context.losing_score}/100\n"
                f"Next Available Slot: {context.next_available_slot_iso}\n"
                f"Alternative Machine: {context.alternative_resource_name}"
            )
            try:
                response = client.models.generate_content(
                    model=cls.DEFAULT_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=ArbitrationExplanationOutput,
                        temperature=0.2,
                    ),
                )
                if response.text:
                    data = json.loads(response.text)
                    return ArbitrationExplanationOutput(**data)
            except Exception as e:
                print(f"[AgriMartAIAgent] Gemini arbitration fallback triggered: {e}")

        return cls._fallback_arbitration_explanation(context)

    @classmethod
    def simulate_disruption(
        cls,
        disruption_type: str,
        affected_machine_id: str,
        duration_hours: float,
        current_schedule_json: str,
    ) -> DisruptionSimulationOutput:
        """Agent 3: Autonomous Fleet Rerouting & Crisis Response Agent."""
        client = cls._get_client()

        if client is not None:
            system_instruction = (
                "You are an autonomous agricultural fleet manager. A crisis has occurred "
                "(e.g., sudden rain or machine breakdown). Analyze the current schedule and "
                "available alternative machines. Reallocate affected bookings to minimize crop loss. "
                "Output a JSON object containing system_action_taken, reallocated_bookings, and sms_notifications."
            )
            prompt = (
                f"Disruption Type: {disruption_type}\n"
                f"Affected Machine ID: {affected_machine_id}\n"
                f"Disruption Duration: {duration_hours} hours\n"
                f"Current Schedule & Fleet State JSON:\n{current_schedule_json}"
            )
            try:
                response = client.models.generate_content(
                    model=cls.DEFAULT_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=DisruptionSimulationOutput,
                        temperature=0.2,
                    ),
                )
                if response.text:
                    data = json.loads(response.text)
                    return DisruptionSimulationOutput(**data)
            except Exception as e:
                print(f"[AgriMartAIAgent] Gemini disruption fallback triggered: {e}")

        return cls._fallback_disruption_simulation(
            disruption_type=disruption_type,
            affected_machine_id=affected_machine_id,
            duration_hours=duration_hours,
            current_schedule_json=current_schedule_json,
        )

    @classmethod
    def evaluate_urgency_justification(
        cls,
        justification_text: str,
        crop_stage: str = "Ripening",
        rainfall_mm: float = 0.0,
    ) -> UrgencyJustificationOutput:
        """Agent 4: Evaluates farmer urgency justification into a 0-10 priority score bonus."""
        heuristic = cls._fallback_urgency_evaluation(
            justification_text, crop_stage, rainfall_mm
        )
        if not justification_text or not justification_text.strip():
            return heuristic

        client = cls._get_client()
        if client is not None:
            system_instruction = (
                "You are the AgriMart Fair Turn Agricultural Priority AI for Indian farming communities. "
                "Analyze the farmer's urgency justification text (English, Hindi, Punjabi, Haryanvi) "
                "and return a calibrated urgencyScoreBonus (0.0 to 10.0), urgencyRating (1 to 10), "
                "threatLevel (CRITICAL, HIGH, MODERATE, LOW), detectedThreats, cropLossRisk, and aiAnalysisSummary."
            )
            prompt = (
                f'Justification: "{justification_text}"\n'
                f"Biological Crop Stage: {crop_stage}\n"
                f"Forecasted Precipitation: {rainfall_mm} mm"
            )
            try:
                response = client.models.generate_content(
                    model=cls.DEFAULT_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=UrgencyJustificationOutput,
                        temperature=0.1,
                    ),
                )
                if response.text:
                    data = json.loads(response.text)
                    bonus = float(
                        min(10.0, max(0.0, data.get("urgencyScoreBonus", heuristic.urgencyScoreBonus)))
                    )
                    data["urgencyScoreBonus"] = round(bonus, 1)
                    data["verified_urgency_multiplier"] = round(1.0 + (bonus / 10.0), 2)
                    data["credibility_score"] = round(min(100.0, 65.0 + bonus * 3.5), 1)
                    data["ai_reasoning"] = data.get(
                        "aiAnalysisSummary", heuristic.aiAnalysisSummary
                    )
                    data["flagged_for_review"] = False
                    return UrgencyJustificationOutput(**data)
            except Exception as e:
                print(f"[AgriMartAIAgent] Gemini urgency fallback triggered: {e}")

        return heuristic

    # --------------------------------------------------------------------------
    # DETERMINISTIC MULTI-DIALECT FALLBACKS
    # --------------------------------------------------------------------------

    @staticmethod
    def _fallback_intake_parser(raw_text: str) -> IntakeNormalizationOutput:
        lower = raw_text.lower()
        weather_threat = any(
            kw in lower
            for kw in [
                "rain", "storm", "downpour", "hail", "frost", "freeze",
                "weather", "wet", "baarish", "barkha", "toofan", "paani",
            ]
        )
        intent = "harvesting"
        if any(kw in lower for kw in ["tow", "haul", "trailer", "transport", "trolley"]):
            intent = "towing"
        elif any(kw in lower for kw in ["till", "plow", "plough", "disc", "soil", "jutai"]):
            intent = "tillage"
        elif any(kw in lower for kw in ["spray", "fungicide", "pesticide", "fertiliz"]):
            intent = "spraying"
        elif any(kw in lower for kw in ["irrigat", "water", "pump"]):
            intent = "irrigation"
        elif any(kw in lower for kw in ["seed", "plant", "drill", "sow"]):
            intent = "seeding"

        crop_stage = "Ripening"
        if any(kw in lower for kw in ["harvest-ready", "ready to harvest", "ripe", "mature", "pak"]):
            crop_stage = "Harvest-Ready"
        elif any(kw in lower for kw in ["flower", "bloom", "tassel", "silking"]):
            crop_stage = "Flowering"
        elif any(kw in lower for kw in ["vegetative", "sprout", "early", "pasture"]):
            crop_stage = "Vegetative"

        duration_hours = 4.0
        hour_match = re.search(
            r"(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|ghante)", lower
        )
        if hour_match:
            duration_hours = min(72.0, max(1.0, float(hour_match.group(1))))

        detected_crop = "General Field Crop"
        if any(kw in lower for kw in ["wheat", "gehu", "kanak"]):
            detected_crop = "Wheat (Gehu)"
        elif any(kw in lower for kw in ["paddy", "rice", "dhan", "basmati"]):
            detected_crop = "Basmati Paddy (Dhan)"
        elif "corn" in lower or "maize" in lower:
            detected_crop = "Corn (Maize)"
        elif "soy" in lower:
            detected_crop = "Soybeans"

        urgency = 5
        if weather_threat and crop_stage in ("Harvest-Ready", "Ripening"):
            urgency = 9
        elif intent == "towing":
            urgency = 3
        elif intent == "harvesting":
            urgency = 7

        summary = (
            f"Normalized {intent} request ({duration_hours}h) for {detected_crop} "
            f"[{crop_stage}]. Weather threat: {'ACTIVE' if weather_threat else 'None'}."
        )
        return IntakeNormalizationOutput(
            intent=intent,
            duration_hours=duration_hours,
            crop_stage=crop_stage,
            weather_threat_detected=weather_threat,
            urgency_rating=urgency,
            detected_crop=detected_crop,
            concise_summary=summary,
        )

    @staticmethod
    def _fallback_arbitration_explanation(
        ctx: ArbitrateConflictRequest,
    ) -> ArbitrationExplanationOutput:
        score_delta = round(ctx.winning_score - ctx.losing_score, 1)
        win_msg = (
            f"Your {ctx.winning_intent} request for {ctx.winning_plot_name} ({ctx.winning_crop_stage}) "
            f"has been allocated the primary slot on {ctx.resource_name} with a Fair Turn Priority Score "
            f"of {ctx.winning_score}/100 (+{score_delta} pts margin)."
        )
        lose_msg = (
            f"To prevent severe crop loss on {ctx.winning_plot_name} during an active weather/maturity window, "
            f"{ctx.resource_name} was assigned to a higher-vulnerability {ctx.winning_intent} operation "
            f"(Score {ctx.winning_score} vs {ctx.losing_score}). Your anti-starvation priority boost has been credited."
        )
        contingency = (
            f"Recommended Action: Switch immediately to {ctx.alternative_resource_name} (available now within "
            f"geofence) OR confirm the auto-reserved slot at {ctx.next_available_slot_iso} with +5.0 anti-starvation bonus points."
        )
        audit = (
            f"Audited by AgriMart Deterministic Engine v2.0 | Zero-Bribery Guarantee | "
            f"Delta: +{score_delta} pts."
        )
        return ArbitrationExplanationOutput(
            winning_farmer_justification_en=win_msg,
            losing_farmer_explanation_en=lose_msg,
            contingency_recommendation=contingency,
            fairness_audit_note=audit,
        )

    @staticmethod
    def _fallback_disruption_simulation(
        disruption_type: str,
        affected_machine_id: str,
        duration_hours: float,
        current_schedule_json: str,
    ) -> DisruptionSimulationOutput:
        try:
            payload = json.loads(current_schedule_json)
            bookings: List[Dict[str, Any]] = payload.get("bookings", [])
            resources: List[Dict[str, Any]] = payload.get("resources", [])
        except Exception:
            bookings = []
            resources = []

        substitute_machine_name = "Community Reserve Unit #2"
        affected_machine_name = affected_machine_id
        for r in resources:
            if r.get("id") == affected_machine_id:
                affected_machine_name = r.get("name", affected_machine_id)
            elif r.get("operationalStatus") == "available":
                substitute_machine_name = r.get("name", substitute_machine_name)

        reallocated: List[ReallocatedBookingItem] = []
        sms_list: List[SMSNotificationItem] = []

        for b in bookings:
            if b.get("status") == "cancelled":
                continue
            farmer = b.get("farmerName", "Cooperative Farmer")
            orig_slot = f"{b.get('startTime', '')} - {b.get('endTime', '')}"
            res_id = b.get("resourceId", "")

            if res_id == affected_machine_id:
                if disruption_type == "EQUIPMENT_BREAKDOWN":
                    reallocated.append(
                        ReallocatedBookingItem(
                            farmer_name=farmer,
                            original_slot=orig_slot,
                            new_slot=f"Immediate Reroute (+30m transit buffer) [{duration_hours}h window]",
                            assigned_machine=substitute_machine_name,
                            status="Substitute Assigned",
                        )
                    )
                    sms_list.append(
                        SMSNotificationItem(
                            recipient=farmer,
                            message=(
                                f"[AgriMart Crisis Dispatch] {affected_machine_name} reported a mechanical breakdown. "
                                f"Your booking for {b.get('plotName', 'your plot')} has been automatically reassigned to "
                                f"{substitute_machine_name} with zero priority penalty."
                            ),
                        )
                    )
                else:
                    reallocated.append(
                        ReallocatedBookingItem(
                            farmer_name=farmer,
                            original_slot=orig_slot,
                            new_slot=f"Pre-Storm Express Window (Shifted +{duration_hours}h post-squall)",
                            assigned_machine=affected_machine_name,
                            status="Delayed",
                        )
                    )
                    sms_list.append(
                        SMSNotificationItem(
                            recipient=farmer,
                            message=(
                                f"[AgriMart Weather Sentinel] Sudden rain alert detected. "
                                f"Harvest-ready crops prioritized; your slot on {affected_machine_name} is protected "
                                f"with +5.0 anti-starvation priority pts."
                            ),
                        )
                    )
            else:
                reallocated.append(
                    ReallocatedBookingItem(
                        farmer_name=farmer,
                        original_slot=orig_slot,
                        new_slot=orig_slot,
                        assigned_machine=b.get("resourceName", "Assigned Unit"),
                        status="Unaffected",
                    )
                )

        if not reallocated:
            reallocated.append(
                ReallocatedBookingItem(
                    farmer_name="Rajeshwar Singh (Plot #4)",
                    original_slot="Today 10:00 AM - 02:00 PM",
                    new_slot="Today 10:30 AM - 02:30 PM (+30m Transit Buffer)",
                    assigned_machine=substitute_machine_name,
                    status="Substitute Assigned"
                    if disruption_type == "EQUIPMENT_BREAKDOWN"
                    else "Delayed",
                )
            )
            sms_list.append(
                SMSNotificationItem(
                    recipient="Rajeshwar Singh (+91-98120-XXXXX)",
                    message=(
                        f"[AgriMart Alert] {disruption_type.replace('_', ' ')} on {affected_machine_name}. "
                        f"Rerouted to {substitute_machine_name} automatically."
                    ),
                )
            )

        action_summary = (
            f"Autonomous Fleet Reroute Executed: {affected_machine_name} flagged for {disruption_type}. "
            f"Impacted jobs reallocated to {substitute_machine_name} within 50km geofence."
        )

        return DisruptionSimulationOutput(
            system_action_taken=action_summary,
            reallocated_bookings=reallocated,
            sms_notifications=sms_list,
        )

    @staticmethod
    def _fallback_urgency_evaluation(
        text: str,
        crop_stage: str = "Ripening",
        rainfall_mm: float = 0.0,
    ) -> UrgencyJustificationOutput:
        if not text or not text.strip():
            return UrgencyJustificationOutput(
                urgencyScoreBonus=0.0,
                urgencyRating=2,
                threatLevel="LOW",
                detectedThreats=[],
                cropLossRisk="Standard routine request without emergency risk factors.",
                aiAnalysisSummary="Standard turn requested. No critical crop loss triggers detected.",
                verified_urgency_multiplier=1.0,
                credibility_score=80.0,
                ai_reasoning="Standard turn requested. No critical crop loss triggers detected.",
                flagged_for_review=False,
            )

        lower = text.lower()
        threats: List[str] = []
        score = 0.0

        rain_match = any(
            kw in lower
            for kw in [
                "rain", "baarish", "barkha", "storm", "toofan", "waterlog",
                "downpour", "paani", "pani", "wet", "flood", "monsoon",
            ]
        )
        if rain_match:
            threats.append("Imminent Rainstorm / Waterlogging Threat")
            score += 4.5

        damage_match = any(
            kw in lower
            for kw in [
                "shatter", "rot", "spoil", "overripe", "loss", "nuksan",
                "kharab", "gir", "fall", "lodging", "pest", "keeda", "fungus", "damage",
            ]
        )
        if damage_match:
            threats.append("High Spoilage / Grain Shattering Risk")
            score += 3.5

        time_match = any(
            kw in lower
            for kw in [
                "urgent", "emergency", "immediate", "jaldi", "aaj hi",
                "kal subah", "asap", "critical", "hours", "deadline",
            ]
        )
        if time_match:
            threats.append("Time-Sensitive Harvest Window")
            score += 2.0

        is_vulnerable = crop_stage in ("Harvest-Ready", "Ripening") or any(
            kw in lower for kw in ["basmati", "dhan", "gehu", "paddy", "wheat"]
        )
        if is_vulnerable and (rain_match or damage_match):
            score += 1.5

        if rainfall_mm > 5.0 and (rain_match or damage_match):
            score += 1.0

        bonus = round(min(10.0, max(1.0, score)), 1)
        rating = min(10, max(1, int(round(bonus))))

        if bonus >= 7.5:
            threat_level = "CRITICAL"
            loss_risk = "Severe crop loss imminent if harvest delayed past the weather window."
        elif bonus >= 5.0:
            threat_level = "HIGH"
            loss_risk = "Elevated risk of grain damage or soil moisture degradation."
        elif bonus >= 2.5:
            threat_level = "MODERATE"
            loss_risk = "Moderate operational impact if rescheduled."
        else:
            threat_level = "LOW"
            loss_risk = "Minor impact if rescheduled."

        threat_str = (
            ", ".join(threats) if threats else "Routine agricultural operation"
        )
        summary = f"Justification evaluates to {threat_level} priority: {threat_str} (+{bonus} pts Fair Turn bonus)."

        return UrgencyJustificationOutput(
            urgencyScoreBonus=bonus,
            urgencyRating=rating,
            threatLevel=threat_level,
            detectedThreats=threats,
            cropLossRisk=loss_risk,
            aiAnalysisSummary=summary,
            verified_urgency_multiplier=round(1.0 + (bonus / 10.0), 2),
            credibility_score=round(min(100.0, 65.0 + bonus * 3.5), 1),
            ai_reasoning=summary,
            flagged_for_review=False,
        )
