import React, { useState, useEffect } from 'react';
import { checkSupabaseHealth, SupabaseHealthReport } from '../lib/supabase';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  RefreshCw,
  X,
  Server,
  ShieldCheck,
} from 'lucide-react';

interface SupabaseStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
}

const SUPABASE_SETUP_SQL = `-- AgriMart Supabase PostgreSQL Setup
-- Run in Supabase SQL Editor in your Supabase Project Dashboard

-- -----------------------------------------------------------------------------
-- QUICK NON-DESTRUCTIVE MIGRATION (If you already have existing tables & data)
-- -----------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unique_email ON profiles(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unique_phone ON profiles(phone) WHERE phone IS NOT NULL;

-- -----------------------------------------------------------------------------
-- FULL SCHEMA SETUP (For new installations or table creation)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    village TEXT,
    state TEXT,
    avatar_url TEXT,
    password_hash TEXT,
    trust_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    role_flags TEXT[] NOT NULL DEFAULT ARRAY['borrower', 'lender']::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unique_email ON profiles(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unique_phone ON profiles(phone) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS plots (
    id TEXT PRIMARY KEY,
    farmer_id TEXT NOT NULL,
    farmer_name TEXT NOT NULL DEFAULT 'Farmer',
    plot_name TEXT NOT NULL,
    village TEXT,
    state TEXT,
    acres NUMERIC(8, 2) NOT NULL DEFAULT 1.00,
    acre_unit TEXT NOT NULL DEFAULT 'acre',
    crop_type TEXT NOT NULL DEFAULT 'Field Crop',
    crop_stage TEXT NOT NULL DEFAULT 'Ripening',
    latitude NUMERIC(10, 6) NOT NULL DEFAULT 29.685700,
    longitude NUMERIC(10, 6) NOT NULL DEFAULT 76.990500,
    weather_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    owner_name TEXT NOT NULL DEFAULT 'Equipment Owner',
    owner_phone TEXT,
    category TEXT NOT NULL DEFAULT 'machinery',
    name TEXT NOT NULL,
    specs TEXT DEFAULT '',
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
    rate_unit TEXT NOT NULL DEFAULT 'per_hour',
    condition_rating NUMERIC(2, 1) NOT NULL DEFAULT 4.8,
    operational_status TEXT NOT NULL DEFAULT 'available',
    village TEXT,
    state TEXT,
    base_lat NUMERIC(10, 6) NOT NULL DEFAULT 29.685700,
    base_lng NUMERIC(10, 6) NOT NULL DEFAULT 76.990500,
    max_radius_km NUMERIC(6, 2) NOT NULL DEFAULT 50.00,
    image_url TEXT,
    operating_hours TEXT DEFAULT '06:00 AM - 08:00 PM',
    attachment_types TEXT,
    capacity_or_workers TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    resource_name TEXT NOT NULL DEFAULT 'Equipment',
    farmer_id TEXT NOT NULL,
    farmer_name TEXT NOT NULL DEFAULT 'Farmer',
    plot_id TEXT NOT NULL,
    plot_name TEXT NOT NULL DEFAULT 'Field',
    plot_lat NUMERIC(10, 6) NOT NULL DEFAULT 29.685700,
    plot_lng NUMERIC(10, 6) NOT NULL DEFAULT 76.990500,
    crop_stage TEXT NOT NULL DEFAULT 'Ripening',
    intent TEXT NOT NULL DEFAULT 'harvesting',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    priority_score NUMERIC(5, 2) DEFAULT 0.00,
    score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'confirmed',
    transit_buffer_minutes NUMERIC(6, 1) DEFAULT 30.0,
    distance_km NUMERIC(6, 2) DEFAULT 0.00,
    notes TEXT,
    urgency_justification TEXT,
    earliest_start TIMESTAMPTZ,
    latest_end TIMESTAMPTZ,
    total_cost_rupees NUMERIC(10, 2),
    is_offline_cached BOOLEAN DEFAULT FALSE,
    allocated_slot_explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Permissive public policies for AgriMart anon client access
DROP POLICY IF EXISTS "Allow anon public access" ON profiles;
CREATE POLICY "Allow anon public access" ON profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon public access" ON plots;
CREATE POLICY "Allow anon public access" ON plots FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon public access" ON resources;
CREATE POLICY "Allow anon public access" ON resources FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon public access" ON bookings;
CREATE POLICY "Allow anon public access" ON bookings FOR ALL USING (true) WITH CHECK (true);

-- Grant privileges
GRANT ALL ON profiles, plots, resources, bookings TO anon, authenticated, service_role;`;

