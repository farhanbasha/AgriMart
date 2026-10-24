import React from 'react';
import { UserRole, Profile } from '../types';
import { Logo } from './Logo';
import {
  Tractor,
  Wifi,
  WifiOff,
  RefreshCw,
  PlusCircle,
  Search,
  CalendarCheck,
  MapPin,
  Scale,
  User,
  LogOut,
  Database,
} from 'lucide-react';

export type AppNavTab = 'explore' | 'add' | 'bookings' | 'plots' | 'owner';

interface HeaderProps {
  activeTab: AppNavTab;
  onSelectTab: (tab: AppNavTab) => void;
  activeRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  conflictCount: number;
  onOpenFairTurnModal: () => void;
  isOnline: boolean;
  onToggleConnectivity: () => void;
  offlineQueueCount: number;
  onManualSync?: () => void;
  currentUser?: Profile | null;
  onOpenAuthModal?: () => void;
  onLogout?: () => void;
  onOpenSupabaseModal?: () => void;
  isSupabaseConnected?: boolean;
}

const UserAvatar: React.FC<{ user: Profile }> = ({ user }) => {
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [user.avatarUrl]);

  const initials = (user.fullName || '')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  if (user.avatarUrl && !imgError) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.fullName || 'User Avatar'}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setImgError(true)}
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl object-cover shadow-xs border border-emerald-300"
      />
    );
  }

  return (
    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-[11px] sm:text-xs shadow-xs">
      {initials}
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  activeRole,
  onRoleChange,
  conflictCount,
  onOpenFairTurnModal,
  isOnline,
  onToggleConnectivity,
  offlineQueueCount,
  onManualSync,
  currentUser,
  onOpenAuthModal,
  onLogout,
  onOpenSupabaseModal,
  isSupabaseConnected = true,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-4">
          {/* AgriMart Brand Logo */}
          <div className="flex items-center flex-shrink-0">
            <button
              type="button"
              onClick={() => onSelectTab('explore')}
              className="flex items-center gap-2.5 text-left focus:outline-none group hover:opacity-90 transition-opacity"
              title="AgriMart Home"
            >
              <Logo size="md" />
            </button>
          </div>

          {/* Center Navigation Menu (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 bg-neutral-100/90 p-1 rounded-2xl border border-neutral-200/80">
            <button
              type="button"
              onClick={() => onSelectTab('explore')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'explore'
                  ? 'bg-white text-neutral-900 shadow-xs ring-1 ring-neutral-200/60'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-emerald-600" />
              <span>Explore</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('bookings')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'bookings'
                  ? 'bg-white text-neutral-900 shadow-xs ring-1 ring-neutral-200/60'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Bookings</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('plots')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'plots'
                  ? 'bg-white text-neutral-900 shadow-xs ring-1 ring-neutral-200/60'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-sky-600" />
              <span>My Land</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('owner')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'owner'
                  ? 'bg-white text-neutral-900 shadow-xs ring-1 ring-neutral-200/60'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
              }`}
            >
              <Tractor className="w-3.5 h-3.5 text-amber-700" />
              <span>Owner Fleet</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('add')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'add'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Add</span>
            </button>
          </nav>

          {/* Right Controls: Cloud DB + Fair Turn + Connectivity + Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Supabase Cloud Database Status Trigger */}
            {onOpenSupabaseModal && (
              <button
                type="button"
                onClick={onOpenSupabaseModal}
                className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold border border-neutral-200 transition-colors"
                title="View Cloud PostgreSQL Database Status"
              >
                <Database className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden md:inline">Cloud DB</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </button>
            )}

            {/* Fair Turn Priority indicator */}
            {conflictCount > 0 && (
              <button
                type="button"
                onClick={onOpenFairTurnModal}
                className="flex items-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300 transition-colors"
                title="View Transparent Fair Turn Decision"
              >
                <Scale className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden md:inline">Fair Turn</span>
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {conflictCount}
                </span>
              </button>
            )}

            {/* Offline Connectivity Toggle */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={onToggleConnectivity}
                title="Click to toggle network state (Offline sync demonstration)"
                className={`inline-flex items-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  isOnline
                    ? 'bg-emerald-50/90 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                }`}
              >
                {isOnline ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="hidden sm:inline">Online</span>
                    <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="font-bold text-[11px] sm:text-xs">Offline</span>
                    <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  </>
                )}
              </button>

              {offlineQueueCount > 0 && (
                <button
                  type="button"
                  onClick={onManualSync}
                  className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-bold bg-amber-500 text-white hover:bg-amber-600 shadow-xs transition-colors"
                  title="Offline bookings ready to sync"
                >
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>{offlineQueueCount}</span>
                </button>
              )}
            </div>

            {/* User Profile Badge or Login Button */}
            <div className="flex items-center gap-2 pl-1.5 sm:pl-2 border-l border-neutral-200">
              {currentUser ? (
                <div className="flex items-center gap-2">
                  <UserAvatar user={currentUser} />
                  <div className="hidden xl:block text-left">
                    <div className="text-xs font-bold text-neutral-900 leading-tight">
                      {currentUser.fullName}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-semibold truncate max-w-[120px]">
                      {currentUser.roles?.join(' • ') || currentUser.village || currentUser.email || currentUser.phone}
                    </div>
                  </div>
                  {onLogout && (
                    <button
                      type="button"
                      onClick={onLogout}
                      title="Log out"
                      className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-xl hover:bg-neutral-100 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Log In / Sign Up</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Ergonomic Bottom Navigation Dock */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200/90 lg:hidden shadow-lg px-2 py-1.5"
      >
        <div className="flex items-center justify-around text-xs font-bold max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => onSelectTab('explore')}
            className={`flex-1 flex flex-col items-center py-1.5 px-1 rounded-xl transition-all ${
              activeTab === 'explore'
                ? 'text-emerald-800 font-extrabold bg-emerald-50'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Search className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Explore</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('bookings')}
            className={`flex-1 flex flex-col items-center py-1.5 px-1 rounded-xl transition-all ${
              activeTab === 'bookings'
                ? 'text-emerald-800 font-extrabold bg-emerald-50'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Bookings</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('add')}
            className={`flex-1 flex flex-col items-center py-1.5 px-1 rounded-xl transition-all ${
              activeTab === 'add'
                ? 'text-white font-extrabold bg-emerald-700 shadow-xs'
                : 'text-emerald-800 font-bold bg-emerald-50/80 hover:bg-emerald-100'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">+ Add</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('plots')}
            className={`flex-1 flex flex-col items-center py-1.5 px-1 rounded-xl transition-all ${
              activeTab === 'plots'
                ? 'text-emerald-800 font-extrabold bg-emerald-50'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">My Land</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('owner')}
            className={`flex-1 flex flex-col items-center py-1.5 px-1 rounded-xl transition-all ${
              activeTab === 'owner'
                ? 'text-emerald-800 font-extrabold bg-emerald-50'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Tractor className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Owner</span>
          </button>
        </div>
      </nav>
    </header>
  );
};
