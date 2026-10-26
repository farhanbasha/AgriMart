import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Booking,
  ConflictRecord,
  CropStage,
  IntentType,
  OperationalStatus,
  Plot,
  Profile,
  Resource,
  UserRole,
  UrgencyEvaluationResult,
} from './types';
import {
  calculateHaversineDistance,
  calculateTransitBuffer,
  computeDeterministicPriorityScore,
  arbitrateAndSequenceSmartSchedule,
  filterNonElapsedBookings,
} from './lib/engine';
import {
  scheduleBookingViaFastAPI,
  pruneElapsedBookingsViaFastAPI,
  setStoredJwtToken,
  getStoredJwtToken,
} from './lib/api';
import { evaluateUrgencyHeuristic } from './lib/gemini';
import { offlineSync } from './lib/offlineSync';
import { appStorage } from './lib/storage';
import {
  dbGetPlots,
  dbGetResources,
  dbGetBookings,
  dbGetProfiles,
  dbUpsertPlot,
  dbUpsertResource,
  dbInsertBooking,
  dbUpdateBookingStatus,
  dbDeleteBookings,
  dbUpdateResourceStatus,
  dbDeleteResource,
  subscribeToSupabaseChanges,
  subscribeToAuthChanges,
  supabaseSignOut,
  cleanAuthTokensFromUrl,
  isSupabaseConfigured,
  checkSupabaseHealth,
} from './lib/supabase';
import { initAutoDeviceLocation } from './lib/deviceLocation';
import {
  sendBookingConfirmationSMS,
  sendDriverDispatchSMS,
  sendDisruptionAlertSMS,
  isSMSConfigured,
} from './lib/sms';
import { Header, AppNavTab } from './components/Header';
import { SentinelBar } from './components/SentinelBar';
import { DeviceWeatherWidget } from './components/DeviceWeatherWidget';
import { FarmerActionPanel } from './components/FarmerActionPanel';
import { MasterTimeline } from './components/MasterTimeline';
import { EquipmentCardGrid } from './components/EquipmentCardGrid';
import { OwnerActionPanel } from './components/OwnerActionPanel';
import { ArbitrationModal } from './components/ArbitrationModal';
import { DisruptionSimulatorModal } from './components/DisruptionSimulatorModal';
import { AddResourceView } from './components/AddResourceView';
import { PlotsManager } from './components/PlotsManager';
import { AuthModal } from './components/AuthModal';
import { SupabaseStatusModal } from './components/SupabaseStatusModal';
import { Logo } from './components/Logo';
import { NotFoundPage } from './components/NotFoundPage';
import {
  CheckCircle2,
  CalendarCheck,
  PlusCircle,
  Search,
  MapPin,
  Tractor,
  Sparkles,
  Phone,
  Database,
} from 'lucide-react';

const KNOWN_ROUTES: Record<string, AppNavTab> = {
  '/': 'explore',
  '': 'explore',
  '/explore': 'explore',
  '/bookings': 'bookings',
  '/timeline': 'bookings',
  '/plots': 'plots',
  '/land': 'plots',
  '/owner': 'owner',
  '/fleet': 'owner',
  '/add': 'add',
  '/list-machine': 'add',
};

