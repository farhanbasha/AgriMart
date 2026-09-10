import { Booking, Resource, Plot } from '../types';
import { computeDeterministicPriorityScore, calculateHaversineDistance, calculateTransitBuffer } from './engine';

const OFFLINE_QUEUE_KEY = 'farmgrid_offline_booking_queue_v1';
const OFFLINE_MODE_OVERRIDE_KEY = 'farmgrid_manual_offline_override_v1';
const CACHED_RESOURCES_KEY = 'farmgrid_cached_resources_v1';
const CACHED_PLOTS_KEY = 'farmgrid_cached_plots_v1';

export type NetworkStatus = 'online' | 'offline';

type NetworkChangeListener = (status: NetworkStatus) => void;
type QueueChangeListener = (queue: Booking[]) => void;

class OfflineSyncManager {
  private networkListeners: Set<NetworkChangeListener> = new Set();
  private queueListeners: Set<QueueChangeListener> = new Set();
  private manualOfflineOverride: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const storedOverride = localStorage.getItem(OFFLINE_MODE_OVERRIDE_KEY);
      this.manualOfflineOverride = storedOverride === 'true';

      window.addEventListener('online', () => {
        if (!this.manualOfflineOverride) {
          this.notifyNetworkChange('online');
        }
      });

      window.addEventListener('offline', () => {
        this.notifyNetworkChange('offline');
      });
    }
  }

  public isOnline(): boolean {
    if (typeof window === 'undefined') return true;
    if (this.manualOfflineOverride) return false;
    return window.navigator.onLine;
  }

  public getNetworkStatus(): NetworkStatus {
    return this.isOnline() ? 'online' : 'offline';
  }

  public setManualOfflineOverride(isOffline: boolean) {
    this.manualOfflineOverride = isOffline;
    if (typeof window !== 'undefined') {
      localStorage.setItem(OFFLINE_MODE_OVERRIDE_KEY, isOffline ? 'true' : 'false');
    }
    const currentStatus = this.getNetworkStatus();
    this.notifyNetworkChange(currentStatus);
  }

  public getManualOfflineOverride(): boolean {
    return this.manualOfflineOverride;
  }

  public subscribe(callback: (state: { isOnline: boolean; queue: Booking[] }) => void): () => void {
    const notify = () => {
      callback({
        isOnline: this.isOnline(),
        queue: this.getOfflineQueue(),
      });
    };
    const unsubNet = this.onNetworkChange(() => notify());
    const unsubQ = this.onQueueChange(() => notify());
    return () => {
      unsubNet();
      unsubQ();
    };
  }

  public getQueuedBookings(): Booking[] {
    return this.getOfflineQueue();
  }

  public queueBooking(data: {
    plotId: string;
    resourceId: string;
    intent: any;
    cropStage: any;
    durationHours: number;
    hoursUntilStart: number;
    notes: string;
  }): { id: string; queuedAt: string } {
    const id = `offline-q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date();
    const startTime = new Date(now.getTime() + data.hoursUntilStart * 3600 * 1000).toISOString();
    const endTime = new Date(
      now.getTime() + (data.hoursUntilStart + data.durationHours) * 3600 * 1000
    ).toISOString();

    const draftBooking: Booking = {
      id,
      resourceId: data.resourceId,
      resourceName: 'Queued Resource',
      farmerId: 'farmer-prosumer-01',
      farmerName: 'Elias Vance',
      plotId: data.plotId,
      plotName: 'Plot',
      plotLat: 41.5,
      plotLng: -93.6,
      cropStage: data.cropStage,
      intent: data.intent,
      startTime,
      endTime,
      priorityScore: 50,
      scoreBreakdown: {
        urgencyDeadlinePts: 10,
        weatherRiskPts: 10,
        cropVulnerabilityPts: 10,
        antiStarvationPts: 10,
        logisticsProximityPts: 5,
        intentConditionPts: 5,
        totalPriorityScore: 50,
      },
      status: 'pending',
      transitBufferMinutes: 30,
      distanceKm: 10,
      notes: data.notes,
      isOfflineCached: true,
      offlineQueuedAt: now.toISOString(),
    };

    this.saveToOfflineQueue(draftBooking);
    return { id, queuedAt: now.toISOString() };
  }

  public async syncQueue(
    syncHandler?: (items: any[]) => Promise<any[]>
  ): Promise<{ syncedCount: number }> {
    const queue = this.getOfflineQueue();
    if (queue.length === 0) return { syncedCount: 0 };
    if (syncHandler) {
      await syncHandler(queue);
      this.clearOfflineQueue();
      return { syncedCount: queue.length };
    }
    this.clearOfflineQueue();
    return { syncedCount: queue.length };
  }

  public onNetworkChange(callback: NetworkChangeListener): () => void {
    this.networkListeners.add(callback);
    return () => this.networkListeners.delete(callback);
  }

  public onQueueChange(callback: QueueChangeListener): () => void {
    this.queueListeners.add(callback);
    return () => this.queueListeners.delete(callback);
  }

  private notifyNetworkChange(status: NetworkStatus) {
    this.networkListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.error('Error in network listener:', err);
      }
    });
  }

  private notifyQueueChange(queue: Booking[]) {
    this.queueListeners.forEach((listener) => {
      try {
        listener(queue);
      } catch (err) {
        console.error('Error in queue listener:', err);
      }
    });
  }

  // ============================================================================
  // QUEUE OPERATIONS
  // ============================================================================

  public getOfflineQueue(): Booking[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to read offline queue:', e);
      return [];
    }
  }

  public saveToOfflineQueue(booking: Booking): Booking {
    const queue = this.getOfflineQueue();
    const offlineBooking: Booking = {
      ...booking,
      isOfflineCached: true,
      offlineQueuedAt: new Date().toISOString(),
      status: 'pending',
    };

    const updatedQueue = [offlineBooking, ...queue.filter((b) => b.id !== booking.id)];
    if (typeof window !== 'undefined') {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));
    }

    this.notifyQueueChange(updatedQueue);
    return offlineBooking;
  }

  public removeFromOfflineQueue(bookingId: string) {
    const queue = this.getOfflineQueue();
    const updated = queue.filter((b) => b.id !== bookingId);
    if (typeof window !== 'undefined') {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
    }
    this.notifyQueueChange(updated);
  }

  public clearOfflineQueue() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    }
    this.notifyQueueChange([]);
  }

  // ============================================================================
  // SYNCHRONIZATION WITH CENTRAL ENGINE
  // ============================================================================

  public async syncOfflineQueue(
    resources: Resource[],
    plots: Plot[],
    existingBookings: Booking[]
  ): Promise<{
    syncedBookings: Booking[];
    failedCount: number;
    summary: string;
  }> {
    const queue = this.getOfflineQueue();
    if (queue.length === 0) {
      return { syncedBookings: [], failedCount: 0, summary: 'No offline requests pending.' };
    }

    const syncedBookings: Booking[] = [];
    let failedCount = 0;

    for (const item of queue) {
      try {
        const targetPlot = plots.find((p) => p.id === item.plotId) || {
          latitude: item.plotLat,
          longitude: item.plotLng,
          plotName: item.plotName,
          cropStage: item.cropStage,
        };

        const targetResource = resources.find((r) => r.id === item.resourceId) || resources[0];

        const dist = calculateHaversineDistance(
          targetPlot.latitude,
          targetPlot.longitude,
          targetResource.baseLat,
          targetResource.baseLng
        );

        const transit = calculateTransitBuffer(dist);

        // Calculate deterministic score
        const score = computeDeterministicPriorityScore({
          hoursUntilStart: 2.0,
          imminentRainfallMm: targetPlot && 'weather' in targetPlot && targetPlot.weather ? targetPlot.weather.rainfallMm : 0,
          severeWeatherAlert: targetPlot && 'weather' in targetPlot && targetPlot.weather ? targetPlot.weather.severeAlert : false,
          cropStage: item.cropStage,
          queueWaitHours: 3.5,
          distanceKm: dist,
          intent: item.intent,
          resourceConditionRating: targetResource.conditionRating,
        });

        const syncedItem: Booking = {
          ...item,
          isOfflineCached: false,
          status: 'confirmed',
          priorityScore: score.totalPriorityScore,
          scoreBreakdown: score,
          transitBufferMinutes: transit.totalBufferMinutes,
          distanceKm: dist,
          allocatedSlotExplanation: `Synced with Central Scheduler. Allocated priority score ${score.totalPriorityScore}/100 with a ${transit.totalBufferMinutes} min transit buffer.`,
        };

        syncedBookings.push(syncedItem);
      } catch (err) {
        console.error('Error syncing offline item:', err);
        failedCount++;
      }
    }

    // Clear local storage queue upon sync
    this.clearOfflineQueue();

    return {
      syncedBookings,
      failedCount,
      summary: `Successfully synchronized ${syncedBookings.length} offline request${
        syncedBookings.length === 1 ? '' : 's'
      } to FarmGrid Central.`,
    };
  }

  // ============================================================================
  // CACHE PERSISTENCE FOR MASTER DATA
  // ============================================================================

  public cacheMasterData(resources: Resource[], plots: Plot[]) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CACHED_RESOURCES_KEY, JSON.stringify(resources));
      localStorage.setItem(CACHED_PLOTS_KEY, JSON.stringify(plots));
    } catch (e) {
      console.error('Failed to cache master data:', e);
    }
  }

  public getCachedMasterData(): { resources: Resource[] | null; plots: Plot[] | null } {
    if (typeof window === 'undefined') return { resources: null, plots: null };
    try {
      const res = localStorage.getItem(CACHED_RESOURCES_KEY);
      const plo = localStorage.getItem(CACHED_PLOTS_KEY);
      return {
        resources: res ? JSON.parse(res) : null,
        plots: plo ? JSON.parse(plo) : null,
      };
    } catch {
      return { resources: null, plots: null };
    }
  }
}

export const offlineSync = new OfflineSyncManager();
