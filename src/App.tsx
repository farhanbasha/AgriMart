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
  UITheme,
  UrgencyEvaluationResult,
} from './types';
import {
  calculateHaversineDistance,
  calculateTransitBuffer,
  computeDeterministicPriorityScore,
  checkFeasibleTimeSlot,
  rankCollidingBookings,
  sequenceCollidingBookings,
} from './lib/engine';
import { evaluateUrgencyHeuristic } from './lib/gemini';
import { offlineSync } from './lib/offlineSync';
import { appStorage } from './lib/storage';
import {
  dbGetPlots,
  dbGetResources,
  dbGetBookings,
  dbUpsertPlot,
  dbUpsertResource,
  dbInsertBooking,
  dbUpdateBookingStatus,
  dbUpdateResourceStatus,
  dbDeleteResource,
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
import { UIDesignSelector } from './components/UIDesignSelector';
import { AuthModal } from './components/AuthModal';
import { SupabaseStatusModal } from './components/SupabaseStatusModal';
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

export default function App() {
  const [activeTab, setActiveTab] = useState<AppNavTab>('explore');
  const [activeRole, setActiveRole] = useState<UserRole>('borrower');

  // Kisan User Authentication & Session
  const [currentUser, setCurrentUser] = useState<Profile | null>(() => appStorage.getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Dynamic Data from appStorage (No hardcoded data)
  const [plots, setPlots] = useState<Plot[]>(() => appStorage.getPlots());
  const [resources, setResources] = useState<Resource[]>(() => appStorage.getResources());
  const [bookings, setBookings] = useState<Booking[]>(() => appStorage.getBookings());

  // User-scoped plot selection
  const userPlots = useMemo(() => {
    if (currentUser) {
      return plots.filter((p) => p.farmerId === currentUser.id);
    }
    return plots;
  }, [plots, currentUser]);

  const [selectedPlotId, setSelectedPlotId] = useState<string>(() => {
    return userPlots[0]?.id || plots[0]?.id || '';
  });

  const [selectedResourceId, setSelectedResourceId] = useState<string>(() => {
    const initialResources = appStorage.getResources();
    return initialResources[0]?.id || '';
  });

  const [activeConflict, setActiveConflict] = useState<ConflictRecord | null>(null);

  // UI Theme state
  const [currentTheme, setCurrentTheme] = useState<UITheme>(() => appStorage.getTheme());
  const [isUISelectorOpen, setIsUISelectorOpen] = useState(false);

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

  // Automatic Device Location Detection on entering website
  useEffect(() => {
    initAutoDeviceLocation().then((loc) => {
      if (loc.status === 'granted') {
        console.log('[FarmGrid] Auto device location granted:', loc.placeName, loc.latitude, loc.longitude);
      }
    });
  }, []);

  // Synchronize state from storage (localStorage + Supabase)
  const refreshDataFromStorage = useCallback(async () => {
    setPlots(appStorage.getPlots());
    setResources(appStorage.getResources());
    setBookings(appStorage.getBookings());

    if (isSupabaseConfigured()) {
      try {
        const health = await checkSupabaseHealth();
        if (health.tablesFound) {
          const [cloudPlots, cloudResources, cloudBookings] = await Promise.all([
            dbGetPlots(),
            dbGetResources(),
            dbGetBookings(),
          ]);
          if (cloudPlots.length > 0) {
            cloudPlots.forEach((p) => appStorage.upsertPlot(p));
            setPlots(appStorage.getPlots());
          }
          if (cloudResources.length > 0) {
            cloudResources.forEach((r) => appStorage.upsertResource(r));
            setResources(appStorage.getResources());
          }
          if (cloudBookings.length > 0) {
            cloudBookings.forEach((b) => appStorage.addBooking(b));
            setBookings(appStorage.getBookings());
          }
        }
      } catch (err) {
        console.warn('[App] Supabase background sync notice:', err);
      }
    }
  }, []);

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

  // Initial cloud synchronization
  useEffect(() => {
    if (isSupabaseConfigured()) {
      refreshDataFromStorage();
    }
  }, [refreshDataFromStorage]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleAuthSuccess = (user: Profile) => {
    setCurrentUser(user);
    if (user.roleFlags.includes('lender') && !user.roleFlags.includes('borrower')) {
      setActiveRole('lender');
    } else {
      setActiveRole('borrower');
    }
    showToast(`Namaste ${user.fullName}! Welcome to FarmGrid.`);
  };

  const handleLogout = () => {
    appStorage.logoutUser();
    setCurrentUser(null);
    showToast('Logged out successfully.');
  };

  const handleSelectTheme = (theme: UITheme) => {
    setCurrentTheme(theme);
    appStorage.setTheme(theme);
    showToast(`Design theme set to ${theme.replace('_', ' ').toUpperCase()}`);
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
    if (plots.length === 0) {
      showToast('Please register a farm plot before booking equipment.');
      setActiveTab('plots');
      return;
    }
    if (resources.length === 0) {
      showToast('Please list or select an equipment unit before booking.');
      setActiveTab('add');
      return;
    }

    const targetPlot = plots.find((p) => p.id === bookingData.plotId) || plots[0];
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
        farmerId: currentUser?.id || 'guest-farmer',
        farmerName: currentUser?.fullName || 'Guest Farmer',
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
      setActiveTab('bookings');
      return;
    }

    // Check Feasibility and Time-Slot Collisions
    const feasibility = checkFeasibleTimeSlot(
      targetResource,
      targetPlot,
      startTime,
      endTime,
      bookings
    );

    const hasCollision = feasibility.hasTimeCollision && feasibility.conflictingBookings && feasibility.conflictingBookings.length > 0;

    if (hasCollision) {
      const collidingBookings = feasibility.conflictingBookings!;

      const candidateBooking: Booking = {
        id: `book-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        resourceId: targetResource.id,
        resourceName: targetResource.name,
        farmerId: currentUser?.id || 'guest-farmer',
        farmerName: currentUser?.fullName || 'Guest Farmer',
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
        totalCostRupees: cost,
      };

      // Rank all competing bookings descending by priority score
      const competingList = [candidateBooking, ...collidingBookings];
      const ranked = rankCollidingBookings(competingList);

      // Automatically sequence colliding bookings into consecutive non-overlapping slots
      const sequencedList = sequenceCollidingBookings(ranked, transit.totalBufferMinutes);
      const winner = sequencedList[0];
      const runnerUp = sequencedList[1] || sequencedList[0];
      const candidateWon = winner.id === candidateBooking.id;

      // Persist all sequenced bookings to local storage and Supabase
      sequencedList.forEach((seqBooking) => {
        if (seqBooking.id === candidateBooking.id) {
          appStorage.addBooking(seqBooking);
        } else {
          appStorage.updateBooking(seqBooking);
        }
      });
      setBookings(appStorage.getBookings());

      const primaryFactor = winner.scoreBreakdown.weatherRiskPts > runnerUp.scoreBreakdown.weatherRiskPts
        ? 'Imminent Rainfall & Weather Threat'
        : (winner.scoreBreakdown.urgencyJustificationPts || 0) >= 5
        ? 'Emergency Urgency Justification & Spoilage Prevention'
        : 'Biological Crop Vulnerability & Shatter Risk';

      const conflictRecord: ConflictRecord = {
        id: `conflict-${Date.now().toString(36)}`,
        resourceId: targetResource.id,
        resourceName: targetResource.name,
        bookingA: winner,
        bookingB: runnerUp,
        winningBookingId: winner.id,
        losingBookingId: runnerUp.id,
        justificationEn: `Fair Turn Priority Decision: ${winner.farmerName} (${winner.priorityScore}/100) received 1st Priority Turn over ${runnerUp.farmerName} (${runnerUp.priorityScore}/100). ${
          winner.urgencyJustification ? `Winner justification: "${winner.urgencyJustification}". ` : ''
        }Subsequent requests automatically scheduled to consecutive non-overlapping slots. Deciding factors: ${primaryFactor} (+${(winner.priorityScore - runnerUp.priorityScore).toFixed(1)} pts advantage).`,
        contingencyAction: `Sequential scheduling active: ${runnerUp.farmerName} has been automatically allocated the next available consecutive slot without time collision.`,
        primaryDecidingFactor: primaryFactor,
        resolvedAt: new Date().toISOString(),
        rankedBookings: sequencedList,
      };

      setActiveConflict(conflictRecord);
      setIsArbitrationOpen(true);
      setActiveTab('bookings');

      if (candidateWon) {
        showToast(`Fair Turn Decision: Priority 1st Turn awarded to your request (${winner.priorityScore}/100)! Competing request sequenced to Turn #2.`);
      } else {
        const myTurnIndex = sequencedList.findIndex((b) => b.id === candidateBooking.id) + 1;
        showToast(`Fair Turn Decision: ${winner.farmerName} holds higher priority (${winner.priorityScore}/100). Your request is sequenced to Turn #${myTurnIndex}.`);
      }

      // Send SMS notifications
      if (currentUser?.phone) {
        const myBooking = sequencedList.find((b) => b.id === candidateBooking.id) || candidateBooking;
        sendBookingConfirmationSMS({
          farmerPhone: currentUser.phone,
          farmerName: currentUser.fullName,
          resourceName: targetResource.name,
          plotName: targetPlot.plotName,
          startTime: myBooking.startTime,
          totalCostRupees: cost,
          priorityScore: myBooking.priorityScore,
          transitBufferMinutes: transit.totalBufferMinutes,
        });
      }

      return;
    }

    // No collision: Direct Confirmation
    const newBooking: Booking = {
      id: `book-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      resourceId: targetResource.id,
      resourceName: targetResource.name,
      farmerId: currentUser?.id || 'guest-farmer',
      farmerName: currentUser?.fullName || 'Guest Farmer',
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

    appStorage.addBooking(newBooking);
    if (isSupabaseConfigured()) {
      dbInsertBooking(newBooking);
    }
    setBookings(appStorage.getBookings());
    showToast(`Booked ${targetResource.name}! Priority Score: ${score.totalPriorityScore}/100.`);
    setActiveTab('bookings');

    // Automated Twilio SMS Dispatch to Farmer & Driver
    if (isSMSConfigured() && currentUser?.phone) {
      sendBookingConfirmationSMS({
        farmerPhone: currentUser.phone,
        farmerName: currentUser.fullName,
        resourceName: targetResource.name,
        plotName: targetPlot.plotName,
        startTime,
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
          startTime,
          distanceKm: dist,
        });
      }
    }
  };

  // Cancel Booking Handler (Strictly only the farmer who created the booking can cancel)
  const handleCancelBooking = (bookingId: string) => {
    const targetBooking = bookings.find((b) => b.id === bookingId);
    if (!targetBooking) return;

    if (!currentUser || targetBooking.farmerId !== currentUser.id) {
      showToast('Action not allowed: Only the farmer who created this booking can cancel it.');
      return;
    }

    appStorage.updateBookingStatus(bookingId, 'cancelled');
    setBookings(appStorage.getBookings());
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
    <div className={`min-h-screen theme-${currentTheme} transition-colors duration-200 flex flex-col`}>
      {/* 1. Header with Menu Navigation & Cloud DB trigger */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onOpenUISelector={() => setIsUISelectorOpen(true)}
        currentTheme={currentTheme}
        conflictCount={activeConflict ? 1 : 0}
        onOpenFairTurnModal={() => setIsArbitrationOpen(true)}
        isOnline={isOnline}
        onToggleConnectivity={handleToggleConnectivity}
        offlineQueueCount={offlineQueueCount}
        onManualSync={triggerSyncOfflineQueue}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
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
          className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:bottom-6 z-50 max-w-md bg-neutral-950/95 text-white px-4 py-3.5 rounded-2xl shadow-2xl border border-neutral-700/80 backdrop-blur-md flex items-center gap-3 animate-fade-in text-xs font-semibold"
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

      {/* 4. Main Tabbed Views */}
      <main className="flex-1 pb-24 lg:pb-16">
        {activeTab === 'explore' && (
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8">
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
              onOpenAddPlot={() => setActiveTab('plots')}
              onOpenAddResource={() => setActiveTab('add')}
              currentUser={currentUser}
              onSubmitBooking={handleBookingSubmit}
            />

            {/* Equipment, Services & Labour Browser with Lender Radius Filter */}
            <EquipmentCardGrid
              resources={resources}
              activePlot={currentPlot}
              currentUser={currentUser}
              onRequestResource={(resId) => {
                setSelectedResourceId(resId);
                const target = resources.find((r) => r.id === resId);
                if (target) {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  showToast(`Selected "${target.name}". Review details above to confirm booking.`);
                }
              }}
              onDeleteResource={handleDeleteResource}
              onNavigateToAdd={() => setActiveTab('add')}
            />
          </div>
        )}

        {activeTab === 'add' && (
          <AddResourceView
            onResourceAdded={handleResourceAdded}
            onPlotAdded={handlePlotAdded}
            onViewExplore={() => setActiveTab('explore')}
            currentUser={currentUser}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
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
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onBookForPlot={(plotId) => {
              setSelectedPlotId(plotId);
              setActiveTab('explore');
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
              onNavigateToAdd={() => setActiveTab('add')}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onCancelBooking={handleCancelBooking}
            />
          </div>
        )}
      </main>

      {/* 5. Cooperative Footer */}
      <footer className="bg-white border-t border-neutral-200/90 py-6 pb-24 lg:pb-6 text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-700 text-white font-black flex items-center justify-center text-xs">
                FG
              </div>
              <span className="font-bold text-neutral-900">FarmGrid Kisan Seva</span>
              <span className="text-neutral-300">|</span>
              <span>Made for Indian Farmers</span>
              <span className="text-neutral-300">|</span>
              <span>Karnal, Haryana & Pan-India</span>
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

              <button
                type="button"
                onClick={() => setIsUISelectorOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold border border-neutral-300 transition-colors"
              >
                <span>Theme</span>
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

      {/* UI Design Theme Selector Modal */}
      <UIDesignSelector
        currentTheme={currentTheme}
        onSelectTheme={handleSelectTheme}
        isOpen={isUISelectorOpen}
        onClose={() => setIsUISelectorOpen(false)}
      />

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

      {/* Kisan Auth Modal (Login / Sign Up) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
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
