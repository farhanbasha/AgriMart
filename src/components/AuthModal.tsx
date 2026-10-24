import React, { useState, useEffect } from 'react';
import { Profile, UserRole } from '../types';
import { appStorage } from '../lib/storage';
import {
  loginViaBackend,
  registerViaBackend,
  updateProfileViaBackend,
  setStoredJwtToken,
} from '../lib/api';
import {
  signInWithGoogleOAuth,
  dbUpsertProfile,
  getSupabaseClient,
  supabaseSignOut,
  dbCheckCredentialConflict,
} from '../lib/supabase';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Lock,
  Tractor,
  Sprout,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Check,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: Profile) => void;
  initialMode?: 'login' | 'register' | 'complete-profile';
  initialUser?: Profile | null;
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
  initialUser = null,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'complete-profile'>(initialMode);

  // Form Fields
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [village, setVillage] = useState('');
  const [selectedState, setSelectedState] = useState('Haryana');
  const [selectedRole, setSelectedRole] = useState<UserRole>('borrower');
  const [isProsumer, setIsProsumer] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Status feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync mode and initialUser when props change
  useEffect(() => {
    setMode(initialMode);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (initialUser) {
      if (initialUser.fullName) setFullName(initialUser.fullName);
      if (initialUser.email) setEmail(initialUser.email);
      if (initialUser.phone) {
        setPhone(initialUser.phone.replace('+91', '').trim());
      }
      if (initialUser.village) setVillage(initialUser.village);
      if (initialUser.state) setSelectedState(initialUser.state);
      if (initialUser.roleFlags) {
        if (initialUser.roleFlags.includes('borrower') && initialUser.roleFlags.includes('lender')) {
          setIsProsumer(true);
        } else if (initialUser.roleFlags.includes('lender')) {
          setSelectedRole('lender');
          setIsProsumer(false);
        } else {
          setSelectedRole('borrower');
          setIsProsumer(false);
        }
      }
    }
  }, [initialUser]);

  if (!isOpen) return null;

  // ----------------------------------------------------------------------------
  // 1. LOGIN SUBMIT HANDLER
  // ----------------------------------------------------------------------------
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMessage(
        'You are currently offline. An active online connection is strictly required to log in to AgriMart.'
      );
      return;
    }

    const cleanIdentifier = loginIdentifier.trim();
    if (!cleanIdentifier) {
      setErrorMessage('Please enter your mobile number or email address.');
      return;
    }

    setIsLoading(true);

    try {
      // Clear any conflicting stale Google session from Supabase
      await supabaseSignOut();

      const backendRes = await loginViaBackend(cleanIdentifier, password || undefined);
      setIsLoading(false);

      if (backendRes.success && backendRes.user) {
        backendRes.user.authProvider = 'local';
        // Persist directly to Supabase profiles to ensure synchronization
        await dbUpsertProfile(backendRes.user);

        appStorage.setCurrentUser(backendRes.user);
        const allUsers = appStorage.getUsers().filter((u) => u.id !== backendRes.user!.id);
        appStorage.saveUsers([backendRes.user, ...allUsers]);

        setSuccessMessage(`Namaste ${backendRes.user.fullName}! Welcome to AgriMart.`);
        setTimeout(() => {
          onAuthSuccess(backendRes.user!);
          onClose();
        }, 500);
        return;
      }

      setErrorMessage(
        backendRes.error || 'Login failed. Please verify your mobile number / email and password.'
      );
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(
        err.message || 'Unable to connect to authentication server. Please verify backend is running.'
      );
    }
  };

  // ----------------------------------------------------------------------------
  // 2. REGISTER SUBMIT HANDLER
  // ----------------------------------------------------------------------------
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMessage(
        'You are currently offline. An active online connection is strictly required to register an account.'
      );
      return;
    }

    const cleanPhone = phone.trim().replace(/\D/g, '');
    const cleanEmail = email.trim();

    // Flexible credential requirement: at least one of phone or email is required
    if (!cleanPhone && !cleanEmail) {
      setErrorMessage('Please provide either a mobile number or email address (or both) to register.');
      return;
    }

    if (cleanPhone && cleanPhone.length !== 10) {
      setErrorMessage('Mobile Number must be exactly 10 digits.');
      return;
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Please create a password with at least 6 characters.');
      return;
    }

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!village.trim()) {
      setErrorMessage('Please enter your Village or Town to match with nearby machinery.');
      return;
    }

    const roles: UserRole[] = isProsumer ? ['borrower', 'lender'] : [selectedRole];
    setIsLoading(true);

    try {
      // 1. Pre-flight check: verify email or phone does not already exist
      const conflictCheck = await dbCheckCredentialConflict({
        email: cleanEmail || undefined,
        phone: cleanPhone ? (cleanPhone.startsWith('91') ? `+${cleanPhone}` : `+91${cleanPhone}`) : undefined,
      });

      if (conflictCheck.conflict) {
        setIsLoading(false);
        setErrorMessage(
          conflictCheck.message ||
            'This email or mobile number is already in use. Please choose a different one or log in.'
        );
        return;
      }

      // Clear any conflicting stale Google session from Supabase
      await supabaseSignOut();

      const backendRes = await registerViaBackend({
        fullName: fullName.trim(),
        phone: cleanPhone || undefined,
        email: cleanEmail || undefined,
        village: village.trim(),
        state: selectedState,
        password: password,
        roleFlags: roles,
      });

      setIsLoading(false);

      if (backendRes.success && backendRes.user) {
        backendRes.user.authProvider = 'local';
        // Persist directly to Supabase profiles with the Bcrypt hash from backend (never plain text!)
        const userToSync: Profile = {
          ...backendRes.user,
          passwordHash: backendRes.user.passwordHash || backendRes.user.password_hash || undefined,
        };
        await dbUpsertProfile(userToSync);

        appStorage.setCurrentUser(backendRes.user);
        const allUsers = appStorage.getUsers().filter((u) => u.id !== backendRes.user!.id);
        appStorage.saveUsers([backendRes.user, ...allUsers]);

        setSuccessMessage(`Account created successfully for ${backendRes.user.fullName}!`);
        setTimeout(() => {
          onAuthSuccess(backendRes.user!);
          onClose();
        }, 500);
        return;
      }

      setErrorMessage(
        backendRes.error || 'Registration failed. Please check your inputs and try again.'
      );
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(
        err.message || 'Unable to reach AgriMart registration server. Please verify backend is running.'
      );
    }
  };

  // ----------------------------------------------------------------------------
  // 3. COMPLETE PROFILE SUBMIT HANDLER (Google OAuth Onboarding)
  // ----------------------------------------------------------------------------
  const handleCompleteProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!village.trim()) {
      setErrorMessage('Please enter your Village / Town to enable distance and equipment calculations.');
      return;
    }

    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (cleanPhone && cleanPhone.length !== 10) {
      setErrorMessage('Mobile Number must be 10 digits if provided.');
      return;
    }

    setIsLoading(true);
    const roles: UserRole[] = isProsumer ? ['borrower', 'lender'] : [selectedRole];
    const targetId = initialUser?.id || `usr-g-${Date.now()}`;
    const targetEmail = initialUser?.email || email.trim() || undefined;
    const phoneWithCountry = cleanPhone ? `+91${cleanPhone}` : initialUser?.phone || undefined;

    // Check if entered optional phone number is already registered to another user
    if (phoneWithCountry) {
      const conflictCheck = await dbCheckCredentialConflict({
        phone: phoneWithCountry,
        excludeUserId: targetId,
      });
      if (conflictCheck.conflict) {
        setIsLoading(false);
        setErrorMessage(
          conflictCheck.message ||
            'This mobile number is already in use by another account. Please use a different phone number.'
        );
        return;
      }
    }

    const completedProfile: Profile = {
      id: targetId,
      fullName: fullName.trim(),
      phone: phoneWithCountry,
      email: targetEmail,
      village: village.trim(),
      state: selectedState,
      avatarUrl: initialUser?.avatarUrl,
      trustScore: 100,
      roleFlags: roles,
      roles: Array.from(new Set([...roles, isProsumer ? 'prosumer' : selectedRole])),
      authProvider: 'google',
    };

    try {
      // 1. Direct and guaranteed upsert to Supabase profiles database table
      const upsertResult = await dbUpsertProfile(completedProfile);
      const c = getSupabaseClient();

      if (!upsertResult && c) {
        // Fallback explicit query to diagnose or retry
        const { error: directError } = await c.from('profiles').upsert(
          {
            id: completedProfile.id,
            full_name: completedProfile.fullName,
            email: completedProfile.email || null,
            phone: completedProfile.phone || null,
            village: completedProfile.village,
            state: completedProfile.state,
            avatar_url: completedProfile.avatarUrl || null,
            trust_score: 100,
            role_flags: completedProfile.roleFlags,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

        if (directError) {
          console.error('[Supabase Save Failure]:', directError);
          setErrorMessage(`Database Save Error: ${directError.message}`);
          setIsLoading(false);
          return;
        }
      }

      // 2. Update Supabase Auth user metadata so session caches the village
      if (c) {
        await c.auth
          .updateUser({
            data: {
              full_name: completedProfile.fullName,
              village: completedProfile.village,
              state: completedProfile.state,
              phone: completedProfile.phone,
              role_flags: completedProfile.roleFlags,
            },
          })
          .catch((err) => console.warn('[Supabase] metadata update notice:', err));
      }

      // 3. Update localStorage cache so subsequent reloads never prompt again
      appStorage.setCurrentUser(completedProfile);
      const allUsers = appStorage.getUsers().filter((u) => u.id !== completedProfile.id);
      appStorage.saveUsers([completedProfile, ...allUsers]);

      // 4. Also sync with FastAPI backend in the background
      try {
        await updateProfileViaBackend({
          fullName: completedProfile.fullName,
          phone: completedProfile.phone,
          village: completedProfile.village,
          state: completedProfile.state,
          roleFlags: completedProfile.roleFlags,
        });
      } catch (backendErr) {
        console.warn('[FastAPI Profile Update Notice]:', backendErr);
      }

      setSuccessMessage(`Welcome to AgriMart, ${completedProfile.fullName}! Profile setup complete.`);
      setTimeout(() => {
        onAuthSuccess(completedProfile);
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error completing profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------------------------------
  // 4. GOOGLE OAUTH TRIGGER
  // ----------------------------------------------------------------------------
  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    // Explicitly flag that Google OAuth is being initiated by the user
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('agrimart_google_auth_initiated', 'true');
    }
    setStoredJwtToken(null);
    appStorage.logoutUser();

    try {
      const res = await signInWithGoogleOAuth();
      if (res.success) {
        return;
      }

      setIsLoading(false);
      setErrorMessage(
        res.error ||
          'Google Sign-In is not enabled yet in your Supabase dashboard. Please enable Google under Authentication -> Providers.'
      );
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Google Sign-In failed to connect.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-neutral-950/70 backdrop-blur-md overflow-y-auto animate-fade-in"
    >
      <div
        className={`relative w-full ${
          mode === 'complete-profile'
            ? 'max-w-xl sm:max-w-2xl'
            : mode === 'register'
            ? 'max-w-lg sm:max-w-xl'
            : 'max-w-md'
        } bg-white rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden my-4 sm:my-8 transition-all`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-neutral-100 flex items-center justify-between bg-gradient-to-r from-neutral-50 via-white to-emerald-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              {mode === 'complete-profile' ? (
                <Sparkles className="w-5 h-5 text-amber-300" />
              ) : (
                <Tractor className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900">
                  {mode === 'login'
                    ? 'Kisan Login'
                    : mode === 'register'
                    ? 'Register New Kisan Account'
                    : 'Complete Your Kisan Profile'}
                </h2>
                {mode === 'complete-profile' && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Google Verified</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500">
                {mode === 'login'
                  ? 'Access your land plots, machinery and bookings'
                  : mode === 'register'
                  ? 'Join the rural cooperative equipment sharing network'
                  : 'Finish setup to unlock nearest machines and plot detection'}
              </p>
            </div>
          </div>

          {mode !== 'complete-profile' && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tab Selector (only for Login vs Register) */}
        {mode !== 'complete-profile' && (
          <div className="flex border-b border-neutral-100 bg-neutral-50/40 p-1.5 gap-1.5 text-xs font-bold">
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
        )}

        {/* Alerts */}
        {errorMessage && (
          <div className="mx-6 sm:mx-8 mt-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 sm:mx-8 mt-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 sm:p-8">
          {mode === 'login' ? (
            /* ================================================================= */
            /* 1. LOGIN FORM                                                     */
            /* ================================================================= */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Mobile Number or Email
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. 9876543210 or kisan@example.com"
                    className="w-full pl-4 pr-10 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <User className="w-4 h-4 text-neutral-400 absolute right-3.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your account password"
                    className="w-full pl-4 pr-10 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <Lock className="w-4 h-4 text-neutral-400 absolute right-3.5 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Log In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-white px-2.5 text-neutral-400 font-bold">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 rounded-2xl text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
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
                  New to AgriMart? Register your farm or equipment here
                </button>
              </div>
            </form>
          ) : mode === 'register' ? (
            /* ================================================================= */
            /* 2. REGISTER FORM                                                  */
            /* ================================================================= */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
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
                    className="w-full pl-4 pr-10 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <User className="w-4 h-4 text-neutral-400 absolute right-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Flexible Contact: Phone or Email (One or Both) */}
              <div className="bg-neutral-50/80 p-3.5 rounded-2xl border border-neutral-200/80 space-y-3">
                <div className="text-[11px] font-bold text-emerald-800 flex items-center justify-between">
                  <span>Contact Information</span>
                  <span className="text-[10px] text-neutral-500 font-normal">Provide Mobile, Email, or Both</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                      Mobile Number (10 Digits) {phone && !email && <span className="text-emerald-700">*</span>}
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-xs font-bold text-neutral-500">+91</span>
                      <input
                        type="tel"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="98765 43210"
                        className="w-full pl-11 pr-4 py-2 bg-white border border-neutral-300 rounded-xl text-xs sm:text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                      <Phone className="w-3.5 h-3.5 text-neutral-400 absolute right-3 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                      Email Address {email && !phone && <span className="text-emerald-700">*</span>}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="kisan@example.com"
                        className="w-full pl-3 pr-9 py-2 bg-white border border-neutral-300 rounded-xl text-xs sm:text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                      <Mail className="w-3.5 h-3.5 text-neutral-400 absolute right-3 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                    Village / Town
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      value={village}
                      onChange={(e) => setVillage(e.target.value)}
                      placeholder="e.g. Samana"
                      className="w-full pl-3.5 pr-9 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-xs sm:text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                    <MapPin className="w-4 h-4 text-neutral-400 absolute right-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                    State
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-xs sm:text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('borrower');
                      setIsProsumer(false);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      !isProsumer && selectedRole === 'borrower'
                        ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 font-bold ring-2 ring-emerald-600'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100/70'
                    }`}
                  >
                    <Sprout className="w-5 h-5 text-emerald-700 mb-1.5" />
                    <div className="text-xs font-bold">Farmer</div>
                    <div className="text-[10px] text-neutral-500">Need machines for land</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('lender');
                      setIsProsumer(false);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      !isProsumer && selectedRole === 'lender'
                        ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 font-bold ring-2 ring-emerald-600'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100/70'
                    }`}
                  >
                    <Tractor className="w-5 h-5 text-emerald-700 mb-1.5" />
                    <div className="text-xs font-bold">Owner</div>
                    <div className="text-[10px] text-neutral-500">List machines to earn</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsProsumer(true)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isProsumer
                        ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 font-bold ring-2 ring-emerald-600'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100/70'
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5 text-emerald-700 mb-1.5" />
                    <div className="text-xs font-bold">Both</div>
                    <div className="text-[10px] text-neutral-500">Kisan Prosumer</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Create Password (Min. 6 Characters)
                </label>
                <div className="relative flex items-center">
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter a secure password"
                    className="w-full pl-4 pr-10 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <Lock className="w-4 h-4 text-neutral-400 absolute right-3.5 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Register & Enter AgriMart</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-white px-2.5 text-neutral-400 font-bold">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 rounded-2xl text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
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
          ) : (
            /* ================================================================= */
            /* 3. COMPLETE PROFILE FORM (Google OAuth Onboarding - Redesigned)  */
            /* ================================================================= */
            <form onSubmit={handleCompleteProfileSubmit} className="space-y-5">
              {/* Google Verified Account Card */}
              <div className="p-4 bg-gradient-to-r from-emerald-50/80 to-neutral-50 rounded-2xl border border-emerald-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {initialUser?.avatarUrl ? (
                    <div className="relative flex-shrink-0">
                      <img
                        src={initialUser.avatarUrl}
                        alt={fullName || 'Google Kisan'}
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        className="w-10 h-10 rounded-xl object-cover border border-emerald-300 shadow-xs"
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border border-neutral-200 shadow-xs flex items-center justify-center">
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-white border border-neutral-200 shadow-xs flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-bold text-neutral-900 leading-tight">
                      {fullName || 'Google Kisan'}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-medium">
                      {email || initialUser?.email || 'Authenticated via Google'}
                    </div>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-100/80 text-emerald-800 text-[11px] font-bold self-start sm:self-auto border border-emerald-200">
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Google Account Linked</span>
                </div>
              </div>

              {/* 2-Column Responsive Inputs on Desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                    Your Full Name <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Rameshwar Singh"
                      className="w-full pl-4 pr-10 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                    <User className="w-4 h-4 text-neutral-400 absolute right-3.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                    Mobile Number <span className="text-neutral-400 font-normal lowercase">(optional for SMS)</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-xs font-bold text-neutral-500">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="98765 43210"
                      className="w-full pl-12 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                    <Phone className="w-4 h-4 text-neutral-400 absolute right-3.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Village & State in 2-Column Responsive Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                    Village / Town <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      value={village}
                      onChange={(e) => setVillage(e.target.value)}
                      placeholder="e.g. Samana"
                      className="w-full pl-3.5 pr-9 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-xs sm:text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                    <MapPin className="w-4 h-4 text-neutral-400 absolute right-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                    State
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-xs sm:text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Role Selection Cards */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                  Select Your Primary Role
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('borrower');
                      setIsProsumer(false);
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      !isProsumer && selectedRole === 'borrower'
                        ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 font-bold ring-2 ring-emerald-600 shadow-xs'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100/80'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center mb-2 text-emerald-800">
                      <Sprout className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold">Farmer</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">Need machines & plots</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('lender');
                      setIsProsumer(false);
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      !isProsumer && selectedRole === 'lender'
                        ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 font-bold ring-2 ring-emerald-600 shadow-xs'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100/80'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center mb-2 text-amber-800">
                      <Tractor className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold">Equipment Owner</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">List machinery to earn</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsProsumer(true)}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      isProsumer
                        ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 font-bold ring-2 ring-emerald-600 shadow-xs'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100/80'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center mb-2 text-sky-800">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold">Both Roles</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">Kisan Prosumer</div>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Profile to Database...</span>
                  </>
                ) : (
                  <>
                    <span>Complete Profile & Enter AgriMart</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
