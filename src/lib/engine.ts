import { Booking, CropStage, IntentType, Plot, Resource, ScoreBreakdown, UrgencyEvaluationResult } from '../types';

export const RURAL_TRANSIT_SPEED_KMH = 30.0;
export const MANDATORY_PREP_BUFFER_MINUTES = 30.0;
export const DEFAULT_MAX_RADIUS_KM = 50.0;

/**
 * Calculates great-circle distance between two GPS coordinates using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371.0; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180.0;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Calculates rural transit minutes (at 30 km/h) plus mandatory 30m prep/turnaround buffer.
 */
export function calculateTransitBuffer(distanceKm: number): {
  transitMinutes: number;
  maintenanceMinutes: number;
  totalBufferMinutes: number;
} {
  const transitHours = distanceKm / RURAL_TRANSIT_SPEED_KMH;
  const transitMinutes = Number((transitHours * 60.0).toFixed(1));
  const maintenanceMinutes = MANDATORY_PREP_BUFFER_MINUTES;
  const totalBufferMinutes = Number((transitMinutes + maintenanceMinutes).toFixed(1));

  return { transitMinutes, maintenanceMinutes, totalBufferMinutes };
}

export interface FeasibilityCheckResult {
  feasible: boolean;          // true if zero collisions AND zero hard blockers
  isHardBlocker: boolean;     // true if distance > maxRadius, machine in maintenance, or invalid times
  hasTimeCollision: boolean;  // true if time overlap with existing booking or turnaround deficit
  conflictReason?: string;
  conflictingBooking?: Booking;
  conflictingBookings?: Booking[];
  distanceKm: number;
  bufferMinutes: number;
}

/**
 * Mathematical conflict and overlap detection preventing uncoordinated double-booking:
 * 1. Checks lender service radius: distance <= res.maxRadiusKm (Hard Blocker)
 * 2. Checks machine operational status: available vs maintenance (Hard Blocker)
 * 3. Mathematical interval overlap detection: max(S1, S2) < min(E1, E2) (Soft Collision -> Fair Turn Arbitration)
 * 4. Inter-farm transit & turnaround turnaround buffer verification (Soft Collision -> Fair Turn Arbitration)
 */
