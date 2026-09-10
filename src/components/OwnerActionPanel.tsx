import React, { useMemo } from 'react';
import { Booking, OperationalStatus, Resource, Profile } from '../types';
import {
  Wrench,
  CheckCircle2,
  Clock,
  IndianRupee,
  Star,
  MapPin,
  PlusCircle,
  Tractor,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Compass,
  UserCheck,
  XCircle,
  ShieldCheck,
} from 'lucide-react';

interface OwnerActionPanelProps {
  resources: Resource[];
  bookings: Booking[];
  currentUserId: string;
  currentUser?: Profile | null;
  onUpdateStatus: (resourceId: string, newStatus: OperationalStatus) => void;
  onNavigateToAdd?: () => void;
  onOpenAuthModal?: () => void;
  onCancelBooking?: (bookingId: string) => void;
}

export const OwnerActionPanel: React.FC<OwnerActionPanelProps> = ({
  resources,
  bookings,
  currentUserId,
  currentUser,
  onUpdateStatus,
  onNavigateToAdd,
  onOpenAuthModal,
  onCancelBooking,
}) => {
  // STRICT OWNERSHIP FILTER:
  // Only display resources where ownerId === currentUserId.
  // NEVER fall back to showing other users' equipment!
  const ownedResources = useMemo(() => {
    if (!currentUserId) return [];
    return resources.filter((r) => r.ownerId === currentUserId);
  }, [resources, currentUserId]);

  // Bookings specifically assigned to this owner's equipment
  const ownerBookings = useMemo(() => {
    const ownedIds = new Set(ownedResources.map((r) => r.id));
    return bookings.filter((b) => ownedIds.has(b.resourceId));
  }, [bookings, ownedResources]);

  // Compute aggregate rental revenue from active bookings on this owner's equipment
  const totalRentalEarnings = useMemo(() => {
    return ownerBookings.reduce((acc, b) => {
      if (b.status === 'cancelled') return acc;
      return acc + (b.totalCostRupees || 0);
    }, 0);
  }, [ownerBookings]);

  const activeShiftsCount = useMemo(() => {
    return ownerBookings.filter((b) => b.status !== 'cancelled').length;
  }, [ownerBookings]);

  // Handle owner cancel shift
  const handleCancelShift = (booking: Booking) => {
    if (!onCancelBooking) return;
    const confirmed = confirm(
      `Are you sure you want to cancel the shift for "${booking.farmerName}" on "${booking.resourceName}"? This will free up your machine.`
    );
    if (confirmed) {
      onCancelBooking(booking.id);
    }
  };

  // 1. Not logged in state
  if (!currentUserId || !currentUser) {
    return (
      <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-xs p-8 sm:p-12 text-center space-y-4 max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-800 mx-auto flex items-center justify-center border border-amber-200 shadow-xs">
          <Tractor className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
            Equipment Owner Portal (Login Required)
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 max-w-md mx-auto">
            To prevent machinery from mixing between different farmers, please log in with your mobile number to access and manage your private equipment fleet.
          </p>
        </div>
        {onOpenAuthModal && (
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all"
          >
            <UserCheck className="w-4 h-4" />
            <span>Log In as Equipment Owner</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Fleet Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/90 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Your Registered Fleet
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 font-mono">
            {ownedResources.length} Units
          </div>
          <p className="text-xs text-emerald-700 font-medium">Owned by {currentUser.fullName}</p>
        </div>

        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/90 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Assigned Shifts
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 font-mono">
            {activeShiftsCount} Active
          </div>
          <p className="text-xs text-neutral-500 font-medium">
            {ownerBookings.length - activeShiftsCount > 0 ? `${ownerBookings.length - activeShiftsCount} cancelled` : 'Coordinated with buffer'}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/90 shadow-xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Rental Value Generated
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-800 font-mono flex items-center">
            <IndianRupee className="w-6 h-6" />
            <span>{totalRentalEarnings.toLocaleString('en-IN')}</span>
          </div>
          <p className="text-xs text-neutral-500 font-medium">Earned on your listed fleet</p>
        </div>
      </div>

      {/* Fleet Management Card */}
      <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-xs p-4 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-xl font-bold text-neutral-900 tracking-tight">
                Equipment Owner Fleet Controls
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                {currentUser.fullName}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Manage your private fleet, base depot location, daily operational windows, and view incoming farmer bookings.
            </p>
          </div>

          {onNavigateToAdd && (
            <button
              type="button"
              onClick={onNavigateToAdd}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-xs transition-colors self-start sm:self-auto"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Onboard Machine</span>
            </button>
          )}
        </div>

        {/* Fleet Grid or Empty State */}
        {ownedResources.length === 0 ? (
          <div className="text-center py-12 px-4 bg-neutral-50/70 rounded-3xl border border-dashed border-neutral-300 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 mx-auto flex items-center justify-center border border-amber-200">
              <Tractor className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-neutral-900">No Equipment in Your Fleet Yet</h3>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">
              You have not listed any tractors, harvesters, drone services, or labour teams under your account. Click below to add your first machine and start sharing.
            </p>
            {onNavigateToAdd && (
              <button
                type="button"
                onClick={onNavigateToAdd}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Onboard Your First Machine</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {ownedResources.map((res) => {
              const rateSuffix =
                res.rateUnit === 'per_day' ? '/day' : res.rateUnit === 'per_acre' ? '/acre' : '/hr';

              const resBookings = ownerBookings.filter((b) => b.resourceId === res.id);

              return (
                <div
                  key={res.id}
                  className="p-4 sm:p-5 rounded-3xl border border-neutral-200/90 bg-neutral-50/40 hover:bg-white hover:border-emerald-400 hover:shadow-xs transition-all space-y-4"
                >
                  {/* Top info */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70">
                        {res.category}
                      </span>
                      <h3 className="font-bold text-base text-neutral-900 mt-1.5">{res.name}</h3>
                      <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{res.specs}</p>
                    </div>
                    <div className="flex items-center gap-1 font-bold text-xs text-neutral-800 bg-white px-2 py-1 rounded-xl border border-neutral-200 shadow-2xs font-mono">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                      <span>{res.conditionRating.toFixed(1)}</span>
                    </div>
                  </div>

                  {/* Specifications & Operating Location */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 bg-white p-3 rounded-2xl border border-neutral-200/70">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-neutral-400 block">Base Depot</span>
                      <div className="font-semibold text-neutral-800 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="truncate">{res.village || 'Karnal'}</span>
                      </div>
                      <span className="text-[10px] font-mono text-neutral-400">
                        {res.baseLat.toFixed(2)}°N, {res.baseLng.toFixed(2)}°E
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-neutral-400 block">Operating Window</span>
                      <div className="font-semibold text-neutral-800 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span className="truncate">{res.operatingHours || '06:00 AM - 08:00 PM'}</span>
                      </div>
                      <span className="text-[10px] font-mono text-neutral-500">
                        Max Radius: <strong>{res.maxRadiusKm || 50} km</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-600 pt-1">
                    <span className="font-mono text-xs text-neutral-500">
                      Rate: <strong className="text-neutral-900 font-bold text-sm">₹{res.hourlyRate.toLocaleString('en-IN')}</strong>{rateSuffix}
                    </span>
                    <span className="font-mono text-xs text-emerald-700 font-bold">
                      {resBookings.filter(b => b.status !== 'cancelled').length} Active Shift(s)
                    </span>
                  </div>

                  {/* Status Controls */}
                  <div className="space-y-2 pt-3 border-t border-neutral-200/60">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Operational Status:
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      {[
                        { id: 'available', label: 'Ready (Idle)' },
                        { id: 'in_use', label: 'In Field' },
                        { id: 'maintenance', label: 'Under Service' },
                      ].map((st) => {
                        const isSelected = res.operationalStatus === st.id;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => onUpdateStatus(res.id, st.id as OperationalStatus)}
                            className={`px-1.5 sm:px-2.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold border transition-all text-center ${
                              isSelected
                                ? st.id === 'maintenance'
                                  ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                                  : 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100/80'
                            }`}
                          >
                            {st.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Assigned Booking Calendar Snippet */}
                  {resBookings.length > 0 && (
                    <div className="pt-3 border-t border-neutral-200/60 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase text-neutral-500">
                        <span>Assigned Reservations:</span>
                        <span className="font-mono text-emerald-700">{resBookings.length} total</span>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {resBookings.map((b) => {
                          const isCancelled = b.status === 'cancelled';
                          return (
                            <div
                              key={b.id}
                              className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1.5 ${
                                isCancelled
                                  ? 'bg-neutral-100 border-neutral-200 opacity-60'
                                  : 'bg-white border-neutral-200'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="truncate">
                                  <div className="font-bold text-neutral-900 truncate">
                                    {b.farmerName} ({b.plotName})
                                  </div>
                                  <div className="text-[10px] text-neutral-500">
                                    {new Date(b.startTime).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} |{' '}
                                    {new Date(b.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="font-bold font-mono text-emerald-800">
                                    ₹{b.totalCostRupees ? b.totalCostRupees.toLocaleString('en-IN') : '--'}
                                  </div>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                    isCancelled ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {isCancelled ? 'Cancelled' : 'Confirmed'}
                                  </span>
                                </div>
                              </div>

                              {!isCancelled && onCancelBooking && (b.farmerId === currentUserId || (currentUser && b.farmerId === currentUser.id)) && (
                                <div className="pt-1 border-t border-neutral-100 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleCancelShift(b)}
                                    className="text-[10px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 py-0.5 px-2 rounded-md hover:bg-rose-50 transition-colors"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    <span>Cancel Booking</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
