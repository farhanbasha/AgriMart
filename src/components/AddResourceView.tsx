import React, { useState, useEffect } from 'react';
import {
  Tractor,
  Users,
  Plane,
  Droplets,
  Truck,
  MapPin,
  PlusCircle,
  CheckCircle2,
  Phone,
  IndianRupee,
  Sparkles,
  ShieldAlert,
  UserCheck,
  Navigation,
  Crosshair,
} from 'lucide-react';
import { ResourceCategory, Resource, Plot, CropStage, Profile } from '../types';
import { appStorage } from '../lib/storage';
import { getDeviceLocation } from '../lib/deviceLocation';

interface AddResourceViewProps {
  onResourceAdded: (resource: Resource) => void;
  onPlotAdded: (plot: Plot) => void;
  onViewExplore: () => void;
  currentUser?: Profile | null;
  onOpenAuthModal?: () => void;
}

type AddTab = 'machinery' | 'labour' | 'services' | 'irrigation' | 'transportation' | 'storage' | 'plot';

export const AddResourceView: React.FC<AddResourceViewProps> = ({
  onResourceAdded,
  onPlotAdded,
  onViewExplore,
  currentUser,
  onOpenAuthModal,
}) => {
  const [activeTab, setActiveTab] = useState<AddTab>('machinery');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Common Resource Form Fields
  const [name, setName] = useState('');
  const [specs, setSpecs] = useState('');
  const [rate, setRate] = useState<number>(500);
  const [rateUnit, setRateUnit] = useState<'per_hour' | 'per_day' | 'per_acre'>('per_hour');
  const [ownerName, setOwnerName] = useState(currentUser?.fullName || '');
  const [ownerPhone, setOwnerPhone] = useState(currentUser?.phone || '');
  const [village, setVillage] = useState(currentUser?.village || '');
  const [state, setState] = useState(currentUser?.state || 'Haryana');
  const [capacityOrWorkers, setCapacityOrWorkers] = useState('');
  const [operatingHours, setOperatingHours] = useState('06:00 AM - 08:00 PM');
  const [maxRadiusKm, setMaxRadiusKm] = useState<number>(30);

  // Machine Base Coordinates (Auto-detected via GPS + Manual Override)
  const [machineLat, setMachineLat] = useState<number>(() => getDeviceLocation().latitude || 29.6857);
  const [machineLng, setMachineLng] = useState<number>(() => getDeviceLocation().longitude || 76.9905);
  const [isDetectingMachineGps, setIsDetectingMachineGps] = useState(false);
  const [machineGpsStatus, setMachineGpsStatus] = useState<string>('');

  // Plot Form Fields (Auto-detected via GPS + Manual Override)
  const [plotName, setPlotName] = useState('');
  const [acres, setAcres] = useState<number>(5);
  const [acreUnit, setAcreUnit] = useState<'acre' | 'bigha'>('acre');
  const [cropType, setCropType] = useState('Basmati Rice');
  const [cropStage, setCropStage] = useState<CropStage>('Harvest-Ready');
  const [plotLat, setPlotLat] = useState<number>(() => getDeviceLocation().latitude || 29.6857);
  const [plotLng, setPlotLng] = useState<number>(() => getDeviceLocation().longitude || 76.9905);
  const [isDetectingPlotGps, setIsDetectingPlotGps] = useState(false);
  const [plotGpsStatus, setPlotGpsStatus] = useState<string>('');

  // Detect Machine Location
  const handleDetectMachineGPS = (autoFillVillage = false) => {
    setIsDetectingMachineGps(true);
    setMachineGpsStatus('Acquiring machine GPS location...');
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(5));
          const lng = Number(pos.coords.longitude.toFixed(5));
          const acc = Math.round(pos.coords.accuracy || 20);
          setMachineLat(lat);
          setMachineLng(lng);
          setIsDetectingMachineGps(false);
          setMachineGpsStatus(`Machine GPS Attached: ${lat}°N, ${lng}°E (±${acc}m accuracy)`);
          if (autoFillVillage) {
            const dev = getDeviceLocation();
            if (dev.placeName && !dev.placeName.includes('°')) setVillage(dev.placeName);
            if (dev.stateName) setState(dev.stateName);
          }
        },
        (err) => {
          console.warn('[AddResourceView] Machine GPS error:', err.message);
          const dev = getDeviceLocation();
          setMachineLat(dev.latitude || 29.6857);
          setMachineLng(dev.longitude || 76.9905);
          setIsDetectingMachineGps(false);
          setMachineGpsStatus('GPS fix unavailable. Using device default (you can edit coordinates manually).');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    } else {
      const dev = getDeviceLocation();
      setMachineLat(dev.latitude || 29.6857);
      setMachineLng(dev.longitude || 76.9905);
      setIsDetectingMachineGps(false);
      setMachineGpsStatus('Geolocation not supported by browser. Enter coordinates manually.');
    }
  };

  // Detect Plot Location
  const handleDetectPlotGPS = (autoFillVillage = false) => {
    setIsDetectingPlotGps(true);
    setPlotGpsStatus('Acquiring plot GPS location...');
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(5));
          const lng = Number(pos.coords.longitude.toFixed(5));
          const acc = Math.round(pos.coords.accuracy || 20);
          setPlotLat(lat);
          setPlotLng(lng);
          setIsDetectingPlotGps(false);
          setPlotGpsStatus(`Field GPS Attached: ${lat}°N, ${lng}°E (±${acc}m accuracy)`);
          if (autoFillVillage) {
            const dev = getDeviceLocation();
            if (dev.placeName && !dev.placeName.includes('°')) setVillage(dev.placeName);
            if (dev.stateName) setState(dev.stateName);
          }
        },
        (err) => {
          console.warn('[AddResourceView] Plot GPS error:', err.message);
          const dev = getDeviceLocation();
          setPlotLat(dev.latitude || 29.6857);
          setPlotLng(dev.longitude || 76.9905);
          setIsDetectingPlotGps(false);
          setPlotGpsStatus('GPS fix unavailable. Using device default (you can edit coordinates manually).');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    } else {
      const dev = getDeviceLocation();
      setPlotLat(dev.latitude || 29.6857);
      setPlotLng(dev.longitude || 76.9905);
      setIsDetectingPlotGps(false);
      setPlotGpsStatus('Geolocation not supported by browser. Enter coordinates manually.');
    }
  };

  // Automatically trigger location detection on entry or tab change
  useEffect(() => {
    if (activeTab === 'plot') {
      handleDetectPlotGPS(true);
    } else {
      handleDetectMachineGPS(true);
    }
  }, [activeTab]);

  // Keep owner fields updated with currentUser
  useEffect(() => {
    if (currentUser) {
      setOwnerName(currentUser.fullName);
      setOwnerPhone(currentUser.phone);
      if (currentUser.village) setVillage(currentUser.village);
      if (currentUser.state) setState(currentUser.state);
    }
  }, [currentUser]);

  const handleResetForm = () => {
    setName('');
    setSpecs('');
    setCapacityOrWorkers('');
  };

  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }

    if (activeTab === 'plot') {
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
        acreUnit,
        cropType: cropType.trim() || 'Wheat',
        cropStage,
        latitude: Number(plotLat) || 29.6857,
        longitude: Number(plotLng) || 76.9905,
        weather: {
          rainfallMm: 4.0,
          rainProbabilityPercent: 20,
          severeAlert: false,
          description: 'Normal seasonal field conditions',
        },
      });

      onPlotAdded(newPlot);
      setSuccessMsg(`Farm Plot "${newPlot.plotName}" added successfully for ${farmerName}!`);
      setPlotName('');
      setTimeout(() => setSuccessMsg(null), 4000);
      return;
    }

    if (!name.trim()) return;

    const category: ResourceCategory =
      activeTab === 'labour'
        ? 'labour'
        : activeTab === 'services'
        ? 'services'
        : activeTab === 'irrigation'
        ? 'irrigation'
        : activeTab === 'transportation'
        ? 'transportation'
        : activeTab === 'storage'
        ? 'storage'
        : 'machinery';

    // Strict owner association:
    const ownerId = currentUser.id;
    const finalOwnerName = currentUser.fullName;
    const finalOwnerPhone = currentUser.phone || ownerPhone.trim() || '';

    const newResource = appStorage.addResource({
      ownerId,
      ownerName: finalOwnerName,
      ownerPhone: finalOwnerPhone,
      category,
      name: name.trim(),
      specs: specs.trim() || (category === 'labour' ? 'Skilled agricultural team' : 'Ready for farm work'),
      hourlyRate: Number(rate) || 400,
      rateUnit,
      conditionRating: 4.9,
      operationalStatus: 'available',
      village: village.trim() || 'Shivamogga',
      state: state.trim() || 'Karnataka',
      capacityOrWorkers: capacityOrWorkers.trim() || undefined,
      operatingHours,
      maxRadiusKm: Number(maxRadiusKm) || 30,
      baseLat: Number(machineLat) || 29.6857,
      baseLng: Number(machineLng) || 76.9905,
    });

    onResourceAdded(newResource);
    setSuccessMsg(`"${newResource.name}" registered to ${finalOwnerName}'s fleet! It is now browsable in Explore.`);
    handleResetForm();
    setTimeout(() => setSuccessMsg(null), 4500);
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6 w-full max-w-full min-w-0 overflow-hidden">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-neutral-900 text-white rounded-3xl p-5 sm:p-8 shadow-md border border-emerald-700/40 relative overflow-hidden w-full max-w-full min-w-0">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3 border border-emerald-500/30">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Kisan Seva Platform | Community Equipment Registry
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
            List Equipment, Services or Farm Land
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/85 leading-relaxed">
            Register your tractors, combine harvesters, farm labour crews, irrigation tubewell sets, drone sprayers, or agricultural plots. 
            All uploaded equipment is privately owned by your account and made discoverable to nearby farmers.
          </p>
        </div>
      </div>

      {/* Guest Notice if not logged in */}
      {!currentUser && (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-950 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <span>
              You are currently adding as a guest. Please log in or register with your mobile number so this equipment remains in your private owner fleet!
            </span>
          </div>
          {onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold whitespace-nowrap self-start sm:self-auto"
            >
              Log In Now
            </button>
          )}
        </div>
      )}

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between animate-fade-in shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="text-sm font-semibold">{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={onViewExplore}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline px-2 py-1"
          >
            View in Explore →
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="w-full max-w-full min-w-0 overflow-x-auto pb-2 scrollbar-none border-b border-neutral-200 flex items-center gap-2 -mx-3 px-3 sm:mx-0 sm:px-0">
        <button
          type="button"
          onClick={() => {
            setActiveTab('machinery');
            setRateUnit('per_hour');
            setRate(550);
          }}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-all ${
            activeTab === 'machinery'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
          }`}
        >
          <Tractor className="w-4 h-4" />
          <span>Tractor & Machinery</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('labour');
            setRateUnit('per_day');
            setRate(2500);
          }}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-all ${
            activeTab === 'labour'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Farm Labour</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('services');
            setRateUnit('per_acre');
            setRate(350);
          }}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-all ${
            activeTab === 'services'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
          }`}
        >
          <Plane className="w-4 h-4" />
          <span>Drone & Services</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('irrigation');
            setRateUnit('per_hour');
            setRate(200);
          }}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-all ${
            activeTab === 'irrigation'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
          }`}
        >
          <Droplets className="w-4 h-4" />
          <span>Pumps & Irrigation</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('transportation');
            setRateUnit('per_hour');
            setRate(350);
          }}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-all ${
            activeTab === 'transportation'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Trolley & Transport</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('plot')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-all ${
            activeTab === 'plot'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>My Farm Land</span>
        </button>
      </div>

      {/* Main Grid: Form + Live Card Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full max-w-full min-w-0">
        {/* Left Form */}
        <form
          onSubmit={handleAddResource}
          className="lg:col-span-7 bg-white rounded-3xl p-4 sm:p-7 shadow-sm border border-neutral-200 space-y-5 w-full max-w-full min-w-0 overflow-hidden"
        >
          {activeTab === 'plot' ? (
            /* FARM PLOT FORM */
            <>
              <div className="border-b border-neutral-100 pb-3">
                <h2 className="text-base font-bold text-neutral-900">Add Your Farm Land / Plot</h2>
                <p className="text-xs text-neutral-500">
                  {currentUser
                    ? `This plot will be registered exclusively to ${currentUser.fullName}.`
                    : 'Register your field to get prioritized harvesting, sowing, and rain alerts.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Field / Plot Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Subhash Farm - Basmati Field, Canal Road"
                  value={plotName}
                  onChange={(e) => setPlotName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Land Area *
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    required
                    value={acres}
                    onChange={(e) => setAcres(parseFloat(e.target.value) || 1)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Unit</label>
                  <select
                    value={acreUnit}
                    onChange={(e) => setAcreUnit(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="acre">Acres</option>
                    <option value="bigha">Bigha</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Crop Sown *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Basmati Rice, Wheat, Mustard"
                    value={cropType}
                    onChange={(e) => setCropType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Crop Stage
                  </label>
                  <select
                    value={cropStage}
                    onChange={(e) => setCropStage(e.target.value as CropStage)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="Harvest-Ready">Harvest-Ready</option>
                    <option value="Ripening">Ripening</option>
                    <option value="Flowering">Flowering</option>
                    <option value="Vegetative">Vegetative</option>
                    <option value="Post-Harvest">Post-Harvest (Tillage)</option>
                  </select>
                </div>
              </div>

              {/* Field GPS Coordinates (Auto-detected via GPS + Manual Override) */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/90 rounded-2xl space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                    <Navigation className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                    <span>Field GPS Coordinates (Auto-Detected)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDetectPlotGPS(true)}
                    disabled={isDetectingPlotGps}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-[11px] font-bold transition-all shadow-2xs self-start sm:self-auto"
                  >
                    <Crosshair className={`w-3 h-3 text-emerald-700 ${isDetectingPlotGps ? 'animate-spin' : ''}`} />
                    <span>{isDetectingPlotGps ? 'Locating...' : 'Re-detect GPS'}</span>
                  </button>
                </div>

                {plotGpsStatus && (
                  <p className="text-[11px] text-emerald-800/90 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                    <span>{plotGpsStatus}</span>
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2.5">
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
                  Detected automatically via GPS. You can also modify coordinates manually to pinpoint your exact plot.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Village / Tehsil
                  </label>
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
          ) : (
            /* RESOURCE FORM (Machinery, Labour, Service, Irrigation, Transport) */
            <>
              <div className="border-b border-neutral-100 pb-3">
                <h2 className="text-base font-bold text-neutral-900">
                  {activeTab === 'labour'
                    ? 'Add Farm Labour Group'
                    : activeTab === 'services'
                    ? 'Add Agricultural Service / Drone'
                    : activeTab === 'irrigation'
                    ? 'Add Irrigation Pump / Set'
                    : activeTab === 'transportation'
                    ? 'Add Transport / Trolley'
                    : 'Add Tractor or Machinery'}
                </h2>
                <p className="text-xs text-neutral-500">
                  {currentUser
                    ? `This equipment will be added exclusively to ${currentUser.fullName}'s owner fleet.`
                    : 'Fill in details. Other farmers can book your machine when idle.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  {activeTab === 'labour'
                    ? 'Team Name *'
                    : activeTab === 'services'
                    ? 'Service Name *'
                    : 'Machine / Model Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    activeTab === 'labour'
                      ? 'e.g. Kisan Sahyog Harvest Crew (8 Persons)'
                      : activeTab === 'services'
                      ? 'e.g. Garuda Kisan Drone Spraying Service'
                      : activeTab === 'irrigation'
                      ? 'e.g. Kirloskar 10 HP Diesel Mobile Pump'
                      : activeTab === 'transportation'
                      ? 'e.g. Hydraulic 5-Ton Tractor Trolley'
                      : 'e.g. Mahindra 575 DI Sarpanch / John Deere 5310'
                  }
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Rental Rate (₹) *
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                    <input
                      type="number"
                      min="50"
                      step="10"
                      required
                      value={rate}
                      onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Rate Unit</label>
                  <select
                    value={rateUnit}
                    onChange={(e) => setRateUnit(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="per_hour">per Hour</option>
                    <option value="per_day">per Day</option>
                    <option value="per_acre">per Acre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Specifications & Equipment Features
                </label>
                <input
                  type="text"
                  placeholder={
                    activeTab === 'labour'
                      ? 'e.g. Experienced in manual sickle harvesting, thresher bagging'
                      : activeTab === 'services'
                      ? 'e.g. 10L capacity, Nano Urea uniform spray, covers 25 acres/day'
                      : 'e.g. 45 HP, Dual Clutch, Rotavator & 9-tyne cultivator included'
                  }
                  value={specs}
                  onChange={(e) => setSpecs(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Machine Base Coordinates (Auto-detected via GPS + Manual Override) */}
              <div className="p-3.5 bg-neutral-50 border border-neutral-200/90 rounded-2xl space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900">
                    <Navigation className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                    <span>Machine Base Depot Location (Auto-Detected GPS)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDetectMachineGPS(true)}
                    disabled={isDetectingMachineGps}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-neutral-100 text-emerald-800 border border-neutral-300 rounded-xl text-[11px] font-bold transition-all shadow-2xs self-start sm:self-auto"
                  >
                    <Crosshair className={`w-3 h-3 text-emerald-700 ${isDetectingMachineGps ? 'animate-spin' : ''}`} />
                    <span>{isDetectingMachineGps ? 'Locating...' : 'Re-detect GPS'}</span>
                  </button>
                </div>

                {machineGpsStatus && (
                  <p className="text-[11px] text-emerald-800 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                    <span>{machineGpsStatus}</span>
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-0.5">
                      Base Latitude (°N) *
                    </label>
                    <input
                      type="number"
                      step="0.00001"
                      min="-90"
                      max="90"
                      required
                      value={machineLat}
                      onChange={(e) => setMachineLat(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-neutral-300 text-xs font-mono bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-0.5">
                      Base Longitude (°E) *
                    </label>
                    <input
                      type="number"
                      step="0.00001"
                      min="-180"
                      max="180"
                      required
                      value={machineLng}
                      onChange={(e) => setMachineLng(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-neutral-300 text-xs font-mono bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-neutral-500">
                  Taken automatically from your device GPS when adding. You can adjust latitude and longitude manually.
                </p>
              </div>

              {/* Service Radius & Haversine Distance Guarantee */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-neutral-900">
                    Max Serviceable Distance *
                  </label>
                  <span className="text-xs font-extrabold font-mono text-emerald-900 bg-white px-2.5 py-0.5 rounded-lg border border-amber-200">
                    {maxRadiusKm} km Radius
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={maxRadiusKm}
                    onChange={(e) => setMaxRadiusKm(parseInt(e.target.value) || 30)}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <input
                    type="number"
                    min="5"
                    max="150"
                    value={maxRadiusKm}
                    onChange={(e) => setMaxRadiusKm(parseInt(e.target.value) || 30)}
                    className="w-20 px-2.5 py-1.5 rounded-xl border border-neutral-300 text-xs font-bold font-mono text-center bg-white"
                  />
                  <span className="text-xs font-bold text-neutral-500">km</span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mr-1">Presets:</span>
                  {[15, 30, 40, 50, 75].map((km) => (
                    <button
                      key={km}
                      type="button"
                      onClick={() => setMaxRadiusKm(km)}
                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold font-mono transition-all ${
                        maxRadiusKm === km
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
                      }`}
                    >
                      {km} km
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-amber-950/90 leading-relaxed pt-1">
                  <strong>Haversine Formula Rule:</strong> Farmers whose land is further than <strong>{maxRadiusKm} km</strong> from this machine depot will <strong>not be able to see this listing</strong>. Only nearby farmers within this radius will discover and request your equipment.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    {activeTab === 'labour' ? 'Number of Workers' : 'Power / Capacity'}
                  </label>
                  <input
                    type="text"
                    placeholder={activeTab === 'labour' ? 'e.g. 8 Workers' : 'e.g. 50 HP / 5 Ton'}
                    value={capacityOrWorkers}
                    onChange={(e) => setCapacityOrWorkers(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Daily Operating Window
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 06:00 AM - 08:00 PM"
                    value={operatingHours}
                    onChange={(e) => setOperatingHours(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Owner Name / Contact Person
                  </label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Village / Town
                  </label>
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {/* Submit Button */}
          <div className="pt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetForm}
              className="text-xs text-neutral-500 hover:text-neutral-800 font-medium px-3 py-2"
            >
              Clear
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-2xl shadow-md transition-all active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>
                {activeTab === 'plot' ? 'Save Farm Land' : 'Save & List Resource'}
              </span>
            </button>
          </div>
        </form>

        {/* Right Live Card Preview */}
        <div className="lg:col-span-5 space-y-4 w-full max-w-full min-w-0 overflow-hidden">
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
            Live Preview
          </div>

          {activeTab === 'plot' ? (
            /* Plot Preview Card */
            <div className="bg-white rounded-3xl p-6 border-2 border-emerald-500/40 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    Farm Land
                  </span>
                  <h3 className="text-base font-bold text-neutral-900 mt-1">
                    {plotName || 'Subhash Farm - Basmati Field'}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-emerald-800">
                    {acres} {acreUnit === 'acre' ? 'Acres' : 'Bigha'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl space-y-1 text-xs">
                <div className="text-neutral-700">
                  <span className="font-semibold text-neutral-900">Crop:</span> {cropType}
                </div>
                <div className="text-neutral-700">
                  <span className="font-semibold text-neutral-900">Stage:</span>{' '}
                  <span className="text-emerald-700 font-semibold">{cropStage}</span>
                </div>
                <div className="text-neutral-500">
                  <MapPin className="w-3.5 h-3.5 inline mr-1 text-neutral-400" />
                  {village || 'Shivamogga'}, {state || 'Karnataka'}
                </div>
                <div className="text-emerald-800 font-mono text-[11px] pt-1 flex items-center gap-1">
                  <Crosshair className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>GPS: {Number(plotLat).toFixed(4)}°N, {Number(plotLng).toFixed(4)}°E</span>
                </div>
              </div>

              <div className="text-[11px] text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                Weather alerts & automated fair priority will be linked to this plot.
              </div>
            </div>
          ) : (
            /* Resource Preview Card */
            <div className="bg-white rounded-3xl p-6 border-2 border-emerald-500/40 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    {activeTab}
                  </span>
                  <h3 className="text-base font-bold text-neutral-900">
                    {name || 'Mahindra 575 DI Sarpanch'}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {specs || '45 HP - Rotavator & Cultivator'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-emerald-800 flex items-center justify-end">
                    <span>₹{rate}</span>
                    <span className="text-xs font-normal text-neutral-500 ml-1">
                      /{rateUnit.replace('per_', '')}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-600 font-medium">Available</span>
                </div>
              </div>

              {capacityOrWorkers && (
                <div className="text-xs font-medium text-neutral-700 bg-neutral-100 px-3 py-1.5 rounded-xl inline-block">
                  Capacity: {capacityOrWorkers}
                </div>
              )}

              {/* GPS Base Depot & Haversine Radius Badges */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-1.5 text-xs text-neutral-700 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 font-mono">
                  <Crosshair className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Depot GPS: <strong>{Number(machineLat).toFixed(4)}°N, {Number(machineLng).toFixed(4)}°E</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-amber-950 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80">
                  <Navigation className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <span>Max Serviceable: <strong>{maxRadiusKm} km</strong> (Haversine cutoff)</span>
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{village || 'Shivamogga'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-neutral-700 font-medium">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{ownerPhone || '+91 98765 43210'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Helper Tips */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 space-y-1.5">
            <div className="font-bold flex items-center gap-1 text-amber-900">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Ownership & Instant Search Suggestions
            </div>
            <p className="text-amber-800 leading-relaxed">
              As soon as you save, this machinery is attached exclusively to your owner fleet dashboard, while appearing in community search for other farmers to rent.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
