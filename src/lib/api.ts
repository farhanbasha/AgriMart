import { Booking, ConflictRecord, Profile, UserRole } from '../types';
import {
  arbitrateAndSequenceSmartSchedule,
  filterNonElapsedBookings,
  SmartScheduleResolutionResult,
} from './engine';

const API_TIMEOUT_MS = 4500;
const JWT_STORAGE_KEY = 'agrimart_jwt_access_token_v1';
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_BACKEND_URL || '';

export function getStoredJwtToken(): string | null {
  try {
    return localStorage.getItem(JWT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredJwtToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(JWT_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(JWT_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Failed to update stored JWT token', e);
  }
}

async function fetchWithTimeout<T>(endpoint: string, options: RequestInit, timeoutMs = API_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const token = getStoredJwtToken();
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const url = API_BASE_URL && endpoint.startsWith('/') ? `${API_BASE_URL.replace(/\/$/, '')}${endpoint}` : endpoint;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const detail = errorBody?.detail || `FastAPI HTTP ${response.status}`;
      throw new Error(detail);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface RawFastAPIScheduleResponse {
  has_conflict: boolean;
  was_shifted_by_locked_ongoing: boolean;
  locked_ongoing_bookings: Booking[];
  sequenced_bookings: Booking[];
  removed_elapsed_ids: string[];
  conflict_record: ConflictRecord | null;
}

/**
 * Calls the FastAPI `/api/v1/bookings/schedule` endpoint to prune elapsed bookings,
 * enforce the ongoing + 30-minute pre-start buffer lock, and arbitrate strictly
 * against remaining future bookings. Falls back seamlessly to the local mirror
 * if the Python server is unreachable.
 */
export async function scheduleBookingViaFastAPI(
  candidateBooking: Booking,
  existingBookings: Booking[],
  now: Date = new Date(),
  defaultBufferMinutes = 30
): Promise<SmartScheduleResolutionResult> {
  try {
    const raw = await fetchWithTimeout<RawFastAPIScheduleResponse>('/api/v1/bookings/schedule', {
      method: 'POST',
      body: JSON.stringify({
        candidate_booking: candidateBooking,
        existing_bookings: existingBookings,
        reference_now: now.toISOString(),
        default_buffer_minutes: defaultBufferMinutes,
      }),
    });
    return {
      hasConflict: raw.has_conflict,
      wasShiftedByLockedOngoing: raw.was_shifted_by_locked_ongoing,
      lockedOngoingBookings: raw.locked_ongoing_bookings || [],
      sequencedBookings: raw.sequenced_bookings || [],
      removedElapsedIds: raw.removed_elapsed_ids || [],
      conflictRecord: raw.conflict_record || null,
    };
  } catch {
    return arbitrateAndSequenceSmartSchedule(
      candidateBooking,
      existingBookings,
      defaultBufferMinutes,
      now.getTime()
    );
  }
}

/**
 * Calls the FastAPI `/api/v1/bookings/prune-elapsed` endpoint to strip out any
 * booking whose scheduled endTime has elapsed (`endTime <= now`).
 */
export async function pruneElapsedBookingsViaFastAPI(
  bookings: Booking[],
  now: Date = new Date()
): Promise<{ active_bookings: Booking[]; pruned_ids: string[]; pruned_count: number }> {
  try {
    const res = await fetchWithTimeout<{
      active_bookings: Booking[];
      removed_elapsed_ids: string[];
      removed_count: number;
    }>('/api/v1/bookings/prune-elapsed', {
      method: 'POST',
      body: JSON.stringify({
        bookings,
        reference_now: now.toISOString(),
      }),
    });
    return {
      active_bookings: res.active_bookings || [],
      pruned_ids: res.removed_elapsed_ids || [],
      pruned_count: res.removed_count || 0,
    };
  } catch {
    const { activeBookings, removedElapsedIds } = filterNonElapsedBookings(bookings, now.getTime());
    return {
      active_bookings: activeBookings,
      pruned_ids: removedElapsedIds,
      pruned_count: removedElapsedIds.length,
    };
  }
}

export async function evaluateUrgencyViaFastAPI(
  justificationText: string,
  cropStage: string,
  rainfallMm: number
): Promise<{
  verified_urgency_multiplier: number;
  credibility_score: number;
  ai_reasoning: string;
  flagged_for_review: boolean;
} | null> {
  try {
    return await fetchWithTimeout('/api/v1/urgency/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        justification_text: justificationText,
        crop_stage: cropStage,
        rainfall_mm: rainfallMm,
      }),
    });
  } catch {
    return null;
  }
}

export async function explainArbitrationViaFastAPI(payload: {
  winner_name: string;
  winner_score: number;
  winner_crop_stage: string;
  loser_name: string;
  loser_score: number;
  loser_crop_stage: string;
  pushed_by_hours: number;
  new_slot_str: string;
  language?: string;
}): Promise<{ sms_text: string } | null> {
  try {
    return await fetchWithTimeout<{ sms_text: string }>('/api/v1/arbitration/explain', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    return null;
  }
}

export async function simulateDisruptionViaFastAPI(payload: {
  disruption_type: string;
  affected_machine_id: string;
  duration_hours: number;
  current_schedule_json: string;
}): Promise<{
  system_action_taken: string;
  reallocated_bookings: Array<{
    farmer_name: string;
    original_slot: string;
    new_slot: string;
    assigned_machine: string;
    status: string;
  }>;
  sms_notifications: Array<{
    recipient: string;
    message: string;
  }>;
} | null> {
  try {
    return await fetchWithTimeout('/api/disruptions/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    return null;
  }
}

export async function sendSmsViaFastAPI(
  toPhone: string,
  messageBody: string
): Promise<{ success: boolean; mode: string; error?: string | null } | null> {
  try {
    return await fetchWithTimeout('/api/v1/sms/send', {
      method: 'POST',
      body: JSON.stringify({
        to_phone: toPhone,
        message_body: messageBody,
      }),
    });
  } catch {
    return null;
  }
}

// --- JWT Authentication, Registration, and Google OAuth ---

export interface BackendTokenResponse {
  access_token: string;
  token_type: string;
  expires_in_seconds: number;
  user: {
    id: string;
    full_name: string;
    phone: string;
    email?: string;
    village?: string;
    state?: string;
    trust_score: number;
    role_flags: UserRole[];
    roles: string[];
    permissions: string[];
    avatar_url?: string;
    password_hash?: string;
  };
}

export function mapBackendUserToProfile(u: BackendTokenResponse['user']): Profile {
  return {
    id: u.id,
    fullName: u.full_name,
    phone: u.phone,
    email: u.email,
    village: u.village,
    state: u.state,
    trustScore: u.trust_score,
    roleFlags: u.role_flags,
    roles: u.roles,
    permissions: u.permissions,
    avatarUrl: u.avatar_url,
    passwordHash: u.password_hash,
    password_hash: u.password_hash,
  };
}

export async function registerViaBackend(params: {
  fullName: string;
  phone?: string;
  email?: string;
  village?: string;
  state?: string;
  password?: string;
  roleFlags?: UserRole[];
}): Promise<{ success: boolean; user?: Profile; error?: string }> {
  try {
    const res = await fetchWithTimeout<BackendTokenResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: params.fullName,
        phone: params.phone || undefined,
        email: params.email || undefined,
        village: params.village,
        state: params.state || 'Haryana',
        password: params.password,
        role_flags: params.roleFlags || ['borrower'],
      }),
    });

    setStoredJwtToken(res.access_token);
    const profile = mapBackendUserToProfile(res.user);
    profile.authProvider = 'google';
    return { success: true, user: profile };
  } catch (err: any) {
    return { success: false, error: err.message || 'Registration failed' };
  }
}