export const SupabaseStatusModal: React.FC<SupabaseStatusModalProps> = ({
  isOpen,
  onClose,
  onRefreshData,
}) => {
  const [report, setReport] = useState<SupabaseHealthReport | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const runHealthCheck = async () => {
    setIsChecking(true);
    try {
      const res = await checkSupabaseHealth();
      setReport(res);
      if (res.tablesFound && onRefreshData) {
        onRefreshData();
      }
    } catch (err) {
      console.warn('[SupabaseModal] Health check error:', err);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runHealthCheck();
    }
  }, [isOpen]);

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (!isOpen) return null;

  const isFullyWorking = report?.connected && report?.tablesFound;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isFullyWorking ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-neutral-900">
                Supabase Cloud Database Status
              </h3>
              <p className="text-xs text-neutral-500 font-medium">
                Secure Cloud Database Instance
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 space-y-5 flex-1">
          {/* Status Indicator Banner */}
          <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
            isFullyWorking
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/80 border-amber-200 text-amber-950'
          }`}>
            {isFullyWorking ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="text-xs space-y-1">
              <div className="font-extrabold text-sm">
                {isFullyWorking
                  ? 'Cloud PostgreSQL Database Fully Connected'
                  : 'PostgreSQL Tables Need Creation in Supabase'}
              </div>
              <p className="leading-relaxed">
                {isFullyWorking
                  ? 'All 4 tables (profiles, plots, resources, bookings) exist and are saving your data in real time.'
                  : 'Your Supabase API credentials in .env are active, but the database tables have not been created yet in PostgreSQL.'}
              </p>
            </div>
          </div>

          {/* Table Diagnostic Matrix */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Database Table Status
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {['profiles', 'plots', 'resources', 'bookings'].map((tbl) => {
                const isPresent = report?.tablesFound || (report && !report.missingTables.includes(tbl));
                return (
                  <div
                    key={tbl}
                    className={`p-3 rounded-2xl border flex items-center justify-between ${
                      isPresent
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-600'
                    }`}
                  >
                    <span className="font-mono font-bold">{tbl}</span>
                    {isPresent ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                        Missing
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Setup Instructions & 1-Click Copy */}
          {!isFullyWorking && (
            <div className="space-y-3 p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-emerald-700" />
                  <span>Turnkey SQL Migration Script</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopySQL}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy SQL'}</span>
                </button>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed">
                Step 1: Click <strong>Copy SQL</strong> above.<br />
                Step 2: Open your Supabase Dashboard SQL editor with the button below.<br />
                Step 3: Paste and click <strong>Run</strong>. Then come back and click <strong>Verify Connection</strong>!
              </p>

              <div className="relative">
                <pre className="p-3 bg-neutral-900 text-neutral-100 text-[11px] font-mono rounded-xl max-h-36 overflow-y-auto leading-tight border border-neutral-700">
                  {SUPABASE_SETUP_SQL}
                </pre>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-2">
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Supabase Dashboard</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 border-t border-neutral-100 bg-neutral-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Dual persistence enabled: Local Storage + Supabase Cloud PostgreSQL</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={runHealthCheck}
              disabled={isChecking}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-bold transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Checking...' : 'Verify Connection'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
