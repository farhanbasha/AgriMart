import {
  Booking,
  ConflictRecord,
  CropStage,
  IntentType,
  Plot,
  Resource,
  ScoreBreakdown,
  UrgencyEvaluationResult,
} from '../types';

export const RURAL_TRANSIT_SPEED_KMH = 30.0;
export const MANDATORY_PREP_BUFFER_MINUTES = 30.0;
export const ONGOING_LOCK_BUFFER_MINUTES = 30.0;
export const DEFAULT_MAX_RADIUS_KM = 50.0;

/**
 * Returns true if the booking's scheduled endTime has already elapsed (endTime <= nowMs).
 * Elapsed bookings are automatically purged from active schedules.
 */
export function isBookingElapsed(
  booking: { endTime: string; status?: string },
  nowMs: number = Date.now()
): boolean {
  if (!booking?.endTime) return false;
  const endMs = new Date(booking.endTime).getTime();
  if (isNaN(endMs)) return false;
  return endMs <= nowMs;
}

/**
 * Filters out any booking whose scheduled endTime has elapsed (endTime <= nowMs).
 */
export function filterNonElapsedBookings(
  bookings: Booking[],
  nowMs: number = Date.now()
): { activeBookings: Booking[]; removedElapsedIds: string[] } {
  const activeBookings: Booking[] = [];
  const removedElapsedIds: string[] = [];

  for (const b of bookings) {
    if (!b) continue;
    if (isBookingElapsed(b, nowMs)) {
      if (b.id) removedElapsedIds.push(b.id);
    } else {
      activeBookings.push(b);
    }
  }

  return { activeBookings, removedElapsedIds };
}

/**
 * Returns true if a booking is currently ongoing OR within its 30-minute pre-start
 * buffer window:
 *   (startTime - 30 minutes) <= nowMs < endTime
 *
 * Example:
 * If a tractor is booked Sunday 10:00 AM - 12:00 PM (priority 70), starting at 9:30 AM
 * (30 mins early because of buffer time) through 12:00 PM, it is LOCKED.
 * Even if another farmer tries to book during 9:30 AM - 11:59 AM with priority 80,
 * this ongoing schedule must not be disturbed or compared in priority.
 */
export function isBookingLockedOngoing(
  booking: { startTime: string; endTime: string; status?: string },
  nowMs: number = Date.now(),
  bufferMinutes: number = ONGOING_LOCK_BUFFER_MINUTES
): boolean {
  if (!booking?.startTime || !booking?.endTime) return false;
  if (booking.status === 'cancelled') return false;

  const startMs = new Date(booking.startTime).getTime();
  const endMs = new Date(booking.endTime).getTime();
  if (isNaN(startMs) || isNaN(endMs)) return false;

  const lockStartMs = startMs - bufferMinutes * 60 * 1000;
  return nowMs >= lockStartMs && nowMs < endMs;
}

/**
 * Returns the specific real-time operational state of a booking for UI badges:
 * - 'elapsed': endTime <= nowMs
 * - 'ongoing': startTime <= nowMs < endTime
 * - 'buffer_locked': (startTime - 30m) <= nowMs < startTime
 * - 'upcoming': nowMs < (startTime - 30m)
 */
export function getBookingLiveTimeState(
  booking: { startTime: string; endTime: string; status?: string },
  nowMs: number = Date.now(),
  bufferMinutes: number = ONGOING_LOCK_BUFFER_MINUTES
): 'elapsed' | 'ongoing' | 'buffer_locked' | 'upcoming' {
  const startMs = new Date(booking.startTime).getTime();
  const endMs = new Date(booking.endTime).getTime();
  if (endMs <= nowMs) return 'elapsed';
  if (nowMs >= startMs && nowMs < endMs) return 'ongoing';
  if (nowMs >= startMs - bufferMinutes * 60 * 1000 && nowMs < startMs) return 'buffer_locked';
  return 'upcoming';
}

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
  feasible: boolean;                     // true if zero collisions AND zero hard blockers
  isHardBlocker: boolean;                // true if distance > maxRadius, machine in maintenance, or invalid times
  hasTimeCollision: boolean;             // true if time overlap with existing booking or turnaround deficit
  hasLockedOngoingCollision?: boolean;   // true if colliding with a booking currently ongoing or within 30m buffer
  lockedOngoingBookings?: Booking[];     // ongoing/buffer-locked bookings that cannot be preempted
  conflictReason?: string;
  conflictingBooking?: Booking;
  conflictingBookings?: Booking[];       // remaining (unlocked) colliding bookings
  distanceKm: number;
  bufferMinutes: number;
}

