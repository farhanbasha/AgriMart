/**
 * FarmGrid Google Gemini AI Integration
 * Powered by @google/genai SDK with multi-dialect support (Hindi, Punjabi, Haryanvi, English).
 */

import { GoogleGenAI } from '@google/genai';
import { Booking, CropStage, IntentType, UrgencyEvaluationResult } from '../types';

function getGeminiKey(): string {
  try {
    const viteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (viteKey) return viteKey;
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) {
      return process.env.VITE_GEMINI_API_KEY;
    }
  } catch {}
  return '';
}

let _ai: any = null;

function getAI(): any {
  if (_ai) return _ai;
  const key = getGeminiKey();
  if (!key || key === 'YOUR_GEMINI_KEY') return null;
  try {
    _ai = new GoogleGenAI({ apiKey: key });
    return _ai;
  } catch (e) {
    console.warn('[Gemini] Init error:', e);
    return null;
  }
}

export function isGeminiConfigured(): boolean {
  const key = getGeminiKey();
  return Boolean(key && key !== 'YOUR_GEMINI_KEY' && key.length > 10);
}

// Active models verified for this key with multi-version fallback
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3-flash-preview', 'gemini-flash-latest'];

async function callGemini(prompt: string, maxTokens = 800): Promise<string | null> {
  const ai = getAI();
  if (!ai) return null;

  for (const modelName of GEMINI_MODELS) {
    try {
      const resp = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: 0.2,
          maxOutputTokens: maxTokens,
        },
      });
      if (resp && resp.text) {
        return resp.text.trim();
      }
    } catch (err: any) {
      console.warn('[Gemini] Model ' + modelName + ' attempt error:', err?.message || err);
    }
  }
  return null;
}