export async function loginViaBackend(
  phoneOrEmail: string,
  password?: string
): Promise<{ success: boolean; user?: Profile; error?: string }> {
  try {
    const res = await fetchWithTimeout<BackendTokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: phoneOrEmail,
        phone: phoneOrEmail,
        email: phoneOrEmail,
        password: password || undefined,
      }),
    });

    setStoredJwtToken(res.access_token);
    const profile = mapBackendUserToProfile(res.user);
    profile.authProvider = 'google';
    return { success: true, user: profile };
  } catch (err: any) {
    return { success: false, error: err.message || 'Login failed' };
  }
}

export async function updateProfileViaBackend(params: {
  fullName?: string;
  phone?: string;
  village?: string;
  state?: string;
  roleFlags?: UserRole[];
}): Promise<{ success: boolean; user?: Profile; error?: string }> {
  try {
    const res = await fetchWithTimeout<BackendTokenResponse['user']>('/api/v1/auth/profile/update', {
      method: 'POST',
      body: JSON.stringify({
        full_name: params.fullName,
        phone: params.phone,
        village: params.village,
        state: params.state,
        role_flags: params.roleFlags,
      }),
    });

    const profile = mapBackendUserToProfile(res);
    return { success: true, user: profile };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update profile' };
  }
}

export async function loginWithGoogleViaBackend(params: {
  idToken: string;
  roleFlags?: UserRole[];
  village?: string;
  state?: string;
}): Promise<{ success: boolean; user?: Profile; error?: string }> {
  try {
    const res = await fetchWithTimeout<BackendTokenResponse>('/api/v1/auth/google', {
      method: 'POST',
      body: JSON.stringify({
        id_token: params.idToken,
        role_flags: params.roleFlags,
        village: params.village,
        state: params.state,
      }),
    });

    setStoredJwtToken(res.access_token);
    const profile = mapBackendUserToProfile(res.user);
    profile.authProvider = 'google';
    return { success: true, user: profile };
  } catch (err: any) {
    return { success: false, error: err.message || 'Google authentication failed' };
  }
}

export async function getAuthUserViaBackend(): Promise<Profile | null> {
  const token = getStoredJwtToken();
  if (!token) return null;

  try {
    const u = await fetchWithTimeout<BackendTokenResponse['user']>('/api/v1/auth/me', {
      method: 'GET',
    });
    return mapBackendUserToProfile(u);
  } catch {
    return null;
  }
}

export async function getRbacPermissionsViaBackend(): Promise<{ roles: string[]; permissions: string[] } | null> {
  try {
    return await fetchWithTimeout<{ roles: string[]; permissions: string[] }>('/api/v1/auth/rbac/permissions', {
      method: 'GET',
    });
  } catch {
    return null;
  }
}
