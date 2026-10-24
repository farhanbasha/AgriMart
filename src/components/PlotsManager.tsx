import React, { useState, useMemo, useEffect } from 'react';
import { Plot, CropStage, Profile } from '../types';
import {
  MapPin,
  CloudRain,
  Plus,
  Trash2,
  CalendarCheck,
  Sun,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  ShieldAlert,
  Crosshair,
  Navigation,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { appStorage } from '../lib/storage';
import { getLiveWeatherForCoordinates } from '../lib/weather';
import { getDeviceLocation } from '../lib/deviceLocation';

interface PlotsManagerProps {
  plots: Plot[];
  onPlotsChange: (plots: Plot[]) => void;
  onBookForPlot: (plotId: string) => void;
  currentUser?: Profile | null;
  onOpenAuthModal?: () => void;
}

export const PlotsManager: React.FC<PlotsManagerProps> = ({
  plots,
  onPlotsChange,
  onBookForPlot,
  currentUser,
  onOpenAuthModal,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [plotName, setPlotName] = useState('');
  const [acres, setAcres] = useState<number>(6);
  const [cropType, setCropType] = useState('Basmati Rice');
  const [cropStage, setCropStage] = useState<CropStage>('Harvest-Ready');
  const [village, setVillage] = useState(currentUser?.village || '');
  const [state, setState] = useState(currentUser?.state || 'Karnataka');
  const [plotLat, setPlotLat] = useState<number>(() => getDeviceLocation().latitude || 29.6857);
  const [plotLng, setPlotLng] = useState<number>(() => getDeviceLocation().longitude || 76.9905);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsStatusText, setGpsStatusText] = useState<string>('');
  const [refreshingPlotId, setRefreshingPlotId] = useState<string | null>(null);

  // Automatic GPS Location Detection with Manual Fallback
  const handleDetectGPS = (autoFillVillage = false) => {
    setIsDetectingGps(true);
    setGpsStatusText('Acquiring live GPS fix from device...');

    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(5));
          const lng = Number(pos.coords.longitude.toFixed(5));
          const accuracy = Math.round(pos.coords.accuracy || 20);
          setPlotLat(lat);
          setPlotLng(lng);
          setIsDetectingGps(false);
          setGpsStatusText(`GPS Attached: ${lat}°N, ${lng}°E (±${accuracy}m accuracy)`);

          if (autoFillVillage) {
            const dev = getDeviceLocation();
            if (dev.placeName && !dev.placeName.includes('°')) {
              setVillage(dev.placeName);
            }
            if (dev.stateName) {
              setState(dev.stateName);
            }
          }
        },
        (err) => {
          console.warn('[PlotsManager] Geolocation notice:', err.message);
          const dev = getDeviceLocation();
          setPlotLat(dev.latitude || 29.6857);
          setPlotLng(dev.longitude || 76.9905);
          setIsDetectingGps(false);
          setGpsStatusText('Browser GPS unavailable. Using device location (you can adjust coordinates manually below).');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    } else {
      const dev = getDeviceLocation();
      setPlotLat(dev.latitude || 29.6857);
      setPlotLng(dev.longitude || 76.9905);
      setIsDetectingGps(false);
      setGpsStatusText('Geolocation unsupported by browser. Please type coordinates manually below.');
    }
  };

  useEffect(() => {
    if (showAddModal) {
      handleDetectGPS(true);
    }
  }, [showAddModal]);

  // STRICT OWNERSHIP FILTER (RBAC):
  // Only display plots owned by the current logged-in user.
  // Unauthenticated guests see zero plots.
  const userPlots = useMemo(() => {
    if (currentUser) {
      return plots.filter((p) => p.farmerId === currentUser.id);
    }
    return [];
  }, [plots, currentUser]);

  const handleRefreshPlotWeather = async (plot: Plot) => {
    setRefreshingPlotId(plot.id);
    try {
      const live = await getLiveWeatherForCoordinates(plot.latitude, plot.longitude, true);
      const updatedWeather = {
        rainfallMm: live.rainfallMm,
        rainProbabilityPercent: live.rainProbabilityPercent,
        severeAlert: live.severeAlert,
        description: `${live.description} (${live.tempC}°C, Wind ${live.windSpeedKmh}km/h)`,
      };
      appStorage.updatePlotWeather(plot.id, updatedWeather);
      onPlotsChange(appStorage.getPlots());
    } catch (err) {
      console.error('Failed to refresh plot weather:', err);
    } finally {
      setRefreshingPlotId(null);
    }
  };

  const handleAddPlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }
    if (!plotName.trim()) return;

    const farmerId = currentUser.id;
    const farmerName = currentUser.fullName;

    const newPlot = appStorage.addPlot({
      farmerId,
      farmerName,
      plotName: plotName.trim(),
      village: village.trim() || currentUser?.village || 'Shivamogga',
      state: state.trim() || currentUser?.state || 'Karnataka',
      acres: Number(acres) || 1,
      acreUnit: 'acre',
      cropType: cropType.trim(),
      cropStage,
      latitude: Number(plotLat) || 29.6857,
      longitude: Number(plotLng) || 76.9905,
      weather: {
        rainfallMm: 5.0,
        rainProbabilityPercent: 25,
        severeAlert: false,
        description: 'Scattered clouds, suitable for farm operations.',
      },
    });

    onPlotsChange(appStorage.getPlots());
    setShowAddModal(false);
    setPlotName('');
  };

  const handleDeletePlot = (id: string) => {
    if (!currentUser) {
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }

    const plot = plots.find((p) => p.id === id);
    if (!plot) return;

    // Security check: only the owner can delete their plot
    if (plot.farmerId && plot.farmerId !== currentUser.id) {
      alert('You can only delete farm plots registered under your own account.');
      return;
    }

    if (confirm(`Are you sure you want to remove "${plot.plotName}"?`)) {
      appStorage.deletePlot(id);
      onPlotsChange(appStorage.getPlots());
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <span>My Farm Land & Plots</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {userPlots.length} Registered
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            {currentUser
              ? `Showing farm land plots exclusively owned by ${currentUser.fullName}.`
              : 'Registered field plots for local harvest and machinery coordination.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!currentUser && onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-colors"
            >
              <UserCheck className="w-4 h-4 text-amber-700" />
              <span>Log In to Save Plots to Account</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Farm Land</span>
          </button>
        </div>
      </div>

      {/* Plots Cards Grid or Empty / Auth State */}
      {!currentUser ? (
        <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-xs p-8 sm:p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 mx-auto flex items-center justify-center border border-amber-200">
            <Lock className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-base sm:text-lg font-bold text-neutral-900">
              Authentication Required to View & Manage Land Plots
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500">
              For privacy and security, agricultural land records and GPS coordinates are exclusively accessible to authenticated farmers. Please sign in to view and manage your fields.
            </p>
          </div>
          {onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-sm transition-all"
            >
              <UserCheck className="w-4 h-4" />
              <span>Log In or Register to Access Plots</span>
            </button>
          )}
        </div>
      ) : userPlots.length === 0 ? (
        <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-xs p-8 sm:p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center border border-emerald-200">
            <MapPin className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-base sm:text-lg font-bold text-neutral-900">
              No Farm Plots Registered for {currentUser.fullName} Yet
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500">
              Register your agricultural field plots to track live satellite weather risks and coordinate machinery tailored to your crop cycle.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Your First Farm Plot</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {userPlots.map((plot) => (
            <div
              key={plot.id}
              className="bg-white rounded-3xl p-4 sm:p-5 border border-neutral-200/90 shadow-xs hover:border-emerald-500/60 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200/80 font-mono">
                      {plot.acres} Acres
                    </span>
                    <h3 className="text-base font-bold text-neutral-900 group-hover:text-emerald-950 transition-colors mt-1.5">
                      {plot.plotName}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{plot.village || 'Shivamogga'}, {plot.state || 'Karnataka'}</span>
                    </div>
                    <div className="text-[10px] font-mono text-emerald-800 bg-emerald-50/80 px-2 py-0.5 rounded-md inline-block mt-1 border border-emerald-200/60">
                      GPS: {plot.latitude.toFixed(4)}°N, {plot.longitude.toFixed(4)}°E
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeletePlot(plot.id)}
                    className="p-2 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Remove Plot"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Crop & Stage info */}
                <div className="p-3.5 bg-neutral-50/80 rounded-2xl space-y-2 text-xs border border-neutral-100">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500 font-medium">Crop:</span>
                    <span className="font-bold text-neutral-900">{plot.cropType}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500 font-medium">Stage:</span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-md text-[11px] ${
                        plot.cropStage === 'Harvest-Ready'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : plot.cropStage === 'Ripening'
                          ? 'bg-sky-100 text-sky-900 border border-sky-200'
                          : 'bg-neutral-200 text-neutral-800'
                      }`}
                    >
                      {plot.cropStage}
                    </span>
                  </div>
                </div>

                {/* Weather Notice */}
                {plot.weather && (
                  <div
                    className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
                      plot.weather.severeAlert
                        ? 'bg-rose-50 border-rose-200 text-rose-950'
                        : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        {plot.weather.severeAlert ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                        ) : (
                          <Sun className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        )}
                        <span>Field Advisory</span>
                      </span>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span>{plot.weather.rainfallMm} mm rain</span>
                        <button
                          type="button"
                          onClick={() => handleRefreshPlotWeather(plot)}
                          disabled={refreshingPlotId === plot.id}
                          title="Fetch live satellite weather"
                          className="p-1 rounded-md hover:bg-black/10 transition-colors"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${
                              refreshingPlotId === plot.id ? 'animate-spin text-emerald-700' : 'text-neutral-500'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-90">{plot.weather.description}</p>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 mt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => onBookForPlot(plot.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-[0.98] text-white text-xs font-bold transition-all shadow-xs"
                >
                  <CalendarCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Book Machine for this Plot</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Plot Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-neutral-200 space-y-4">
            <h3 className="text-base font-bold text-neutral-900">Add New Farm Land</h3>

            <form onSubmit={handleAddPlot} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Plot / Field Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Subhash Farm - Basmati Field"
                  value={plotName}
                  onChange={(e) => setPlotName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Automatic GPS Location Detection & Manual Coordinates */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/90 rounded-2xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                    <Navigation className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Field GPS Location (Auto-Detected)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDetectGPS(true)}
                    disabled={isDetectingGps}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-[11px] font-bold transition-all shadow-2xs"
                  >
                    <Crosshair className={`w-3 h-3 text-emerald-700 ${isDetectingGps ? 'animate-spin' : ''}`} />
                    <span>{isDetectingGps ? 'Locating...' : 'Re-detect GPS'}</span>
                  </button>
                </div>

                {gpsStatusText && (
                  <p className="text-[11px] text-emerald-800/90 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                    <span>{gpsStatusText}</span>
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-0.5">
                      Latitude (°N) *
                    </label>
                    <input
                      type="number"
                      step="0.00001"
                      min="-90"
                      max="90"
                      required
                      value={plotLat}
                      onChange={(e) => setPlotLat(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-neutral-300 text-xs font-mono bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-0.5">
                      Longitude (°E) *
                    </label>
                    <input
                      type="number"
                      step="0.00001"
                      min="-180"
                      max="180"
                      required
                      value={plotLng}
                      onChange={(e) => setPlotLng(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-neutral-300 text-xs font-mono bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-neutral-500">
                  Detected automatically via GPS. You can also modify coordinates manually to pinpoint your land.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Area (Acres) *</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    required
                    value={acres}
                    onChange={(e) => setAcres(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Crop *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Wheat, Basmati Rice"
                    value={cropType}
                    onChange={(e) => setCropType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Crop Stage</label>
                <select
                  value={cropStage}
                  onChange={(e) => setCropStage(e.target.value as CropStage)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  <option value="Harvest-Ready">Harvest-Ready</option>
                  <option value="Ripening">Ripening</option>
                  <option value="Flowering">Flowering</option>
                  <option value="Vegetative">Vegetative</option>
                  <option value="Post-Harvest">Post-Harvest (Tillage)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Village</label>
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs text-neutral-600 hover:text-neutral-900 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  Save Plot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
