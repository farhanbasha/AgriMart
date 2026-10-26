import React, { useState, useMemo, useEffect } from 'react';
import { Plot, Resource, ResourceCategory, Profile } from '../types';
import { calculateHaversineDistance } from '../lib/engine';
import { getDeviceLocation, subscribeDeviceLocation, DeviceLocationState } from '../lib/deviceLocation';
import {
  Star,
  MapPin,
  IndianRupee,
  Phone,
  Search,
  CheckCircle2,
  Sliders,
  Sparkles,
  Tractor,
  Users,
  Plane,
  Droplets,
  Truck,
  Trash2,
  ShieldCheck,
  Zap,
  Filter,
  AlertTriangle,
  User,
} from 'lucide-react';
import { appStorage } from '../lib/storage';

interface EquipmentCardGridProps {
  resources: Resource[];
  activePlot?: Plot | null;
  currentUser?: Profile | null;
  onRequestResource: (resourceId: string) => void;
  onDeleteResource?: (resourceId: string) => void;
  onNavigateToAdd?: () => void;
}

const CATEGORY_META: Record<
  string,
  { label: string; badgeColor: string; bgBadge: string }
> = {
  machinery: {
    label: 'Tractors & Harvesters',
    badgeColor: 'text-emerald-800',
    bgBadge: 'bg-emerald-50 border-emerald-200',
  },
  labour: {
    label: 'Kheti Mazdoor Dal',
    badgeColor: 'text-amber-800',
    bgBadge: 'bg-amber-50 border-amber-200',
  },
  services: {
    label: 'Drone & Krishi Tech',
    badgeColor: 'text-sky-800',
    bgBadge: 'bg-sky-50 border-sky-200',
  },
  irrigation: {
    label: 'Pumps & Tubewell',
    badgeColor: 'text-cyan-800',
    bgBadge: 'bg-cyan-50 border-cyan-200',
  },
  transportation: {
    label: 'Haulage & Trolley',
    badgeColor: 'text-neutral-800',
    bgBadge: 'bg-neutral-100 border-neutral-300',
  },
  storage: {
    label: 'Godown & Cold Store',
    badgeColor: 'text-stone-800',
    bgBadge: 'bg-stone-100 border-stone-300',
  },
};

