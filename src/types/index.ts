export type UserRole = 'borrower' | 'lender' | 'prosumer' | 'admin';

export interface Profile {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  village?: string;
  state?: string;
  trustScore: number;
  roleFlags: UserRole[];
  roles?: string[];
  permissions?: string[];
  avatarUrl?: string;
  password?: string;
  passwordPin?: string;
  passwordHash?: string;
  password_hash?: string;
  authProvider?: 'local' | 'google';
}

export type CropStage = 'Vegetative' | 'Flowering' | 'Ripening' | 'Harvest-Ready' | 'Post-Harvest';

export type ResourceCategory =
  | 'machinery'
  | 'irrigation'
  | 'storage'
  | 'transportation'
  | 'labour'
  | 'services';

export type OperationalStatus = 'available' | 'maintenance' | 'in_use';

export interface WeatherCondition {
  rainfallMm: number;
  rainProbabilityPercent: number;
  severeAlert: boolean;
  description: string;
}

export interface Plot {
  id: string;
  farmerId: string;
  farmerName: string;
  plotName: string;
  village?: string;
  state?: string;
  acres: number;
  acreUnit?: 'acre' | 'bigha';
  cropType: string;
  cropStage: CropStage;
  latitude: number;
  longitude: number;
  weather?: WeatherCondition;
}

export interface Resource {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerPhone?: string;
  category: ResourceCategory;
  name: string;
  specs: string;
  hourlyRate: number; // in Indian Rupees (₹)
  rateUnit?: 'per_hour' | 'per_day' | 'per_acre';
  conditionRating: number; // 1.0 to 5.0
  operationalStatus: OperationalStatus;
  village?: string;
  state?: string;
  baseLat: number;
  baseLng: number;
  maxRadiusKm: number; // default 50
  imageUrl?: string;
  operatingHours?: string;
  attachmentTypes?: string[];
  capacityOrWorkers?: string; // e.g. "8 Workers", "45 HP", "1000 Quintal"
}

export type IntentType =
  | 'harvesting'
  | 'tillage'
  | 'spraying'
  | 'irrigation'
  | 'towing'
  | 'storage_haul'
  | 'seeding'
  | 'labour_weeding';

export type BookingStatus = 'pending' | 'confirmed' | 'rerouted' | 'cancelled' | 'in_conflict';

export interface UrgencyEvaluationResult {
  urgencyScoreBonus: number; // 0 to 10 points
  urgencyRating: number;     // 1 to 10
  threatLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  detectedThreats: string[];
  cropLossRisk: string;
  aiAnalysisSummary: string;
}

export interface ScoreBreakdown {
  urgencyDeadlinePts: number;       // max 25 (includes time window + urgency justification)
  urgencyJustificationPts?: number; // 0 to 10 pts contributed by urgency justification text
  weatherRiskPts: number;           // max 25
  cropVulnerabilityPts: number;     // max 20
  antiStarvationPts: number;        // max 15
  logisticsProximityPts: number;    // max 10
  intentConditionPts: number;       // max 5
  totalPriorityScore: number;       // 0 to 100
  details?: Record<string, any>;
}

export interface Booking {
  id: string;
  resourceId: string;
  resourceName: string;
  farmerId: string;
  farmerName: string;
  plotId: string;
  plotName: string;
  plotLat: number;
  plotLng: number;
  cropStage: CropStage;
  intent: IntentType;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  priorityScore: number;
  scoreBreakdown: ScoreBreakdown;
  status: BookingStatus;
  transitBufferMinutes: number;
  distanceKm: number;
  notes?: string;
  urgencyJustification?: string;
  urgencyEvaluation?: UrgencyEvaluationResult;
  earliestStart?: string;
  latestEnd?: string;
  totalCostRupees?: number;
  isOfflineCached?: boolean;
  offlineQueuedAt?: string;
  allocatedSlotExplanation?: string;
}

export interface ConflictRecord {
  id: string;
  resourceId: string;
  resourceName: string;
  bookingA: Booking;
  bookingB: Booking;
  winningBookingId: string;
  losingBookingId: string;
  justificationEn: string;
  contingencyAction: string;
  primaryDecidingFactor: string;
  resolvedAt: string;
  rankedBookings?: Booking[];
}

export interface DisruptionEvent {
  id: string;
  type: 'EQUIPMENT_BREAKDOWN' | 'SUDDEN_RAIN_ALERT';
  resourceId: string;
  resourceName: string;
  timestamp: string;
  invalidatedBookingIds: string[];
  humanReadableRationale: string;
  remediationSteps: string[];
}

