import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Booking, BookingStatus, OperationalStatus, Plot, Profile, Resource, WeatherCondition } from '../types';
import { appStorage } from './storage';
import { getStoredJwtToken, setStoredJwtToken, loginWithGoogleViaBackend } from './api';

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
    phone: row.phone || undefined,
    email: row.email || undefined,
    village: row.village || undefined,
    state: row.state || undefined,
    avatarUrl: row.avatar_url || undefined,
    password: row.password_hash || undefined,
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

export async function dbGetProfileByIdOrEmail(id: string, email?: string): Promise<Profile | null> {
  const c = getSupabaseClient();
  if (!c) return null;
  try {
    let query = c.from('profiles').select('*');
    if (email) {
      query = query.or(`id.eq.${id},email.eq.${email.trim().toLowerCase()}`);
    } else {
      query = query.eq('id', id);
    }
    const { data, error } = await query.limit(1).maybeSingle();
    if (!error && data) {
      return mapProfileRow(data);
    }
    return null;
  } catch (err) {
    console.warn('[Supabase] dbGetProfileByIdOrEmail failed:', err);
    return null;
  }
}

export async function dbCheckCredentialConflict(params: {
  email?: string;
  phone?: string;
  excludeUserId?: string;
}): Promise<{ conflict: boolean; field?: 'email' | 'phone'; message?: string }> {
  const c = getSupabaseClient();
  const cleanEmail = params.email?.trim().toLowerCase();
  const cleanPhone = params.phone?.replace(/[\s\-()]/g, '');

  // 1. Check local storage users cache
  const localUsers = appStorage.getUsers();
  for (const u of localUsers) {
    if (params.excludeUserId && u.id === params.excludeUserId) continue;
    if (cleanEmail && u.email && u.email.trim().toLowerCase() === cleanEmail) {
      return {
        conflict: true,
        field: 'email',
        message: 'This email address is already registered. Please choose a different email or log in.',
      };
    }
    if (cleanPhone && u.phone) {
      const uPhone = u.phone.replace(/[\s\-()]/g, '');
      if (uPhone === cleanPhone || uPhone.endsWith(cleanPhone) || cleanPhone.endsWith(uPhone)) {
        return {
          conflict: true,
          field: 'phone',
          message: 'This mobile number is already registered. Please choose a different number or log in.',
        };
      }
    }
  }

  // 2. Query Supabase database profiles table directly
  if (c && (cleanEmail || cleanPhone)) {
    try {
      if (cleanEmail) {
        let q = c.from('profiles').select('id, email').eq('email', cleanEmail);
        if (params.excludeUserId) {
          q = q.neq('id', params.excludeUserId);
        }
        const { data: emailData } = await q.limit(1);
        if (emailData && emailData.length > 0) {
          return {
            conflict: true,
            field: 'email',
            message: 'This email address is already registered. Please choose a different email or log in.',
          };
        }
      }

      if (cleanPhone) {
        const variants = [
          cleanPhone,
          cleanPhone.startsWith('+91') ? cleanPhone : `+91${cleanPhone.replace(/^0+/, '')}`,
          cleanPhone.replace(/^\+91/, ''),
        ];
        let q = c.from('profiles').select('id, phone').in('phone', variants);
        if (params.excludeUserId) {
          q = q.neq('id', params.excludeUserId);
        }
        const { data: phoneData } = await q.limit(1);
        if (phoneData && phoneData.length > 0) {
          return {
            conflict: true,
            field: 'phone',
            message: 'This mobile number is already registered. Please choose a different number or log in.',
          };
        }
      }
    } catch (err) {
      console.warn('[Supabase] Credential conflict check note:', err);
    }
  }

  return { conflict: false };
}

