import { Booking, OperationalStatus, Plot, Profile, Resource, UserRole, WeatherCondition } from '../types';
import {
  isSupabaseConfigured,
  dbUpsertProfile,
  dbUpsertPlot,
  dbDeletePlot,
  dbUpsertResource,
  dbUpdateResourceStatus,
  dbDeleteResource,
  dbInsertBooking,
  dbUpdateBookingStatus,
} from './supabase';

// Browser storage keys (v3 clean slate, zero hardcoded mock data)
const STORAGE_KEYS = {
  RESOURCES: 'farmgrid_resources_v3',
  PLOTS: 'farmgrid_plots_v3',
  BOOKINGS: 'farmgrid_bookings_v3',
  THEME: 'farmgrid_ui_theme_v3',
  USERS: 'farmgrid_users_registry_v3',
  CURRENT_USER: 'farmgrid_current_user_v3',
};

export const DEFAULT_INDIAN_PLOTS: Plot[] = [];
export const DEFAULT_INDIAN_RESOURCES: Resource[] = [];
export const DEFAULT_FARMER_PROFILE: Profile = {
  id: 'guest-farmer',
  fullName: 'Guest Farmer',
  phone: '',
  trustScore: 100,
  roleFlags: ['borrower', 'lender'],
};

class LocalAppStorage {
  // --- USER AUTHENTICATION & PROFILES ---