function normalizePath(rawPath: string): string {
  if (!rawPath) return '/';
  const clean = rawPath.trim();
  const withoutTrailing = clean.length > 1 ? clean.replace(/\/+$/, '') : clean;
  return withoutTrailing.toLowerCase() || '/';
}

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window === 'undefined') return '/';
    return normalizePath(window.location.pathname);
  });

  const [isNotFound, setIsNotFound] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const path = normalizePath(window.location.pathname);
    const isOAuth =
      window.location.hash.includes('access_token=') ||
      window.location.search.includes('code=');
    if (isOAuth) return false;
    return !(path in KNOWN_ROUTES);
  });

  const [activeTab, setActiveTab] = useState<AppNavTab>(() => {
    if (typeof window === 'undefined') return 'explore';
    const path = normalizePath(window.location.pathname);
    return KNOWN_ROUTES[path] || 'explore';
  });

  const handleSelectTab = useCallback((tab: AppNavTab) => {
    setActiveTab(tab);
    setIsNotFound(false);
    const targetPath = tab === 'explore' ? '/' : `/${tab}`;
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
      setCurrentPath(targetPath);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const path = normalizePath(window.location.pathname);
      setCurrentPath(path);
      const isOAuth =
        window.location.hash.includes('access_token=') ||
        window.location.search.includes('code=');
      if (isOAuth) {
        setIsNotFound(false);
        return;
      }
      if (path in KNOWN_ROUTES) {
        setIsNotFound(false);
        setActiveTab(KNOWN_ROUTES[path]);
      } else {
        setIsNotFound(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [activeRole, setActiveRole] = useState<UserRole>('borrower');

  // Kisan User Authentication & Session
  const [currentUser, setCurrentUser] = useState<Profile | null>(() => appStorage.getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'complete-profile'>('login');
  const [pendingAuthUser, setPendingAuthUser] = useState<Profile | null>(null);

  // Dynamic Data from appStorage (No hardcoded data)
  const [plots, setPlots] = useState<Plot[]>(() => appStorage.getPlots());
  const [resources, setResources] = useState<Resource[]>(() => appStorage.getResources());
  const [bookings, setBookings] = useState<Booking[]>(() => appStorage.getBookings());

  // User-scoped plot selection (Strict RBAC: unauthenticated guests see zero plots)
  const userPlots = useMemo(() => {
    if (currentUser) {
      return plots.filter((p) => p.farmerId === currentUser.id);
    }
    return [];
  }, [plots, currentUser]);

  const [selectedPlotId, setSelectedPlotId] = useState<string>(() => {
    return userPlots[0]?.id || plots[0]?.id || '';
  });

  const [selectedResourceId, setSelectedResourceId] = useState<string>(() => {
    const initialResources = appStorage.getResources();
    return initialResources[0]?.id || '';
  });

  const [activeConflict, setActiveConflict] = useState<ConflictRecord | null>(null);

  // Modals
  const [isArbitrationOpen, setIsArbitrationOpen] = useState(false);
  const [isDisruptionOpen, setIsDisruptionOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Offline Sync State
  const [isOnline, setIsOnline] = useState<boolean>(offlineSync.isOnline());
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(
    offlineSync.getQueuedBookings().length
  );

  // Automatic Device Location Detection & Authentication Session Sync
  useEffect(() => {
    initAutoDeviceLocation().then((loc) => {
      if (loc.status === 'granted') {
        console.log('[AgriMart] Auto device location granted:', loc.placeName, loc.latitude, loc.longitude);
      }
    });

    // Listen for OAuth session updates (e.g. Google Sign-In redirect)
    const unsubAuth = subscribeToAuthChanges((authProfile) => {
      if (authProfile) {
        // If the user is actively logged in via normal registration/login, preserve their session
        const localUser = appStorage.getCurrentUser();
        const localJwt = getStoredJwtToken();
        const googleAuthInitiated =
          typeof sessionStorage !== 'undefined' &&
          sessionStorage.getItem('agrimart_google_auth_initiated') === 'true';

        if (!googleAuthInitiated && localUser && localUser.authProvider === 'local' && localJwt && localUser.id !== authProfile.id) {
          return;
        }

        // Only prompt profile completion if this is a Google registration with missing village
        if (authProfile.authProvider === 'google' && (!authProfile.village || authProfile.village.trim() === '')) {
          setPendingAuthUser(authProfile);
          setAuthModalMode('complete-profile');
          setIsAuthModalOpen(true);
        } else {
          appStorage.setCurrentUser(authProfile);
          setCurrentUser(authProfile);
          setIsAuthModalOpen(false);
          setPendingAuthUser(null);
          showToast(`Namaste ${authProfile.fullName}! Welcome to AgriMart.`);
        }
      }
    });

    return () => {
      unsubAuth();
    };
  }, []);

  // Synchronize state from storage (localStorage + Supabase)
  const refreshDataFromStorage = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setPlots(appStorage.getPlots());
      setResources(appStorage.getResources());
      setBookings(appStorage.getBookings());
      return;
    }

    try {
      const health = await checkSupabaseHealth();
      if (health.tablesFound) {
        const [cloudProfiles, cloudPlots, cloudResources, cloudBookings] = await Promise.all([
          dbGetProfiles(),
          dbGetPlots(),
          dbGetResources(),
          dbGetBookings(),
        ]);

        // 1. Sync User Profiles (Do NOT log out active session!)
        if (cloudProfiles && cloudProfiles.length > 0) {
          appStorage.saveUsers(cloudProfiles);
          const currentSavedUser = appStorage.getCurrentUser();
          if (currentSavedUser) {
            const matchingProfile = cloudProfiles.find((u) => u.id === currentSavedUser.id);
            if (matchingProfile) {
              const merged = { ...currentSavedUser, ...matchingProfile };
              appStorage.setCurrentUser(merged);
              setCurrentUser((prev) => (prev ? { ...prev, ...matchingProfile } : merged));
            }
          }
        }

        // 2. Sync Plots
        appStorage.savePlots(cloudPlots || []);
        setPlots(cloudPlots || []);

        // 3. Sync Resources
        appStorage.saveResources(cloudResources || []);
        setResources(cloudResources || []);

        // 4. Sync Bookings with strict unique ID mapping & elapsed-booking auto-pruning
        const nowMs = Date.now();
        const localBookings = appStorage.getBookings(nowMs);
        const bookingMap = new Map<string, Booking>();
        const expiredCloudIds: string[] = [];

        // Cloud bookings take precedence as authoritative truth (only if not elapsed)
        (cloudBookings || []).forEach((b) => {
          if (b && b.id) {
            const endMs = new Date(b.endTime).getTime();
            if (Number.isNaN(endMs) || endMs <= nowMs) {
              expiredCloudIds.push(b.id);
              return;
            }
            // Once confirmed in cloud, clear the offline cached flag
            bookingMap.set(b.id, { ...b, isOfflineCached: false });
          }
        });

        // Clean up any elapsed cloud bookings from Supabase DB
        if (expiredCloudIds.length > 0) {
          dbDeleteBookings(expiredCloudIds).catch((err) => {
            console.warn('[App] Supabase elapsed booking cleanup notice:', err);
          });
        }

        // Only include local offline-cached bookings if they do not yet exist in cloud and haven't elapsed
        localBookings.forEach((b) => {
          if (b && b.id && b.isOfflineCached && !bookingMap.has(b.id)) {
            const endMs = new Date(b.endTime).getTime();
            if (!Number.isNaN(endMs) && endMs > nowMs) {
              bookingMap.set(b.id, b);
            }
          }
        });

        const synchedBookings = Array.from(bookingMap.values());
        appStorage.saveBookings(synchedBookings);
        setBookings(synchedBookings);
      } else {
        setPlots(appStorage.getPlots());
        setResources(appStorage.getResources());
        setBookings(appStorage.getBookings());
      }
    } catch (err) {
      console.warn('[App] Supabase background sync notice:', err);
      setPlots(appStorage.getPlots());
      setResources(appStorage.getResources());
      setBookings(appStorage.getBookings());
    }
  }, []);

  // Live Elapsed Bookings Sweeper: Automatically remove any booking whose endTime has elapsed
  useEffect(() => {
    const sweepElapsed = () => {
      const { activeBookings, prunedCount } = appStorage.pruneElapsedBookings(Date.now());
      if (prunedCount > 0) {
        setBookings(activeBookings);
      } else {
        setBookings((prev) => {
          const { activeBookings: filtered } = filterNonElapsedBookings(prev, Date.now());
          return filtered.length !== prev.length ? filtered : prev;
        });
      }
      // Also notify FastAPI prune endpoint in background if online
      if (appStorage.getBookings().length > 0) {
        pruneElapsedBookingsViaFastAPI(appStorage.getBookings(), new Date()).catch(() => {});
      }
    };

    sweepElapsed();
    const timerId = setInterval(sweepElapsed, 15000);
    return () => clearInterval(timerId);
  }, [activeTab]);

  // Update selectedPlotId when user changes or plots update
  useEffect(() => {
    if (userPlots.length > 0) {
      if (!userPlots.some((p) => p.id === selectedPlotId)) {
        setSelectedPlotId(userPlots[0].id);
      }
    } else {
      setSelectedPlotId('');
    }
  }, [userPlots]);

  // Subscribe to network & offline queue state changes
  useEffect(() => {
    const unsubscribe = offlineSync.subscribe((state) => {
      setIsOnline(state.isOnline);
      setOfflineQueueCount(state.queue.length);
    });
    return unsubscribe;
  }, []);

  // Cloud synchronization (Initial + Realtime + Continuous background sync)
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    // Initial load
    refreshDataFromStorage();

    // Realtime changes listener
    const unsubscribeRealtime = subscribeToSupabaseChanges(() => {
      refreshDataFromStorage();
    });

    // 4-second background poll so cancellations and updates reflect on all devices
    const intervalId = setInterval(() => {
      refreshDataFromStorage();
    }, 4000);

    return () => {
      unsubscribeRealtime();
      clearInterval(intervalId);
    };
  }, [refreshDataFromStorage]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleAuthSuccess = (user: Profile) => {
    setCurrentUser(user);
    setPendingAuthUser(null);
    if (user.roleFlags.includes('lender') && !user.roleFlags.includes('borrower')) {
      setActiveRole('lender');
    } else {
      setActiveRole('borrower');
    }
    showToast(`Namaste ${user.fullName}! Welcome to AgriMart.`);
    refreshDataFromStorage();
  };

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setPendingAuthUser(null);
    setIsAuthModalOpen(true);
  };

  const handleLogout = async () => {
    await supabaseSignOut();
    setStoredJwtToken(null);
    appStorage.logoutUser();
    setCurrentUser(null);
    showToast('Logged out successfully.');
  };

  const currentPlot = userPlots.find((p) => p.id === selectedPlotId) || userPlots[0] || null;

  // Connectivity Toggle Handler
  const handleToggleConnectivity = async () => {
    const nextOnline = !isOnline;
    offlineSync.setManualOfflineOverride(!nextOnline);

    if (nextOnline) {
      showToast('Network connected! Syncing offline requests with central schedule...');
      await triggerSyncOfflineQueue();
    } else {
      showToast('Switched to Low-Signal Offline mode. Requests are saved to your phone.');
    }
  };

  // Sync offline queued bookings
  const triggerSyncOfflineQueue = async () => {
    const queued = offlineSync.getQueuedBookings();
    if (queued.length === 0) return;

    await offlineSync.syncQueue(async (items) => {
      const confirmedBookings: Booking[] = items.map((q) => {
        const targetPlot = plots.find((p) => p.id === q.plotId) || plots[0];
        const targetResource = resources.find((r) => r.id === q.resourceId) || resources[0];

        const dist = calculateHaversineDistance(
          targetPlot.latitude,
          targetPlot.longitude,
          targetResource.baseLat,
          targetResource.baseLng
        );
        const transit = calculateTransitBuffer(dist);
        const score = computeDeterministicPriorityScore({
          hoursUntilStart: q.hoursUntilStart,
          imminentRainfallMm: targetPlot.weather?.rainfallMm || 6.0,
          severeWeatherAlert: targetPlot.weather?.severeAlert || false,
          cropStage: q.cropStage,
          queueWaitHours: 3.5,
          distanceKm: dist,
          intent: q.intent,
          resourceConditionRating: targetResource.conditionRating,
        });

        const now = new Date();
        const startTime = new Date(now.getTime() + q.hoursUntilStart * 3600 * 1000).toISOString();
        const endTime = new Date(
          now.getTime() + (q.hoursUntilStart + q.durationHours) * 3600 * 1000
        ).toISOString();

        const cost =
          targetResource.rateUnit === 'per_acre'
            ? targetResource.hourlyRate * targetPlot.acres
            : targetResource.rateUnit === 'per_day'
              ? targetResource.hourlyRate * Math.max(1, Math.round(q.durationHours / 8))
              : targetResource.hourlyRate * q.durationHours;

        return {
          id: q.id,
          resourceId: targetResource.id,
          resourceName: targetResource.name,
          farmerId: currentUser?.id || 'guest-farmer',
          farmerName: currentUser?.fullName || 'Guest Farmer',
          plotId: targetPlot.id,
          plotName: targetPlot.plotName,
          plotLat: targetPlot.latitude,
          plotLng: targetPlot.longitude,
          cropStage: q.cropStage,
          intent: q.intent,
          startTime,
          endTime,
          priorityScore: score.totalPriorityScore,
          scoreBreakdown: score,
          status: 'confirmed',
          transitBufferMinutes: transit.totalBufferMinutes,
          distanceKm: dist,
          notes: q.notes,
          allocatedSlotExplanation: `Synced successfully! Scheduled with +${transit.totalBufferMinutes} min transit buffer.`,
          totalCostRupees: cost,
          isOfflineCached: false,
        };
      });

      confirmedBookings.forEach((b) => appStorage.addBooking(b));
      setBookings(appStorage.getBookings());
      return confirmedBookings;
    });

    showToast(`All ${queued.length} offline booking(s) synced and scheduled!`);
  };

  // Submit Booking Handler
  const handleBookingSubmit = (bookingData: {
    plotId: string;
    resourceId: string;
    intent: IntentType;
    cropStage: CropStage;
    durationHours: number;
    hoursUntilStart: number;
    earliestStart?: string;
    latestEnd?: string;
    urgencyJustification?: string;
    urgencyEvaluation?: UrgencyEvaluationResult;
    notes: string;
  }) => {
    if (!currentUser) {
      showToast('Authentication required: Please log in with your account to book machinery.');
      openAuthModal('login');
      return;
    }

    if (userPlots.length === 0) {
      showToast('Please register at least one farm plot under your account before booking machinery.');
      handleSelectTab('plots');
      return;
    }
    if (resources.length === 0) {
      showToast('Please list or select an equipment unit before booking.');
      handleSelectTab('add');
      return;
    }

    const targetPlot = userPlots.find((p) => p.id === bookingData.plotId) || userPlots[0];
    const targetResource = resources.find((r) => r.id === bookingData.resourceId) || resources[0];
    if (!targetPlot || !targetResource) return;

    const dist = calculateHaversineDistance(
      targetPlot.latitude,
      targetPlot.longitude,
      targetResource.baseLat,
      targetResource.baseLng
    );
    const transit = calculateTransitBuffer(dist);

    const cost =
      targetResource.rateUnit === 'per_acre'
        ? targetResource.hourlyRate * targetPlot.acres
        : targetResource.rateUnit === 'per_day'
          ? targetResource.hourlyRate * Math.max(1, Math.round(bookingData.durationHours / 8))
          : targetResource.hourlyRate * bookingData.durationHours;

    const startTime = bookingData.earliestStart || new Date(Date.now() + bookingData.hoursUntilStart * 3600 * 1000).toISOString();
    const endTime = bookingData.latestEnd || new Date(new Date(startTime).getTime() + bookingData.durationHours * 3600 * 1000).toISOString();

    const urgencyBonus = bookingData.urgencyEvaluation
      ? bookingData.urgencyEvaluation.urgencyScoreBonus
      : evaluateUrgencyHeuristic(bookingData.urgencyJustification || '', bookingData.cropStage, targetPlot.weather?.rainfallMm).urgencyScoreBonus;

    const score = computeDeterministicPriorityScore({
      hoursUntilStart: bookingData.hoursUntilStart,
      imminentRainfallMm: targetPlot.weather?.rainfallMm || 6.0,
      severeWeatherAlert: targetPlot.weather?.severeAlert || false,
      cropStage: bookingData.cropStage,
      queueWaitHours: 3.5,
      distanceKm: dist,
      intent: bookingData.intent,
      resourceConditionRating: targetResource.conditionRating,
      urgencyJustificationBonus: urgencyBonus,
      urgencyEvaluation: bookingData.urgencyEvaluation,
    });

    if (!isOnline) {
      // Save locally to offline queue
      const offlineItem = offlineSync.queueBooking({
        plotId: targetPlot.id,
        resourceId: targetResource.id,
        intent: bookingData.intent,
        cropStage: bookingData.cropStage,
        durationHours: bookingData.durationHours,
        hoursUntilStart: bookingData.hoursUntilStart,
        notes: bookingData.notes,
      });

      const provisionalBooking: Booking = {
        id: offlineItem.id,
        resourceId: targetResource.id,
        resourceName: targetResource.name,
        farmerId: currentUser.id,
        farmerName: currentUser.fullName,
        plotId: targetPlot.id,
        plotName: targetPlot.plotName,
        plotLat: targetPlot.latitude,
        plotLng: targetPlot.longitude,
        cropStage: bookingData.cropStage,
        intent: bookingData.intent,
        startTime,
        endTime,
        priorityScore: score.totalPriorityScore,
        scoreBreakdown: score,
        status: 'confirmed',
        transitBufferMinutes: transit.totalBufferMinutes,
        distanceKm: dist,
        urgencyJustification: bookingData.urgencyJustification,
        urgencyEvaluation: bookingData.urgencyEvaluation,
        earliestStart: startTime,
        latestEnd: endTime,
        notes: bookingData.notes,
        isOfflineCached: true,
        allocatedSlotExplanation:
          'Saved to Local Cache (Offline). Will synchronize automatically once signal returns.',
        totalCostRupees: cost,
      };

      appStorage.addBooking(provisionalBooking);
      setBookings(appStorage.getBookings());
      showToast('Saved to Local Cache (Offline). Will auto-sync when online.');
      handleSelectTab('bookings');
      return;
    }

    const candidateBooking: Booking = {
      id: `book-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      resourceId: targetResource.id,
      resourceName: targetResource.name,
      farmerId: currentUser.id,
      farmerName: currentUser.fullName,
      plotId: targetPlot.id,
      plotName: targetPlot.plotName,
      plotLat: targetPlot.latitude,
      plotLng: targetPlot.longitude,
      cropStage: bookingData.cropStage,
      intent: bookingData.intent,
      startTime,
      endTime,
      priorityScore: score.totalPriorityScore,
      scoreBreakdown: score,
      status: 'confirmed',
      transitBufferMinutes: transit.totalBufferMinutes,
      distanceKm: dist,
      notes: bookingData.notes,
      urgencyJustification: bookingData.urgencyJustification,
      urgencyEvaluation: bookingData.urgencyEvaluation,
      earliestStart: startTime,
      latestEnd: endTime,
      allocatedSlotExplanation: `Booking confirmed! Estimated total: ₹${cost.toLocaleString(
        'en-IN'
      )}. Dispatched with +${transit.totalBufferMinutes} min buffer.`,
      totalCostRupees: cost,
    };

    const nowDate = new Date();
    const activeCurrentBookings = appStorage.getBookings(nowDate.getTime());

    // Run Smart Schedule Arbitration (prunes elapsed, locks ongoing & 30m buffer, arbitrates strictly against remaining)
    const smartResult = arbitrateAndSequenceSmartSchedule(
      candidateBooking,
      activeCurrentBookings,
      transit.totalBufferMinutes,
      nowDate.getTime()
    );

    // Also invoke FastAPI backend endpoint asynchronously to keep backend state & logs synchronized
    scheduleBookingViaFastAPI(
      candidateBooking,
      activeCurrentBookings,
      nowDate,
      transit.totalBufferMinutes
    ).catch(() => {});

    // Persist all sequenced bookings (candidate + any re-sequenced remaining bookings)
    smartResult.sequencedBookings.forEach((b) => {
      if (b.id === candidateBooking.id) {
        appStorage.addBooking(b);
      } else {
        appStorage.updateBooking(b);
      }
    });
    setBookings(appStorage.getBookings());

    const allocatedBooking =
      smartResult.sequencedBookings.find((b) => b.id === candidateBooking.id) ||
      smartResult.sequencedBookings[0] ||
      candidateBooking;

    if (smartResult.hasConflict && smartResult.conflictRecord) {
      const winner = smartResult.sequencedBookings[0] || allocatedBooking;
      const candidateWon = winner.id === candidateBooking.id;

      setActiveConflict(smartResult.conflictRecord);
      setIsArbitrationOpen(true);
      handleSelectTab('bookings');

      if (candidateWon) {
        showToast(
          smartResult.wasShiftedByLockedOngoing
            ? `Ongoing shift protected! Your request (${winner.priorityScore}/100) won 1st Remaining Turn right after the active shift.`
            : `Fair Turn Decision: Priority 1st Turn awarded to your request (${winner.priorityScore}/100)! Competing request sequenced to Turn #2.`
        );
      } else {
        const myTurnIndex =
          smartResult.sequencedBookings.findIndex((b) => b.id === candidateBooking.id) + 1;
        showToast(
          `Fair Turn Decision: ${winner.farmerName} holds higher priority (${winner.priorityScore}/100) among remaining schedules. Your request is Turn #${myTurnIndex}.`
        );
      }

      if (currentUser?.phone) {
        sendBookingConfirmationSMS({
          farmerPhone: currentUser.phone,
          farmerName: currentUser.fullName,
          resourceName: targetResource.name,
          plotName: targetPlot.plotName,
          startTime: allocatedBooking.startTime,
          totalCostRupees: cost,
          priorityScore: allocatedBooking.priorityScore,
          transitBufferMinutes: transit.totalBufferMinutes,
        });
      }

      return;
    }

    // No remaining-schedule collision (either direct confirmation, or shifted cleanly after a locked ongoing/30m-buffer schedule)
    if (smartResult.wasShiftedByLockedOngoing) {
      const formattedStart = new Date(allocatedBooking.startTime).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      showToast(
        `Ongoing/30m-buffer shift is locked & undisturbed. Your booking (${score.totalPriorityScore}/100) is scheduled next at ${formattedStart}!`
      );
    } else {
      showToast(`Booked ${targetResource.name}! Priority Score: ${score.totalPriorityScore}/100.`);
    }
    handleSelectTab('bookings');

    // Automated Twilio SMS Dispatch to Farmer & Driver
    if (isSMSConfigured() && currentUser?.phone) {
      sendBookingConfirmationSMS({
        farmerPhone: currentUser.phone,
        farmerName: currentUser.fullName,
        resourceName: targetResource.name,
        plotName: targetPlot.plotName,
        startTime: allocatedBooking.startTime,
        totalCostRupees: cost,
        priorityScore: score.totalPriorityScore,
        transitBufferMinutes: transit.totalBufferMinutes,
      }).then((res) => {
        if (res.success && !res.simulated) {
          showToast(`SMS dispatch alert sent to farmer (${currentUser.phone})!`);
        }
      });

      if (targetResource.ownerPhone) {
        sendDriverDispatchSMS({
          ownerPhone: targetResource.ownerPhone,
          ownerName: targetResource.ownerName,
          resourceName: targetResource.name,
          plotName: targetPlot.plotName,
          farmerName: currentUser.fullName,
          startTime: allocatedBooking.startTime,
          distanceKm: dist,
        });
      }
    }
  };

  // Cancel Booking Handler (Strictly only the farmer who created the booking can cancel)
  const handleCancelBooking = async (bookingId: string) => {
    const targetBooking = bookings.find((b) => b.id === bookingId);
    if (!targetBooking) return;

    if (!currentUser || targetBooking.farmerId !== currentUser.id) {
      showToast('Action not allowed: Only the farmer who created this booking can cancel it.');
      return;
    }

    appStorage.updateBookingStatus(bookingId, 'cancelled');
    if (isSupabaseConfigured()) {
      await dbUpdateBookingStatus(bookingId, 'cancelled');
    }
    await refreshDataFromStorage();
    showToast('Booking cancelled successfully. Equipment slot is now freed for other farmers.');
  };

  // Add Resource callback
  const handleResourceAdded = (newResource: Resource) => {
    refreshDataFromStorage();
    if (isSupabaseConfigured()) {
      dbUpsertResource(newResource);
    }
    showToast(`Added ${newResource.name} to community resources!`);
  };

  // Add Plot callback
  const handlePlotAdded = (newPlot: Plot) => {
    refreshDataFromStorage();
    setSelectedPlotId(newPlot.id);
    if (isSupabaseConfigured()) {
      dbUpsertPlot(newPlot);
    }
    showToast(`Saved field "${newPlot.plotName}"!`);
  };

  // Delete Resource
  const handleDeleteResource = (resourceId: string) => {
    appStorage.deleteResource(resourceId);
    refreshDataFromStorage();
    if (isSupabaseConfigured()) {
      dbDeleteResource(resourceId);
    }
    showToast('Equipment removed from your listings.');
  };

  // Update Resource Operational Status
  const handleUpdateResourceStatus = (resourceId: string, status: OperationalStatus) => {
    appStorage.updateResourceStatus(resourceId, status);
    refreshDataFromStorage();
    if (isSupabaseConfigured()) {
      dbUpdateResourceStatus(resourceId, status);
    }
    showToast(`Machine status updated to ${status.replace('_', ' ')}.`);
  };

  // Crisis Disruption Simulation Handler
  const handleApplyDisruption = (
    type: 'EQUIPMENT_BREAKDOWN' | 'SUDDEN_RAIN_ALERT',
    resourceId: string
  ) => {
    const target = resources.find((r) => r.id === resourceId) || resources[0];
    if (type === 'EQUIPMENT_BREAKDOWN') {
      if (target) {
        handleUpdateResourceStatus(target.id, 'maintenance');
      }
      showToast(
        `Breakdown logged: ${target.name} flagged to Maintenance. Pending bookings rerouted to cooperative reserve!`
      );
    } else {
      showToast(
        'Severe storm warning (+32mm) triggered. Pre-storm harvest operations prioritized!'
      );
    }

    // Automated Disruption SMS Alerts to affected farmers
    const impacted = bookings.filter((b) => b.resourceId === target.id);
    if (impacted.length > 0 && isSMSConfigured() && currentUser?.phone) {
      impacted.forEach((b) => {
        sendDisruptionAlertSMS({
          farmerPhone: currentUser.phone,
          farmerName: b.farmerName,
          resourceName: target.name,
          reason: type === 'EQUIPMENT_BREAKDOWN' ? 'Mechanical breakdown' : 'Severe rain alert',
          substituteInfo: 'Cooperative Reserve unit reassigned with zero penalty',
        });
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f8f5] flex flex-col w-full max-w-full overflow-x-hidden">
      {/* 1. Header with Menu Navigation & Cloud DB trigger */}
      <Header
        activeTab={isNotFound ? ('' as any) : activeTab}
        onSelectTab={handleSelectTab}
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        conflictCount={activeConflict ? 1 : 0}
        onOpenFairTurnModal={() => setIsArbitrationOpen(true)}
        isOnline={isOnline}
        onToggleConnectivity={handleToggleConnectivity}
        offlineQueueCount={offlineQueueCount}
        onManualSync={triggerSyncOfflineQueue}
        currentUser={currentUser}
        onOpenAuthModal={() => openAuthModal('login')}
        onLogout={handleLogout}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
      />

      {/* 2. Weather Alert Sentinel Banner */}
      <SentinelBar
        onInspectPriority={() => setIsArbitrationOpen(true)}
        onSimulateDisruption={() => setIsDisruptionOpen(true)}
      />

      {/* 3. Toast Notifications */}
      {toastMessage && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 right-3 sm:left-auto sm:right-4 sm:bottom-6 z-50 max-w-md bg-neutral-950/95 text-white px-4 py-3.5 rounded-2xl shadow-2xl border border-neutral-700/80 backdrop-blur-md flex items-center gap-3 animate-fade-in text-xs font-semibold"
        >
          <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="flex-1 leading-snug">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </aside>
      )}

      {/* 4. Main Tabbed Views or 404 Not Found Page */}
      <main className="flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-16 flex flex-col w-full max-w-full min-w-0 overflow-x-hidden">
        {isNotFound ? (
          <NotFoundPage
            attemptedPath={currentPath}
            onNavigate={handleSelectTab}
            availableResourcesCount={resources.length}
            plotsCount={userPlots.length || plots.length}
            bookingsCount={bookings.length}
          />
        ) : (
          <>
            {activeTab === 'explore' && (
              <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8 min-w-0">
                {/* Automatic Device Geolocation & 5-Day Predictive Weather Widget */}
                <DeviceWeatherWidget
                  activePlot={currentPlot}
                />

                {/* Action Panel: Book Machinery / Labour with Conflict Detection & User-Owned Plots */}
                <FarmerActionPanel
                  plots={plots}
                  resources={resources}
                  bookings={bookings}
                  selectedPlotId={selectedPlotId}
                  onSelectPlot={setSelectedPlotId}
                  selectedResourceId={selectedResourceId}
                  onSelectResource={setSelectedResourceId}
                  isOnline={isOnline}
                  onOpenAddPlot={() => handleSelectTab('plots')}
                  onOpenAddResource={() => handleSelectTab('add')}
                  currentUser={currentUser}
                  onOpenAuthModal={() => openAuthModal('login')}
                  onSubmitBooking={handleBookingSubmit}
                />

                {/* Equipment, Services & Labour Browser with Lender Radius Filter */}
                <EquipmentCardGrid
                  resources={resources}
                  activePlot={currentPlot}
                  currentUser={currentUser}
                  onRequestResource={(resId) => {
                    if (!currentUser) {
                      showToast('Please log in with your mobile number or email to select and book equipment.');
                      openAuthModal('login');
                      return;
                    }
                    setSelectedResourceId(resId);
                    const target = resources.find((r) => r.id === resId);
                    if (target) {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      showToast(`Selected "${target.name}". Review details above to confirm booking.`);
                    }
                  }}
                  onDeleteResource={handleDeleteResource}
                  onNavigateToAdd={() => {
                    if (!currentUser) {
                      showToast('Please log in with your account before listing machinery.');
                      openAuthModal('login');
                      return;
                    }
                    handleSelectTab('add');
                  }}
                />
              </div>
            )}

            {activeTab === 'add' && (
              <div className="w-full max-w-full min-w-0">
                <AddResourceView
                  onResourceAdded={handleResourceAdded}
                  onPlotAdded={handlePlotAdded}
                  onViewExplore={() => handleSelectTab('explore')}
                  currentUser={currentUser}
                  onOpenAuthModal={() => openAuthModal('login')}
                />
              </div>
            )}

            {activeTab === 'bookings' && (
              <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
                <MasterTimeline
                  bookings={bookings}
                  resources={resources}
                  activeConflict={activeConflict}
                  onOpenArbitration={() => setIsArbitrationOpen(true)}
                  onCancelBooking={handleCancelBooking}
                  currentUser={currentUser}
                />
              </div>
            )}

            {activeTab === 'plots' && (
              <PlotsManager
                plots={plots}
                onPlotsChange={setPlots}
                currentUser={currentUser}
                onOpenAuthModal={() => openAuthModal('login')}
                onBookForPlot={(plotId) => {
                  setSelectedPlotId(plotId);
                  handleSelectTab('explore');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  showToast('Plot selected for booking. Choose your machine below.');
                }}
              />
            )}

            {activeTab === 'owner' && (
              <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
                <OwnerActionPanel
                  resources={resources}
                  bookings={bookings}
                  currentUserId={currentUser?.id || ''}
                  currentUser={currentUser}
                  onUpdateStatus={handleUpdateResourceStatus}
                  onNavigateToAdd={() => handleSelectTab('add')}
                  onOpenAuthModal={() => openAuthModal('login')}
                  onCancelBooking={handleCancelBooking}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* 5. Cooperative Footer */}
      <footer className="bg-white border-t border-neutral-200/90 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-6 text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Logo size="sm" />
              <span className="font-bold text-neutral-900">AgriMart Kisan Seva</span>
              <span className="text-neutral-300">|</span>
              <span>Made for Indian Farmers</span>
              <span className="text-neutral-300">|</span>
              <span></span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsSupabaseModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold border border-neutral-300 transition-colors"
              >
                <Database className="w-3.5 h-3.5 text-emerald-700" />
                <span>Cloud PostgreSQL Setup</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDisruptionOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold border border-amber-200 transition-colors"
              >
                <span>Crisis Simulator</span>
              </button>

              <button
                type="button"
                onClick={() => setIsArbitrationOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-semibold border border-emerald-200 transition-colors"
              >
                <span>Fair Turn Rules</span>
              </button>

            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-neutral-100 text-[11px] text-neutral-400">
            <p>
              Open Cooperative Engine: Zero sponsored placement ranking. Turn priority determined by crop maturity, weather risk, and waiting turn.
            </p>
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span>Offline Cache Sync v3.0</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Fair Turn Priority Modal */}
      <ArbitrationModal
        conflict={activeConflict}
        isOpen={isArbitrationOpen}
        onClose={() => setIsArbitrationOpen(false)}
        onConfirmWinner={(winnerId) => {
          showToast(`Fair allocation awarded to booking [${winnerId}].`);
          setActiveConflict(null);
        }}
      />

      {/* Autonomous Fleet Reroute Engine / Crisis Disruption Modal */}
      <DisruptionSimulatorModal
        isOpen={isDisruptionOpen}
        onClose={() => setIsDisruptionOpen(false)}
        resources={resources}
        bookings={bookings}
        onApplyDisruption={handleApplyDisruption}
      />

      {/* Kisan Auth Modal (Login / Sign Up / Complete Profile) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setPendingAuthUser(null);
        }}
        onAuthSuccess={handleAuthSuccess}
        initialMode={authModalMode}
        initialUser={pendingAuthUser}
      />

      {/* Supabase Cloud Database Status & Migration Modal */}
      <SupabaseStatusModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onRefreshData={refreshDataFromStorage}
      />
    </div>
  );
}
