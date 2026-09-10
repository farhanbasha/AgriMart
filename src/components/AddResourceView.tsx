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
} from 'lucide-react';
import { ResourceCategory, Resource, Plot, CropStage, Profile } from '../types';
import { appStorage } from '../lib/storage';

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

  // Plot Form Fields
  const [plotName, setPlotName] = useState('');
  const [acres, setAcres] = useState<number>(5);
  const [acreUnit, setAcreUnit] = useState<'acre' | 'bigha'>('acre');
  const [cropType, setCropType] = useState('Basmati Rice');
  const [cropStage, setCropStage] = useState<CropStage>('Harvest-Ready');

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

    if (activeTab === 'plot') {
      if (!plotName.trim()) return;
      const farmerId = currentUser?.id || 'guest-farmer';
      const farmerName = currentUser?.fullName || ownerName.trim() || 'Community Farmer';

      const newPlot = appStorage.addPlot({
        farmerId,
        farmerName,
        plotName: plotName.trim(),
        village: village.trim() || currentUser?.village || 'Karnal',
        state: state.trim() || currentUser?.state || 'Haryana',
        acres: Number(acres) || 1,
        acreUnit,
        cropType: cropType.trim() || 'Wheat',
        cropStage,
        latitude: 29.68,
        longitude: 76.99,
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
    const ownerId = currentUser?.id || 'guest-owner';
    const finalOwnerName = currentUser?.fullName || ownerName.trim() || 'Equipment Owner';
    const finalOwnerPhone = currentUser?.phone || ownerPhone.trim() || '';

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
      village: village.trim() || 'Karnal',
      state: state.trim() || 'Haryana',
      capacityOrWorkers: capacityOrWorkers.trim() || undefined,
      operatingHours,
      maxRadiusKm: Number(maxRadiusKm) || 30,
      baseLat: 29.68,
      baseLng: 76.99,
    });

    onResourceAdded(newResource);
    setSuccessMsg(`"${newResource.name}" registered to ${finalOwnerName}'s fleet! It is now browsable in Explore.`);
    handleResetForm();
    setTimeout(() => setSuccessMsg(null), 4500);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-neutral-900 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-emerald-700/40 relative overflow-hidden">
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
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-950 text-xs flex items-center justify-between gap-3">
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
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold whitespace-nowrap"
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
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-neutral-200">
        <button
          type="button"
          onClick={() => {
            setActiveTab('machinery');
            setRateUnit('per_hour');
            setRate(550);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form */}
        <form
          onSubmit={handleAddResource}
          className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-neutral-200 space-y-5"
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
                    Service Radius (km)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={maxRadiusKm}
                    onChange={(e) => setMaxRadiusKm(parseInt(e.target.value) || 30)}
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
        <div className="lg:col-span-5 space-y-4">
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
                  {village || 'Karnal'}, {state || 'Haryana'}
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

              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{village || 'Karnal'}</span>
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