  public getUsers(): Profile[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USERS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public saveUsers(users: Profile[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch (e) {
      console.error('Failed to save users registry', e);
    }
  }

  public getCurrentUser(): Profile | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public setCurrentUser(user: Profile | null): void {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    } catch (e) {
      console.error('Failed to save current user session', e);
    }
  }

  public registerUser(params: {
    fullName: string;
    phone: string;
    village?: string;
    state?: string;
    roleFlags: UserRole[];
    passwordPin?: string;
  }): { success: boolean; user?: Profile; error?: string } {
    const cleanPhone = params.phone.replace(/[\s\-()]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      return { success: false, error: 'Please enter a valid 10-digit mobile number' };
    }
    if (!params.fullName.trim()) {
      return { success: false, error: 'Please enter your full name' };
    }

    const users = this.getUsers();
    const existing = users.find((u) => u.phone.replace(/[\s\-()]/g, '') === cleanPhone);
    if (existing) {
      return { success: false, error: 'An account with this mobile number already exists. Please log in.' };
    }

    const newUser: Profile = {
      id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      fullName: params.fullName.trim(),
      phone: params.phone.trim(),
      village: params.village?.trim() || undefined,
      state: params.state?.trim() || undefined,
      trustScore: 100,
      roleFlags: params.roleFlags.length > 0 ? params.roleFlags : ['borrower', 'lender'],
      passwordPin: params.passwordPin?.trim() || undefined,
    };

    users.push(newUser);
    this.saveUsers(users);
    this.setCurrentUser(newUser);

    // Asynchronously synchronize with Supabase Cloud DB
    if (isSupabaseConfigured()) {
      dbUpsertProfile(newUser).catch((err) => {
        console.warn('[Storage] Supabase user sync notice:', err);
      });
    }

    return { success: true, user: newUser };
  }

  public loginUser(
    phone: string,
    passwordPin?: string
  ): { success: boolean; user?: Profile; error?: string } {
    const cleanPhone = phone.replace(/[\s\-()]/g, '');
    if (!cleanPhone) {
      return { success: false, error: 'Please enter your mobile number' };
    }

    const users = this.getUsers();
    const user = users.find((u) => {
      const uPhone = u.phone.replace(/[\s\-()]/g, '');
      return uPhone === cleanPhone || uPhone.endsWith(cleanPhone) || cleanPhone.endsWith(uPhone);
    });

    if (!user) {
      return {
        success: false,
        error: 'No registered farmer or owner account found with this number. Please register first.',
      };
    }

    if (user.passwordPin && passwordPin && user.passwordPin !== passwordPin.trim()) {
      return { success: false, error: 'Incorrect 4-digit PIN. Please try again.' };
    }

    this.setCurrentUser(user);
    return { success: true, user };
  }

  public logoutUser(): void {
    this.setCurrentUser(null);
  }

  // --- RESOURCES (Zero Hardcoded Data) ---

  public getResources(): Resource[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.RESOURCES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public saveResources(resources: Resource[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(resources));
    } catch (e) {
      console.error('Failed to save resources', e);
    }
  }

  public addResource(item: Omit<Resource, 'id'>): Resource {
    const resources = this.getResources();
    const newResource: Resource = {
      ...item,
      id: `res-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      conditionRating: item.conditionRating || 4.8,
      operationalStatus: item.operationalStatus || 'available',
      baseLat: item.baseLat || 29.68,
      baseLng: item.baseLng || 76.99,
      maxRadiusKm: item.maxRadiusKm || 50.0,
      operatingHours: item.operatingHours || '06:00 AM - 08:00 PM',
    };
    resources.unshift(newResource);
    this.saveResources(resources);

    // Asynchronously synchronize with Supabase Cloud DB
    if (isSupabaseConfigured()) {
      dbUpsertResource(newResource).catch((err) => {
        console.warn('[Storage] Supabase resource sync notice:', err);
      });
    }

    return newResource;
  }

  public updateResource(id: string, updates: Partial<Resource>): Resource | null {
    const resources = this.getResources();
    const idx = resources.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    resources[idx] = { ...resources[idx], ...updates };
    this.saveResources(resources);

    // Asynchronously synchronize with Supabase Cloud DB
    if (isSupabaseConfigured()) {
      dbUpsertResource(resources[idx]).catch((err) => {
        console.warn('[Storage] Supabase update resource notice:', err);
      });
    }

    return resources[idx];
  }

  public updateResourceStatus(id: string, status: OperationalStatus): Resource | null {
    const res = this.updateResource(id, { operationalStatus: status });
    if (isSupabaseConfigured()) {
      dbUpdateResourceStatus(id, status).catch((err) => {
        console.warn('[Storage] Supabase update resource status notice:', err);
      });
    }
    return res;
  }

  public deleteResource(id: string): boolean {
    const resources = this.getResources();
    const filtered = resources.filter((r) => r.id !== id);
    if (filtered.length !== resources.length) {
      this.saveResources(filtered);
      if (isSupabaseConfigured()) {
        dbDeleteResource(id).catch((err) => {
          console.warn('[Storage] Supabase delete resource notice:', err);
        });
      }
      return true;
    }
    return false;
  }

  public upsertResource(resource: Resource): void {
    const resources = this.getResources();
    const idx = resources.findIndex((r) => r.id === resource.id);
    if (idx !== -1) {
      resources[idx] = { ...resources[idx], ...resource };
    } else {
      resources.unshift(resource);
    }
    this.saveResources(resources);
  }

  // --- PLOTS (Zero Hardcoded Data) ---

  public getPlots(): Plot[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PLOTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public savePlots(plots: Plot[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PLOTS, JSON.stringify(plots));
    } catch (e) {
      console.error('Failed to save plots', e);
    }
  }

  public addPlot(item: Omit<Plot, 'id'>): Plot {
    const plots = this.getPlots();
    const newPlot: Plot = {
      ...item,
      id: `plot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      latitude: item.latitude || 29.68,
      longitude: item.longitude || 76.99,
      weather: item.weather || {
        rainfallMm: 0.0,
        rainProbabilityPercent: 10,
        severeAlert: false,
        description: 'Normal farm weather.',
      },
    };
    plots.unshift(newPlot);
    this.savePlots(plots);

    // Asynchronously synchronize with Supabase Cloud DB
    if (isSupabaseConfigured()) {
      dbUpsertPlot(newPlot).catch((err) => {
        console.warn('[Storage] Supabase plot sync notice:', err);
      });
    }

    return newPlot;
  }

  public updatePlot(id: string, updates: Partial<Plot>): Plot | null {
    const plots = this.getPlots();
    const idx = plots.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    plots[idx] = { ...plots[idx], ...updates };
    this.savePlots(plots);

    // Asynchronously synchronize with Supabase Cloud DB
    if (isSupabaseConfigured()) {
      dbUpsertPlot(plots[idx]).catch((err) => {
        console.warn('[Storage] Supabase update plot notice:', err);
      });
    }

    return plots[idx];
  }

  public updatePlotWeather(id: string, weather: WeatherCondition): Plot | null {
    return this.updatePlot(id, { weather });
  }

  public deletePlot(id: string): boolean {
    const plots = this.getPlots();
    const filtered = plots.filter((p) => p.id !== id);
    if (filtered.length !== plots.length) {
      this.savePlots(filtered);
      if (isSupabaseConfigured()) {
        dbDeletePlot(id).catch((err) => {
          console.warn('[Storage] Supabase delete plot notice:', err);
        });
      }
      return true;
    }
    return false;
  }

  public upsertPlot(plot: Plot): void {
    const plots = this.getPlots();
    const idx = plots.findIndex((p) => p.id === plot.id);
    if (idx !== -1) {
      plots[idx] = { ...plots[idx], ...plot };
    } else {
      plots.unshift(plot);
    }
    this.savePlots(plots);
  }

  // --- BOOKINGS (Zero Hardcoded Data) ---

  public getBookings(): Booking[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public saveBookings(bookings: Booking[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    } catch (e) {
      console.error('Failed to save bookings', e);
    }
  }

  public addBooking(booking: Booking): void {
    const bookings = this.getBookings();
    const exists = bookings.some((b) => b.id === booking.id);
    if (!exists) {
      bookings.unshift(booking);
      this.saveBookings(bookings);
    }

    // Asynchronously synchronize with Supabase Cloud DB
    if (isSupabaseConfigured()) {
      dbInsertBooking(booking).catch((err) => {
        console.warn('[Storage] Supabase booking sync notice:', err);
      });
    }
  }

  public updateBookingStatus(bookingId: string, status: Booking['status']): void {
    const bookings = this.getBookings();
    const idx = bookings.findIndex((b) => b.id === bookingId);
    if (idx !== -1) {
      bookings[idx].status = status;
      this.saveBookings(bookings);
    }

    // Asynchronously synchronize with Supabase Cloud DB
    if (isSupabaseConfigured()) {
      dbUpdateBookingStatus(bookingId, status).catch((err) => {
        console.warn('[Storage] Supabase update booking status notice:', err);
      });
    }
  }

  public updateBooking(updatedBooking: Booking): void {
    const bookings = this.getBookings();
    const idx = bookings.findIndex((b) => b.id === updatedBooking.id);
    if (idx !== -1) {
      bookings[idx] = { ...bookings[idx], ...updatedBooking };
      this.saveBookings(bookings);
    } else {
      bookings.unshift(updatedBooking);
      this.saveBookings(bookings);
    }

    // Asynchronously synchronize with Supabase Cloud DB
    if (isSupabaseConfigured()) {
      dbInsertBooking(updatedBooking).catch((err) => {
        console.warn('[Storage] Supabase update booking notice:', err);
      });
    }
  }

  // --- DYNAMIC SEARCH SUGGESTIONS ---

  public getSearchSuggestions(query: string): string[] {
    if (!query || query.trim().length < 1) return [];

    const normalized = query.toLowerCase().trim();
    const resources = this.getResources();
    const plots = this.getPlots();

    const suggestionsSet = new Set<string>();

    for (const r of resources) {
      if (r.name.toLowerCase().includes(normalized)) suggestionsSet.add(r.name);
      if (r.village && r.village.toLowerCase().includes(normalized)) suggestionsSet.add(r.village);
      if (r.specs && r.specs.toLowerCase().includes(normalized)) {
        suggestionsSet.add(`${r.name} (${r.category})`);
      }
    }

    for (const p of plots) {
      if (p.cropType.toLowerCase().includes(normalized)) suggestionsSet.add(p.cropType);
      if (p.plotName.toLowerCase().includes(normalized)) suggestionsSet.add(p.plotName);
      if (p.village && p.village.toLowerCase().includes(normalized)) suggestionsSet.add(p.village);
    }

    const standardCategories = ['Machinery', 'Irrigation', 'Labour Crew', 'Drone Spraying', 'Cold Storage'];
    for (const cat of standardCategories) {
      if (cat.toLowerCase().includes(normalized)) suggestionsSet.add(cat);
    }

    return Array.from(suggestionsSet).slice(0, 8);
  }

  // --- UI THEME ---

  public getTheme(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.THEME) || 'kisan_green';
    } catch {
      return 'kisan_green';
    }
  }

  public setTheme(theme: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (e) {
      console.error('Failed to save theme', e);
    }
  }

  // --- RESET SYSTEM TO CLEAN STATE ---

  public resetAll(): void {
    localStorage.removeItem(STORAGE_KEYS.RESOURCES);
    localStorage.removeItem(STORAGE_KEYS.PLOTS);
    localStorage.removeItem(STORAGE_KEYS.BOOKINGS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
}

export const appStorage = new LocalAppStorage();
