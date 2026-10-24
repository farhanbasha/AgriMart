-- ==============================================================================
-- AgriMart: Supabase (PostgreSQL) Master Schema & Setup Script
-- Migration: 001_initial_schema.sql
-- ==============================================================================

DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS plots CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

CREATE TABLE profiles (
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

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

CREATE TABLE plots (
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

CREATE TABLE resources (
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

CREATE TABLE bookings (
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

CREATE INDEX IF NOT EXISTS idx_plots_farmer ON plots(farmer_id);
CREATE INDEX IF NOT EXISTS idx_resources_owner ON resources(owner_id);
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(operational_status);
CREATE INDEX IF NOT EXISTS idx_bookings_resource ON bookings(resource_id);
CREATE INDEX IF NOT EXISTS idx_bookings_time ON bookings(resource_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_priority ON bookings(priority_score DESC);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Public insert profiles" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update profiles" ON profiles FOR UPDATE USING (true);
CREATE POLICY "Public delete profiles" ON profiles FOR DELETE USING (true);

CREATE POLICY "Public read plots" ON plots FOR SELECT USING (true);
CREATE POLICY "Public insert plots" ON plots FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update plots" ON plots FOR UPDATE USING (true);
CREATE POLICY "Public delete plots" ON plots FOR DELETE USING (true);

CREATE POLICY "Public read resources" ON resources FOR SELECT USING (true);
CREATE POLICY "Public insert resources" ON resources FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update resources" ON resources FOR UPDATE USING (true);
CREATE POLICY "Public delete resources" ON resources FOR DELETE USING (true);

CREATE POLICY "Public read bookings" ON bookings FOR SELECT USING (true);
CREATE POLICY "Public insert bookings" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update bookings" ON bookings FOR UPDATE USING (true);
CREATE POLICY "Public delete bookings" ON bookings FOR DELETE USING (true);

GRANT ALL ON TABLE profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE plots TO anon, authenticated, service_role;
GRANT ALL ON TABLE resources TO anon, authenticated, service_role;
GRANT ALL ON TABLE bookings TO anon, authenticated, service_role;
