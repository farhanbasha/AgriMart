import React, { useState, useMemo, useEffect } from 'react';
import { Plot, Resource, IntentType, CropStage, Booking, Profile, UrgencyEvaluationResult } from '../types';
import {
  calculateHaversineDistance,
  calculateTransitBuffer,
  computeDeterministicPriorityScore,
  checkFeasibleTimeSlot,
  FeasibilityCheckResult,
} from '../lib/engine';
import { getLiveWeatherForCoordinates } from '../lib/weather';
import { getDeviceLocation, subscribeDeviceLocation, DeviceLocationState } from '../lib/deviceLocation';
import {
  evaluateUrgencyHeuristic,
  evaluateUrgencyJustificationWithGemini,
  isGeminiConfigured,
} from '../lib/gemini';
import {
  Clock,
  MapPin,
  ArrowRight,
  Sprout,
  Tractor,
  Droplets,
  Truck,
  WifiOff,
  IndianRupee,
  Activity,
  ShieldAlert,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Compass,
  Sparkles,
  Loader2,
  Flame,
} from 'lucide-react';

interface FarmerActionPanelProps {
  plots: Plot[];
  resources: Resource[];
  bookings?: Booking[];
  selectedPlotId: string;
  onSelectPlot: (plotId: string) => void;
  selectedResourceId?: string;
  onSelectResource?: (resourceId: string) => void;
  isOnline?: boolean;
  onOpenAddPlot?: () => void;
  onOpenAddResource?: () => void;
  currentUser?: Profile | null;
  onSubmitBooking: (bookingData: {
    plotId: string;
    resourceId: string;
    intent: IntentType;
    cropStage: CropStage;
    durationHours: number;
    hoursUntilStart: number;
    earliestStart?: string;
    latestEnd?: string;
    urgencyJustification?: string;
    urgencyEvaluation?: UrgencyEvaluationResult;
    notes: string;
  }) => void;
}

