import React, { useState } from 'react';
import { Profile, UserRole } from '../types';
import { appStorage } from '../lib/storage';
import {
  X,
  User,
  Phone,
  MapPin,
  Lock,
  Tractor,
  Sprout,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: Profile) => void;
  initialMode?: 'login' | 'register';
}

const INDIAN_STATES = [
  'Haryana',
  'Punjab',
  'Uttar Pradesh',
  'Madhya Pradesh',
  'Rajasthan',
  'Gujarat',
  'Maharashtra',
  'Bihar',
  'Andhra Pradesh',
  'Karnataka',
  'Tamil Nadu',
  'West Bengal',
  'Telangana',
  'Odisha',
  'Chhattisgarh',
  'Uttarakhand',
  'Himachal Pradesh',
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Form State
  const [phone, setPhone] = useState('');
  const [passwordPin, setPasswordPin] = useState('');
  const [fullName, setFullName] = useState('');
  const [village, setVillage] = useState('');
  const [selectedState, setSelectedState] = useState('Haryana');
  const [selectedRole, setSelectedRole] = useState<UserRole>('borrower');
  const [isProsumer, setIsProsumer] = useState(false);

  // Status feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const res = appStorage.loginUser(phone, passwordPin || undefined);
    if (!res.success || !res.user) {
      setErrorMessage(res.error || 'Login failed. Please verify your mobile number.');
      return;
    }

    setSuccessMessage(`Namaste ${res.user.fullName}! Welcome to FarmGrid.`);
    setTimeout(() => {
      onAuthSuccess(res.user!);
      onClose();
    }, 600);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const roles: UserRole[] = isProsumer
      ? ['borrower', 'lender']
      : [selectedRole];

    const res = appStorage.registerUser({
      fullName,
      phone,
      village,
      state: selectedState,
      roleFlags: roles,
      passwordPin: passwordPin || undefined,
    });

    if (!res.success || !res.user) {
      setErrorMessage(res.error || 'Registration failed. Please check your inputs.');
      return;
    }

    setSuccessMessage(`Account created successfully for ${res.user.fullName}!`);
    setTimeout(() => {
      onAuthSuccess(res.user!);
      onClose();
    }, 600);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-neutral-900/50 backdrop-blur-md overflow-y-auto animate-fade-in"
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
              <Tractor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                {mode === 'login' ? 'Kisan Login' : 'Register New Farmer / Owner'}
              </h2>
              <p className="text-xs text-neutral-500">
                {mode === 'login'
                  ? 'Access your land plots, machinery and bookings'
                  : 'Join the rural cooperative equipment sharing network'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-neutral-100 bg-neutral-50/30 p-1.5 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 rounded-xl transition-all ${
              mode === 'login'
                ? 'bg-white text-emerald-800 shadow-xs border border-neutral-200 font-extrabold'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 rounded-xl transition-all ${
              mode === 'register'
                ? 'bg-white text-emerald-800 shadow-xs border border-neutral-200 font-extrabold'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Sign Up (Register)
          </button>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6">
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Mobile Number
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs font-bold text-neutral-500">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="98765 43210"
                    className="w-full pl-12 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <Phone className="w-4 h-4 text-neutral-400 absolute right-3.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Security PIN / Password (Optional)
                </label>
                <div className="relative flex items-center">
                  <input
                    type="password"
                    maxLength={6}
                    value={passwordPin}
                    onChange={(e) => setPasswordPin(e.target.value)}
                    placeholder="4-digit PIN (if set during sign up)"
                    className="w-full pl-4 pr-10 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <Lock className="w-4 h-4 text-neutral-400 absolute right-3.5 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <span>Log In</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMessage(null);
                  }}
                  className="text-xs font-bold text-emerald-800 hover:underline"
                >
                  New to FarmGrid? Register your farm or machine here
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Your Full Name
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rameshwar Singh"
                    className="w-full pl-4 pr-10 py-2 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <User className="w-4 h-4 text-neutral-400 absolute right-3.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Mobile Number (10 Digits)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs font-bold text-neutral-500">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="98765 43210"
                    className="w-full pl-12 pr-4 py-2 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <Phone className="w-4 h-4 text-neutral-400 absolute right-3.5 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                    Village / Town
                  </label>
                  <input
                    type="text"
                    required
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    placeholder="e.g. Samana"
                    className="w-full px-3.5 py-2 bg-neutral-50 border border-neutral-300 rounded-2xl text-xs sm:text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                    State
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-2xl text-xs sm:text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Your Primary Role in Grid
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('borrower');
                      setIsProsumer(false);
                    }}
                    className={`p-2.5 rounded-2xl border text-left transition-all ${
                      !isProsumer && selectedRole === 'borrower'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-600'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700'
                    }`}
                  >
                    <Sprout className="w-4 h-4 text-emerald-700 mb-1" />
                    <div className="text-xs font-bold">Farmer</div>
                    <div className="text-[10px] text-neutral-500">Need machines</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('lender');
                      setIsProsumer(false);
                    }}
                    className={`p-2.5 rounded-2xl border text-left transition-all ${
                      !isProsumer && selectedRole === 'lender'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-600'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700'
                    }`}
                  >
                    <Tractor className="w-4 h-4 text-emerald-700 mb-1" />
                    <div className="text-xs font-bold">Owner</div>
                    <div className="text-[10px] text-neutral-500">List machines</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsProsumer(true)}
                    className={`p-2.5 rounded-2xl border text-left transition-all ${
                      isProsumer
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-600'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-700 mb-1" />
                    <div className="text-xs font-bold">Both</div>
                    <div className="text-[10px] text-neutral-500">Kisan Prosumer</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Set 4-Digit Security PIN
                </label>
                <div className="relative flex items-center">
                  <input
                    type="password"
                    maxLength={4}
                    value={passwordPin}
                    onChange={(e) => setPasswordPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 1234"
                    className="w-full pl-4 pr-10 py-2 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <Lock className="w-4 h-4 text-neutral-400 absolute right-3.5 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <span>Register & Enter FarmGrid</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage(null);
                  }}
                  className="text-xs font-bold text-emerald-800 hover:underline"
                >
                  Already have an account? Log In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
