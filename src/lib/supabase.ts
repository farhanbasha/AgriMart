import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Booking, BookingStatus, OperationalStatus, Plot, Profile, Resource, WeatherCondition } from '../types';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_URL.startsWith('http')) return null;
  try {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return _client;
  } catch (err) {
    console.warn('[Supabase] Init error:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith('http'));
}

export interface SupabaseHealthReport {
  configured: boolean;
  connected: boolean;
  tablesFound: boolean;
  missingTables: string[];
  errorMessage?: string;
}

export async function checkSupabaseHealth(): Promise<SupabaseHealthReport> {
  const c = getSupabaseClient();
  if (!c) {
    return {
      configured: false,
      connected: false,
      tablesFound: false,
      missingTables: ['profiles', 'plots', 'resources', 'bookings'],
      errorMessage: 'Supabase URL or Anon Key is missing in .env config.',
    };
  }

  const tablesToCheck = ['profiles', 'plots', 'resources', 'bookings'];
  const missing: string[] = [];

  for (const table of tablesToCheck) {
    try {
      const { error } = await c.from(table).select('id').limit(1);
      if (error) {
        missing.push(table);
      }
    } catch {
      missing.push(table);
    }
  }

  return {
    configured: true,
    connected: true,
    tablesFound: missing.length === 0,
    missingTables: missing,
    errorMessage: missing.length > 0 ? `Tables not yet created in PostgreSQL: ${missing.join(', ')}` : undefined,
  };
}

function mapPlotRow(row: any): Plot {
  return {
    id: row.id,
    farmerId: row.farmer_id || 'farmer-user',
    farmerName: row.farmer_name || 'Community Farmer',
    plotName: row.plot_name || 'Field Plot',
    village: row.village || undefined,
    state: row.state || undefined,
    acres: Number(row.acres) || 1,
    acreUnit: row.acre_unit || 'acre',
    cropType: row.crop_type || 'Field Crop',
    cropStage: row.crop_stage || 'Ripening',
    latitude: Number(row.latitude) || 29.6857,
    longitude: Number(row.longitude) || 76.9905,
    weather: row.weather_json ? (row.weather_json as WeatherCondition) : undefined,
  };
}

function mapResourceRow(row: any): Resource {
  return {
    id: row.id,
    ownerId: row.owner_id || 'owner-01',
    ownerName: row.owner_name || 'Equipment Owner',
    ownerPhone: row.owner_phone || undefined,
    category: row.category || 'machinery',
    name: row.name || 'Equipment',
    specs: row.specs || '',
    hourlyRate: Number(row.hourly_rate) || 500,
    rateUnit: row.rate_unit || 'per_hour',
    conditionRating: Number(row.condition_rating) || 4.8,
    operationalStatus: row.operational_status || 'available',
    village: row.village || undefined,
    state: row.state || undefined,
    baseLat: Number(row.base_lat) || 29.6857,
    baseLng: Number(row.base_lng) || 76.9905,
    maxRadiusKm: Number(row.max_radius_km) || 50.0,
    imageUrl: row.image_url || undefined,
    operatingHours: row.operating_hours || '06:00 AM - 08:00 PM',
    attachmentTypes: row.attachment_types || undefined,
    capacityOrWorkers: row.capacity_or_workers || undefined,
  };
}

function mapBookingRow(row: any): Booking {
  return {
    id: row.id,
    resourceId: row.resource_id,
    resourceName: row.resource_name || 'Equipment',
    farmerId: row.farmer_id || 'farmer-01',
    farmerName: row.farmer_name || 'Farmer',
    plotId: row.plot_id,
    plotName: row.plot_name || 'Field',
    plotLat: Number(row.plot_lat || 29.6857),
    plotLng: Number(row.plot_lng || 76.9905),
    cropStage: row.crop_stage || 'Ripening',
    intent: row.intent || 'harvesting',
    startTime: row.start_time,
    endTime: row.end_time,
    priorityScore: Number(row.priority_score || 0),
    scoreBreakdown: row.score_breakdown || {
      urgencyDeadlinePts: 0,
      weatherRiskPts: 0,
      cropVulnerabilityPts: 0,
      antiStarvationPts: 0,
      logisticsProximityPts: 0,
      intentConditionPts: 0,
      totalPriorityScore: 0,
    },
    status: (row.status as BookingStatus) || 'confirmed',
    transitBufferMinutes: Number(row.transit_buffer_minutes || 30),
    distanceKm: Number(row.distance_km || 0),
    notes: row.notes || undefined,
    urgencyJustification: row.urgency_justification || undefined,
    earliestStart: row.earliest_start || undefined,
    latestEnd: row.latest_end || undefined,
    totalCostRupees: row.total_cost_rupees ? Number(row.total_cost_rupees) : undefined,
    isOfflineCached: row.is_offline_cached || false,
    allocatedSlotExplanation: row.allocated_slot_explanation || undefined,
  };
}

function mapProfileRow(row: any): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone || '',
    village: row.village || undefined,
    state: row.state || undefined,
    passwordPin: row.password_pin || undefined,
    trustScore: Number(row.trust_score || 100),
    roleFlags: Array.isArray(row.role_flags) ? row.role_flags : ['borrower', 'lender'],
  };
}

