'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Room, Booking } from '@/types';
import { RoomSeasonalTariffs, SeasonalDateRange, MealPlan } from '@/types/crm';
import { INITIAL_ROOMS, INITIAL_BOOKINGS } from '@/lib/mock-data';
import { INITIAL_ROOM_SEASONAL_TARIFFS, INITIAL_SEASONAL_DATE_RANGES } from '@/lib/crm-data';
import DateRangePicker from './DateRangePicker';
import RoomGuestSelector, { RoomConfig, DEFAULT_ROOM_CONFIG } from './RoomGuestSelector';
import {
  calculateDynamicTariff,
  calculateCategoryAvailability,
  suggestBestRoomCombinations,
  SuggestedCombination,
} from '@/lib/tariff-calculator';
import {
  X,
  Calendar,
  Bed,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  Users,
  ShieldCheck,
  Building,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Coffee,
  Check,
  Flame,
  Maximize2,
  ChevronRight,
  Award,
} from 'lucide-react';

interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms?: Room[];
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialRoomsCount?: number;
  initialRoomsConfig?: RoomConfig[];
  initialStep?: 'form' | 'results';
  onBookRoom: (
    room: Room,
    dates?: { checkIn: string; checkOut: string },
    mealPlan?: 'EP' | 'CP' | 'MAP' | 'AP',
    roomsConfig?: RoomConfig[]
  ) => void;
  onOpenInquiry: (initialDates?: { checkIn: string; checkOut: string; guests: number }) => void;
}

interface CategoryAvailability {
  room: Room;
  totalCapacity: number;
  bookedCount: number;
  availableCount: number;
  nightlyRate: number;
  totalStayPrice: number;
  nights: number;
}