export function checkFeasibleTimeSlot(
  resource: Resource,
  plot: Plot,
  startTimeIso: string,
  endTimeIso: string,
  existingBookings: Booking[],
  excludeBookingId?: string
): FeasibilityCheckResult {
  const distanceKm = calculateHaversineDistance(
    resource.baseLat,
    resource.baseLng,
    plot.latitude,
    plot.longitude
  );

  const maxRadius = resource.maxRadiusKm || DEFAULT_MAX_RADIUS_KM;
  const transit = calculateTransitBuffer(distanceKm);

  // 1. Lender Radius Check (Hard Blocker)
  if (distanceKm > maxRadius) {
    return {
      feasible: false,
      isHardBlocker: true,
      hasTimeCollision: false,
      conflictReason: `Field is ${distanceKm.toFixed(1)} km away, exceeding lender max operational radius of ${maxRadius} km.`,
      distanceKm,
      bufferMinutes: transit.totalBufferMinutes,
    };
  }

  // 2. Operational Status Check (Hard Blocker)
  if (resource.operationalStatus === 'maintenance') {
    return {
      feasible: false,
      isHardBlocker: true,
      hasTimeCollision: false,
      conflictReason: `Machine ${resource.name} is currently flagged for maintenance.`,
      distanceKm,
      bufferMinutes: transit.totalBufferMinutes,
    };
  }

  const reqStart = new Date(startTimeIso).getTime();
  const reqEnd = new Date(endTimeIso).getTime();

  if (isNaN(reqStart) || isNaN(reqEnd) || reqEnd <= reqStart) {
    return {
      feasible: false,
      isHardBlocker: true,
      hasTimeCollision: false,
      conflictReason: 'Invalid requested time window.',
      distanceKm,
      bufferMinutes: transit.totalBufferMinutes,
    };
  }

  // 3. Filter active bookings for this physical equipment unit
  const relevantBookings = existingBookings.filter(
    (b) =>
      b.resourceId === resource.id &&
      b.status !== 'cancelled' &&
      b.id !== excludeBookingId
  );

  const collidingBookings: Booking[] = [];
  let primaryConflictReason: string | undefined;

  for (const b of relevantBookings) {
    const existStart = new Date(b.startTime).getTime();
    const existEnd = new Date(b.endTime).getTime();

    // Mathematical overlap condition: max(S1, S2) < min(E1, E2)
    const hasOverlap = Math.max(reqStart, existStart) < Math.min(reqEnd, existEnd);
    if (hasOverlap) {
      collidingBookings.push(b);
      if (!primaryConflictReason) {
        primaryConflictReason = `Time overlap: Machine is scheduled for ${b.plotName} (${b.farmerName}) during this period.`;
      }
      continue;
    }

    // 4. Turnaround & transit buffer between consecutive farm deployments
    const requiredBufferMs = (transit.totalBufferMinutes || 30) * 60 * 1000;

    // Case A: Existing booking ends right before requested booking starts
    if (existEnd <= reqStart && reqStart - existEnd < requiredBufferMs) {
      const gapMin = Math.round((reqStart - existEnd) / (60 * 1000));
      collidingBookings.push(b);
      if (!primaryConflictReason) {
        primaryConflictReason = `Transit turnaround: Only ${gapMin} min buffer available before this shift (needs +${transit.totalBufferMinutes} min).`;
      }
      continue;
    }

    // Case B: Requested booking ends right before existing booking starts
    if (reqEnd <= existStart && existStart - reqEnd < requiredBufferMs) {
      const gapMin = Math.round((existStart - reqEnd) / (60 * 1000));
      collidingBookings.push(b);
      if (!primaryConflictReason) {
        primaryConflictReason = `Transit turnaround: Only ${gapMin} min buffer before next shift at ${b.plotName} (needs +${transit.totalBufferMinutes} min).`;
      }
      continue;
    }
  }

  if (collidingBookings.length > 0) {
    return {
      feasible: false,
      isHardBlocker: false,
      hasTimeCollision: true,
      conflictReason: primaryConflictReason,
      conflictingBooking: collidingBookings[0],
      conflictingBookings: collidingBookings,
      distanceKm,
      bufferMinutes: transit.totalBufferMinutes,
    };
  }

  return {
    feasible: true,
    isHardBlocker: false,
    hasTimeCollision: false,
    distanceKm,
    bufferMinutes: transit.totalBufferMinutes,
  };
}

export interface PriorityScoreInput {
  hoursUntilStart: number;
  imminentRainfallMm: number;
  severeWeatherAlert: boolean;
  cropStage: CropStage;
  queueWaitHours: number;
  distanceKm: number;
  intent: IntentType;
  resourceConditionRating: number;
  urgencyJustificationBonus?: number; // 0 to 10 points evaluated from urgency justification
  urgencyEvaluation?: UrgencyEvaluationResult;
}

/**
 * Computes deterministic 0-100 priority score using benchmark weights:
 * 1. Urgency / Deadline & Justification Proximity: 25 pts max
 *    - Base deadline window: up to 15 pts
 *    - Urgency Justification Factor: up to 10 pts
 * 2. Weather Risk Exposure: 25 pts max
 * 3. Crop Vulnerability / Stage: 20 pts max
 * 4. Anti-Starvation Queue Wait Time: 15 pts max
 * 5. Logistics Proximity (<=50km): 10 pts max
 * 6. Equipment Condition & Intent Alignment: 5 pts max
 */