// ------------------------------------------------------------------------------
// PROFILES API
// ------------------------------------------------------------------------------
export async function dbGetProfiles(): Promise<Profile[]> {
  const c = getSupabaseClient();
  if (!c) return [];
  try {
    const { data, error } = await c.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) {
      console.warn('[Supabase] dbGetProfiles notice:', error.message);
      return [];
    }
    return (data || []).map(mapProfileRow);
  } catch (err) {
    console.warn('[Supabase] dbGetProfiles failed:', err);
    return [];
  }
}

export async function dbUpsertProfile(profile: Profile): Promise<Profile | null> {
  const c = getSupabaseClient();
  if (!c) return null;
  try {
    const row = {
      id: profile.id,
      full_name: profile.fullName,
      phone: profile.phone || null,
      village: profile.village || null,
      state: profile.state || null,
      password_pin: profile.passwordPin || null,
      trust_score: profile.trustScore || 100,
      role_flags: profile.roleFlags,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await c.from('profiles').upsert(row, { onConflict: 'id' }).select().maybeSingle();
    if (error) {
      console.warn('[Supabase] dbUpsertProfile error:', error.message);
      return null;
    }
    return data ? mapProfileRow(data) : null;
  } catch (err) {
    console.warn('[Supabase] dbUpsertProfile failed:', err);
    return null;
  }
}

// ------------------------------------------------------------------------------
// PLOTS API
// ------------------------------------------------------------------------------
export async function dbGetPlots(): Promise<Plot[]> {
  const c = getSupabaseClient();
  if (!c) return [];
  try {
    const { data, error } = await c.from('plots').select('*').order('created_at', { ascending: false });
    if (error) {
      console.warn('[Supabase] dbGetPlots notice:', error.message);
      return [];
    }
    return (data || []).map(mapPlotRow);
  } catch (err) {
    console.warn('[Supabase] dbGetPlots failed:', err);
    return [];
  }
}

export async function dbUpsertPlot(plot: Plot): Promise<Plot | null> {
  const c = getSupabaseClient();
  if (!c) return null;
  try {
    const row = {
      id: plot.id,
      farmer_id: plot.farmerId,
      farmer_name: plot.farmerName,
      plot_name: plot.plotName,
      village: plot.village || null,
      state: plot.state || null,
      acres: plot.acres,
      acre_unit: plot.acreUnit || 'acre',
      crop_type: plot.cropType,
      crop_stage: plot.cropStage,
      latitude: plot.latitude,
      longitude: plot.longitude,
      weather_json: plot.weather || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await c.from('plots').upsert(row, { onConflict: 'id' }).select().maybeSingle();
    if (error) {
      console.warn('[Supabase] dbUpsertPlot error:', error.message);
      return null;
    }
    return data ? mapPlotRow(data) : null;
  } catch (err) {
    console.warn('[Supabase] dbUpsertPlot failed:', err);
    return null;
  }
}

export async function dbDeletePlot(plotId: string): Promise<boolean> {
  const c = getSupabaseClient();
  if (!c) return false;
  try {
    const { error } = await c.from('plots').delete().eq('id', plotId);
    if (error) {
      console.warn('[Supabase] dbDeletePlot error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] dbDeletePlot failed:', err);
    return false;
  }
}

// ------------------------------------------------------------------------------
// RESOURCES API
// ------------------------------------------------------------------------------
export async function dbGetResources(): Promise<Resource[]> {
  const c = getSupabaseClient();
  if (!c) return [];
  try {
    const { data, error } = await c.from('resources').select('*').order('created_at', { ascending: false });
    if (error) {
      console.warn('[Supabase] dbGetResources notice:', error.message);
      return [];
    }
    return (data || []).map(mapResourceRow);
  } catch (err) {
    console.warn('[Supabase] dbGetResources failed:', err);
    return [];
  }
}

export async function dbUpsertResource(resource: Resource): Promise<Resource | null> {
  const c = getSupabaseClient();
  if (!c) return null;
  try {
    const row = {
      id: resource.id,
      owner_id: resource.ownerId,
      owner_name: resource.ownerName,
      owner_phone: resource.ownerPhone || null,
      category: resource.category,
      name: resource.name,
      specs: resource.specs,
      hourly_rate: resource.hourlyRate,
      rate_unit: resource.rateUnit || 'per_hour',
      condition_rating: resource.conditionRating,
      operational_status: resource.operationalStatus,
      village: resource.village || null,
      state: resource.state || null,
      base_lat: resource.baseLat,
      base_lng: resource.baseLng,
      max_radius_km: resource.maxRadiusKm,
      image_url: resource.imageUrl || null,
      operating_hours: resource.operatingHours || '06:00 AM - 08:00 PM',
      attachment_types: resource.attachmentTypes || null,
      capacity_or_workers: resource.capacityOrWorkers || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await c.from('resources').upsert(row, { onConflict: 'id' }).select().maybeSingle();
    if (error) {
      console.warn('[Supabase] dbUpsertResource error:', error.message);
      return null;
    }
    return data ? mapResourceRow(data) : null;
  } catch (err) {
    console.warn('[Supabase] dbUpsertResource failed:', err);
    return null;
  }
}

export async function dbUpdateResourceStatus(resourceId: string, status: OperationalStatus): Promise<boolean> {
  const c = getSupabaseClient();
  if (!c) return false;
  try {
    const { error } = await c.from('resources').update({ operational_status: status, updated_at: new Date().toISOString() }).eq('id', resourceId);
    if (error) {
      console.warn('[Supabase] dbUpdateResourceStatus error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] dbUpdateResourceStatus failed:', err);
    return false;
  }
}

export async function dbDeleteResource(resourceId: string): Promise<boolean> {
  const c = getSupabaseClient();
  if (!c) return false;
  try {
    const { error } = await c.from('resources').delete().eq('id', resourceId);
    if (error) {
      console.warn('[Supabase] dbDeleteResource error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] dbDeleteResource failed:', err);
    return false;
  }
}

// ------------------------------------------------------------------------------
// BOOKINGS API
// ------------------------------------------------------------------------------
export async function dbGetBookings(): Promise<Booking[]> {
  const c = getSupabaseClient();
  if (!c) return [];
  try {
    const { data, error } = await c.from('bookings').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) {
      console.warn('[Supabase] dbGetBookings notice:', error.message);
      return [];
    }
    return (data || []).map(mapBookingRow);
  } catch (err) {
    console.warn('[Supabase] dbGetBookings failed:', err);
    return [];
  }
}

export async function dbInsertBooking(booking: Booking): Promise<Booking | null> {
  const c = getSupabaseClient();
  if (!c) return null;
  try {
    const row = {
      id: booking.id,
      resource_id: booking.resourceId,
      resource_name: booking.resourceName,
      farmer_id: booking.farmerId,
      farmer_name: booking.farmerName,
      plot_id: booking.plotId,
      plot_name: booking.plotName,
      plot_lat: booking.plotLat,
      plot_lng: booking.plotLng,
      crop_stage: booking.cropStage,
      intent: booking.intent,
      start_time: booking.startTime,
      end_time: booking.endTime,
      priority_score: booking.priorityScore,
      score_breakdown: booking.scoreBreakdown,
      status: booking.status,
      transit_buffer_minutes: booking.transitBufferMinutes,
      distance_km: booking.distanceKm,
      notes: booking.notes || null,
      urgency_justification: booking.urgencyJustification || null,
      earliest_start: booking.earliestStart || null,
      latest_end: booking.latestEnd || null,
      total_cost_rupees: booking.totalCostRupees || null,
      is_offline_cached: booking.isOfflineCached || false,
      allocated_slot_explanation: booking.allocatedSlotExplanation || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await c.from('bookings').upsert(row, { onConflict: 'id' }).select().maybeSingle();
    if (error) {
      console.warn('[Supabase] dbInsertBooking error:', error.message);
      return null;
    }
    return data ? mapBookingRow(data) : null;
  } catch (err) {
    console.warn('[Supabase] dbInsertBooking failed:', err);
    return null;
  }
}

export async function dbUpdateBookingStatus(bookingId: string, status: BookingStatus): Promise<boolean> {
  const c = getSupabaseClient();
  if (!c) return false;
  try {
    const { error } = await c.from('bookings').update({ status, updated_at: new Date().toISOString() }).eq('id', bookingId);
    if (error) {
      console.warn('[Supabase] dbUpdateBookingStatus error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] dbUpdateBookingStatus failed:', err);
    return false;
  }
}