function extractJSON(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ==============================================================================
// 1. MULTILINGUAL VOICE / TEXT INTAKE PARSER
// ==============================================================================

export interface GeminiIntakeResult {
  intent: IntentType;
  durationHours: number;
  cropStage: CropStage;
  weatherThreat: boolean;
  urgencyRating: number;
  detectedCrop: string;
  summary: string;
}

export async function parseVoiceIntakeWithGemini(text: string): Promise<GeminiIntakeResult | null> {
  if (!text || !text.trim()) return null;

  const prompt = `You are an expert agricultural coordinator assisting Indian farmers in Haryana, Punjab, and Uttar Pradesh.
Parse this conversational farmer voice request (which may contain Hindi, Punjabi, or colloquial rural phrasing):
"${text}"

Respond STRICTLY with a valid JSON object matching these fields:
{
  "intent": "harvesting" | "tillage" | "spraying" | "irrigation" | "towing" | "storage_haul" | "seeding" | "labour_weeding",
  "durationHours": number,
  "cropStage": "Vegetative" | "Flowering" | "Ripening" | "Harvest-Ready" | "Post-Harvest",
  "weatherThreat": boolean,
  "urgencyRating": number between 1 (routine haul) and 10 (emergency pre-rain harvest),
  "detectedCrop": string (e.g. "Wheat / Gehu", "Basmati Paddy", "Sugarcane", "Mustard / Sarson"),
  "summary": string (clean 1-sentence English description of the equipment needed and purpose)
}

Cultural vocabulary hints:
- "baarish" / "barkha" / "paani" = rain
- "dhan" / "chawal" = paddy/rice
- "gehu" / "kanak" = wheat
- "ganna" = sugarcane
- "sarso" = mustard
- "tola" / "trolley" = towing / haulage
- "katai" / "wadhi" = harvesting
- "jutai" / "vahuna" = tillage / plowing
- "kal subah" = tomorrow morning`;

  const responseText = await callGemini(prompt, 500);
  if (!responseText) return null;

  const parsed = extractJSON(responseText);
  if (!parsed) return null;

  const validIntents: IntentType[] = [
    'harvesting', 'tillage', 'spraying', 'irrigation',
    'towing', 'storage_haul', 'seeding', 'labour_weeding'
  ];
  const validStages: CropStage[] = [
    'Vegetative', 'Flowering', 'Ripening', 'Harvest-Ready', 'Post-Harvest'
  ];

  return {
    intent: validIntents.includes(parsed.intent) ? parsed.intent : 'harvesting',
    durationHours: Number(parsed.durationHours) || 4,
    cropStage: validStages.includes(parsed.cropStage) ? parsed.cropStage : 'Ripening',
    weatherThreat: Boolean(parsed.weatherThreat),
    urgencyRating: Math.min(10, Math.max(1, Number(parsed.urgencyRating) || 5)),
    detectedCrop: parsed.detectedCrop || 'Field Crops',
    summary: parsed.summary || text,
  };
}

// ==============================================================================
// 2. DYNAMIC URGENCY JUSTIFICATION NLP & GEMINI EVALUATOR
// ==============================================================================

/**
 * Robust offline heuristic NLP evaluator for farmer urgency sentences.
 * Operates with zero external API calls in low-signal and offline rural areas.
 */
export function evaluateUrgencyHeuristic(
  text: string,
  cropStage?: string,
  weatherRainfallMm?: number
): UrgencyEvaluationResult {
  if (!text || !text.trim()) {
    return {
      urgencyScoreBonus: 0,
      urgencyRating: 2,
      threatLevel: 'LOW',
      detectedThreats: [],
      cropLossRisk: 'Standard routine request without emergency risk factors.',
      aiAnalysisSummary: 'Standard turn requested. No critical crop loss triggers detected.',
    };
  }

  const lower = text.toLowerCase();
  const detectedThreats: string[] = [];
  let score = 0;

  // Rain and storm signals
  const rainMatch =
    lower.includes('rain') ||
    lower.includes('baarish') ||
    lower.includes('barkha') ||
    lower.includes('storm') ||
    lower.includes('toofan') ||
    lower.includes('waterlog') ||
    lower.includes('downpour') ||
    lower.includes('paani') ||
    lower.includes('pani') ||
    lower.includes('wet') ||
    lower.includes('flood') ||
    lower.includes('monsoon');

  if (rainMatch) {
    detectedThreats.push('Imminent Rainstorm / Waterlogging Threat');
    score += 4.5;
  }

  // Spoilage, shattering, and crop loss signals
  const damageMatch =
    lower.includes('shatter') ||
    lower.includes('rot') ||
    lower.includes('spoil') ||
    lower.includes('overripe') ||
    lower.includes('loss') ||
    lower.includes('nuksan') ||
    lower.includes('kharab') ||
    lower.includes('gir') ||
    lower.includes('fall') ||
    lower.includes('lodging') ||
    lower.includes('pest') ||
    lower.includes('keeda') ||
    lower.includes('fungus') ||
    lower.includes('damage') ||
    lower.includes('crop fail');

  if (damageMatch) {
    detectedThreats.push('High Spoilage / Grain Shattering Risk');
    score += 3.5;
  }

  // Time-critical urgency signals
  const timeMatch =
    lower.includes('urgent') ||
    lower.includes('emergency') ||
    lower.includes('immediate') ||
    lower.includes('jaldi') ||
    lower.includes('aaj hi') ||
    lower.includes('kal subah') ||
    lower.includes('asap') ||
    lower.includes('critical') ||
    lower.includes('hours') ||
    lower.includes('deadline');

  if (timeMatch) {
    detectedThreats.push('Time-Sensitive Harvest Window');
    score += 2.0;
  }

  // Crop stage biological sensitivity
  const isVulnerableStage =
    cropStage === 'Harvest-Ready' ||
    cropStage === 'Ripening' ||
    lower.includes('basmati') ||
    lower.includes('dhan') ||
    lower.includes('gehu') ||
    lower.includes('paddy');

  if (isVulnerableStage && (rainMatch || damageMatch)) {
    score += 1.5;
  }

  if (weatherRainfallMm && weatherRainfallMm > 5.0 && (rainMatch || damageMatch)) {
    score += 1.0;
  }

  const bonus = Number(Math.min(10.0, Math.max(1.0, score)).toFixed(1));
  const rating = Math.min(10, Math.max(1, Math.round(bonus)));

  let threatLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
  if (bonus >= 7.5) threatLevel = 'CRITICAL';
  else if (bonus >= 5.0) threatLevel = 'HIGH';
  else if (bonus >= 2.5) threatLevel = 'MODERATE';

  const threatStr = detectedThreats.length > 0 ? detectedThreats.join(', ') : 'Routine agricultural operation';
  const cropLossRisk =
    bonus >= 7.5
      ? 'Severe crop loss imminent if harvest delayed past the weather window.'
      : bonus >= 5.0
      ? 'Elevated risk of grain damage or soil moisture degradation.'
      : 'Minor impact if rescheduled.';

  const summary = `Justification evaluates to ${threatLevel} priority: ${threatStr} (+${bonus} pts Fair Turn bonus).`;

  return {
    urgencyScoreBonus: bonus,
    urgencyRating: rating,
    threatLevel,
    detectedThreats,
    cropLossRisk,
    aiAnalysisSummary: summary,
  };
}

/**
 * Evaluates farmer urgency justification using Google Gemini AI,
 * seamlessly falling back to local heuristic analysis when offline.
 */
export async function evaluateUrgencyJustificationWithGemini(
  justificationText: string,
  cropStage?: string,
  weatherRainfallMm?: number
): Promise<UrgencyEvaluationResult> {
  const heuristicFallback = evaluateUrgencyHeuristic(justificationText, cropStage, weatherRainfallMm);
  if (!justificationText || !justificationText.trim()) {
    return heuristicFallback;
  }

  if (!isGeminiConfigured()) {
    return heuristicFallback;
  }

  const prompt = `You are the FarmGrid Fair Turn Agricultural Priority AI for Indian farming communities.
Analyze this farmer's urgency justification text written when requesting shared farm equipment:
"${justificationText}"

Contextual factors:
- Biological Crop Stage: ${cropStage || 'Ripening'}
- Forecasted Precipitation: ${weatherRainfallMm || 0} mm

Respond STRICTLY with a valid JSON object matching these exact fields:
{
  "urgencyScoreBonus": number between 0.0 and 10.0 (exact points added to priority score),
  "urgencyRating": number between 1 (routine haul/plow) and 10 (emergency pre-storm harvest or catastrophic rot),
  "threatLevel": "CRITICAL" | "HIGH" | "MODERATE" | "LOW",
  "detectedThreats": ["list of detected threats like imminent rain, grain shattering, waterlogging, mould"],
  "cropLossRisk": "1-2 sentences in clear English on the biological danger to the crop",
  "aiAnalysisSummary": "1 sentence summarizing why this justification increases priority"
}

Calibration benchmark:
- Imminent rain / storm over ripe Basmati paddy or wheat: 8.0 to 10.0 pts (CRITICAL)
- Severe grain shattering, fungal rot, or flood threat: 6.5 to 8.5 pts (HIGH)
- Moderate time-sensitivity (tight planting window, labour delay): 3.5 to 6.0 pts (MODERATE)
- Routine soil prep, maintenance, or non-urgent towing: 0.0 to 3.0 pts (LOW)`;

  try {
    const responseText = await callGemini(prompt, 500);
    if (!responseText) return heuristicFallback;

    const parsed = extractJSON(responseText);
    if (!parsed) return heuristicFallback;

    const bonus = Number(parsed.urgencyScoreBonus);
    const validBonus = isNaN(bonus) ? heuristicFallback.urgencyScoreBonus : Math.min(10, Math.max(0, bonus));
    const rating = Number(parsed.urgencyRating);
    const validRating = isNaN(rating) ? heuristicFallback.urgencyRating : Math.min(10, Math.max(1, rating));
    const validThreatLevel = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'].includes(parsed.threatLevel)
      ? parsed.threatLevel
      : heuristicFallback.threatLevel;

    return {
      urgencyScoreBonus: Number(validBonus.toFixed(1)),
      urgencyRating: validRating,
      threatLevel: validThreatLevel,
      detectedThreats: Array.isArray(parsed.detectedThreats) && parsed.detectedThreats.length > 0
        ? parsed.detectedThreats
        : heuristicFallback.detectedThreats,
      cropLossRisk: parsed.cropLossRisk || heuristicFallback.cropLossRisk,
      aiAnalysisSummary: parsed.aiAnalysisSummary || heuristicFallback.aiAnalysisSummary,
    };
  } catch (err) {
    console.warn('[Gemini] evaluateUrgencyJustification failed, using heuristic fallback:', err);
    return heuristicFallback;
  }
}

// ==============================================================================
// 3. EXPLAINABLE ARBITRATION AGENT
// ==============================================================================

export interface GeminiArbitrationResult {
  explanation: string;
  contingencyInHindi: string;
  fairnessSummary: string;
}

export async function generateArbitrationExplanation(
  bookingA: Booking,
  bookingB: Booking,
  winnerId: string
): Promise<GeminiArbitrationResult | null> {
  const winner = winnerId === bookingA.id ? bookingA : bookingB;
  const loser = winnerId === bookingA.id ? bookingB : bookingA;

  const winnerJustification = winner.urgencyJustification || 'High crop vulnerability and imminent weather threat';
  const loserJustification = loser.urgencyJustification || 'Standard scheduled request';

  const prompt = `You are the FarmGrid Fair Turn Arbitration Coordinator explaining a fair equipment allocation between two Indian farmers.

WINNER (Awarded Priority):
- Farmer: ${winner.farmerName}
- Plot: ${winner.plotName} (Crop: ${winner.cropStage})
- Operation: ${winner.intent}
- Priority Score: ${winner.priorityScore} / 100
- Urgency Justification: "${winnerJustification}"
- Score Breakdown: Weather Risk ${winner.scoreBreakdown?.weatherRiskPts ?? 0}pts, Urgency ${winner.scoreBreakdown?.urgencyDeadlinePts ?? 0}pts (Urgency Justification: ${winner.scoreBreakdown?.urgencyJustificationPts ?? 0}pts), Crop Vulnerability ${winner.scoreBreakdown?.cropVulnerabilityPts ?? 0}pts

DEPRIORITIZED (Rescheduled / Contingency):
- Farmer: ${loser.farmerName}
- Plot: ${loser.plotName} (Crop: ${loser.cropStage})
- Operation: ${loser.intent}
- Priority Score: ${loser.priorityScore} / 100
- Urgency Justification: "${loserJustification}"

Respond STRICTLY with a valid JSON object:
{
  "explanation": "2-3 sentences in clear English explaining why ${winner.farmerName} received priority over ${loser.farmerName}, citing their urgency justification, crop vulnerability, and imminent weather risk without bureaucratic jargon.",
  "contingencyInHindi": "1-2 respectful sentences in Devanagari Hindi reassuring ${loser.farmerName} with an actionable next step or backup arrangement.",
  "fairnessSummary": "1 concise sentence stating the mathematical benchmark that guaranteed fair turn allocation."
}`;

  const responseText = await callGemini(prompt, 600);
  if (!responseText) {
    const diff = (winner.priorityScore - loser.priorityScore).toFixed(1);
    return {
      explanation: `Allocation awarded to ${winner.farmerName} (${winner.priorityScore}/100) over ${loser.farmerName} (${loser.priorityScore}/100) with a +${diff} pt priority margin. ${winner.farmerName}'s request carries urgent crop vulnerability ("${winnerJustification}") which outweighs routine scheduling.`,
      contingencyInHindi: `${loser.farmerName} जी, आपके कार्य के लिए पास के दूसरे उपकरण या अगले सुरक्षित समय स्लॉट की व्यवस्था की जा रही है।`,
      fairnessSummary: `Decision computed transparently by Fair Turn algorithm using crop stage, weather threat, and urgency justification.`,
    };
  }

  const parsed = extractJSON(responseText);
  if (!parsed) return null;

  return {
    explanation: parsed.explanation || '',
    contingencyInHindi: parsed.contingencyInHindi || '',
    fairnessSummary: parsed.fairnessSummary || '',
  };
}

// ==============================================================================
// 3. DYNAMIC DISRUPTION CRISIS AGENT
// ==============================================================================

export interface GeminiDisruptionResult {
  rationale: string;
  remediationSteps: string[];
  affectedFarmersMessage: string;
  substituteAdvice: string;
}

export async function generateDisruptionResponse(
  disruptionType: 'EQUIPMENT_BREAKDOWN' | 'SUDDEN_RAIN_ALERT',
  resourceName: string,
  affectedBookings: Booking[],
  substituteNames: string[]
): Promise<GeminiDisruptionResult | null> {
  const prompt = `You are the FarmGrid Crisis Coordinator. An agricultural disruption occurred in the village cluster.
Event: ${disruptionType.replace('_', ' ')}
Equipment Impacted: ${resourceName}
Impacted Bookings Count: ${affectedBookings.length}
Available Substitute Equipment in Network: ${substituteNames.join(', ') || 'Community Cooperative Reserve'}

Respond STRICTLY with a valid JSON object:
{
  "rationale": "2 sentences describing the operational impact on crop readiness and field schedule.",
  "remediationSteps": [
    "Step 1: Immediate dispatch or reroute instruction",
    "Step 2: Buffer and transit coordination",
    "Step 3: Post-event verification"
  ],
  "affectedFarmersMessage": "A reassuring broadcast message for impacted farmers in the WhatsApp/SMS group.",
  "substituteAdvice": "Specific operational advice on how to deploy the substitute equipment smoothly."
}`;

  const responseText = await callGemini(prompt, 600);
  if (!responseText) return null;

  const parsed = extractJSON(responseText);
  if (!parsed) return null;

  return {
    rationale: parsed.rationale || '',
    remediationSteps: Array.isArray(parsed.remediationSteps) ? parsed.remediationSteps : [],
    affectedFarmersMessage: parsed.affectedFarmersMessage || '',
    substituteAdvice: parsed.substituteAdvice || '',
  };
}
