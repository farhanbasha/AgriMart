/**
 * AgriMart Automatic Device Geolocation Service
 *
 * Automatically triggers browser geolocation on entry (without requiring manual button clicks).
 * Reverse-geocodes coordinates using OpenWeatherMap Reverse Geocoding API to resolve place names.
 */

export interface DeviceLocationState {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  placeName: string;
  stateName?: string;
  countryCode: string;
  status: 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';
  errorMessage?: string;
  updatedAt: string;
}

// Default regional fallback: Shivamogga, Karnataka (Agricultural Hub)
const DEFAULT_LOCATION: DeviceLocationState = {
  latitude: 29.6857,
  longitude: 76.9905,
  accuracyMeters: 50,
  placeName: 'Shivamogga',
  stateName: 'Karnataka',
  countryCode: 'IN',
  status: 'idle',
  updatedAt: new Date().toISOString(),
};

let currentLocation: DeviceLocationState = { ...DEFAULT_LOCATION };
type LocationListener = (loc: DeviceLocationState) => void;
const listeners = new Set<LocationListener>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener(currentLocation);
    } catch (err) {
      console.warn('[DeviceLocation] Listener error:', err);
    }
  });
}

export function subscribeDeviceLocation(listener: LocationListener): () => void {
  listeners.add(listener);
  listener(currentLocation);
  return () => {
    listeners.delete(listener);
  };
}

export function getDeviceLocation(): DeviceLocationState {
  return currentLocation;
}

/**
 * Reverse geocodes coordinates using OpenWeatherMap reverse geocoding API.
 */
async function reverseGeocodeCoords(lat: number, lon: number): Promise<{ placeName: string; stateName?: string }> {
  const env = (import.meta as any).env || {};
  const apiKey = env.VITE_OPENWEATHER_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_API_KEY') {
    return { placeName: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`, stateName: 'Local Farm' };
  }

  try {
    const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      return {
        placeName: first.name || `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`,
        stateName: first.state || undefined,
      };
    }
  } catch (err) {
    console.warn('[DeviceLocation] Reverse geocode notice:', err);
  }

  return { placeName: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`, stateName: 'Local Field' };
}

/**
 * Automatically requests browser location when entering the website.
 * The browser prompts the user to allow location access; upon approval,
 * coordinates and resolved place name are populated immediately.
 */
export function initAutoDeviceLocation(): Promise<DeviceLocationState> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    currentLocation = {
      ...currentLocation,
      status: 'unavailable',
      errorMessage: 'Geolocation is not supported by this browser.',
      updatedAt: new Date().toISOString(),
    };
    notifyListeners();
    return Promise.resolve(currentLocation);
  }

  currentLocation = {
    ...currentLocation,
    status: 'requesting',
    updatedAt: new Date().toISOString(),
  };
  notifyListeners();

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const { placeName, stateName } = await reverseGeocodeCoords(latitude, longitude);

        currentLocation = {
          latitude: Number(latitude.toFixed(5)),
          longitude: Number(longitude.toFixed(5)),
          accuracyMeters: Math.round(accuracy || 20),
          placeName,
          stateName,
          countryCode: 'IN',
          status: 'granted',
          updatedAt: new Date().toISOString(),
        };

        notifyListeners();
        resolve(currentLocation);
      },
      (err) => {
        console.warn('[DeviceLocation] Geolocation permission status:', err.message);
        currentLocation = {
          ...currentLocation,
          status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
          errorMessage: err.message,
          updatedAt: new Date().toISOString(),
        };
        notifyListeners();
        resolve(currentLocation);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}
