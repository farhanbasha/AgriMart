import React, { useState, useEffect } from 'react';
import { CloudRain, X, ArrowRight, ShieldAlert, RefreshCw, Sun, Wind } from 'lucide-react';
import { getLiveWeatherForCoordinates, LiveWeatherReport } from '../lib/weather';

interface SentinelBarProps {
  onInspectPriority: () => void;
  onSimulateDisruption?: () => void;
  latitude?: number;
  longitude?: number;
}

export const SentinelBar: React.FC<SentinelBarProps> = ({
  onInspectPriority,
  onSimulateDisruption,
  latitude = 29.6857,
  longitude = 76.9905,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [weather, setWeather] = useState<LiveWeatherReport | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchWeather = async (force: boolean = false) => {
    setLoading(true);
    try {
      const data = await getLiveWeatherForCoordinates(latitude, longitude, force);
      setWeather(data);
    } catch (err) {
      console.error('Weather update failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, [latitude, longitude]);

  if (dismissed) return null;

  const isRainy = (weather?.rainfallMm ?? 0) > 0 || weather?.severeAlert;

  return (
    <aside
      aria-label="Kisan Sentinel Weather Advisory"
      className={`${
        isRainy
          ? 'bg-amber-50/95 border-b border-amber-300/80 text-amber-950'
          : 'bg-emerald-50/95 border-b border-emerald-300/80 text-emerald-950'
      } px-3 sm:px-4 py-2.5 transition-all backdrop-blur-xs`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <div
            className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-xl text-white shadow-xs mt-0.5 sm:mt-0 ${
              isRainy ? 'bg-amber-600' : 'bg-emerald-600'
            }`}
          >
            {isRainy ? <CloudRain className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </div>
          <div className="text-xs leading-relaxed">
            <span
              className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md mr-1.5 sm:mr-2 ${
                isRainy
                  ? 'bg-amber-200/80 text-amber-950 border border-amber-300/80'
                  : 'bg-emerald-200/80 text-emerald-950 border border-emerald-300/80'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full animate-ping ${
                  isRainy ? 'bg-amber-700' : 'bg-emerald-700'
                }`}
              />
              {weather ? (
                <span>
                  {weather.rainfallMm > 0 ? `Rain Alert (+${weather.rainfallMm}mm)` : 'Clear Sky'} · {weather.tempC}°C
                </span>
              ) : (
                <span>Kisan Radar</span>
              )}
            </span>
            <span className="font-semibold text-neutral-900">
              Karnal Field Radar:
            </span>{' '}
            <span className="text-neutral-700">
              {weather?.description || 'Prioritizing ripe Basmati paddy harvesters based on weather models.'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 flex-shrink-0 pt-1 sm:pt-0 border-t border-neutral-200/50 sm:border-t-0">
          <button
            type="button"
            onClick={() => fetchWeather(true)}
            disabled={loading}
            title="Refresh satellite weather forecast"
            className="p-1.5 rounded-xl bg-white/80 hover:bg-white text-neutral-700 hover:text-neutral-950 border border-neutral-200 shadow-2xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {onSimulateDisruption && (
            <button
              type="button"
              onClick={onSimulateDisruption}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-semibold text-xs border border-amber-300 transition-colors"
            >
              <span>⚡ Crisis Reroute</span>
            </button>
          )}

          <button
            type="button"
            onClick={onInspectPriority}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Scorecard</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss alert"
            className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
