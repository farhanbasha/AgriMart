import React, { useState } from 'react';
import { Booking, Resource } from '../types';
import {
  X,
  AlertTriangle,
  CloudRain,
  Wrench,
  Sparkles,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { generateDisruptionResponse, isGeminiConfigured } from '../lib/gemini';

interface DisruptionSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  resources: Resource[];
  bookings: Booking[];
  onApplyDisruption: (
    type: 'EQUIPMENT_BREAKDOWN' | 'SUDDEN_RAIN_ALERT',
    resourceId: string
  ) => void;
}

export const DisruptionSimulatorModal: React.FC<DisruptionSimulatorModalProps> = ({
  isOpen,
  onClose,
  resources,
  bookings,
  onApplyDisruption,
}) => {
  if (!isOpen) return null;

  if (resources.length === 0) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-neutral-900/40 backdrop-blur-md animate-fade-in"
      >
        <div className="relative w-full max-w-md bg-white rounded-3xl border border-neutral-200 shadow-2xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 mx-auto flex items-center justify-center border border-amber-200">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-neutral-900">No Machinery Registered</h2>
            <p className="text-xs text-neutral-500">
              Please register or list at least one machine or equipment unit before simulating field crisis and rain rerouting scenarios.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-xs"
          >
            Close Simulator
          </button>
        </div>
      </div>
    );
  }

  const [disruptionType, setDisruptionType] = useState<'EQUIPMENT_BREAKDOWN' | 'SUDDEN_RAIN_ALERT'>(
    'EQUIPMENT_BREAKDOWN'
  );
  const [selectedResourceId, setSelectedResourceId] = useState(resources[0]?.id || '');
  const [isSimulated, setIsSimulated] = useState(false);
  const [isSimulatingAI, setIsSimulatingAI] = useState(false);
  const [simulationResult, setSimulationResult] = useState<{
    invalidatedCount: number;
    substituteName: string;
    rationale: string;
    remediationSteps: string[];
  } | null>(null);

  const handleSimulate = async () => {
    const targetResource = resources.find((r) => r.id === selectedResourceId) || resources[0];
    if (!targetResource) return;
    const impactedBookings = bookings.filter((b) => b.resourceId === targetResource.id);
    const substitute =
      resources.find((r) => r.id !== targetResource.id && r.operationalStatus === 'available') ||
      resources.find((r) => r.id !== targetResource.id) ||
      targetResource;
    const substituteName = substitute?.name || 'Cooperative Reserve Machine';

    setIsSimulatingAI(true);

    if (isGeminiConfigured()) {
      try {
        const aiResp = await generateDisruptionResponse(
          disruptionType,
          targetResource.name,
          impactedBookings,
          [substituteName]
        );
        if (aiResp && aiResp.rationale) {
          setSimulationResult({
            invalidatedCount: impactedBookings.length,
            substituteName: substituteName,
            rationale: `[Gemini AI] ${aiResp.rationale}`,
            remediationSteps: aiResp.remediationSteps.length > 0 ? aiResp.remediationSteps : [
              `Flag ${targetResource.name} to Maintenance status in master registry.`,
              `Dispatch ${substituteName} with rerouted transit buffer.`,
              'Send automated SMS coordination alert to affected farmers.',
            ],
          });
          setIsSimulated(true);
          setIsSimulatingAI(false);
          onApplyDisruption(disruptionType, targetResource.id);
          return;
        }
      } catch (err) {
        console.warn('[Disruption] Gemini AI simulation notice:', err);
      }
    }

    if (disruptionType === 'EQUIPMENT_BREAKDOWN') {
      setSimulationResult({
        invalidatedCount: impactedBookings.length,
        substituteName: substituteName,
        rationale: `Hydraulic pump failure flagged on ${targetResource.name}. Automatically reallocated ${impactedBookings.length} pending slots to cooperative reserve unit [${substituteName}] at 14.5km base. Calculated +45 min turnaround buffer.`,
        remediationSteps: [
          `Flag ${targetResource.name} to Maintenance status in master registry.`,
          `Dispatch ${substituteName} with rerouted GPS coordinates to North Field.`,
          'Send automated SMS coordination alert to prosumers with revised arrival timeline.',
        ],
      });
    } else {
      setSimulationResult({
        invalidatedCount: impactedBookings.length,
        substituteName: 'Post-Storm Drying Window',
        rationale: `Imminent 32mm precipitation alert detected. Heavy machinery suspended for soil compaction preservation; harvest-ready plots accelerated into emergency pre-storm window.`,
        remediationSteps: [
          'Prioritize ripe soybean harvesting before ground compaction threshold is breached.',
          'Halt all non-urgent tillage and towing operations.',
          'Issue automated schedule shifts to post-rain drainage clearance.',
        ],
      });
    }

    setIsSimulated(true);
    setIsSimulatingAI(false);
    onApplyDisruption(disruptionType, targetResource.id);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disruption-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-neutral-900/40 backdrop-blur-md overflow-y-auto animate-fade-in"
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-700 flex items-center justify-center border border-rose-500/20">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <h2 id="disruption-modal-title" className="text-base font-bold text-neutral-900">
                Fleet Crisis & Disruption Simulator
              </h2>
              <p className="text-xs text-neutral-500">
                Test sudden rainfall shocks and mechanical breakdown reallocations in real-time.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Shock Type Selector */}
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
              Select Disruption Shock
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setDisruptionType('EQUIPMENT_BREAKDOWN');
                  setIsSimulated(false);
                }}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  disruptionType === 'EQUIPMENT_BREAKDOWN'
                    ? 'border-rose-600 bg-rose-50/40 ring-1 ring-rose-600 shadow-xs'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Wrench className="w-4 h-4 text-rose-600" />
                  <span className="font-bold text-xs text-neutral-900">Equipment Breakdown</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Mechanical hydraulic failure; triggers cooperative reserve unit rerouting.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDisruptionType('SUDDEN_RAIN_ALERT');
                  setIsSimulated(false);
                }}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  disruptionType === 'SUDDEN_RAIN_ALERT'
                    ? 'border-amber-600 bg-amber-50/40 ring-1 ring-amber-600 shadow-xs'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <CloudRain className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-xs text-neutral-900">Sudden Rain Alert (+30mm)</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Compaction risks; suspends routine tillage, prioritizes ripe harvest slots.
                </p>
              </button>
            </div>
          </div>

          {/* Affected Resource Dropdown */}
          <div>
            <label htmlFor="affected-resource-select" className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">
              Target Contested Equipment
            </label>
            <select
              id="affected-resource-select"
              value={selectedResourceId}
              onChange={(e) => {
                setSelectedResourceId(e.target.value);
                setIsSimulated(false);
              }}
              className="w-full bg-neutral-50 border border-neutral-300 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-neutral-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.category} | {r.operationalStatus})
                </option>
              ))}
            </select>
          </div>

          {/* Result Card if simulated */}
          {isSimulated && simulationResult && (
            <div className="bg-neutral-50/90 rounded-2xl p-4 sm:p-5 border border-neutral-200 space-y-3 animate-fade-in shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>FarmGrid Autonomous Fleet Reroute Engine</span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
                {simulationResult.rationale}
              </p>

              <div className="pt-3 border-t border-neutral-200/80 space-y-2">
                <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                  Autonomous Multi-Farm Coordination Directives:
                </div>
                {simulationResult.remediationSteps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-neutral-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
          <span className="text-xs text-neutral-400">
            Real-time multi-agent crisis simulation
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 text-xs font-semibold hover:bg-neutral-100"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSimulate}
              disabled={isSimulatingAI}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-70 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              {isSimulatingAI ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              <span>{isSimulatingAI ? 'Simulating with Gemini AI...' : 'Trigger Disruption & Reroute'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