export function computeDeterministicPriorityScore(input: PriorityScoreInput): ScoreBreakdown {
  // 1. Urgency / Deadline Proximity & Justification Factor (25 pts max)
  let baseUrgencyPts = 0;
  if (input.hoursUntilStart <= 6.0) baseUrgencyPts = 15.0;
  else if (input.hoursUntilStart <= 12.0) baseUrgencyPts = 13.0;
  else if (input.hoursUntilStart <= 24.0) baseUrgencyPts = 10.0;
  else if (input.hoursUntilStart <= 48.0) baseUrgencyPts = 7.0;
  else if (input.hoursUntilStart <= 72.0) baseUrgencyPts = 4.0;
  else baseUrgencyPts = Math.max(1.0, 15.0 - (input.hoursUntilStart / 168.0) * 14.0);

  const urgencyBonus = Number(
    Math.min(10.0, Math.max(0.0, input.urgencyJustificationBonus || 0)).toFixed(1)
  );

  const urgencyPts = Number(Math.min(25.0, baseUrgencyPts + urgencyBonus).toFixed(1));

  // 2. Weather Risk Exposure (25 pts max)
  const rainPts = Math.min(20.0, (input.imminentRainfallMm / 25.0) * 20.0);
  const alertPts = input.severeWeatherAlert ? 5.0 : 0.0;
  const weatherRiskPts = Number(Math.min(25.0, rainPts + alertPts).toFixed(1));

  // 3. Crop Vulnerability / Stage (20 pts max)
  const stageMap: Record<CropStage, number> = {
    'Harvest-Ready': 20.0,
    'Ripening': 16.0,
    'Flowering': 12.0,
    'Vegetative': 7.0,
    'Post-Harvest': 3.0,
  };
  const cropVulnerabilityPts = stageMap[input.cropStage] ?? 10.0;

  // 4. Anti-Starvation Queue Wait Time (15 pts max)
  const antiStarvationPts = Number(Math.min(15.0, (input.queueWaitHours / 30.0) * 15.0).toFixed(1));

  // 5. Logistics Proximity (10 pts max)
  let logisticsProximityPts = 0;
  if (input.distanceKm < DEFAULT_MAX_RADIUS_KM) {
    logisticsProximityPts = Number(
      (10.0 * (1.0 - input.distanceKm / DEFAULT_MAX_RADIUS_KM)).toFixed(1)
    );
  }

  // 6. Intent & Condition Alignment (5 pts max)
  const intentBaseMap: Record<IntentType, number> = {
    harvesting: 4.5,
    spraying: 3.5,
    seeding: 3.0,
    irrigation: 2.5,
    tillage: 2.0,
    labour_weeding: 1.5,
    storage_haul: 1.0,
    towing: 0.5,
  };
  const baseIntent = intentBaseMap[input.intent] ?? 1.5;
  const conditionBonus = (input.resourceConditionRating / 5.0) * 0.5;
  const intentConditionPts = Number(Math.min(5.0, baseIntent + conditionBonus).toFixed(1));

  const totalPriorityScore = Number(
    (
      urgencyPts +
      weatherRiskPts +
      cropVulnerabilityPts +
      antiStarvationPts +
      logisticsProximityPts +
      intentConditionPts
    ).toFixed(1)
  );

  return {
    urgencyDeadlinePts: urgencyPts,
    urgencyJustificationPts: urgencyBonus,
    weatherRiskPts,
    cropVulnerabilityPts,
    antiStarvationPts,
    logisticsProximityPts,
    intentConditionPts,
    totalPriorityScore,
    details: input,
  };
}

/**
 * Ranks an array of bookings by priority score descending for Fair Turn arbitration.
 */
