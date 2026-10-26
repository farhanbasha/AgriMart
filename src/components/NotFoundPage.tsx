import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AppNavTab } from './Header';
import {
  Compass,
  Search,
  ArrowRight,
  Tractor,
  MapPin,
  CalendarCheck,
  ShieldCheck,
  RefreshCw,
  Home,
  AlertCircle,
  Navigation,
  Layers,
  ChevronRight,
  Radio,
} from 'lucide-react';

interface NotFoundPageProps {
  attemptedPath?: string;
  onNavigate: (tab: AppNavTab) => void;
  availableResourcesCount?: number;
  plotsCount?: number;
  bookingsCount?: number;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  attemptedPath = '/unknown',
  onNavigate,
  availableResourcesCount = 18,
  plotsCount = 6,
  bookingsCount = 4,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const cleanPath = attemptedPath.startsWith('/') ? attemptedPath : `/${attemptedPath}`;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate('explore');
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden min-h-[calc(100dvh-4rem)] bg-neutral-50/50 flex flex-col justify-between">
      {/* 1. ATTENTION: Atmospheric Hero Section */}
      <section className="relative pt-8 sm:pt-12 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8 border-b border-neutral-200/70 bg-gradient-to-b from-white via-white to-neutral-50/40">
        {/* Subtle Background Geodesic Grid Accent */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035] bg-[radial-gradient(#047857_1px,transparent_1px)] [background-size:24px_24px]"
          aria-hidden="true"
        />

        <div className="max-w-5xl mx-auto relative z-10 space-y-6">
          {/* Geodesic Boundary Breadcrumb & Signal Indicator */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-wrap items-center gap-2 sm:gap-3"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-mono font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span>SECTOR 404 // SIGNAL OUT OF BOUNDS</span>
            </div>

            <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-neutral-500 bg-neutral-100/80 px-2.5 py-1 rounded-lg border border-neutral-200/60">
              <Compass className="w-3.5 h-3.5 text-neutral-400" />
              <span>UNRESOLVED ROUTE: {cleanPath}</span>
            </div>
          </motion.div>

          {/* 2-Line Iron Rule Headline */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-3"
          >
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 leading-[1.08]">
              Field Sector Not Found.
              <span className="block text-emerald-700">Out of Surveyed Grid Bounds.</span>
            </h1>

            <p className="max-w-2xl text-sm sm:text-base text-neutral-600 leading-relaxed font-normal">
              The destination path <code className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-neutral-200/70 text-neutral-900 font-bold">{cleanPath}</code> does not match any active agricultural plot, machinery depot, or scheduled field dispatch.
            </p>
          </motion.div>

          {/* Primary Recovery CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-wrap items-center gap-3 pt-2"
          >
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
            >
              <Home className="w-4 h-4" />
              <span>Return to Field Radar</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('bookings')}
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-xs sm:text-sm border border-neutral-300 shadow-xs active:scale-[0.98] transition-all"
            >
              <CalendarCheck className="w-4 h-4 text-emerald-700" />
              <span>View Field Schedule</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  window.history.back();
                } else {
                  onNavigate('explore');
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl text-neutral-600 hover:text-neutral-900 text-xs sm:text-sm font-semibold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Go Back</span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* 2. INTEREST: Gapless Bento Grid with 4 Mathematically Interlocked Cards */}
      <section className="py-10 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
              Recalibrate to Active Cooperative Sectors
            </h2>
            <p className="text-xs text-neutral-500">
              Select an established operational hub to resume machinery booking and farm coordination.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/70 self-start sm:self-auto font-semibold">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>GRID ONLINE</span>
          </div>
        </div>

        {/* Dense 3-column Bento Grid (2x1 + 1x1 on Row 1, 1x1 + 2x1 on Row 2 = 6 units, 0 gaps) */}
        <div className="grid grid-cols-1 md:grid-cols-3 grid-flow-dense gap-4 sm:gap-5">
          {/* Card 1: Equipment Directory (Col Span 2) */}
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            onClick={() => onNavigate('explore')}
            className="md:col-span-2 group cursor-pointer bg-white rounded-3xl p-6 border border-neutral-200/90 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center font-bold">
                  <Tractor className="w-5 h-5 text-emerald-700" />
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {availableResourcesCount} Units Active
                </span>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-neutral-900 group-hover:text-emerald-800 transition-colors">
                  Agricultural Equipment Directory
                </h3>
                <p className="text-xs sm:text-sm text-neutral-500 mt-1 leading-relaxed">
                  Explore available 4x4 tractors, combine harvesters, laser levelers, and drone sprayers with verified lender bounds and Haversine transit calculation.
                </p>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-neutral-100 mt-4 text-xs font-bold text-emerald-700">
              <span>Access Machinery Radar</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>

          {/* Card 2: Registered Farm Land (Col Span 1) */}
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            onClick={() => onNavigate('plots')}
            className="md:col-span-1 group cursor-pointer bg-white rounded-3xl p-6 border border-neutral-200/90 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-sky-100/80 text-sky-800 flex items-center justify-center font-bold">
                  <MapPin className="w-5 h-5 text-sky-700" />
                </div>
                <span className="text-[11px] font-mono font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                  {plotsCount} Plots
                </span>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-neutral-900 group-hover:text-sky-800 transition-colors">
                  My Farm Plots
                </h3>
                <p className="text-xs sm:text-sm text-neutral-500 mt-1 leading-relaxed">
                  Manage soil crops, acreages, and GPS coordinates for precision dispatch.
                </p>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-neutral-100 mt-4 text-xs font-bold text-sky-700">
              <span>Open Land Manager</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>

          {/* Card 3: Master Dispatch Timeline (Col Span 1) */}
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            onClick={() => onNavigate('bookings')}
            className="md:col-span-1 group cursor-pointer bg-white rounded-3xl p-6 border border-neutral-200/90 shadow-xs hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-amber-100/80 text-amber-800 flex items-center justify-center font-bold">
                  <CalendarCheck className="w-5 h-5 text-amber-700" />
                </div>
                <span className="text-[11px] font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  Live Dispatch
                </span>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-neutral-900 group-hover:text-amber-800 transition-colors">
                  Field Dispatch Timeline
                </h3>
                <p className="text-xs sm:text-sm text-neutral-500 mt-1 leading-relaxed">
                  Review verified Fair Turn sequential shifts and the 30-minute buffer lock safety system.
                </p>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-neutral-100 mt-4 text-xs font-bold text-amber-800">
              <span>View Active Shifts</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>

          {/* Card 4: Owner Fleet Controls (Col Span 2) */}
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            onClick={() => onNavigate('owner')}
            className="md:col-span-2 group cursor-pointer bg-white rounded-3xl p-6 border border-neutral-200/90 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5 text-emerald-700" />
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Fleet Command
                </span>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-neutral-900 group-hover:text-emerald-800 transition-colors">
                  Equipment Owner Fleet Controls
                </h3>
                <p className="text-xs sm:text-sm text-neutral-500 mt-1 leading-relaxed">
                  List community machinery, calibrate custom serviceable radius bounds, set hourly rental pricing, and view rental earnings generated.
                </p>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-neutral-100 mt-4 text-xs font-bold text-emerald-700">
              <span>Manage Fleet Depot</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3. DESIRE & ACTION: Context Search / Route Resolver Form */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 border-t border-neutral-200/80 bg-white">
        <div className="max-w-3xl mx-auto space-y-3 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Search Agricultural Machinery Directory
          </p>

          <form onSubmit={handleSearchSubmit} className="relative flex items-center max-w-xl mx-auto">
            <Search className="w-4 h-4 text-neutral-400 absolute left-4 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. John Deere 5310, Kubota Harvester, Rotavator, Drone"
              className="w-full pl-11 pr-28 py-3 bg-neutral-50 border border-neutral-300 rounded-2xl text-xs sm:text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all shadow-xs"
            />
            <button
              type="submit"
              className="absolute right-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              Search
            </button>
          </form>

          <div className="text-[11px] text-neutral-400 font-mono pt-1">
            Lat: 28.6139° N  •  Lng: 77.2090° E  •  Geodesic Radius: 50.0 km  •  AgriMart v2.0
          </div>
        </div>
      </section>
    </div>
  );
};
