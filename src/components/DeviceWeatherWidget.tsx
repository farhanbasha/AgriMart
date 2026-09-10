import React, { useEffect, useState } from 'react';
import { Plot } from '../types';
import { getDeviceLocation, subscribeDeviceLocation, DeviceLocationState } from '../lib/deviceLocation';
import { getLiveWeatherForCoordinates, get5DayForecast, LiveWeatherReport, DailyForecastReport } from '../lib/weather';
import {
  CloudRain,
  Sun,
  Wind,
  Droplets,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Compass,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface DeviceWeatherWidgetProps {
  activePlot?: Plot | null;
  onWeatherAlertDetected?: (hasSevereAlert: boolean, rainfallMm: number) => void;
}

export const DeviceWeatherWidget: React.FC<DeviceWeatherWidgetProps> = ({
  activePlot,
  onWeatherAlertDetected,
}) => {
  const [deviceLoc, setDeviceLoc] = useState<DeviceLocationState>(() => getDeviceLocation());
  const [useDeviceLocation, setUseDeviceLocation] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [currentWeather, setCurrentWeather] = useState<LiveWeatherReport | null>(null);
  const [forecast, setForecast] = useState<DailyForecastReport[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Subscribe to automatic device geolocation updates
  useEffect(() => {
    const unsub = subscribeDeviceLocation((loc) => {
      setDeviceLoc(loc);
    });
    return unsub;
  }, []);

  // Determine current active coordinates
  const targetLat = useDeviceLocation ? deviceLoc.latitude : activePlot?.latitude ?? deviceLoc.latitude;
  const targetLon = useDeviceLocation ? deviceLoc.longitude : activePlot?.longitude ?? deviceLoc.longitude;
  const locationLabel = useDeviceLocation
    ? `${deviceLoc.placeName}${deviceLoc.stateName ? ', ' + deviceLoc.stateName : ''}`
    : activePlot
    ? `${activePlot.plotName} (${activePlot.village || 'Field'})`
    : deviceLoc.placeName;

  // Fetch live weather and 5-day forecast whenever coordinates change
  const loadWeatherData = async (force: boolean = false) => {
    setIsLoading(true);
    try {
      const [live, daily] = await Promise.all([
        getLiveWeatherForCoordinates(targetLat, targetLon, force),
        get5DayForecast(targetLat, targetLon, force),
      ]);
      setCurrentWeather(live);
      setForecast(daily);
      if (onWeatherAlertDetected) {
        onWeatherAlertDetected(live.severeAlert, live.rainfallMm);
      }
    } catch (err) {
      console.warn('[DeviceWeatherWidget] Weather load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWeatherData(false);
  }, [targetLat, targetLon, useDeviceLocation]);

  return (
    <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-xs p-4 sm:p-5 transition-all">
      {/* Top Banner: Location Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-neutral-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-200/70 flex-shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Live Agricultural Forecast
              </span>
              {deviceLoc.status === 'granted' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200 font-mono">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Auto-GPS
                </span>
              )}
            </div>
            <div className="text-sm sm:text-base font-extrabold text-neutral-900 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>{locationLabel}</span>
              <span className="text-xs text-neutral-400 font-mono font-normal">
                ({targetLat.toFixed(2)}°N, {targetLon.toFixed(2)}°E)
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls: Refresh + Plot vs Device Switch + Forecast Toggle */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {activePlot && (
            <button
              type="button"
              onClick={() => setUseDeviceLocation(!useDeviceLocation)}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200"
            >
              {useDeviceLocation ? 'View Farm Plot' : 'View Device GPS'}
            </button>
          )}

          <button
            type="button"
            onClick={() => loadWeatherData(true)}
            disabled={isLoading}
            title="Refresh live weather"
            className="p-2 rounded-xl text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 border border-neutral-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-700" />
            <span>5-Day Outlook</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Current Conditions Bar */}
      {currentWeather && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3.5 text-xs">
          <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-neutral-50/70 border border-neutral-100">
            <Sun className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Temperature</div>
              <div className="font-extrabold text-neutral-900 text-sm font-mono">{currentWeather.tempC}°C</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-neutral-50/70 border border-neutral-100">
            <CloudRain className="w-5 h-5 text-sky-500 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Rain Probability</div>
              <div className="font-extrabold text-neutral-900 text-sm font-mono">{currentWeather.rainProbabilityPercent}%</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-neutral-50/70 border border-neutral-100">
            <Droplets className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Precipitation</div>
              <div className="font-extrabold text-neutral-900 text-sm font-mono">{currentWeather.rainfallMm} mm</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-neutral-50/70 border border-neutral-100">
            <Wind className="w-5 h-5 text-stone-500 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Wind Speed</div>
              <div className="font-extrabold text-neutral-900 text-sm font-mono">{currentWeather.windSpeedKmh} km/h</div>
            </div>
          </div>
        </div>
      )}

      {/* Advisory Bar */}
      {currentWeather && (
        <div className="mt-3 flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/60 text-xs text-emerald-950">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <span className="font-semibold">{currentWeather.description}</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-700 uppercase font-bold">
            Provider: {currentWeather.provider}
          </span>
        </div>
      )}

      {/* Expandable 5-Day Agricultural Forecast Strip */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-neutral-100 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              <span>5-Day Agricultural Work Windows</span>
            </h4>
            <span className="text-[11px] text-neutral-400">OpenWeatherMap / Agro-Meteo Engine</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
            {forecast.map((day, idx) => {
              const isOptimal = day.suitabilityTag === 'optimal';
              const isDanger = day.suitabilityTag === 'danger';

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-2xl border transition-all flex flex-col justify-between space-y-2 ${
                    isDanger
                      ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                      : isOptimal
                      ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-950'
                      : 'bg-amber-50/60 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-xs text-neutral-900">{day.dayName}</div>
                      <div className="text-[10px] text-neutral-500 font-medium">{day.dateStr}</div>
                    </div>
                    {isDanger ? (
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    ) : (
                      <Sun className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    )}
                  </div>

                  <div>
                    <div className="font-extrabold font-mono text-base text-neutral-900">
                      {day.tempMax}° <span className="text-xs font-normal text-neutral-500">/ {day.tempMin}°</span>
                    </div>
                    <div className="text-[11px] font-semibold text-neutral-700 flex items-center gap-1 mt-0.5">
                      <CloudRain className="w-3 h-3 text-sky-600" />
                      <span>{day.rainProbabilityPercent}% ({day.rainfallMm} mm)</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-200/50">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mb-1 ${
                        isDanger
                          ? 'bg-rose-600 text-white'
                          : isOptimal
                          ? 'bg-emerald-700 text-white'
                          : 'bg-amber-500 text-neutral-950'
                      }`}
                    >
                      {isDanger ? 'Rain Threat' : isOptimal ? 'Safe to Harvest' : 'Caution'}
                    </span>
                    <p className="text-[10px] leading-tight text-neutral-600">{day.agriAdvisory}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
