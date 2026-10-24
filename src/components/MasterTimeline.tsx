import React, { useState, useMemo, useEffect } from 'react';
import { Booking, ConflictRecord, Resource, Profile } from '../types';
import {
  filterNonElapsedBookings,
  getBookingLiveTimeState,
} from '../lib/engine';
import {
  Clock,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  Sprout,
  Tractor,
  Truck,
  Droplets,
  WifiOff,
  IndianRupee,
  MapPin,
  CheckCircle2,
  Navigation,
  XCircle,
  Filter,
  Lock,
} from 'lucide-react';

interface MasterTimelineProps {
  bookings: Booking[];
  resources: Resource[];
  activeConflict: ConflictRecord | null;
  onOpenArbitration: () => void;
  onCancelBooking?: (bookingId: string) => void;
  currentUser?: Profile | null;
}

export const MasterTimeline: React.FC<MasterTimelineProps> = ({
  bookings,
  resources,
  activeConflict,
  onOpenArbitration,
  onCancelBooking,
  currentUser,
}) => {
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'cancelled'>('active');
  const [nowTick, setNowTick] = useState<Date>(() => new Date());

  // Tick every 15 seconds so elapsed bookings disappear automatically and 30m buffer locks update live
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(new Date());
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Format ISO time to readable 12-hour format
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  const renderIntentIcon = (intent: string) => {
    switch (intent) {
      case 'harvesting':
        return <Sprout className="w-5 h-5 text-emerald-700" />;
      case 'tillage':
        return <Tractor className="w-5 h-5 text-amber-700" />;
      case 'spraying':
      case 'irrigation':
        return <Droplets className="w-5 h-5 text-sky-700" />;
      default:
        return <Truck className="w-5 h-5 text-neutral-700" />;
    }
  };

  // Always exclude any booking whose scheduled endTime has elapsed (endTime <= nowTick)
  const nonElapsedBookings = useMemo(() => {
    return filterNonElapsedBookings(bookings, nowTick.getTime()).activeBookings;
  }, [bookings, nowTick]);

  const filteredBookings = useMemo(() => {
    let list = nonElapsedBookings;
    if (statusFilter === 'active') {
      list = nonElapsedBookings.filter((b) => b.status !== 'cancelled');
    } else if (statusFilter === 'cancelled') {
      list = nonElapsedBookings.filter((b) => b.status === 'cancelled');
    }
    // Sort chronologically by startTime ascending, ties broken by priorityScore descending
    return [...list].sort((a, b) => {
      const timeDiff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (b.priorityScore || 0) - (a.priorityScore || 0);
    });
  }, [nonElapsedBookings, statusFilter]);

  const handleCancelClick = (booking: Booking) => {
    if (!onCancelBooking) return;
    const confirmed = confirm(
      `Are you sure you want to cancel the booking for "${booking.resourceName}" at "${booking.plotName}"?\n\nThis will immediately release the equipment for other community farmers.`
    );
    if (confirmed) {
      onCancelBooking(booking.id);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-xs p-4 sm:p-7 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-neutral-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-xl font-bold text-neutral-900 tracking-tight">
              Operational Schedule & Field Timeline
            </h2>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Real-time machine transit windows, active deployments, and reservation cancellations.
          </p>
        </div>

        {/* Filter Tabs & Conflict Trigger */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-neutral-100 p-1 rounded-2xl border border-neutral-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-xl transition-all ${
                statusFilter === 'active'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Active ({nonElapsedBookings.filter((b) => b.status !== 'cancelled').length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-xl transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              All ({nonElapsedBookings.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('cancelled')}
              className={`px-3 py-1 rounded-xl transition-all ${
                statusFilter === 'cancelled'
                  ? 'bg-white text-rose-800 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Cancelled ({nonElapsedBookings.filter((b) => b.status === 'cancelled').length})
            </button>
          </div>

          {activeConflict && (
            <button
              type="button"
              onClick={onOpenArbitration}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold transition-all shadow-2xs"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Fair Turn Conflict</span>
            </button>
          )}
        </div>
      </div>

      {/* Fair Turn Priority Banner if conflict exists */}
      {activeConflict && (
        <div className="bg-gradient-to-r from-amber-50 via-amber-100/60 to-amber-50 border border-amber-300 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-950 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0" />
              <span>Contested Machine Allocation Alert</span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-800 leading-relaxed">
              <strong>{activeConflict.resourceName}:</strong> Simultaneous requests between{' '}
              <span className="font-bold text-emerald-900">
                {activeConflict.bookingA.farmerName} ({activeConflict.bookingA.intent})
              </span>{' '}
              and{' '}
              <span className="font-bold text-neutral-900">
                {activeConflict.bookingB.farmerName} ({activeConflict.bookingB.intent})
              </span>
              .{' '}
              <span>
                {activeConflict.justificationEn ||
                  `Fair Turn engine awarded priority based on operational urgency (${activeConflict.primaryDecidingFactor}).`}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenArbitration}
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span>View Scorecard</span>
          </button>
        </div>
      )}

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div className="text-center py-12 text-neutral-400 text-xs bg-neutral-50/50 rounded-2xl border border-dashed border-neutral-200">
          {statusFilter === 'cancelled'
            ? 'No cancelled bookings in the system.'
            : 'No scheduled bookings yet. Explore machines above to book your field shift.'}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const isCancelled = booking.status === 'cancelled';
            const isFarmerOwner = currentUser && booking.farmerId === currentUser.id;
            const liveState = !isCancelled ? getBookingLiveTimeState(booking, nowTick.getTime(), 30) : 'upcoming';

            return (
              <div key={booking.id} className="space-y-3">
                {/* Scheduled Booking Card */}
                <div
                  className={`p-4 sm:p-5 rounded-3xl border transition-all ${
                    isCancelled
                      ? 'border-neutral-200 bg-neutral-50/70 opacity-75'
                      : liveState === 'ongoing'
                      ? 'border-emerald-500 bg-emerald-50/30 shadow-xs'
                      : liveState === 'buffer_locked'
                      ? 'border-indigo-400 bg-indigo-50/30 shadow-xs'
                      : booking.isOfflineCached
                      ? 'border-amber-300 bg-amber-50/40 shadow-xs'
                      : booking.status === 'in_conflict'
                      ? 'border-amber-300 bg-amber-50/40'
                      : 'border-neutral-200/90 bg-white hover:border-emerald-400/80 hover:shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-3.5">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border flex items-center justify-center font-bold shadow-2xs flex-shrink-0 ${
                        isCancelled ? 'bg-neutral-100 border-neutral-300 text-neutral-400' : 'bg-neutral-50 border-neutral-200'
                      }`}>
                        {renderIntentIcon(booking.intent)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-bold text-base ${isCancelled ? 'text-neutral-500 line-through' : 'text-neutral-900'}`}>
                            {booking.plotName}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 border border-neutral-200 uppercase tracking-wider">
                            {booking.intent}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {booking.cropStage}
                          </span>

                          {/* Status Badge */}
                          {isCancelled ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1 font-mono">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Cancelled</span>
                            </span>
                          ) : booking.status === 'in_conflict' ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 font-mono">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>In Conflict</span>
                            </span>
                          ) : booking.allocatedSlotExplanation?.includes('Turn #') || booking.allocatedSlotExplanation?.includes('Sequential') ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 text-blue-600" />
                              <span>Sequenced Slot</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 font-mono">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Confirmed</span>
                            </span>
                          )}

                          {/* Live Ongoing / 30m Buffer Lock Protection Badge */}
                          {!isCancelled && liveState === 'ongoing' && (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-700 text-white border border-emerald-800 flex items-center gap-1 font-mono shadow-2xs">
                              <Lock className="w-3 h-3 text-emerald-200" />
                              <span>ONGOING NOW • PRIORITY LOCKED</span>
                            </span>
                          )}

                          {!isCancelled && liveState === 'buffer_locked' && (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-700 text-white border border-indigo-800 flex items-center gap-1 font-mono shadow-2xs">
                              <Lock className="w-3 h-3 text-indigo-200" />
                              <span>30M BUFFER LOCK • MOBILIZING</span>
                            </span>
                          )}

                          {booking.isOfflineCached && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs">
                              <WifiOff className="w-3 h-3 text-amber-700" />
                              <span>Saved Offline</span>
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-neutral-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>
                            Farmer: <strong className="text-neutral-800 font-semibold">{booking.farmerName}</strong>
                            {isFarmerOwner && <span className="text-emerald-700 font-bold ml-1">(You)</span>}
                          </span>
                          <span>|</span>
                          <span>
                            Machine: <strong className="text-neutral-800 font-semibold">{booking.resourceName}</strong>
                          </span>
                          {booking.totalCostRupees && (
                            <>
                              <span>|</span>
                              <span className="text-emerald-800 font-bold font-mono">
                                ₹{booking.totalCostRupees.toLocaleString('en-IN')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Time & Priority & Cancel Action */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-neutral-100 gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 font-mono">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        <span>
                          {formatDate(booking.startTime)} | {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-[11px] text-neutral-500 font-medium">
                          Priority Score:{' '}
                          <span className="font-extrabold text-emerald-800 font-mono">{booking.priorityScore}</span> / 100
                        </div>

                        {/* CANCEL BOOKING BUTTON (Strictly for the farmer who booked) */}
                        {!isCancelled && onCancelBooking && isFarmerOwner && (
                          <button
                            type="button"
                            onClick={() => handleCancelClick(booking)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold transition-colors shadow-2xs"
                            title="Cancel this booking"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Cancel Booking</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {booking.urgencyJustification && (
                    <div className="mt-2.5 p-2 rounded-xl bg-neutral-50 border border-neutral-150 text-xs text-neutral-700">
                      <span className="font-bold text-neutral-900">Urgency Note:</span> {booking.urgencyJustification}
                    </div>
                  )}

                  {booking.allocatedSlotExplanation && !isCancelled && (
                    <div className={`mt-2.5 pt-2.5 border-t border-neutral-100 flex items-center gap-2 text-xs p-2.5 rounded-2xl ${
                      booking.allocatedSlotExplanation.includes('Sequential') || booking.allocatedSlotExplanation.includes('Turn #')
                        ? 'text-blue-950 bg-blue-50/70 border border-blue-200'
                        : 'text-emerald-950 bg-emerald-50/60'
                    }`}>
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span>{booking.allocatedSlotExplanation}</span>
                    </div>
                  )}

                  {isCancelled && (
                    <div className="mt-2.5 pt-2 border-t border-neutral-100 text-xs text-rose-700 bg-rose-50/60 p-2 rounded-xl">
                      This reservation has been cancelled. Equipment is freed for other cooperative requests.
                    </div>
                  )}
                </div>

                {/* Transit & Preparation Buffer Indicator (Only for active bookings) */}
                {!isCancelled && (
                  <div className="flex items-center justify-center gap-3 py-0.5">
                    <div className="h-px bg-neutral-200/90 flex-1" />
                    <div className="px-3.5 py-1 rounded-full bg-amber-50/90 border border-amber-200/90 text-[11px] font-semibold text-amber-950 flex items-center gap-1.5 shadow-2xs">
                      <Navigation className="w-3 h-3 text-amber-600" />
                      <span>
                        Transit Buffer: <strong className="font-mono">+{booking.transitBufferMinutes} min</strong>{' '}
                        <span className="text-neutral-500 font-normal">
                          ({booking.distanceKm} km field transit)
                        </span>
                      </span>
                    </div>
                    <div className="h-px bg-neutral-200/90 flex-1" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
