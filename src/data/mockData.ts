import { ConflictRecord } from '../types';
import {
  DEFAULT_FARMER_PROFILE,
  DEFAULT_INDIAN_PLOTS,
  DEFAULT_INDIAN_RESOURCES,
  appStorage,
} from '../lib/storage';

export const CURRENT_USER_FARMER = DEFAULT_FARMER_PROFILE;
export const INITIAL_PLOTS = DEFAULT_INDIAN_PLOTS;
export const INITIAL_RESOURCES = DEFAULT_INDIAN_RESOURCES;
export const INITIAL_BOOKINGS = appStorage.getBookings();

// Fair Arbitration Example in Simple Indian Terms:
// e.g. Rain alert over Harvest-Ready Basmati rice takes priority over routine field trolley hauling.
export const INITIAL_CONFLICT_SCENARIO: ConflictRecord = {
  id: 'conflict-case-01',
  resourceId: 'res-preet-harvester',
  resourceName: 'Preet 987 Combined Harvester',
  bookingA: {
    id: 'req-karnal-rajesh',
    resourceId: 'res-preet-harvester',
    resourceName: 'Preet 987 Combined Harvester',
    farmerId: 'farmer-kisan-01',
    farmerName: 'Rajesh Kumar Patel',
    plotId: 'plot-karnal-paddy',
    plotName: 'Subhash Farm - Basmati Paddy (8 Acres)',
    plotLat: 29.6857,
    plotLng: 76.9905,
    cropStage: 'Harvest-Ready',
    intent: 'harvesting',
    startTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    endTime: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    priorityScore: 94.0,
    scoreBreakdown: {
      urgencyDeadlinePts: 24.0,
      weatherRiskPts: 25.0,
      cropVulnerabilityPts: 20.0,
      antiStarvationPts: 10.0,
      logisticsProximityPts: 10.0,
      intentConditionPts: 5.0,
      totalPriorityScore: 94.0,
    },
    status: 'confirmed',
    transitBufferMinutes: 25.0,
    distanceKm: 4.8,
    notes: 'Heavy 18mm rain forecast in 24 hrs. Urgent harvesting needed before waterlogging.',
    totalCostRupees: 6600,
  },
  bookingB: {
    id: 'req-routine-haul',
    resourceId: 'res-preet-harvester',
    resourceName: 'Preet 987 Combined Harvester',
    farmerId: 'farmer-kisan-06',
    farmerName: 'Rameshwar Dayal',
    plotId: 'plot-meerut-sugarcane',
    plotName: 'Ganga Canal Sugarcane',
    plotLat: 28.9845,
    plotLng: 77.7064,
    cropStage: 'Vegetative',
    intent: 'towing',
    startTime: new Date(Date.now() + 2.5 * 3600 * 1000).toISOString(),
    endTime: new Date(Date.now() + 6.5 * 3600 * 1000).toISOString(),
    priorityScore: 32.0,
    scoreBreakdown: {
      urgencyDeadlinePts: 8.0,
      weatherRiskPts: 4.0,
      cropVulnerabilityPts: 8.0,
      antiStarvationPts: 5.0,
      logisticsProximityPts: 4.0,
      intentConditionPts: 3.0,
      totalPriorityScore: 32.0,
    },
    status: 'in_conflict',
    transitBufferMinutes: 45.0,
    distanceKm: 18.0,
    notes: 'Routine equipment transfer between farm sheds.',
    totalCostRupees: 6600,
  },
  winningBookingId: 'req-karnal-rajesh',
  losingBookingId: 'req-routine-haul',
  justificationEn:
    'Awarded to Rajesh Kumar Patel (94 pts) over Rameshwar Dayal (32 pts). Rajesh faces catastrophic grain drop and waterlogging damage if the 8-acre ripe Basmati paddy is not harvested before the incoming 18mm rain. Routine equipment transport can safely be done after the storm window.',
  contingencyAction:
    'Rameshwar Dayal is offered a Mahindra 575 tractor trolley nearby (3 km away) at ₹480/hr, or can reschedule towing for tomorrow morning.',
  primaryDecidingFactor: 'Crop Protection & Incoming Rain Urgency',
  resolvedAt: new Date().toISOString(),
};