export function rankCollidingBookings(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Sequences an array of colliding bookings so that:
 * 1. The highest-priority booking retains or is allocated the primary 1st turn slot.
 * 2. Competing bookings are systematically scheduled into subsequent consecutive, non-overlapping
 *    time slots (startTime = previousBooking.endTime + transitBufferMinutes), preventing double-booking.
 */
export function sequenceCollidingBookings(
  rankedBookings: Booking[],
  defaultBufferMinutes = 30
): Booking[] {
  if (rankedBookings.length === 0) return [];

  const sequenced: Booking[] = [];
  let previousEndMs = 0;

  for (let idx = 0; idx < rankedBookings.length; idx++) {
    const original = rankedBookings[idx];
    const booking: Booking = { ...original };
    const originalDurationMs =
      new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime() ||
      4 * 3600 * 1000;
    const transitMs = (booking.transitBufferMinutes || defaultBufferMinutes) * 60 * 1000;

    let startMs = new Date(booking.startTime).getTime();
    if (idx > 0) {
      // Must not start before previous booking ends + transit buffer
      const earliestAvailableMs = previousEndMs + transitMs;
      if (startMs < earliestAvailableMs) {
        startMs = earliestAvailableMs;
      }
    }

    const endMs = startMs + originalDurationMs;
    previousEndMs = endMs;

    booking.startTime = new Date(startMs).toISOString();
    booking.endTime = new Date(endMs).toISOString();
    booking.status = 'confirmed';

    if (idx === 0) {
      booking.allocatedSlotExplanation = `Allocated: 1st Priority Turn (Fair Turn Score: ${booking.priorityScore}/100)`;
    } else {
      const prevFarmer = sequenced[idx - 1]?.farmerName || 'Preceding Farmer';
      booking.allocatedSlotExplanation = `Allocated: Turn #${idx + 1} after ${prevFarmer} (Sequential Auto-Schedule)`;
    }

    sequenced.push(booking);
  }

  return sequenced;
}

/**
 * Natural language intake parser simulating Gemini LLM intake agent.
 */
export function parseNaturalIntakeTranscript(text: string): {
  intent: IntentType;
  durationHours: number;
  cropStage: CropStage;
  weatherThreat: boolean;
  urgencyRating: number;
  detectedCrop: string;
  summary: string;
} {
  const lower = text.toLowerCase();
  const weatherThreat =
    lower.includes('rain') ||
    lower.includes('storm') ||
    lower.includes('weather') ||
    lower.includes('downpour') ||
    lower.includes('freeze');

  let intent: IntentType = 'harvesting';
  if (lower.includes('tow') || lower.includes('haul trailer')) intent = 'towing';
  else if (lower.includes('plow') || lower.includes('till') || lower.includes('disc')) intent = 'tillage';
  else if (lower.includes('spray') || lower.includes('fertiliz')) intent = 'spraying';
  else if (lower.includes('irrigat') || lower.includes('pump') || lower.includes('water')) intent = 'irrigation';
  else if (lower.includes('harvest') || lower.includes('combine') || lower.includes('cut')) intent = 'harvesting';

  let cropStage: CropStage = 'Ripening';
  if (lower.includes('ready') || lower.includes('ripe') || lower.includes('harvest ready')) {
    cropStage = 'Harvest-Ready';
  } else if (lower.includes('young') || lower.includes('pasture') || lower.includes('sprout')) {
    cropStage = 'Vegetative';
  }

  // Duration extraction
  let durationHours = 4;
  const matchHours = text.match(/(\d+)\s*(?:hours|hour|hrs|hr)/i);
  if (matchHours && matchHours[1]) {
    durationHours = parseInt(matchHours[1], 10);
  }

  let detectedCrop = 'Field Crops';
  if (lower.includes('corn')) detectedCrop = 'Yellow Dent Corn';
  else if (lower.includes('soy')) detectedCrop = 'Soybeans';
  else if (lower.includes('wheat')) detectedCrop = 'Spring Wheat';
  else if (lower.includes('alfalfa') || lower.includes('hay')) detectedCrop = 'Alfalfa Hay';

  const urgencyRating = weatherThreat && cropStage === 'Harvest-Ready' ? 9 : intent === 'towing' ? 3 : 7;

  return {
    intent,
    durationHours,
    cropStage,
    weatherThreat,
    urgencyRating,
    detectedCrop,
    summary: `Parsed ${intent} operation for ${durationHours}h on ${detectedCrop}. Weather alert: ${
      weatherThreat ? 'Imminent rainfall flag detected' : 'Normal conditions'
    }.`,
  };
}