/**
 * Checks whether two time intervals [s1, e1] and [s2, e2] directly overlap or violate
 * the required turnaround transit buffer between them.
 */
export function intervalsCollideWithBuffer(
  s1Ms: number,
  e1Ms: number,
  s2Ms: number,
  e2Ms: number,
  requiredBufferMs: number
): boolean {
  if (Math.max(s1Ms, s2Ms) < Math.min(e1Ms, e2Ms)) {
    return true;
  }
  if (e1Ms <= s2Ms && s2Ms - e1Ms < requiredBufferMs) {
    return true;
  }
  if (e2Ms <= s1Ms && s1Ms - e2Ms < requiredBufferMs) {
    return true;
  }
  return false;
}

/**
 * Mathematical conflict and overlap detection preventing uncoordinated double-booking:
 * 1. Checks lender service radius: distance <= res.maxRadiusKm (Hard Blocker)
 * 2. Checks machine operational status: available vs maintenance (Hard Blocker)
 * 3. Automatically ignores elapsed bookings (endTime <= nowMs)
 * 4. Distinguishes Locked Ongoing / 30-Min Buffer bookings from Remaining Future schedules
 */
export function checkFeasibleTimeSlot(
  resource: Resource,
  plot: Plot,
  startTimeIso: string,
  endTimeIso: string,
  existingBookings: Booking[],
  excludeBookingId?: string,
  nowMs: number = Date.now()
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

  // 3. Filter active, non-elapsed bookings for this physical equipment unit
  const relevantBookings = existingBookings.filter(
    (b) =>
      b &&
      b.resourceId === resource.id &&
      b.status !== 'cancelled' &&
      b.id !== excludeBookingId &&
      !isBookingElapsed(b, nowMs)
  );

  const collidingBookings: Booking[] = [];
  const lockedOngoingBookings: Booking[] = [];
  let primaryConflictReason: string | undefined;

  for (const b of relevantBookings) {
    const existStart = new Date(b.startTime).getTime();
    const existEnd = new Date(b.endTime).getTime();
    const requiredBufferMs = (transit.totalBufferMinutes || 30) * 60 * 1000;
    const isLocked = isBookingLockedOngoing(b, nowMs, ONGOING_LOCK_BUFFER_MINUTES);

    // Mathematical overlap condition: max(S1, S2) < min(E1, E2)
    const hasOverlap = Math.max(reqStart, existStart) < Math.min(reqEnd, existEnd);
    if (hasOverlap) {
      collidingBookings.push(b);
      if (isLocked) {
        lockedOngoingBookings.push(b);
        if (!primaryConflictReason) {
          primaryConflictReason = `Ongoing / 30m Buffer Locked: ${b.plotName} (${b.farmerName}) is currently active or within its 30-min mobilization buffer and cannot be disturbed. Your shift will schedule after it.`;
        }
      } else if (!primaryConflictReason) {
        primaryConflictReason = `Time overlap: Machine is scheduled for ${b.plotName} (${b.farmerName}) during this period.`;
      }
      continue;
    }

    // 4. Turnaround & transit buffer between consecutive farm deployments
    if (existEnd <= reqStart && reqStart - existEnd < requiredBufferMs) {
      const gapMin = Math.round((reqStart - existEnd) / (60 * 1000));
      collidingBookings.push(b);
      if (isLocked) {
        lockedOngoingBookings.push(b);
      }
      if (!primaryConflictReason) {
        primaryConflictReason = `Transit turnaround: Only ${gapMin} min buffer available before this shift (needs +${transit.totalBufferMinutes} min).`;
      }
      continue;
    }

    if (reqEnd <= existStart && existStart - reqEnd < requiredBufferMs) {
      const gapMin = Math.round((existStart - reqEnd) / (60 * 1000));
      collidingBookings.push(b);
      if (isLocked) {
        lockedOngoingBookings.push(b);
      }
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
      hasLockedOngoingCollision: lockedOngoingBookings.length > 0,
      lockedOngoingBookings,
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
    hasLockedOngoingCollision: false,
    lockedOngoingBookings: [],
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
  defaultBufferMinutes = 30,
  anchorMinStartMs?: number
): Booking[] {
  if (rankedBookings.length === 0) return [];

  const sequenced: Booking[] = [];
  let previousEndMs = 0;

  // Baseline start is the earliest start among the competing pool, clamped to anchorMinStartMs if provided
  const earliestPoolStartMs = Math.min(
    ...rankedBookings.map((b) => new Date(b.startTime).getTime())
  );
  const baselineStartMs =
    anchorMinStartMs !== undefined
      ? Math.max(earliestPoolStartMs, anchorMinStartMs)
      : earliestPoolStartMs;

  for (let idx = 0; idx < rankedBookings.length; idx++) {
    const original = rankedBookings[idx];
    const booking: Booking = { ...original };
    const originalStartMs = new Date(booking.startTime).getTime();
    const originalDurationMs =
      new Date(booking.endTime).getTime() - originalStartMs || 4 * 3600 * 1000;
    const transitMs = (booking.transitBufferMinutes || defaultBufferMinutes) * 60 * 1000;

    let startMs = originalStartMs;
    if (idx === 0) {
      startMs =
        anchorMinStartMs !== undefined
          ? Math.max(originalStartMs, baselineStartMs)
          : baselineStartMs;
    } else {
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
      booking.allocatedSlotExplanation =
        anchorMinStartMs !== undefined
          ? `Allocated: 1st Priority Turn among remaining schedules (Score: ${booking.priorityScore}/100) following locked ongoing shift.`
          : `Allocated: 1st Priority Turn (Fair Turn Score: ${booking.priorityScore}/100)`;
    } else {
      const prevFarmer = sequenced[idx - 1]?.farmerName || 'Preceding Farmer';
      booking.allocatedSlotExplanation = `Allocated: Turn #${idx + 1} after ${prevFarmer} (Sequential Auto-Schedule)`;
    }

    sequenced.push(booking);
  }

  return sequenced;
}

export interface SmartScheduleResolutionResult {
  hasConflict: boolean;
  wasShiftedByLockedOngoing: boolean;
  lockedOngoingBookings: Booking[];
  sequencedBookings: Booking[];
  removedElapsedIds: string[];
  conflictRecord: ConflictRecord | null;
}

/**
 * Full Smart Scheduler enforcing:
 * 1. Elapsed bookings (endTime <= nowMs) are removed automatically.
 * 2. Ongoing & 30-Minute Buffer Locked bookings ((startTime - 30m) <= nowMs < endTime)
 *    are NEVER disturbed, moved, or compared in priority—even if the new booking has
 *    a higher priority score (e.g. 80 vs 70).
 * 3. New bookings colliding with a locked ongoing booking are pushed after
 *    (lockedBooking.endTime + transitBuffer) and compared strictly against any
 *    remaining (unlocked) future schedules on that resource.
 */
export function arbitrateAndSequenceSmartSchedule(
  candidateBooking: Booking,
  existingBookings: Booking[],
  defaultBufferMinutes: number = 30,
  nowMs: number = Date.now()
): SmartScheduleResolutionResult {
  // 1. Prune elapsed bookings
  const { activeBookings, removedElapsedIds } = filterNonElapsedBookings(
    existingBookings,
    nowMs
  );

  const resourceBookings = activeBookings.filter(
    (b) =>
      b.resourceId === candidateBooking.resourceId &&
      b.status !== 'cancelled' &&
      b.id !== candidateBooking.id
  );

  const candStartMs = new Date(candidateBooking.startTime).getTime();
  const candEndMs = new Date(candidateBooking.endTime).getTime();
  const candDurationMs = Math.max(3600 * 1000, candEndMs - candStartMs);
  const candBufferMin = candidateBooking.transitBufferMinutes || defaultBufferMinutes;

  // 2. Partition resource bookings into LOCKED (Ongoing / within 30m buffer) vs UNLOCKED (Remaining future)
  const lockedBookings: Booking[] = [];
  const unlockedBookings: Booking[] = [];

  for (const b of resourceBookings) {
    if (isBookingLockedOngoing(b, nowMs, ONGOING_LOCK_BUFFER_MINUTES)) {
      lockedBookings.push(b);
    } else {
      unlockedBookings.push(b);
    }
  }

  lockedBookings.sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  unlockedBookings.sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  // 3. Check if candidate collides with any locked ongoing booking
  const collidingLocked: Booking[] = [];
  for (const lb of lockedBookings) {
    const lbStart = new Date(lb.startTime).getTime();
    const lbEnd = new Date(lb.endTime).getTime();
    const bufMs = Math.max(candBufferMin, lb.transitBufferMinutes || defaultBufferMinutes) * 60 * 1000;
    if (intervalsCollideWithBuffer(candStartMs, candEndMs, lbStart, lbEnd, bufMs)) {
      collidingLocked.push(lb);
    }
  }

  let anchorStartMs: number | undefined;
  if (collidingLocked.length > 0) {
    anchorStartMs = Math.max(
      ...collidingLocked.map((lb) => {
        const lbEnd = new Date(lb.endTime).getTime();
        const bufMs = Math.max(candBufferMin, lb.transitBufferMinutes || defaultBufferMinutes) * 60 * 1000;
        return lbEnd + bufMs;
      })
    );
  }

  const tentativeCandStartMs =
    anchorStartMs !== undefined ? Math.max(candStartMs, anchorStartMs) : candStartMs;
  const tentativeCandEndMs = tentativeCandStartMs + candDurationMs;

  // 4. Collect all UNLOCKED (remaining future) bookings that collide with candidate or the cascaded window
  const competingUnlocked: Booking[] = [];
  const competingIds = new Set<string>();
  let clusterStartMs = tentativeCandStartMs;
  let clusterEndMs = tentativeCandEndMs;

  let changed = true;
  while (changed) {
    changed = false;
    for (const ub of unlockedBookings) {
      if (!ub.id || competingIds.has(ub.id)) continue;
      const ubStart = new Date(ub.startTime).getTime();
      const ubEnd = new Date(ub.endTime).getTime();
      const ubDur = ubEnd - ubStart;
      const bufMs = Math.max(candBufferMin, ub.transitBufferMinutes || defaultBufferMinutes) * 60 * 1000;

      const collidesShifted = intervalsCollideWithBuffer(
        clusterStartMs,
        clusterEndMs,
        ubStart,
        ubEnd,
        bufMs
      );
      const collidesOriginal = intervalsCollideWithBuffer(
        candStartMs,
        candEndMs,
        ubStart,
        ubEnd,
        bufMs
      );

      if (collidesShifted || collidesOriginal) {
        competingUnlocked.push(ub);
        competingIds.add(ub.id);
        clusterStartMs = Math.min(clusterStartMs, ubStart);
        if (anchorStartMs !== undefined) {
          clusterStartMs = Math.max(clusterStartMs, anchorStartMs);
        }
        clusterEndMs = Math.max(clusterEndMs, ubEnd) + ubDur + bufMs;
        changed = true;
      }
    }
  }

  // Case A: No collision at all
  if (collidingLocked.length === 0 && competingUnlocked.length === 0) {
    const confirmed: Booking = {
      ...candidateBooking,
      status: 'confirmed',
    };
    return {
      hasConflict: false,
      wasShiftedByLockedOngoing: false,
      lockedOngoingBookings: [],
      sequencedBookings: [confirmed],
      removedElapsedIds,
      conflictRecord: null,
    };
  }

  // Case B: Collided ONLY with a Locked Ongoing booking (no remaining schedules in the way)
  if (collidingLocked.length > 0 && competingUnlocked.length === 0) {
    const lockedNames = collidingLocked.map((b) => b.farmerName).join(', ');
    const shifted: Booking = {
      ...candidateBooking,
      startTime: new Date(tentativeCandStartMs).toISOString(),
      endTime: new Date(tentativeCandEndMs).toISOString(),
      status: 'confirmed',
      allocatedSlotExplanation: `Ongoing schedule (${lockedNames}) is locked (active / within 30-min buffer). Your booking is scheduled for the next immediate slot with +${Math.round(
        candBufferMin
      )}m turnaround buffer.`,
    };
    return {
      hasConflict: false,
      wasShiftedByLockedOngoing: true,
      lockedOngoingBookings: collidingLocked,
      sequencedBookings: [shifted],
      removedElapsedIds,
      conflictRecord: null,
    };
  }

  // Case C: Competes with one or more REMAINING (unlocked) future schedules!
  const competingMap = new Map<string, Booking>();
  competingMap.set(candidateBooking.id, { ...candidateBooking });
  for (const ub of competingUnlocked) {
    if (ub && ub.id && !competingMap.has(ub.id)) {
      competingMap.set(ub.id, { ...ub });
    }
  }

  const ranked = rankCollidingBookings(Array.from(competingMap.values()));
  const sequencedList = sequenceCollidingBookings(
    ranked,
    candBufferMin,
    anchorStartMs
  );

  const winner = sequencedList[0];
  const runnerUp = sequencedList[1] || sequencedList[0];

  const primaryFactor =
    (winner.scoreBreakdown?.weatherRiskPts || 0) > (runnerUp.scoreBreakdown?.weatherRiskPts || 0)
      ? 'Imminent Rainfall & Weather Threat'
      : (winner.scoreBreakdown?.urgencyJustificationPts || 0) >= 5
      ? 'Emergency Urgency Justification & Spoilage Prevention'
      : 'Biological Crop Vulnerability & Shatter Risk';

  const lockedNotice =
    collidingLocked.length > 0
      ? ' Ongoing/buffer-locked shift was preserved untouched; priority arbitration evaluated only remaining schedules.'
      : '';

  const conflictRecord: ConflictRecord = {
    id: `conflict-${Date.now().toString(36)}`,
    resourceId: candidateBooking.resourceId,
    resourceName: candidateBooking.resourceName,
    bookingA: winner,
    bookingB: runnerUp,
    winningBookingId: winner.id,
    losingBookingId: runnerUp.id,
    justificationEn: `Fair Turn Priority Decision: ${winner.farmerName} (${winner.priorityScore}/100) received 1st Priority Turn over ${runnerUp.farmerName} (${runnerUp.priorityScore}/100). ${
      winner.urgencyJustification ? `Winner justification: "${winner.urgencyJustification}". ` : ''
    }Subsequent requests automatically scheduled to consecutive non-overlapping slots. Deciding factors: ${primaryFactor} (+${(
      winner.priorityScore - runnerUp.priorityScore
    ).toFixed(1)} pts advantage).${lockedNotice}`,
    contingencyAction: `Sequential scheduling active: ${runnerUp.farmerName} has been automatically allocated the next available consecutive slot without time collision.`,
    primaryDecidingFactor: primaryFactor,
    resolvedAt: new Date(nowMs).toISOString(),
    rankedBookings: sequencedList,
  };

  return {
    hasConflict: true,
    wasShiftedByLockedOngoing: collidingLocked.length > 0,
    lockedOngoingBookings: collidingLocked,
    sequencedBookings: sequencedList,
    removedElapsedIds,
    conflictRecord,
  };
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