export const EquipmentCardGrid: React.FC<EquipmentCardGridProps> = ({
  resources,
  activePlot,
  currentUser,
  onRequestResource,
  onDeleteResource,
  onNavigateToAdd,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(60);
  const [deviceLoc, setDeviceLoc] = useState<DeviceLocationState>(() => getDeviceLocation());

  useEffect(() => {
    const unsub = subscribeDeviceLocation((loc) => setDeviceLoc(loc));
    return unsub;
  }, []);

  // Origin coordinates: active plot if selected, else device location
  const originLat = activePlot?.latitude ?? deviceLoc.latitude ?? 29.6857;
  const originLng = activePlot?.longitude ?? deviceLoc.longitude ?? 76.9905;
  const originLabel = activePlot
    ? `${activePlot.plotName} (${activePlot.village || 'Plot'})`
    : `${deviceLoc.placeName} (Device GPS)`;

  // Dynamic suggestions from storage
  const suggestions = useMemo(() => {
    return appStorage.getSearchSuggestions(searchQuery);
  }, [searchQuery, resources]);

  // Compute distances relative to origin and verify lender operational radius
  const resourcesWithDistance = useMemo(() => {
    return resources.map((res) => {
      const distance = calculateHaversineDistance(
        originLat,
        originLng,
        res.baseLat,
        res.baseLng
      );
      const lenderRadius = res.maxRadiusKm || 50.0;
      const isWithinLenderRadius = distance <= lenderRadius;
      const isWithinUserRadius = distance <= maxDistanceKm;

      return {
        ...res,
        computedDistanceKm: Math.round(distance * 10) / 10,
        lenderMaxRadiusKm: lenderRadius,
        isWithinLenderRadius,
        isWithinUserRadius,
      };
    });
  }, [resources, originLat, originLng, maxDistanceKm]);

  // Filtered by category, search query, lender radius, and user distance slider
  // Strict rule: If farmer is beyond lender's maxRadiusKm, machine is strictly hidden unless farmer owns it!
  const filteredResources = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return resourcesWithDistance.filter((res) => {
      const isMine = Boolean(currentUser && res.ownerId === currentUser.id);

      // Strict lender cutoff: other farmers > maxRadiusKm away cannot even see this service/machine
      if (!isMine && !res.isWithinLenderRadius) {
        return false;
      }

      // Filter by category
      if (selectedCategory !== 'all' && res.category !== selectedCategory) {
        return false;
      }

      // User distance preference slider
      if (res.computedDistanceKm > maxDistanceKm) {
        return false;
      }

      if (!q) return true;

      const matchName = res.name.toLowerCase().includes(q);
      const matchSpecs = res.specs.toLowerCase().includes(q);
      const matchVillage = res.village?.toLowerCase().includes(q) || false;
      const matchOwner = res.ownerName.toLowerCase().includes(q);

      return matchName || matchSpecs || matchVillage || matchOwner;
    });
  }, [resourcesWithDistance, selectedCategory, searchQuery, maxDistanceKm, currentUser]);

  // Featured emergency resource (Highest-rated machinery strictly within serviceable area)
  const featuredResource = useMemo(() => {
    return (
      filteredResources.find(
        (r) => r.category === 'machinery' && r.operationalStatus === 'available'
      ) || filteredResources[0] || null
    );
  }, [filteredResources]);

  const handleSelectSuggestion = (text: string) => {
    const clean = text.split('(')[0].trim();
    setSearchQuery(clean);
    setIsSearchFocused(false);
  };

  return (
    <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-xs p-4 sm:p-7 space-y-5 sm:space-y-6 w-full max-w-full min-w-0 overflow-hidden">
      {/* 1. Header & Location Context */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 border-b border-neutral-100 pb-4 sm:pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-xl font-bold text-neutral-900 tracking-tight">
              Community Machinery, Services & Labour
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold font-mono">
              {filteredResources.length} In Range
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>
              Origin: <strong className="text-neutral-800 font-semibold">{originLabel}</strong>
            </span>
          </p>
        </div>

        {/* Lender Geofence Indicator & Distance Range Slider */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200/80 px-3 py-1.5 rounded-2xl text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Lender Service Radius Enforced (Haversine)</span>
          </div>

          <div className="flex items-center gap-2 bg-neutral-50/80 px-3.5 py-1.5 rounded-2xl border border-neutral-200/80 text-xs">
            <Sliders className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-neutral-600 font-medium">Filter Dist:</span>
            <strong className="text-neutral-900 font-bold font-mono">{maxDistanceKm} km</strong>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={maxDistanceKm}
              onChange={(e) => setMaxDistanceKm(Number(e.target.value))}
              aria-label="Filter radius in kilometers"
              className="w-20 sm:w-24 accent-emerald-600 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 2. Emergency Weather Mobilization Spotlight */}
      {featuredResource && selectedCategory === 'all' && !searchQuery && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-900 via-emerald-950 to-neutral-900 text-white p-4 sm:p-6 shadow-md border border-emerald-700/40 w-full max-w-full min-w-0">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500 text-neutral-950 text-[11px] font-black uppercase tracking-wider">
                  <Zap className="w-3 h-3 fill-neutral-950" />
                  Storm Priority Dispatch
                </span>
                <span className="text-emerald-300 text-xs font-semibold">
                  Pre-Rain Harvest Window
                </span>
                <span className="text-[10px] bg-emerald-800/80 text-emerald-200 px-2 py-0.5 rounded font-mono">
                  Lender Radius: {featuredResource.lenderMaxRadiusKm} km
                </span>
              </div>
              <h3 className="text-base sm:text-xl font-extrabold text-white tracking-tight">
                {featuredResource.name}
              </h3>
              <p className="text-xs text-emerald-100/85 leading-relaxed">
                {featuredResource.specs}. Base depot in {featuredResource.village || 'Shivamogga'} ({featuredResource.computedDistanceKm} km from you).
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-200 pt-1">
                <span className="flex items-center gap-1 font-mono font-bold text-white text-base">
                  ₹{featuredResource.hourlyRate.toLocaleString('en-IN')}/hr
                </span>
                <span className="text-emerald-400">|</span>
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-white">{featuredResource.conditionRating.toFixed(1)}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              {featuredResource.ownerPhone && (
                <a
                  href={`tel:${featuredResource.ownerPhone}`}
                  title="Call Driver"
                  className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-colors flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Call</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => onRequestResource(featuredResource.id)}
                className="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold text-xs shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <span>Book Machine Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Search Bar with Auto-Suggestions */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-neutral-400 absolute left-4 pointer-events-none" />
          <input
            type="text"
            placeholder="Search tractor model, combine harvester, drone spray, labour team, village or crop..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            className="w-full pl-11 pr-16 py-3 rounded-2xl border border-neutral-200 text-xs sm:text-sm bg-neutral-50/70 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all placeholder:text-neutral-400 font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-4 text-xs font-semibold text-neutral-400 hover:text-neutral-800"
            >
              Clear
            </button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {isSearchFocused && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-neutral-200 p-2 z-30 animate-fade-in">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              Direct Suggestions:
            </div>
            <div className="space-y-1">
              {suggestions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onMouseDown={() => handleSelectSuggestion(item)}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-neutral-800 hover:bg-emerald-50 hover:text-emerald-950 transition-colors flex items-center justify-between"
                >
                  <span className="font-semibold">{item}</span>
                  <span className="text-[10px] text-neutral-400">1-click filter</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Category Filter Chips */}
      <div className="w-full max-w-full min-w-0 overflow-x-auto pb-2 scrollbar-none flex items-center gap-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        <span className="text-neutral-400 font-bold uppercase tracking-wider text-[10px] mr-1 shrink-0">
          Filter:
        </span>
        {[
          { id: 'all', label: 'All Equipment', icon: null },
          { id: 'machinery', label: 'Tractors & Machinery', icon: <Tractor className="w-3.5 h-3.5" /> },
          { id: 'labour', label: 'Farm Labour Teams', icon: <Users className="w-3.5 h-3.5" /> },
          { id: 'services', label: 'Drone & Tech Services', icon: <Plane className="w-3.5 h-3.5" /> },
          { id: 'irrigation', label: 'Pumps & Irrigation', icon: <Droplets className="w-3.5 h-3.5" /> },
          { id: 'transportation', label: 'Trolley & Transport', icon: <Truck className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedCategory(tab.id as any)}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl font-bold whitespace-nowrap shrink-0 transition-all ${
              selectedCategory === tab.id
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-neutral-100 hover:bg-neutral-200/70 text-neutral-700'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 5. Equipment Cards Grid */}
      {filteredResources.length === 0 ? (
        <div className="text-center py-12 px-4 bg-neutral-50/70 rounded-3xl border border-dashed border-neutral-300">
          <p className="text-sm font-bold text-neutral-800">
            {resources.length === 0
              ? 'No machinery or services listed in community registry yet'
              : 'No machinery or services available within lender serviceable distance'}
          </p>
          <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
            {resources.length === 0
              ? 'Be the first to list a tractor, harvester, drone, or farm labour team to start sharing.'
              : 'Lenders specify a maximum serviceable radius using the Haversine formula. Equipment outside their service area is automatically hidden.'}
          </p>
          {onNavigateToAdd && (
            <button
              type="button"
              onClick={onNavigateToAdd}
              className="mt-4 px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800 shadow-xs transition-colors"
            >
              + List Equipment Now
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full max-w-full min-w-0">
          {filteredResources.map((item) => {
            const isOperational = item.operationalStatus === 'available';
            const isMine = currentUser && item.ownerId === currentUser.id;
            const rateLabel =
              item.rateUnit === 'per_day'
                ? '/day'
                : item.rateUnit === 'per_acre'
                ? '/acre'
                : '/hr';

            const catMeta = CATEGORY_META[item.category] || {
              label: item.category,
              badgeColor: 'text-neutral-700',
              bgBadge: 'bg-neutral-100 border-neutral-200',
            };

            return (
              <div
                key={item.id}
                className="p-5 rounded-3xl border border-neutral-200/90 bg-white hover:border-emerald-500/70 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  {/* Status & Distance */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isOperational ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      <span className="text-[11px] font-bold text-neutral-700 capitalize">
                        {isOperational ? 'Ready for Booking' : 'Under Service / In Field'}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-mono">
                      <MapPin className="w-3 h-3 text-emerald-600" />
                      <span>{item.computedDistanceKm} km</span>
                    </span>
                  </div>

                  {/* Lender Radius Badge & Ownership Pill */}
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-neutral-500">
                      Lender Limit: <strong>{item.lenderMaxRadiusKm} km</strong>
                    </span>
                    {isMine ? (
                      <span className="text-emerald-950 font-bold bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-700" />
                        Your Listing
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        In Service Area (≤{item.lenderMaxRadiusKm} km)
                      </span>
                    )}
                  </div>

                  {/* Category & Title */}
                  <div>
                    <span
                      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${catMeta.bgBadge} ${catMeta.badgeColor}`}
                    >
                      {catMeta.label}
                    </span>
                    <h3 className="font-bold text-base text-neutral-900 leading-snug group-hover:text-emerald-900 transition-colors mt-1">
                      {item.name}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                      {item.specs}
                    </p>
                  </div>

                  {/* Capacity / Workers Badge */}
                  {item.capacityOrWorkers && (
                    <div className="inline-block text-[11px] font-semibold text-neutral-700 bg-neutral-100 px-2.5 py-1 rounded-lg">
                      {item.capacityOrWorkers}
                    </div>
                  )}

                  {/* Owner, Village & Rating */}
                  <div className="pt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="text-neutral-800 font-semibold truncate max-w-[170px] flex items-center gap-1">
                        <User className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                        <span className="truncate">{item.ownerName}</span>
                      </div>
                      <div className="text-[11px] text-neutral-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-neutral-400" />
                        <span>{item.village || 'Depot'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 font-bold text-neutral-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                      <span className="font-mono">{item.conditionRating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Rate & Book Action */}
                <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                  <div>
                    <div className="text-lg font-extrabold text-neutral-900 flex items-baseline font-mono">
                      <span>₹{item.hourlyRate.toLocaleString('en-IN')}</span>
                      <span className="text-xs text-neutral-500 font-normal ml-1">{rateLabel}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.ownerPhone && (
                      <a
                        href={`tel:${item.ownerPhone}`}
                        title="Call Equipment Owner"
                        className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-700" />
                      </a>
                    )}

                    {/* ONLY THE OWNER CAN DELETE THEIR EQUIPMENT */}
                    {isMine && onDeleteResource && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove "${item.name}" from your equipment listings?`)) {
                            onDeleteResource(item.id);
                          }
                        }}
                        className="p-2 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete Your Listing"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onRequestResource(item.id)}
                      disabled={!isOperational}
                      className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all ${
                        !isOperational
                          ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                          : isMine
                          ? 'bg-emerald-800 text-white hover:bg-emerald-900'
                          : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white'
                      }`}
                    >
                      {isMine ? 'Your Machine' : isOperational ? 'Book Now' : 'In Field'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
