import React, { useState, useEffect } from 'react';
import { ConflictRecord } from '../types';
import {
  X,
  Sparkles,
  Trophy,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Clock,
  CloudRain,
  MapPin,
  CheckCircle2,
  Loader2,
  Languages,
} from 'lucide-react';
import { generateArbitrationExplanation, isGeminiConfigured } from '../lib/gemini';

interface ArbitrationModalProps {
  conflict: ConflictRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmWinner?: (winningId: string) => void;
}

export const ArbitrationModal: React.FC<ArbitrationModalProps> = ({
  conflict,
  isOpen,
  onClose,
  onConfirmWinner,
}) => {
  if (!isOpen || !conflict) return null;

  const { bookingA, bookingB, winningBookingId, justificationEn, contingencyAction, primaryDecidingFactor } =
    conflict;

  const isAWinner = winningBookingId === bookingA.id;
  const winner = isAWinner ? bookingA : bookingB;
  const deprioritized = isAWinner ? bookingB : bookingA;

  const [aiExplanation, setAiExplanation] = useState<{
    explanation: string;
    contingencyInHindi: string;
    fairnessSummary: string;
  } | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const handleExplainWithAI = async () => {
    setIsLoadingAI(true);
    try {
      const res = await generateArbitrationExplanation(bookingA, bookingB, winner.id);
      if (res) {
        setAiExplanation(res);
      }
    } catch (e) {
      console.warn('[Arbitration] Gemini AI explanation notice:', e);
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Automatically trigger AI explanation when modal opens
  useEffect(() => {
    if (isOpen && conflict) {
      setAiExplanation(null);
      setIsLoadingAI(true);
      generateArbitrationExplanation(conflict.bookingA, conflict.bookingB, winner.id)
        .then((res) => {
          if (res) setAiExplanation(res);
        })
        .catch((e) => console.warn('[Arbitration] Auto-explain notice:', e))
        .finally(() => setIsLoadingAI(false));
    }
  }, [isOpen, conflict?.id, winner.id]);

  // Breakdown dimension configs in simple terms
  const breakdownDimensions = [
    { label: 'Weather Alert Urgency (+Rain)', max: 25, key: 'weatherRiskPts' as const },
    { label: 'Crop Urgency & Justification', max: 25, key: 'urgencyDeadlinePts' as const },
    { label: 'Crop Stage Threat (Grain Shatter)', max: 20, key: 'cropVulnerabilityPts' as const },
    { label: 'Fair Waiting Turn in Queue', max: 15, key: 'antiStarvationPts' as const },
    { label: 'Travel Distance to Field', max: 10, key: 'logisticsProximityPts' as const },
    { label: 'Work Criticality (Harvest vs Towing)', max: 5, key: 'intentConditionPts' as const },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="arbitration-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 bg-neutral-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in"
    >
      <div
        className="relative w-full max-w-3xl bg-white rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden my-auto max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-300 flex-shrink-0">
              <Sparkles className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 id="arbitration-modal-title" className="text-base font-bold text-neutral-900">
                Fair Turn Priority Decision
              </h2>
              <p className="text-xs text-neutral-500">
                When two farmers need the same machine, crop safety & rain alerts decide fairly.
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

        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto flex-1 overscroll-contain">
          {/* Deciding Factor Pill */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs">
            <div className="flex items-center gap-2 text-neutral-600 font-medium">
              <span className="text-neutral-400 uppercase tracking-wider text-[10px] font-bold">
                Contested Machine:
              </span>
              <strong className="text-neutral-900 font-bold">{conflict.resourceName}</strong>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
              <span>Primary Reason:</span>
              <span>{primaryDecidingFactor}</span>
            </div>
          </div>

          {/* Side-by-side comparison cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Candidate A */}
            <div
              className={`p-5 rounded-3xl border-2 transition-all ${
                isAWinner
                  ? 'border-emerald-600 bg-emerald-50/30 shadow-xs'
                  : 'border-neutral-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Farmer 1
                  </span>
                  {isAWinner && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                      <Trophy className="w-3 h-3" />
                      Priority 1st
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xl font-extrabold text-neutral-900">
                    {bookingA.priorityScore}
                    <span className="text-xs font-normal text-neutral-400"> / 100</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-sm font-bold text-neutral-900">{bookingA.farmerName}</div>
                <div className="text-neutral-600 flex items-center justify-between">
                  <span>Field:</span>
                  <span className="font-semibold text-neutral-800">{bookingA.plotName}</span>
                </div>
                <div className="text-neutral-600 flex items-center justify-between">
                  <span>Crop Stage:</span>
                  <span className="font-bold text-emerald-800">{bookingA.cropStage}</span>
                </div>
                <div className="text-neutral-600 flex items-center justify-between">
                  <span>Work:</span>
                  <span className="font-bold uppercase text-neutral-900">{bookingA.intent}</span>
                </div>
                <div className="text-neutral-600 flex items-center justify-between">
                  <span>Distance:</span>
                  <span className="font-semibold text-neutral-800">{bookingA.distanceKm} km away</span>
                </div>

                {bookingA.urgencyJustification && (
                  <div className="mt-3 p-2.5 rounded-2xl bg-white border border-neutral-200 text-xs shadow-2xs">
                    <div className="font-bold text-neutral-900 flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 text-neutral-800">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        <span>Urgency Justification</span>
                      </span>
                      {bookingA.scoreBreakdown?.urgencyJustificationPts ? (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold">
                          +{bookingA.scoreBreakdown.urgencyJustificationPts} pts bonus
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-neutral-600 italic text-[11px] leading-relaxed">
                      "{bookingA.urgencyJustification}"
                    </p>
                  </div>
                )}
              </div>

              {/* Score breakdown bars for A */}
              <div className="mt-4 pt-4 border-t border-neutral-100 space-y-2">
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Fair Scoring Points
                </div>
                {breakdownDimensions.map((dim) => {
                  const val = bookingA.scoreBreakdown[dim.key] ?? 0;
                  const pct = Math.min(100, (val / dim.max) * 100);
                  return (
                    <div key={dim.key} className="space-y-0.5">
                      <div className="flex justify-between text-[11px] text-neutral-600">
                        <span className="truncate">{dim.label}</span>
                        <span className="font-bold text-neutral-900">
                          {val} <span className="text-[10px] text-neutral-400">/ {dim.max}</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isAWinner ? 'bg-emerald-600' : 'bg-neutral-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Candidate B */}
            <div
              className={`p-5 rounded-3xl border-2 transition-all ${
                !isAWinner
                  ? 'border-emerald-600 bg-emerald-50/30 shadow-xs'
                  : 'border-neutral-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Farmer 2
                  </span>
                  {!isAWinner && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                      <Trophy className="w-3 h-3" />
                      Priority 1st
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xl font-extrabold text-neutral-900">
                    {bookingB.priorityScore}
                    <span className="text-xs font-normal text-neutral-400"> / 100</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-sm font-bold text-neutral-900">{bookingB.farmerName}</div>
                <div className="text-neutral-600 flex items-center justify-between">
                  <span>Field:</span>
                  <span className="font-semibold text-neutral-800">{bookingB.plotName}</span>
                </div>
                <div className="text-neutral-600 flex items-center justify-between">
                  <span>Crop Stage:</span>
                  <span className="font-bold text-neutral-800">{bookingB.cropStage}</span>
                </div>
                <div className="text-neutral-600 flex items-center justify-between">
                  <span>Work:</span>
                  <span className="font-bold uppercase text-neutral-900">{bookingB.intent}</span>
                </div>
                <div className="text-neutral-600 flex items-center justify-between">
                  <span>Distance:</span>
                  <span className="font-semibold text-neutral-800">{bookingB.distanceKm} km away</span>
                </div>

                {bookingB.urgencyJustification && (
                  <div className="mt-3 p-2.5 rounded-2xl bg-white border border-neutral-200 text-xs shadow-2xs">
                    <div className="font-bold text-neutral-900 flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 text-neutral-800">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        <span>Urgency Justification</span>
                      </span>
                      {bookingB.scoreBreakdown?.urgencyJustificationPts ? (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold">
                          +{bookingB.scoreBreakdown.urgencyJustificationPts} pts bonus
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-neutral-600 italic text-[11px] leading-relaxed">
                      "{bookingB.urgencyJustification}"
                    </p>
                  </div>
                )}
              </div>

              {/* Score breakdown bars for B */}
              <div className="mt-4 pt-4 border-t border-neutral-100 space-y-2">
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Fair Scoring Points
                </div>
                {breakdownDimensions.map((dim) => {
                  const val = bookingB.scoreBreakdown[dim.key] ?? 0;
                  const pct = Math.min(100, (val / dim.max) * 100);
                  return (
                    <div key={dim.key} className="space-y-0.5">
                      <div className="flex justify-between text-[11px] text-neutral-600">
                        <span className="truncate">{dim.label}</span>
                        <span className="font-bold text-neutral-900">
                          {val} <span className="text-[10px] text-neutral-400">/ {dim.max}</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            !isAWinner ? 'bg-emerald-600' : 'bg-neutral-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Multi-Candidate Leaderboard (if >2 colliding bookings) */}
          {conflict.rankedBookings && conflict.rankedBookings.length > 2 && (
            <div className="p-4 rounded-3xl bg-neutral-50 border border-neutral-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-emerald-600" />
                  <span>Full Colliding Requests Leaderboard ({conflict.rankedBookings.length} Farmers)</span>
                </div>
                <span className="text-[10px] font-mono text-neutral-500">Ranked by Priority Score</span>
              </div>

              <div className="space-y-1.5">
                {conflict.rankedBookings.map((b, idx) => (
                  <div
                    key={b.id}
                    className={`p-2.5 rounded-2xl border flex items-center justify-between text-xs transition-colors ${
                      idx === 0
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-bold'
                        : 'bg-white border-neutral-200 text-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px] font-black ${
                        idx === 0 ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-700'
                      }`}>
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-bold text-neutral-900">{b.farmerName}</span>
                        <span className="text-neutral-500 text-[11px] ml-1.5">
                          ({b.plotName} · {b.cropStage} · {b.intent})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-sm text-neutral-900">{b.priorityScore}</span>
                      <span className="text-[10px] text-neutral-400">/ 100</span>
                      {idx === 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                          Awarded Slot
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-semibold">
                          Contingency
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Simple Rationale & Solution */}
          <div className="bg-neutral-50 rounded-3xl p-5 border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-900 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Why This Decision Was Made</span>
              </div>
              <button
                type="button"
                onClick={handleExplainWithAI}
                disabled={isLoadingAI}
                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-70 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                {isLoadingAI ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Languages className="w-3.5 h-3.5" />
                )}
                <span>{isLoadingAI ? 'Generating AI Justification...' : 'Explain with Gemini AI'}</span>
              </button>
            </div>

            <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
              {aiExplanation ? aiExplanation.explanation : justificationEn}
            </p>

            {aiExplanation && (
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1 text-xs">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-emerald-700" />
                  <span>किसान संदेश (Hindi Village Reassurance):</span>
                </div>
                <p className="text-emerald-950 font-medium leading-relaxed">
                  {aiExplanation.contingencyInHindi}
                </p>
                <p className="text-[11px] text-emerald-800 italic pt-1">
                  {aiExplanation.fairnessSummary}
                </p>
              </div>
            )}

            {/* Supportive alternative recommendation */}
            <div className="mt-3 pt-3 border-t border-neutral-200 text-xs flex items-start gap-2.5 text-neutral-700">
              <div className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 font-bold text-[11px] uppercase flex-shrink-0">
                Backup Solution
              </div>
              <div className="leading-relaxed">
                <strong className="text-neutral-900">Alternative for {deprioritized.farmerName}:</strong>{' '}
                {contingencyAction}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-t border-neutral-100 bg-neutral-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-neutral-500">
            Automated Fair Decision · Completely Transparent
          </span>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 text-xs font-bold hover:bg-neutral-100 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                if (onConfirmWinner) onConfirmWinner(winner.id);
                onClose();
              }}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Accept & Confirm Allocation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