export default function AvailabilityModal({
  isOpen,
  onClose,
  rooms = [],
  initialCheckIn,
  initialCheckOut,
  initialRoomsCount = 1,
  initialRoomsConfig,
  initialStep = 'form',
  onBookRoom,
  onOpenInquiry,
}: AvailabilityModalProps) {
  const getTodayStr = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const getNextDayStr = (dateStr: string) => {
    if (!dateStr) return getTomorrowStr();
    try {
      const d = new Date(dateStr + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    } catch {
      return getTomorrowStr();
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const [step, setStep] = useState<'form' | 'results'>(initialStep || 'form');
  const [checkIn, setCheckIn] = useState(initialCheckIn || getTodayStr());
  const [checkOut, setCheckOut] = useState(
    initialCheckOut || getNextDayStr(initialCheckIn || getTodayStr())
  );
  const [selectedMealPlan, setSelectedMealPlan] = useState<MealPlan>('CP');
  const [roomsConfig, setRoomsConfig] = useState<RoomConfig[]>(
    initialRoomsConfig && initialRoomsConfig.length > 0
      ? initialRoomsConfig
      : Array.from({ length: Math.max(1, initialRoomsCount || 1) }, (_, i) => ({
          roomNumber: i + 1,
          adults: 2,
          children: 0,
          childAges: [],
        }))
  );

  const roomsCount = roomsConfig.length;
  const totalAdults = roomsConfig.reduce((acc, r) => acc + (r.adults || 0), 0);
  const totalChildren = roomsConfig.reduce((acc, r) => acc + (r.children || 0), 0);
  const totalGuests = totalAdults + totalChildren;

  const [isChecking, setIsChecking] = useState(false);
  const [availabilityResults, setAvailabilityResults] = useState<CategoryAvailability[]>([]);
  const [suggestedCombinations, setSuggestedCombinations] = useState<SuggestedCombination[]>([]);
  const [cachedBookings, setCachedBookings] = useState<Booking[]>([]);
  const [tariffsMap, setTariffsMap] = useState<Record<string, RoomSeasonalTariffs>>(INITIAL_ROOM_SEASONAL_TARIFFS);
  const [seasonalDateRanges, setSeasonalDateRanges] = useState<SeasonalDateRange[]>(INITIAL_SEASONAL_DATE_RANGES);
  const [stayNights, setStayNights] = useState(1);
  const [availabilityError, setAvailabilityError] = useState('');

  // Re-calculate availability and room combinations with current parameters
  const recalculateData = useCallback(
    (
      inDate: string,
      outDate: string,
      currentMealPlan: MealPlan,
      currentConfig: RoomConfig[],
      bookingsList: Booking[],
      currentTariffs: Record<string, RoomSeasonalTariffs>,
      currentRanges: SeasonalDateRange[]
    ) => {
      const activeRooms = rooms && rooms.length > 0 ? rooms : INITIAL_ROOMS;

      // Calculate availability map per category
      const availMap = calculateCategoryAvailability({
        checkIn: inDate,
        checkOut: outDate,
        bookings: bookingsList,
        rooms: activeRooms,
      });

      // Calculate dynamic tariffs for individual categories
      const list: CategoryAvailability[] = activeRooms.map((room) => {
        const stats = availMap[room.id] || {
          availableCount: room.total_inventory || 1,
          totalCapacity: room.total_inventory || 1,
          bookedCount: 0,
        };

        const tariffRes = calculateDynamicTariff({
          roomId: room.id,
          checkIn: inDate,
          checkOut: outDate,
          mealPlan: currentMealPlan,
          adultsCount: 2,
          childrenCount: 0,
          tariffsMap: currentTariffs,
          seasonalDateRanges: currentRanges,
        });

        return {
          room,
          totalCapacity: stats.totalCapacity,
          bookedCount: stats.bookedCount,
          availableCount: stats.availableCount,
          nightlyRate: tariffRes.avgRatePerNight,
          totalStayPrice: tariffRes.totalAmount,
          nights: tariffRes.nights,
        };
      });

      // Suggest best room combinations
      const combs = suggestBestRoomCombinations({
        roomsConfig: currentConfig,
        checkIn: inDate,
        checkOut: outDate,
        mealPlan: currentMealPlan,
        availableCategories: availMap,
        rooms: activeRooms,
        tariffsMap: currentTariffs,
        seasonalDateRanges: currentRanges,
      });

      const d1 = new Date(inDate + 'T00:00:00');
      const d2 = new Date(outDate + 'T00:00:00');
      const nights = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24)));

      setAvailabilityResults(list);
      setSuggestedCombinations(combs);
      setStayNights(nights);
    },
    [rooms]
  );

  // Perform inventory and live tariffs check from backend
  const runLiveCheck = async (inDate: string, outDate: string, config: RoomConfig[] = roomsConfig) => {
    setIsChecking(true);
    setAvailabilityError('');

    try {
      let bookingsList = cachedBookings;
      let liveTariffs = tariffsMap;
      let liveRanges = seasonalDateRanges;

      // Fetch bookings & tariffs in parallel
      const [bookingsRes, tariffsRes] = await Promise.all([
        bookingsList.length === 0
          ? fetch('/api/bookings')
              .then((r) => r.json())
              .catch(() => null)
          : Promise.resolve(null),
        fetch('/api/tariffs')
          .then((r) => r.json())
          .catch(() => null),
      ]);

      if (bookingsRes && bookingsRes.success && Array.isArray(bookingsRes.data)) {
        bookingsList = bookingsRes.data;
        setCachedBookings(bookingsRes.data);
      } else if (bookingsList.length === 0) {
        bookingsList = INITIAL_BOOKINGS;
      }

      if (tariffsRes && tariffsRes.success && tariffsRes.data) {
        if (tariffsRes.data.tariffs) {
          liveTariffs = { ...INITIAL_ROOM_SEASONAL_TARIFFS, ...tariffsRes.data.tariffs };
          setTariffsMap(liveTariffs);
        }
        if (Array.isArray(tariffsRes.data.seasonalDateRanges) && tariffsRes.data.seasonalDateRanges.length > 0) {
          liveRanges = tariffsRes.data.seasonalDateRanges;
          setSeasonalDateRanges(liveRanges);
        }
      }

      recalculateData(inDate, outDate, selectedMealPlan, config, bookingsList, liveTariffs, liveRanges);
    } catch {
      setAvailabilityError('Failed to verify live inventory. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  // Sync initial props when opened
  useEffect(() => {
    if (isOpen) {
      const effIn = initialCheckIn || getTodayStr();
      let effOut = initialCheckOut;
      if (!effOut || effOut <= effIn) {
        effOut = getNextDayStr(effIn);
      }
      setCheckIn(effIn);
      setCheckOut(effOut);

      let targetConfig = roomsConfig;
      if (initialRoomsConfig && initialRoomsConfig.length > 0) {
        targetConfig = initialRoomsConfig;
        setRoomsConfig(initialRoomsConfig);
      } else if (initialRoomsCount && initialRoomsCount !== roomsConfig.length) {
        targetConfig = Array.from({ length: Math.max(1, initialRoomsCount) }, (_, i) => ({
          roomNumber: i + 1,
          adults: 2,
          children: 0,
          childAges: [],
        }));
        setRoomsConfig(targetConfig);
      }

      const targetStep = initialStep || 'form';
      setStep(targetStep);

      if (targetStep === 'results') {
        runLiveCheck(effIn, effOut, targetConfig);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialCheckIn, initialCheckOut, initialRoomsCount, initialRoomsConfig, initialStep]);

  // Handle meal plan switch directly in results step
  const handleMealPlanChange = (plan: MealPlan) => {
    setSelectedMealPlan(plan);
    recalculateData(
      checkIn,
      checkOut,
      plan,
      roomsConfig,
      cachedBookings.length > 0 ? cachedBookings : INITIAL_BOOKINGS,
      tariffsMap,
      seasonalDateRanges
    );
  };

  // Trigger Live Check and transition to results
  const handleFormCheckAvailability = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const effIn = checkIn || getTodayStr();
    let effOut = checkOut;
    if (!effOut || effOut <= effIn) {
      effOut = getNextDayStr(effIn);
      setCheckOut(effOut);
    }
    setStep('results');
    runLiveCheck(effIn, effOut, roomsConfig);
  };

  // Select combination to book directly
  const handleSelectCombination = (comb: SuggestedCombination) => {
    onClose();
    // Prepare multi-room configuration with pre-allocated room categories
    const combinationRoomsConfig: RoomConfig[] = comb.rooms.map((item) => ({
      roomNumber: item.roomNumber,
      adults: item.adults,
      children: item.children,
      childAges: item.childAges,
      roomId: item.roomCategory.id,
      roomName: item.roomCategory.name,
    }));

    const primaryRoom = comb.rooms[0].roomCategory;
    onBookRoom(primaryRoom, { checkIn, checkOut }, selectedMealPlan, combinationRoomsConfig);
  };

  // Select individual category
  const handleSelectCategoryToBook = (room: Room) => {
    onClose();
    // Apply this room category across requested rooms or as primary
    const categoryRoomsConfig: RoomConfig[] = roomsConfig.map((rc) => ({
      ...rc,
      roomId: room.id,
      roomName: room.name,
    }));
    onBookRoom(room, { checkIn, checkOut }, selectedMealPlan, categoryRoomsConfig);
  };

  const handleInquireCategory = (room: Room) => {
    onClose();
    onOpenInquiry({ checkIn, checkOut, guests: totalGuests });
  };

  if (!isOpen) return null;

  const totalHomestayRooms = availabilityResults.reduce((acc, item) => acc + item.totalCapacity, 0);
  const totalAvailableRooms = availabilityResults.reduce((acc, item) => acc + item.availableCount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div
        className={`relative w-full ${
          step === 'form' ? 'max-w-2xl' : 'max-w-5xl'
        } bg-white rounded-3xl shadow-2xl border border-sand-200 overflow-hidden my-6 max-h-[92vh] flex flex-col transition-all duration-300`}
      >
        {/* =========================================================================
            STEP 1: ASK FOR CHECK-IN, CHECK-OUT, ROOMS WITH CHECK AVAILABILITY BUTTON
           ========================================================================= */}
        {step === 'form' ? (
          <>
            {/* Header */}
            <div className="bg-[#0B1733] text-white p-6 sm:p-7 relative shrink-0">
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-2 mb-2">
                <span className="inline-flex items-center space-x-1.5 bg-primary-500/20 text-primary-200 text-[11px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full border border-primary-400/30">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>DIRECT HOMESTAY BOOKING</span>
                </span>
                <span className="text-xs text-gray-300 font-medium">• Live Inventory</span>
              </div>

              <h3
                className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                Check Room Availability
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-gray-300 max-w-lg leading-relaxed">
                Select your check-in and check-out dates and party details. We will suggest the optimal combination of rooms based on live backend availability.
              </p>
            </div>

            {/* Step 1 Form Body */}
            <form onSubmit={handleFormCheckAvailability} className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">
              {/* Boutique Date Range Picker */}
              <DateRangePicker
                checkIn={checkIn}
                checkOut={checkOut}
                onChange={(range) => {
                  setCheckIn(range.checkIn);
                  setCheckOut(range.checkOut);
                }}
              />

              {/* Multi-Room & Guest Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Rooms & Guests Configuration
                </label>
                <RoomGuestSelector
                  roomsConfig={roomsConfig}
                  onChange={(newConfig) => setRoomsConfig(newConfig)}
                  maxRooms={7}
                  variant="modal"
                  popoverPlacement="bottom"
                />
              </div>

              {/* Quick Meal Plan Preference */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Preferred Meal Plan
                  </label>
                  <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                    <Coffee className="w-3.5 h-3.5" />
                    <span>CP (Breakfast included) Recommended</span>
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { plan: 'EP' as const, label: 'EP', sub: 'Room Only' },
                    { plan: 'CP' as const, label: 'CP', sub: 'Breakfast' },
                    { plan: 'MAP' as const, label: 'MAP', sub: 'B’fast + Dinner' },
                    { plan: 'AP' as const, label: 'AP', sub: 'All Meals' },
                  ].map((item) => (
                    <button
                      key={item.plan}
                      type="button"
                      onClick={() => setSelectedMealPlan(item.plan)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        selectedMealPlan === item.plan
                          ? 'border-primary-600 bg-primary-50 text-primary-900 font-bold shadow-xs ring-1 ring-primary-500'
                          : 'border-sand-300 bg-sand-50/50 text-gray-700 hover:bg-sand-100'
                      }`}
                    >
                      <div className="text-xs font-bold">{item.label}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5 truncate">{item.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isChecking}
                  className="w-full bg-gradient-to-r from-[#FE6E00] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] active:scale-[0.99] text-white font-bold text-sm sm:text-base py-3.5 px-6 rounded-2xl shadow-[0_4px_16px_rgba(254,110,0,0.35)] transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-70"
                >
                  {isChecking ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Checking Live Inventory & Tariffs...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Check Live Availability & Rates</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-sand-200 px-6 py-3.5 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Zero Booking Fees • Best Rate Guaranteed • Live PMS Sync</span>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-800 font-semibold cursor-pointer">
                Close
              </button>
            </div>
          </>
        ) : (
          /* =========================================================================
              STEP 2: LIVE AVAILABILITY & SMART ROOM COMBINATIONS
             ========================================================================= */
          <>
            {/* Header */}
            <div className="bg-[#0B1733] text-white p-5 sm:p-6 relative shrink-0">
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-2 mb-1">
                <span className="inline-flex items-center space-x-1.5 bg-emerald-500/20 text-emerald-300 text-[10px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>LIVE INVENTORY CHECK</span>
                </span>
                <span className="text-xs text-sand-300 font-medium">• Verified Backend Tariffs</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3
                    className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
                    style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                  >
                    Suggested Room Combinations
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-sand-200">
                    <span className="font-semibold text-white">
                      📅 {formatDisplayDate(checkIn)} → {formatDisplayDate(checkOut)}
                    </span>
                    <span>•</span>
                    <span>{stayNights} {stayNights === 1 ? 'Night' : 'Nights'}</span>
                    <span>•</span>
                    <span className="bg-white/15 px-2.5 py-0.5 rounded-full text-amber-300 font-bold border border-white/20">
                      {roomsCount} {roomsCount === 1 ? 'Room' : 'Rooms'} · {totalGuests} Guests ({totalAdults} Adults{totalChildren > 0 ? `, ${totalChildren} Child` : ''})
                    </span>
                  </div>
                </div>

                {/* Back to Step 1 Button */}
                <button
                  onClick={() => setStep('form')}
                  className="inline-flex items-center space-x-1.5 bg-white/15 hover:bg-white/25 text-sand-100 hover:text-white text-xs font-semibold px-3.5 py-2 rounded-xl border border-white/20 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Dates / Guests</span>
                </button>
              </div>
            </div>

            {/* Sub-header: Live Status & Interactive Meal Plan Switcher */}
            <div className="bg-[#F3F7FF] border-b border-[#C7D4F5] px-5 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2">
                {isChecking ? (
                  <div className="inline-flex items-center space-x-2 text-xs font-semibold text-primary-800">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-700" />
                    <span>Checking live estate availability & backend tariffs...</span>
                  </div>
                ) : totalAvailableRooms > 0 ? (
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{totalAvailableRooms} of {totalHomestayRooms} Rooms Open on Estate</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Fully Booked on Selected Dates</span>
                  </div>
                )}
              </div>

              {/* Meal Plan Switcher on Results */}
              <div className="flex items-center space-x-1.5 bg-white border border-[#C7D4F5] p-1 rounded-xl shadow-2xs">
                <span className="text-[11px] font-bold text-gray-500 px-2 uppercase tracking-wider hidden sm:inline">
                  Meal Plan:
                </span>
                {(['EP', 'CP', 'MAP', 'AP'] as const).map((plan) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => handleMealPlanChange(plan)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                      selectedMealPlan === plan
                        ? 'bg-primary-600 text-white shadow-xs'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {plan}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {availabilityError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{availabilityError}</span>
                </div>
              )}

              {/* =========================================================================
                  SECTION A: SUGGESTED BEST ROOM COMBINATIONS
                 ========================================================================= */}
              {suggestedCombinations.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4
                        className="text-lg sm:text-xl font-bold text-[#0B1733] flex items-center gap-2"
                        style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                      >
                        <Sparkles className="w-5 h-5 text-amber-500" />
                        <span>Recommended Room Allocations for Your Group</span>
                      </h4>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Matched specifically for your {roomsCount} room{roomsCount > 1 ? 's' : ''} ({totalGuests} guests) with live backend tariffs and capacity validation.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {suggestedCombinations.map((comb) => (
                      <div
                        key={comb.id}
                        className={`rounded-2xl border-2 transition-all p-5 flex flex-col justify-between gap-4 ${
                          comb.isRecommended
                            ? 'border-primary-500 bg-gradient-to-br from-white via-primary-50/20 to-white shadow-md ring-2 ring-primary-500/10'
                            : 'border-[#C7D4F5] bg-white hover:border-primary-400 hover:shadow-sm'
                        }`}
                      >
                        {/* Combination Top: Badge, Title & Pricing */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span
                                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${comb.badgeColor}`}
                              >
                                {comb.badge}
                              </span>
                              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                {selectedMealPlan === 'CP' && 'Breakfast Included'}
                                {selectedMealPlan === 'MAP' && 'Breakfast & Dinner Included'}
                                {selectedMealPlan === 'AP' && 'All Meals Included'}
                                {selectedMealPlan === 'EP' && 'Room Only (EP)'}
                              </span>
                            </div>

                            <h5
                              className="text-xl font-bold text-[#0B1733] tracking-tight"
                              style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                            >
                              {comb.title}
                            </h5>
                            <p className="text-xs text-gray-600 mt-0.5">{comb.description}</p>
                          </div>

                          {/* Live Dynamic Tariff Box */}
                          <div className="text-left sm:text-right shrink-0 bg-sand-50/80 p-3 rounded-xl border border-sand-200/80">
                            <span className="text-[11px] uppercase tracking-wider text-gray-500 block">
                              Total Stay Tariffs
                            </span>
                            <div
                              className="text-2xl font-bold text-[#0B1733]"
                              style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                            >
                              ₹{comb.totalStayPrice.toLocaleString()}
                            </div>
                            <span className="text-xs text-gray-600 block">
                              ₹{comb.totalNightlyRate.toLocaleString()}/night ({stayNights}{' '}
                              {stayNights === 1 ? 'night' : 'nights'})
                            </span>
                          </div>
                        </div>

                        {/* Room by Room Allocation Breakdown */}
                        <div className="bg-[#F8FAFC] border border-gray-200/80 rounded-xl p-3.5 space-y-2">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                            Allocated Room Configuration:
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {comb.rooms.map((roomItem) => (
                              <div
                                key={roomItem.roomNumber}
                                className="bg-white border border-[#C7D4F5] rounded-lg p-2.5 flex items-start space-x-2.5 shadow-2xs"
                              >
                                <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                  {roomItem.roomNumber}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-xs text-[#0B1733] truncate">
                                      {roomItem.roomCategory.name}
                                    </span>
                                    <span className="text-xs font-bold text-primary-700 ml-1 shrink-0">
                                      ₹{roomItem.nightlyRate.toLocaleString()}/nt
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-gray-600 flex items-center gap-1.5 mt-0.5">
                                    <Users className="w-3 h-3 text-primary-600" />
                                    <span>
                                      {roomItem.adults} Adults
                                      {roomItem.children > 0 ? `, ${roomItem.children} Child` : ''}
                                    </span>
                                    <span className="text-gray-300">•</span>
                                    <span className="text-gray-500 truncate">{roomItem.roomCategory.bed_type}</span>
                                  </div>
                                  <div className="text-[10px] text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span className="truncate">{roomItem.capacityFitReason}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Action CTA */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-gray-100">
                          <span className="text-xs text-gray-500 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Direct rates matching backend tariffs to the exact rupee.</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSelectCombination(comb)}
                            className="bg-gradient-to-r from-[#FE6E00] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] active:scale-95 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-[0_3px_12px_rgba(254,110,0,0.3)] transition-all flex items-center justify-center space-x-2 cursor-pointer"
                          >
                            <span>Book This Combination</span>
                            <ArrowRight className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* If party requested more rooms than available across estate */}
              {suggestedCombinations.length === 0 && roomsCount > totalAvailableRooms && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-sm">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Notice: Requested {roomsCount} rooms, but only {totalAvailableRooms} rooms are open</span>
                  </div>
                  <p>
                    Our estate has {totalAvailableRooms} rooms available across all categories for your selected dates. You can adjust your dates or book the available categories below.
                  </p>
                </div>
              )}

              {/* =========================================================================
                  SECTION B: EXPLORE ALL INDIVIDUAL ROOM CATEGORIES
                 ========================================================================= */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <h4
                    className="text-base sm:text-lg font-bold text-[#0B1733]"
                    style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                  >
                    All Estate Categories & Live Inventory
                  </h4>
                  <span className="text-xs text-gray-500">
                    Live Rates for {selectedMealPlan} Plan
                  </span>
                </div>

                <div className="space-y-3">
                  {availabilityResults.map(({ room, totalCapacity, availableCount, nightlyRate, totalStayPrice }) => {
                    const isSufficient = availableCount >= roomsCount;
                    const isSoldOut = availableCount === 0;

                    return (
                      <div
                        key={room.id}
                        className={`rounded-2xl border transition-all overflow-hidden flex flex-col md:flex-row gap-4 p-4 items-center ${
                          isSoldOut
                            ? 'border-gray-200 bg-gray-50/70 opacity-80'
                            : 'border-[#C7D4F5] bg-white hover:border-primary-500 hover:shadow-sm'
                        }`}
                      >
                        {/* Category Image */}
                        <div className="w-full md:w-44 h-36 md:h-32 rounded-xl overflow-hidden relative shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={room.images?.[0] || '/images/hero/deluxe-bedroom-suite.jpg'}
                            alt={room.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 bg-[#0B1733]/80 backdrop-blur-sm text-sand-200 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded">
                            {room.room_type}
                          </div>
                        </div>

                        {/* Category Details */}
                        <div className="flex-1 min-w-0 space-y-1.5 w-full text-left">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h5
                              className="text-base sm:text-lg font-bold text-[#0B1733] tracking-tight"
                              style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                            >
                              {room.name}
                            </h5>

                            {/* Inventory Status Badge */}
                            {isSoldOut ? (
                              <span className="inline-flex items-center space-x-1 bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                <span>Sold Out</span>
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center space-x-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                  availableCount > 1
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-amber-100 text-amber-800 border-amber-300'
                                }`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    availableCount > 1 ? 'bg-emerald-500' : 'bg-amber-500'
                                  }`}
                                />
                                <span>
                                  {availableCount} of {totalCapacity} Available
                                </span>
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              <Coffee className="w-3 h-3 text-emerald-600" />
                              <span>{selectedMealPlan} Plan Active</span>
                            </span>
                            <p className="text-xs text-gray-500 line-clamp-1">{room.tagline || room.description}</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-700">
                            <span className="flex items-center space-x-1">
                              <Users className="w-3.5 h-3.5 text-primary-600" />
                              <span>
                                Max {room.capacity_adults} Adults
                                {room.capacity_children > 0 ? ` + ${room.capacity_children} Child` : ''}
                              </span>
                            </span>
                            <span>•</span>
                            <span>{room.bed_type}</span>
                            {room.room_size_sqft && (
                              <>
                                <span>•</span>
                                <span>{room.room_size_sqft} sq.ft</span>
                              </>
                            )}
                          </div>

                          {/* Amenities snippet */}
                          {room.amenities && room.amenities.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {room.amenities.slice(0, 3).map((amenity, idx) => (
                                <span
                                  key={idx}
                                  className="bg-sand-100 text-gray-800 text-[10px] px-2 py-0.5 rounded font-medium"
                                >
                                  {amenity}
                                </span>
                              ))}
                              {room.amenities.length > 3 && (
                                <span className="text-[10px] text-gray-400 self-center">
                                  +{room.amenities.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Pricing & CTA */}
                        <div className="w-full md:w-48 flex md:flex-col justify-between md:justify-center items-center md:items-end gap-1.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-sand-100">
                          <div className="text-left md:text-right">
                            <div className="text-[11px] text-gray-500">Live Rate ({selectedMealPlan})</div>
                            <div
                              className="text-lg sm:text-xl font-bold text-[#0B1733]"
                              style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                            >
                              ₹{nightlyRate.toLocaleString()}
                              <span className="text-xs font-normal text-gray-600"> /night</span>
                            </div>
                            <div className="text-[11px] text-primary-700 font-medium">
                              ₹{totalStayPrice.toLocaleString()} for {stayNights}{' '}
                              {stayNights === 1 ? 'night' : 'nights'}
                            </div>
                          </div>

                          {!isSoldOut ? (
                            <button
                              type="button"
                              onClick={() => handleSelectCategoryToBook(room)}
                              className="bg-primary-600 hover:bg-primary-700 active:scale-95 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all flex items-center space-x-1 cursor-pointer"
                            >
                              <span>Reserve Category</span>
                              <ChevronRight className="w-3.5 h-3.5 text-white" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleInquireCategory(room)}
                              className="bg-sand-200 hover:bg-sand-300 text-[#0B1733] text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                            >
                              <span>Waitlist</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Full Estate Buyout Notice */}
              {roomsCount >= 5 && (
                <div className="bg-[#F3F7FF] border border-[#C7D4F5] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[#0B1733]">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                      <Building className="w-5 h-5 text-primary-700" />
                    </div>
                    <div>
                      <h5
                        className="font-bold text-sm text-[#0B1733]"
                        style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                      >
                        Planning an Exclusive Buyout (All 7 Rooms)?
                      </h5>
                      <p className="text-xs text-gray-600">
                        Enjoy private access to the entire estate, lawns, and dedicated chef for your group.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenInquiry({ checkIn, checkOut, guests: 14 });
                    }}
                    className="whitespace-nowrap bg-[#25479E] hover:bg-[#1A3478] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-colors cursor-pointer"
                  >
                    Inquire Villa Buyout
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-sand-200 px-5 py-3.5 sm:px-6 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero Booking Fees • Direct Best Rate Guarantee • Real-time Backend Sync</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenInquiry({ checkIn, checkOut, guests: roomsCount * 2 });
                  }}
                  className="text-xs text-primary-700 hover:text-primary-900 underline font-medium px-2 py-1 cursor-pointer"
                >
                  Need Custom Assistance?
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-sand-200 hover:bg-sand-300 text-gray-900 text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
