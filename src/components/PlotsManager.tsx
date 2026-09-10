import React, { useState, useMemo } from 'react';
import { Plot, CropStage, Profile } from '../types';
import { MapPin, CloudRain, Plus, Trash2, CalendarCheck, Sun, AlertTriangle, RefreshCw, UserCheck, ShieldAlert } from 'lucide-react';
import { appStorage } from '../lib/storage';
import { getLiveWeatherForCoordinates } from '../lib/weather';

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
  const [state, setState] = useState(currentUser?.state || 'Haryana');
  const [refreshingPlotId, setRefreshingPlotId] = useState<string | null>(null);

  // STRICT OWNERSHIP FILTER:
  // Only display plots owned by the current logged-in user.
  // If guest (not logged in), show only guest plots.
  const userPlots = useMemo(() => {
    if (currentUser) {
      return plots.filter((p) => p.farmerId === currentUser.id);
    }
    // Guest session: only show plots registered by guest
    return plots.filter((p) => p.farmerId === 'guest-farmer' || !p.farmerId);
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
    if (!plotName.trim()) return;

    const farmerId = currentUser?.id || 'guest-farmer';
    const farmerName = currentUser?.fullName || 'Community Farmer';

    const newPlot = appStorage.addPlot({
      farmerId,
      farmerName,
      plotName: plotName.trim(),
      village: village.trim() || currentUser?.village || 'Karnal',
      state: state.trim() || currentUser?.state || 'Haryana',
      acres: Number(acres) || 1,
      acreUnit: 'acre',
      cropType: cropType.trim(),
      cropStage,
      latitude: 29.68,
      longitude: 76.99,
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
    const plot = plots.find((p) => p.id === id);
    if (!plot) return;

    // Security check: only the owner can delete their plot
    if (currentUser && plot.farmerId && plot.farmerId !== currentUser.id) {
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

      {/* Guest Notice if not logged in */}
      {!currentUser && (
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-950 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <span>
              You are currently viewing as a guest. Log in or create an account so your registered farm plots remain private to you!
            </span>
          </div>
          {onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="px-3 py-1 bg-amber-600 text-white rounded-xl font-bold whitespace-nowrap hover:bg-amber-700"
            >
              Log In Now
            </button>
          )}
        </div>
      )}

      {/* Plots Cards Grid or Empty State */}
      {userPlots.length === 0 ? (
        <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-xs p-8 sm:p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center border border-emerald-200">
            <MapPin className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-base sm:text-lg font-bold text-neutral-900">
              {currentUser
                ? `No Farm Plots Registered for ${currentUser.fullName} Yet`
                : 'No Farm Plots Registered Yet'}
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
                      <span>{plot.village || 'Karnal'}, {plot.state || 'Haryana'}</span>
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