export async function dbUpsertProfile(profile: Profile): Promise<Profile | null> {
  const c = getSupabaseClient();
  if (!c) return null;
  try {
    // Ensure we strictly store Bcrypt hashes and NEVER plain text passwords in the database!
    const candidateHash =
      profile.passwordHash ||
      profile.password_hash ||
      (profile.password && (profile.password.startsWith('$2b$') || profile.password.startsWith('$2a$'))
        ? profile.password
        : null);

    const row: any = {
      id: profile.id,
      full_name: profile.fullName,
      email: profile.email || null,
      phone: profile.phone || null,
      village: profile.village || null,
      state: profile.state || null,
      avatar_url: profile.avatarUrl || null,
      password_hash: candidateHash || null,
      trust_score: profile.trustScore || 100,
      role_flags: profile.roleFlags,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await c.from('profiles').upsert(row, { onConflict: 'id' }).select().maybeSingle();
    if (error) {
      console.warn('[Supabase] dbUpsertProfile error:', error.message);
      // Graceful fallback if email/avatar_url columns are pending SQL migration
      if (error.message.includes('email') || error.message.includes('avatar_url') || error.message.includes('column')) {
        const fallbackRow = { ...row };
        delete fallbackRow.email;
        delete fallbackRow.avatar_url;
        const retry = await c.from('profiles').upsert(fallbackRow, { onConflict: 'id' }).select().maybeSingle();
        return retry.data ? mapProfileRow(retry.data) : null;
      }
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

export async function dbDeleteBooking(bookingId: string): Promise<boolean> {
  const c = getSupabaseClient();
  if (!c) return false;
  try {
    const { error } = await c.from('bookings').delete().eq('id', bookingId);
    if (error) {
      console.warn('[Supabase] dbDeleteBooking error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] dbDeleteBooking failed:', err);
    return false;
  }
}

export async function dbDeleteBookings(bookingIds: string[]): Promise<boolean> {
  if (!bookingIds.length) return true;
  const c = getSupabaseClient();
  if (!c) return false;
  try {
    const { error } = await c.from('bookings').delete().in('id', bookingIds);
    if (error) {
      console.warn('[Supabase] dbDeleteBookings error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] dbDeleteBookings failed:', err);
    return false;
  }
}

/**
 * Subscribes to live database changes via Supabase Realtime channel
 */
export function subscribeToSupabaseChanges(onUpdate: () => void): () => void {
  const c = getSupabaseClient();
  if (!c) return () => {};

  try {
    const channel = c
      .channel('agrimart-db-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        onUpdate();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plots' }, () => {
        onUpdate();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resources' }, () => {
        onUpdate();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        onUpdate();
      })
      .subscribe();

    return () => {
      c.removeChannel(channel);
    };
  } catch (err) {
    console.warn('[Supabase] Realtime subscription notice:', err);
    return () => {};
  }
}

/**
 * Initiates the real Google OAuth 2.0 flow via Supabase Auth
 */
export async function signInWithGoogleOAuth(): Promise<{ success: boolean; error?: string }> {
  const c = getSupabaseClient();
  if (!c) {
    return {
      success: false,
      error: 'Supabase is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    };
  }

  try {
    const { error } = await c.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Google OAuth failed to initialize.' };
  }
}

/**
 * Strips sensitive tokens (access_token, id_token, code) from browser address bar
 * using window.history.replaceState to prevent token visibility in URLs.
 */
export function cleanAuthTokensFromUrl(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const hasHash =
    window.location.hash &&
    (window.location.hash.includes('access_token=') ||
      window.location.hash.includes('id_token=') ||
      window.location.hash.includes('token_type='));
  const hasQuery =
    window.location.search &&
    (window.location.search.includes('code=') ||
      window.location.search.includes('token=') ||
      window.location.search.includes('access_token='));

  if (hasHash || hasQuery) {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}

/**
 * Signs out from Supabase Auth explicitly.
 */
export async function supabaseSignOut(): Promise<void> {
  const c = getSupabaseClient();
  if (c) {
    try {
      await c.auth.signOut();
    } catch (e) {
      console.warn('[Supabase] signOut notice:', e);
    }
  }
}

/**
 * Listens for Supabase OAuth session changes (e.g. Google redirect login)
 */
export function subscribeToAuthChanges(callback: (user: Profile | null) => void): () => void {
  const c = getSupabaseClient();
  if (!c) {
    cleanAuthTokensFromUrl();
    return () => {};
  }

  const processSessionUser = async (session: any) => {
    if (!session?.user) return;
    const u = session.user;

    // Check if Google OAuth was intentionally initiated or returned via URL redirect
    const googleInitiated =
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem('agrimart_google_auth_initiated') === 'true';

    const isOAuthRedirectUrl =
      typeof window !== 'undefined' &&
      (window.location.hash.includes('access_token=') || window.location.search.includes('code='));

    if (googleInitiated || isOAuthRedirectUrl) {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('agrimart_google_auth_initiated');
      }
      // Intentionally clear old local JWT when switching/logging into Google
      setStoredJwtToken(null);
    } else {
      // Check if user is ALREADY authenticated with an active local account
      const currentLocalUser = appStorage.getCurrentUser();
      const storedJwt = getStoredJwtToken();
      if (currentLocalUser && currentLocalUser.authProvider === 'local' && storedJwt) {
        console.log('[Supabase OAuth] Active local user retained:', currentLocalUser.fullName);
        return;
      }
    }

    cleanAuthTokensFromUrl();

    // 1. Check if a profile ALREADY exists in Supabase database for this user (by ID or Email)
    const existing = await dbGetProfileByIdOrEmail(u.id, u.email);

    // If an existing profile was found and has a village, the profile is ALREADY COMPLETED!
    if (existing && existing.village && existing.village.trim() !== '') {
      const completedUser: Profile = {
        ...existing,
        id: u.id,
        email: existing.email || u.email || undefined,
        avatarUrl: existing.avatarUrl || u.user_metadata?.avatar_url || u.user_metadata?.picture,
        authProvider: 'google',
      };
      // Persist without wiping existing village
      dbUpsertProfile(completedUser).catch(() => {});
      callback(completedUser);
      return;
    }

    // 2. If no village is in table, check if user_metadata in Supabase Auth has village (from earlier setup)
    const metaVillage = u.user_metadata?.village;
    if (metaVillage && metaVillage.trim() !== '') {
      const completedFromMeta: Profile = {
        id: u.id,
        fullName: u.user_metadata?.full_name || u.user_metadata?.name || 'Kisan User',
        phone: u.user_metadata?.phone || existing?.phone || u.phone || undefined,
        email: u.email || existing?.email || undefined,
        avatarUrl: u.user_metadata?.avatar_url || u.user_metadata?.picture || existing?.avatarUrl,
        village: metaVillage.trim(),
        state: u.user_metadata?.state || 'Haryana',
        trustScore: 100,
        roleFlags: u.user_metadata?.role_flags || ['borrower', 'lender'],
        roles: ['borrower', 'lender', 'prosumer'],
        authProvider: 'google',
      };
      dbUpsertProfile(completedFromMeta).catch(() => {});
      callback(completedFromMeta);
      return;
    }

    // 3. This is truly a fresh Google registration that needs onboarding
    const newGoogleProfile: Profile = {
      id: u.id,
      fullName:
        existing?.fullName ||
        u.user_metadata?.full_name ||
        u.user_metadata?.name ||
        u.email?.split('@')[0] ||
        'Kisan User',
      phone: existing?.phone || u.phone || u.user_metadata?.phone || undefined,
      email: u.email || existing?.email || undefined,
      avatarUrl: u.user_metadata?.avatar_url || u.user_metadata?.picture || existing?.avatarUrl,
      village: undefined,
      state: existing?.state || u.user_metadata?.state || 'Haryana',
      trustScore: 100,
      roleFlags: existing?.roleFlags || ['borrower', 'lender'],
      roles: ['borrower', 'lender', 'prosumer'],
      authProvider: 'google',
    };

    // Notice: WE DO NOT CALL dbUpsertProfile here with village: null!
    callback(newGoogleProfile);
  };

  // Check existing session
  c.auth
    .getSession()
    .then(async ({ data: { session } }) => {
      if (session?.user) {
        await processSessionUser(session);
      } else {
        cleanAuthTokensFromUrl();
      }
    })
    .catch((err) => {
      cleanAuthTokensFromUrl();
      console.warn('[Supabase] getSession notice:', err);
    });

  const {
    data: { subscription },
  } = c.auth.onAuthStateChange(async (event, session) => {
    if (
      session?.user &&
      (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED')
    ) {
      await processSessionUser(session);
    } else if (event === 'SIGNED_OUT') {
      cleanAuthTokensFromUrl();
      // Do NOT log out user if they have an active local session or FastAPI JWT
      const current = appStorage.getCurrentUser();
      const jwtToken = getStoredJwtToken();
      if (!current && !jwtToken) {
        callback(null);
      }
    }
  });

  return () => {
    subscription.unsubscribe();
  };
}