export const FarmerActionPanel: React.FC<FarmerActionPanelProps> = ({
  plots,
  resources,
  bookings = [],
  selectedPlotId,
  onSelectPlot,
  selectedResourceId,
  onSelectResource,
  isOnline = true,
  onOpenAddPlot,
  onOpenAddResource,
  currentUser,
  onSubmitBooking,
}) => {
  // STRICT OWNERSHIP FILTER:
  // Farmer can only book machinery for their own registered land plots.
  const userPlots = useMemo(() => {
    if (currentUser) {
      return plots.filter((p) => p.farmerId === currentUser.id);
    }
    return plots;
  }, [plots, currentUser]);

  const [internalResourceId, setInternalResourceId] = useState(resources[0]?.id || '');
  const activeResourceId = selectedResourceId !== undefined ? selectedResourceId : internalResourceId;

  const handleResourceChange = (newId: string) => {
    if (onSelectResource) {
      onSelectResource(newId);
    } else {
      setInternalResourceId(newId);
    }
  };

  const [intent, setIntent] = useState<IntentType>('harvesting');
  const [durationHours, setDurationHours] = useState(4);
  const [hoursUntilStart, setHoursUntilStart] = useState(3);
  const [severeWeatherAlert, setSevereWeatherAlert] = useState(false);
  const [imminentRainfallMm, setImminentRainfallMm] = useState(0.0);
  const [urgencyJustification, setUrgencyJustification] = useState('');
  const [customCropStage, setCustomCropStage] = useState<CropStage | null>(null);
  const [notes, setNotes] = useState('');
  const [deviceLoc, setDeviceLoc] = useState<DeviceLocationState>(() => getDeviceLocation());

  // Real-time Urgency Evaluation State (NLP Heuristic + Gemini AI)
  const [urgencyEvaluation, setUrgencyEvaluation] = useState<UrgencyEvaluationResult>(() =>
    evaluateUrgencyHeuristic('', 'Ripening', 0)
  );
  const [isEvaluatingUrgency, setIsEvaluatingUrgency] = useState(false);

  useEffect(() => {
    const unsub = subscribeDeviceLocation((loc) => setDeviceLoc(loc));
    return unsub;
  }, []);

  // Selected Plot & Resource objects (strictly from user's plots)
  const activePlot = useMemo(() => {
    return userPlots.find((p) => p.id === selectedPlotId) || userPlots[0] || null;
  }, [userPlots, selectedPlotId]);

  const activeResource = useMemo(
    () => resources.find((r) => r.id === activeResourceId) || resources[0] || null,
    [resources, activeResourceId]
  );

  const effectiveCropStage: CropStage = customCropStage || activePlot?.cropStage || 'Ripening';

  // Compute calculated start and end times
  const startTimeIso = useMemo(() => {
    const d = new Date();
    d.setTime(d.getTime() + hoursUntilStart * 3600 * 1000);
    return d.toISOString();
  }, [hoursUntilStart]);

  const endTimeIso = useMemo(() => {
    const d = new Date(startTimeIso);
    d.setTime(d.getTime() + durationHours * 3600 * 1000);
    return d.toISOString();
  }, [startTimeIso, durationHours]);

  // Fetch real satellite/station weather for active plot GPS coordinates
  useEffect(() => {
    if (!activePlot) return;
    let isCancelled = false;
    getLiveWeatherForCoordinates(activePlot.latitude, activePlot.longitude).then((data) => {
      if (!isCancelled) {
        setImminentRainfallMm(data.rainfallMm);
        setSevereWeatherAlert(data.severeAlert);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [activePlot]);

  // Real-time NLP & Gemini evaluation of farmer urgency justification
  useEffect(() => {
    // Instant zero-latency heuristic evaluation
    const instant = evaluateUrgencyHeuristic(
      urgencyJustification,
      effectiveCropStage,
      imminentRainfallMm
    );
    setUrgencyEvaluation(instant);

    if (!isGeminiConfigured() || !urgencyJustification.trim()) {
      setIsEvaluatingUrgency(false);
      return;
    }

    setIsEvaluatingUrgency(true);
    const debounceTimer = setTimeout(() => {
      evaluateUrgencyJustificationWithGemini(
        urgencyJustification,
        effectiveCropStage,
        imminentRainfallMm
      )
        .then((aiRes) => {
          setUrgencyEvaluation(aiRes);
        })
        .catch((err) => {
          console.warn('[FarmerActionPanel] Urgency AI notice:', err);
        })
        .finally(() => {
          setIsEvaluatingUrgency(false);
        });
    }, 600);

    return () => clearTimeout(debounceTimer);
  }, [urgencyJustification, effectiveCropStage, imminentRainfallMm]);

  // Spatial Distance & Turnaround Transit Buffer
  const distanceKm = useMemo(() => {
    if (!activePlot || !activeResource) return 0;
    return calculateHaversineDistance(
      activeResource.baseLat,
      activeResource.baseLng,
      activePlot.latitude,
      activePlot.longitude
    );
  }, [activePlot, activeResource]);

  const transitBuffer = useMemo(() => {
    return calculateTransitBuffer(distanceKm);
  }, [distanceKm]);

  // Mathematical Time-Slot Conflict & Feasibility Check
  const feasibility: FeasibilityCheckResult = useMemo(() => {
    if (!activeResource || !activePlot) {
      return {
        feasible: false,
        isHardBlocker: true,
        hasTimeCollision: false,
        conflictReason: 'Select your land plot and machine first.',
        distanceKm: 0,
        bufferMinutes: 30,
      };
    }
    return checkFeasibleTimeSlot(activeResource, activePlot, startTimeIso, endTimeIso, bookings);
  }, [activeResource, activePlot, startTimeIso, endTimeIso, bookings]);

  // Deterministic 0-100 Priority Scoring incorporating Urgency Justification
  const scoreBreakdown = useMemo(() => {
    return computeDeterministicPriorityScore({
      hoursUntilStart,
      imminentRainfallMm,
      severeWeatherAlert,
      cropStage: effectiveCropStage,
      queueWaitHours: 2.5,
      distanceKm,
      intent,
      resourceConditionRating: activeResource?.conditionRating || 4.8,
      urgencyJustificationBonus: urgencyEvaluation.urgencyScoreBonus,
      urgencyEvaluation,
    });
  }, [
    hoursUntilStart,
    imminentRainfallMm,
    severeWeatherAlert,
    effectiveCropStage,
    distanceKm,
    intent,
    activeResource,
    urgencyEvaluation,
  ]);

  // Estimated Cost Calculation in Indian Rupees
  const estimatedCostRupees = useMemo(() => {
    if (!activeResource) return 0;
    if (activeResource.rateUnit === 'per_day') {
      const days = Math.max(1, Math.round(durationHours / 8));
      return activeResource.hourlyRate * days;
    }
    if (activeResource.rateUnit === 'per_acre') {
      const acres = activePlot?.acres || 4;
      return activeResource.hourlyRate * acres;
    }
    return activeResource.hourlyRate * durationHours;
  }, [activeResource, durationHours, activePlot]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlot) {
      alert('Please register at least one farm plot under your account before requesting equipment.');
      return;
    }
    if (!activeResource) {
      alert('Please select or list an equipment unit before requesting allocation.');
      return;
    }
    // Hard blockers (out of range >50km, machine under maintenance, invalid time) strictly block booking
    if (feasibility.isHardBlocker) {
      alert(`Operational Constraint: ${feasibility.conflictReason}`);
      return;
    }

    onSubmitBooking({
      plotId: activePlot.id,
      resourceId: activeResource.id,
      intent,
      cropStage: effectiveCropStage,
      durationHours,
      hoursUntilStart,
      earliestStart: startTimeIso,
      latestEnd: endTimeIso,
      urgencyJustification: urgencyJustification.trim(),
      urgencyEvaluation,
    });
  };

  return (
    <div className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-7 shadow-xs">
      {/* Top Header & Priority Preview */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-5 border-b border-neutral-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
              Fair Machine & Labour Request
            </h2>
            {!isOnline && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
                <WifiOff className="w-3 h-3" />
                Offline Mode
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Transparent deterministic turn allocation calculated by crop urgency and weather risk.
          </p>
        </div>

        {/* Real-time Priority Preview Badge */}
        {activePlot && activeResource && (
          <div className="flex items-center gap-3 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl px-4 py-2 text-xs">
            <Activity className="w-4 h-4 text-emerald-700" />
            <div>
              <div className="text-[10px] uppercase font-bold text-emerald-800">Priority Score</div>
              <div className="text-sm sm:text-base font-extrabold text-emerald-950 font-mono">
                {scoreBreakdown.totalPriorityScore} <span className="text-xs font-normal text-emerald-700">/ 100</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty Plots Notification for Current User */}
      {userPlots.length === 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="font-bold text-xs sm:text-sm">
              {currentUser ? `No Farm Plots Registered for ${currentUser.fullName}` : 'No Farm Plots Registered'}
            </div>
            <div className="text-xs text-amber-800">
              Register your own land plot to calculate weather risk, soil compaction, and machine transit.
            </div>
          </div>
          {onOpenAddPlot && (
            <button
              type="button"
              onClick={onOpenAddPlot}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Your Farm Plot</span>
            </button>
          )}
        </div>
      )}

      {/* Empty Resources Notification */}
      {resources.length === 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="font-bold text-xs sm:text-sm">No Equipment in Community Registry</div>
            <div className="text-xs text-neutral-600">
              List community tractors, harvesters, or labour crews to enable sharing in your area.
            </div>
          </div>
          {onOpenAddResource && (
            <button
              type="button"
              onClick={onOpenAddResource}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>List Equipment</span>
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-5 sm:space-y-6">
        {/* Step 1: Select Farm Plot (strictly user's owned plots) */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap justify-between items-center gap-1">
            <label htmlFor="land-plot-select" className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-neutral-900 text-white text-[11px] font-bold flex items-center justify-center font-mono">
                1
              </span>
              <span>Your Registered Land Plot</span>
            </label>
            {activePlot && (
              <span className="text-xs text-emerald-800 font-semibold font-mono">
                GPS: {activePlot.latitude.toFixed(4)}°N, {activePlot.longitude.toFixed(4)}°E ({activePlot.acres} {activePlot.acreUnit || 'Acres'})
              </span>
            )}
          </div>

          <div className="relative">
            <select
              id="land-plot-select"
              value={activePlot?.id || ''}
              onChange={(e) => onSelectPlot(e.target.value)}
              className="w-full appearance-none bg-neutral-50 hover:bg-neutral-100/70 border border-neutral-300 rounded-2xl px-4 py-3 text-xs sm:text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors cursor-pointer"
            >
              {userPlots.length === 0 ? (
                <option value="">No plots registered under your account - add your plot first</option>
              ) : (
                userPlots.map((plot) => (
                  <option key={plot.id} value={plot.id}>
                    {plot.plotName} - {plot.acres} Acres ({plot.cropType} | {plot.cropStage} | {plot.village || 'Karnal'})
                  </option>
                ))
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-emerald-700">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Step 2: Select Equipment or Labour */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="target-machinery-select" className="block text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-neutral-900 text-white text-[11px] font-bold flex items-center justify-center font-mono">
                2
              </span>
              <span>Select Equipment or Community Labour</span>
            </label>
            {activeResource && (
              <span className="text-[11px] font-mono text-neutral-500">
                Owner: <strong>{activeResource.ownerName}</strong> | Max Radius: {activeResource.maxRadiusKm || 50} km
              </span>
            )}
          </div>
          <div className="relative">
            <select
              id="target-machinery-select"
              value={activeResourceId}
              onChange={(e) => handleResourceChange(e.target.value)}
              className="w-full appearance-none bg-neutral-50 hover:bg-neutral-100/70 border border-neutral-300 rounded-2xl px-4 py-3 text-xs sm:text-sm text-neutral-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {resources.length === 0 ? (
                <option value="">No equipment listed yet</option>
              ) : (
                resources.map((r) => {
                  const rateSuffix =
                    r.rateUnit === 'per_day' ? '/day' : r.rateUnit === 'per_acre' ? '/acre' : '/hr';
                  const isMine = currentUser && r.ownerId === currentUser.id;
                  return (
                    <option key={r.id} value={r.id}>
                      {r.name} {isMine ? '(Your Machine)' : `(${r.ownerName})`} - ₹{r.hourlyRate}{rateSuffix} ({r.village || 'Local'} | {r.operationalStatus})
                    </option>
                  );
                })
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-emerald-700">
              <Tractor className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Step 3: Crop Stage & Purpose */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="crop-stage-select" className="block text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-neutral-900 text-white text-[11px] font-bold flex items-center justify-center font-mono">
                3
              </span>
              <span>Biological Crop Stage</span>
            </label>
            <select
              id="crop-stage-select"
              value={effectiveCropStage}
              onChange={(e) => setCustomCropStage(e.target.value as CropStage)}
              className="w-full bg-neutral-50 border border-neutral-300 rounded-2xl px-3.5 py-3 text-xs sm:text-sm text-neutral-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="Harvest-Ready">Harvest-Ready (Critical Window: 20 pts)</option>
              <option value="Ripening">Ripening (High Vulnerability: 16 pts)</option>
              <option value="Flowering">Flowering (Medium Sensitivity: 12 pts)</option>
              <option value="Vegetative">Vegetative (Normal Growth: 7 pts)</option>
              <option value="Post-Harvest">Post-Harvest (Field Prep: 3 pts)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wider">
              Operation Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'harvesting', label: 'Harvesting', icon: Sprout },
                { id: 'tillage', label: 'Tillage', icon: Tractor },
                { id: 'spraying', label: 'Spraying', icon: Droplets },
                { id: 'towing', label: 'Haulage', icon: Truck },
              ].map((item) => {
                const IconComp = item.icon;
                const isSelected = intent === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIntent(item.id as IntentType)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-950 shadow-2xs'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step 4: Required Time Window */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-neutral-900 text-white text-[11px] font-bold flex items-center justify-center font-mono">
              4
            </span>
            <span>Required Time Window & Duration</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <span className="text-[11px] text-neutral-500 font-bold uppercase">Earliest Start Window</span>
              <select
                value={hoursUntilStart}
                onChange={(e) => setHoursUntilStart(Number(e.target.value))}
                className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2.5 text-xs text-neutral-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value={1}>Within 1 Hour (Urgent)</option>
                <option value={3}>In 3 Hours (Afternoon)</option>
                <option value={6}>In 6 Hours (Evening)</option>
                <option value={12}>Tomorrow Morning (06:00 AM)</option>
                <option value={24}>Tomorrow Afternoon (24h buffer)</option>
              </select>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-neutral-500 font-bold uppercase">Work Duration</span>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2.5 text-xs text-neutral-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value={2}>2 Hours (Quick shift)</option>
                <option value={4}>4 Hours (Half day)</option>
                <option value={6}>6 Hours (Standard field)</option>
                <option value={8}>8 Hours (Full day)</option>
                <option value={12}>12 Hours (Double shift)</option>
              </select>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-neutral-500 font-bold uppercase">Calculated Latest End</span>
              <div className="bg-neutral-100 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs text-neutral-800 font-mono font-semibold truncate">
                {new Date(endTimeIso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ({durationHours}h shift)
              </div>
            </div>
          </div>
        </div>

        {/* Step 5: Urgency Justification */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="urgency-input" className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-neutral-900 text-white text-[11px] font-bold flex items-center justify-center font-mono">
                5
              </span>
              <span>Urgency Justification (Fair Turn Priority Factor)</span>
            </label>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              {isEvaluatingUrgency ? (
                <span className="flex items-center gap-1 text-amber-700">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Gemini AI Analyzing...</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-700">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>AI Fair Turn Evaluated</span>
                </span>
              )}
            </div>
          </div>

          <input
            id="urgency-input"
            type="text"
            value={urgencyJustification}
            onChange={(e) => setUrgencyJustification(e.target.value)}
            placeholder="Why is this machine urgently required? e.g. Imminent rainstorm, overripe grain loss, labour shortage"
            className="w-full bg-neutral-50 border border-neutral-300 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />

          {/* Real-time AI Urgency Analysis Card */}
          <div className={`p-3 sm:p-3.5 rounded-2xl border text-xs transition-all ${
            urgencyEvaluation.threatLevel === 'CRITICAL'
              ? 'bg-rose-50/80 border-rose-200 text-rose-950'
              : urgencyEvaluation.threatLevel === 'HIGH'
              ? 'bg-amber-50/80 border-amber-200 text-amber-950'
              : urgencyEvaluation.threatLevel === 'MODERATE'
              ? 'bg-sky-50/80 border-sky-200 text-sky-950'
              : 'bg-neutral-50 border-neutral-200 text-neutral-800'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-black/5">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider font-mono ${
                  urgencyEvaluation.threatLevel === 'CRITICAL'
                    ? 'bg-rose-600 text-white'
                    : urgencyEvaluation.threatLevel === 'HIGH'
                    ? 'bg-amber-600 text-white'
                    : urgencyEvaluation.threatLevel === 'MODERATE'
                    ? 'bg-sky-600 text-white'
                    : 'bg-neutral-600 text-white'
                }`}>
                  {urgencyEvaluation.threatLevel} THREAT
                </span>
                <span className="font-bold text-neutral-900">
                  Rating: {urgencyEvaluation.urgencyRating}/10
                </span>
              </div>

              <div className="flex items-center gap-1 font-mono text-xs font-black">
                <span>Urgency Priority Impact:</span>
                <span className={`px-2 py-0.5 rounded-lg ${
                  urgencyEvaluation.urgencyScoreBonus > 0
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-neutral-200 text-neutral-700'
                }`}>
                  +{urgencyEvaluation.urgencyScoreBonus} pts
                </span>
              </div>
            </div>

            <div className="pt-2 space-y-1.5">
              {urgencyEvaluation.detectedThreats.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-neutral-500">Detected Signals:</span>
                  {urgencyEvaluation.detectedThreats.map((threat, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-white border border-neutral-200 text-[11px] font-semibold text-neutral-800 shadow-2xs"
                    >
                      {threat}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-[11px] leading-relaxed text-neutral-700">
                <strong className="font-bold text-neutral-900">AI Assessment:</strong> {urgencyEvaluation.aiAnalysisSummary}
              </p>

              {urgencyEvaluation.cropLossRisk && (
                <p className="text-[10px] text-neutral-500 italic">
                  Biological Loss Risk: {urgencyEvaluation.cropLossRisk}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Real-time Feasibility & Conflict Detection Alert */}
        <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs ${
          feasibility.isHardBlocker
            ? 'bg-rose-50 border-rose-200 text-rose-950'
            : feasibility.hasTimeCollision
            ? 'bg-amber-50 border-amber-300 text-amber-950'
            : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
        }`}>
          {feasibility.isHardBlocker ? (
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          ) : feasibility.hasTimeCollision ? (
            <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="space-y-1 flex-1">
            <div className="font-extrabold text-sm">
              {feasibility.isHardBlocker
                ? 'Operational Restriction (Unfeasible)'
                : feasibility.hasTimeCollision
                ? '⚡ Competing Request Detected: Fair Turn Arbitration Available'
                : 'Time Slot Feasible: Zero Machine Collisions'}
            </div>
            <p className="leading-relaxed">
              {feasibility.isHardBlocker
                ? feasibility.conflictReason
                : feasibility.hasTimeCollision
                ? `Machine is currently requested by ${feasibility.conflictingBooking?.farmerName || 'another farmer'} for ${feasibility.conflictingBooking?.plotName || 'their field'}. You may still submit: Fair Turn will arbitrate priority based on your Urgency Justification and Weather Risk.`
                : `Machine is free for requested window. Transit buffer +${transitBuffer.totalBufferMinutes} min confirmed (distance: ${distanceKm.toFixed(1)} km).`}
            </p>
          </div>
        </div>

        {/* Telemetry Card */}
        {activePlot && activeResource && (
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Depot Distance</div>
              <div className="font-bold text-neutral-900 font-mono text-sm mt-0.5">{distanceKm.toFixed(1)} km</div>
              <div className="text-[10px] text-neutral-400">depot to field</div>
            </div>

            <div>
              <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Turnaround Buffer</div>
              <div className="font-bold text-neutral-900 font-mono text-sm mt-0.5">+{transitBuffer.totalBufferMinutes} min</div>
              <div className="text-[10px] text-neutral-400">clean & travel</div>
            </div>

            <div>
              <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Live Weather Risk</div>
              <div className="font-bold text-neutral-900 font-mono text-sm mt-0.5">
                {imminentRainfallMm > 0 ? `${imminentRainfallMm.toFixed(1)} mm` : '0.0 mm'}
              </div>
              <div className="text-[10px] text-emerald-700">
                {severeWeatherAlert ? 'Rain Alert Active' : 'Normal Conditions'}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Estimated Rental Total</div>
              <div className="font-bold text-emerald-950 font-mono text-base mt-0.5">
                ₹{estimatedCostRupees.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-neutral-400">
                ₹{activeResource.hourlyRate}{activeResource.rateUnit === 'per_day' ? '/day' : '/hr'}
              </div>
            </div>
          </div>
        )}

        {/* Submit Booking Button */}
        <button
          type="submit"
          disabled={userPlots.length === 0 || resources.length === 0 || feasibility.isHardBlocker}
          className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
            feasibility.hasTimeCollision
              ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-amber-200'
              : 'bg-emerald-700 hover:bg-emerald-800 text-white'
          }`}
        >
          {feasibility.hasTimeCollision ? (
            <>
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Submit for Fair Turn Priority Arbitration</span>
            </>
          ) : (
            <>
              <span>Confirm Fair Allocation Request</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
