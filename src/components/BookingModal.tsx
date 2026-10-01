'use client';

import { useState, useEffect, useMemo } from 'react';
import { Room } from '@/types';
import { MealPlan } from '@/types/crm';
import { INITIAL_ROOMS } from '@/lib/mock-data';
import {
  calculateDynamicTariff,
  categoryCapacity,
  normalizeCategoryId,
  addCalendarDays,
  nightsBetween,
  todayInIST,
  tomorrowInIST,
  stayRestriction,
} from '@/lib/tariff-calculator';
import { useLiveTariffs } from '@/lib/live-tariffs';
import { calculateBookingTotals } from '@/lib/gst';
import {
  AIRPORT_TRANSFER_RATE,
  BIKE_RENTAL_RATE_PER_NIGHT,
  calculateAddonCharges,
} from '@/lib/booking-addons';
import DateRangePicker from './DateRangePicker';
import { RoomConfig, DEFAULT_ROOM_CONFIG } from './RoomGuestSelector';
import {
  X,
  Calendar,
  User,
  Phone,
  Mail,
  CheckCircle,
  Loader2,
  CreditCard,
  Users,
  Coffee,
  Bed,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  Building,
} from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  rooms?: Room[];
  initialDates?: { checkIn?: string; checkOut?: string } | null;
  initialMealPlan?: MealPlan;
  initialRoomsConfig?: RoomConfig[];
  whatsappNumber?: string;
}

export default function BookingModal({
  isOpen,
  onClose,
  room,
  rooms = [],
  initialDates = null,
  initialMealPlan,
  initialRoomsConfig,
  whatsappNumber = '918101298882',
}: BookingModalProps) {
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [mealPlan, setMealPlan] = useState<MealPlan>('CP');

  // Multi-room Goibibo-style configuration
  const [roomsConfig, setRoomsConfig] = useState<RoomConfig[]>(
    initialRoomsConfig && initialRoomsConfig.length > 0
      ? initialRoomsConfig
      : DEFAULT_ROOM_CONFIG
  );

  const [includeAirportTransfer, setIncludeAirportTransfer] = useState(false);
  const [includeBikeRental, setIncludeBikeRental] = useState(false);
  const [specialRequests, setSpecialRequests] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [bookingRef, setBookingRef] = useState('');

  // Server-confirmed total (the booking API re-prices every booking with live tariffs)
  const [confirmedTotal, setConfirmedTotal] = useState<number | null>(null);

  // Live tariffs & seasonal date ranges from backend (no seed fallback)
  const {
    status: tariffStatus,
    tariffs: tariffsMap,
    seasonalDateRanges,
    gstConfig,
    addonRates,
  } = useLiveTariffs();
  // One key per reservation attempt: a double-tap or retry never creates two bookings.
  const [idempotencyKey, setIdempotencyKey] = useState(() => `bk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const getTodayStr = () => todayInIST();

  const getTomorrowStr = () => tomorrowInIST();

  const getNextDayStr = (dateStr: string) => {
    if (!dateStr) return getTomorrowStr();
    return addCalendarDays(dateStr, 1);
  };

  // Sync initial dates, meal plan & room configuration when modal is triggered
  useEffect(() => {
    if (isOpen) {
      if (initialMealPlan) {
        setMealPlan(initialMealPlan);
      }
      if (initialDates && initialDates.checkIn) {
        const effIn = initialDates.checkIn;
        const effOut = (!initialDates.checkOut || initialDates.checkOut <= effIn) ? getNextDayStr(effIn) : initialDates.checkOut;
        setCheckIn(effIn);
        setCheckOut(effOut);
      } else {
        const today = getTodayStr();
        setCheckIn(today);
        setCheckOut(getNextDayStr(today));
      }
      if (initialRoomsConfig && initialRoomsConfig.length > 0) {
        setRoomsConfig(initialRoomsConfig);
      } else if (room) {
        setRoomsConfig([
          {
            roomNumber: 1,
            adults: 2,
            children: 0,
            childAges: [],
            roomId: room.id,
            roomName: room.name,
          },
        ]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialDates, initialMealPlan, initialRoomsConfig, room]);

  const activeRoomsList = useMemo(() => {
    return rooms && rooms.length > 0 ? rooms : INITIAL_ROOMS;
  }, [rooms]);

  if (!isOpen || !room) return null;

  // Calculate nights
  let nights = 1;
  if (checkIn && checkOut) {
    const diff = nightsBetween(checkIn, checkOut);
    if (diff !== null && diff > 0) nights = diff;
  }

  // Goibibo Room Actions
  const handleAddRoom = () => {
    if (roomsConfig.length >= 7) return;
    const nextRoomNum = roomsConfig.length + 1;
    setRoomsConfig([
      ...roomsConfig,
      {
        roomNumber: nextRoomNum,
        adults: 2,
        children: 0,
        childAges: [],
        roomId: room.id,
        roomName: room.name,
      },
    ]);
  };

  const handleRemoveRoom = (indexToRemove: number) => {
    if (roomsConfig.length <= 1) return;
    const filtered = roomsConfig
      .filter((_, idx) => idx !== indexToRemove)
      .map((r, newIdx) => ({
        ...r,
        roomNumber: newIdx + 1,
      }));
    setRoomsConfig(filtered);
  };

  const handleUpdateAdults = (index: number, delta: number) => {
    const updated = [...roomsConfig];
    const current = updated[index].adults || 1;
    const assignedCatId = normalizeCategoryId(updated[index].roomId || room.id);
    const maxAllowed = categoryCapacity(assignedCatId, activeRoomsList.find((r) => r.id === assignedCatId)).maxAdults;
    const next = Math.min(maxAllowed, Math.max(1, current + delta));
    updated[index] = { ...updated[index], adults: next };
    setRoomsConfig(updated);
  };

  const handleUpdateChildren = (index: number, delta: number) => {
    const updated = [...roomsConfig];
    const current = updated[index].children || 0;
    const assignedCatId = normalizeCategoryId(updated[index].roomId || room.id);
    const maxAllowed = categoryCapacity(assignedCatId, activeRoomsList.find((r) => r.id === assignedCatId)).maxChildren;
    const next = Math.min(maxAllowed, Math.max(0, current + delta));

    let ages = [...(updated[index].childAges || [])];
    if (next > current) {
      for (let i = current; i < next; i++) {
        ages.push(5);
      }
    } else if (next < current) {
      ages = ages.slice(0, next);
    }

    updated[index] = {
      ...updated[index],
      children: next,
      childAges: ages,
    };
    setRoomsConfig(updated);
  };

  const handleUpdateChildAge = (
    roomIndex: number,
    childIndex: number,
    age: number
  ) => {
    const updated = [...roomsConfig];
    const ages = [...(updated[roomIndex].childAges || [])];
    ages[childIndex] = age;
    updated[roomIndex] = {
      ...updated[roomIndex],
      childAges: ages,
    };
    setRoomsConfig(updated);
  };

  // Change assigned room category for an individual room
  const handleUpdateRoomCategory = (roomIndex: number, targetCategoryId: string) => {
    const updated = [...roomsConfig];
    const matchedCategory = activeRoomsList.find((r) => r.id === targetCategoryId);
    const { maxAdults, maxChildren } = categoryCapacity(targetCategoryId, activeRoomsList.find((r) => r.id === targetCategoryId));

    const currentAdults = updated[roomIndex].adults || 2;
    const currentChildren = updated[roomIndex].children || 0;

    updated[roomIndex] = {
      ...updated[roomIndex],
      roomId: targetCategoryId,
      roomName: matchedCategory?.name || room.name,
      adults: Math.min(currentAdults, maxAdults),
      children: Math.min(currentChildren, maxChildren),
    };
    setRoomsConfig(updated);
  };

  // Aggregate room calculations
  const totalRooms = roomsConfig.length;
  const totalAdults = roomsConfig.reduce((sum, r) => sum + (r.adults || 0), 0);
  const totalChildren = roomsConfig.reduce((sum, r) => sum + (r.children || 0), 0);
  const totalGuests = totalAdults + totalChildren;

  // CANONICAL BACKEND TARIFF CALCULATION FOR EACH ROOM
  const roomCalculations = roomsConfig.map((r, idx) => {
    const assignedCatId = normalizeCategoryId(r.roomId || room.id);
    const matchedCategory = activeRoomsList.find((rm) => rm.id === assignedCatId) || room;

    const tariffResult = calculateDynamicTariff({
      roomId: assignedCatId,
      checkIn: checkIn || getTodayStr(),
      checkOut: checkOut || getNextDayStr(checkIn || getTodayStr()),
      mealPlan,
      adultsCount: r.adults || 2,
      childrenCount: r.children || 0,
      childAges: r.childAges,
      tariffsMap,
      seasonalDateRanges,
    });

    return {
      roomNumber: idx + 1,
      assignedCategory: matchedCategory,
      assignedCatId,
      adults: r.adults || 2,
      children: r.children || 0,
      childAges: r.childAges || [],
      priced: tariffResult !== null,
      result: tariffResult,
      nightlyTotal: tariffResult?.avgRatePerNight ?? 0,
      stayTotal: tariffResult?.totalAmount ?? 0,
      baseAmount: tariffResult?.baseAmount ?? 0,
      extraAdultsCount: tariffResult?.extraAdultsCount ?? 0,
      extraAdultRate: tariffResult?.extraAdultRate ?? 0,
      extraAdultsCharge: tariffResult?.extraAdultsCharge ?? 0,
      extraChildrenCount: tariffResult?.extraChildrenCount ?? 0,
      extraChildRate: tariffResult?.extraChildRate ?? 0,
      extraChildrenCharge: tariffResult?.extraChildrenCharge ?? 0,
      breakdown: tariffResult?.breakdown ?? [],
    };
  });

  // Every room must be priced from live backend tariffs before a total is shown or submitted
  const pricingReady = tariffStatus === 'ready' && roomCalculations.every((rc) => rc.priced);
  // Minimum-stay rules from the seasonal calendar (the server enforces the same rule)
  const restrictionMsg = checkIn && checkOut ? stayRestriction(checkIn, checkOut, seasonalDateRanges) : null;
  const priceUnavailableLabel = tariffStatus === 'loading' ? 'Loading live rates…' : 'Price on request';
  const inr = (amount: number) => (pricingReady ? `₹${amount.toLocaleString('en-IN')}` : '—');

  const baseStayAllRooms = roomCalculations.reduce((sum, rc) => sum + rc.baseAmount, 0);
  const totalExtraCharges = roomCalculations.reduce(
    (sum, rc) => sum + rc.extraAdultsCharge + rc.extraChildrenCharge,
    0
  );
  const totalRoomsCost = roomCalculations.reduce((sum, rc) => sum + rc.stayTotal, 0);

  const { transferCharge, bikeCharge } = calculateAddonCharges({
    includeAirportTransfer,
    includeBikeRental,
    nights,
    rates: addonRates,
  });
  // GST on rooms (per room-night slab) and add-ons: the same function the booking API uses
  const stayGst = pricingReady
    ? calculateBookingTotals(roomCalculations.map((rc) => rc.result!).filter(Boolean), transferCharge + bikeCharge, gstConfig)
    : null;
  const totalEstimatedAmount = stayGst ? stayGst.total : Math.round((totalRoomsCost + transferCharge + bikeCharge) * 100) / 100;
  const airportTransferLabel = `₹${(addonRates?.airportTransfer ?? AIRPORT_TRANSFER_RATE).toLocaleString('en-IN')}`;
  const bikeRatePerNight = addonRates?.bikeRentalPerNight ?? BIKE_RENTAL_RATE_PER_NIGHT;

  // Quick meal plan rates for selector preview (for primary room)
  const primaryCatId = normalizeCategoryId(room.id);
  const mealPlanPreviewRates = (['EP', 'CP', 'MAP', 'AP'] as const).reduce(
    (acc, plan) => {
      const res = calculateDynamicTariff({
        roomId: primaryCatId,
        checkIn: checkIn || getTodayStr(),
        checkOut: checkOut || getNextDayStr(checkIn || getTodayStr()),
        mealPlan: plan,
        adultsCount: 2,
        childrenCount: 0,
        tariffsMap,
        seasonalDateRanges,
      });
      if (res) acc[plan] = res.avgRatePerNight;
      return acc;
    },
    {} as Partial<Record<MealPlan, number>>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!guestName.trim() || !phone.trim() || !checkIn || !checkOut) {
      setErrorMsg('Please complete your name, phone number, and both check-in/out dates.');
      return;
    }

    if (!pricingReady) {
      setErrorMsg('Live prices for these dates are not available right now. Please send us an enquiry and we will confirm your exact tariff.');
      return;
    }

    if (restrictionMsg) {
      setErrorMsg(restrictionMsg);
      return;
    }

    setLoading(true);

    try {
      const roomSummaryStr = roomCalculations
        .map(
          (rc) =>
            `[Room ${rc.roomNumber} (${rc.assignedCategory.name}): ${rc.adults} Adults${
              rc.children > 0
                ? `, ${rc.children} Child${
                    rc.childAges.length > 0 ? ` (Age ${rc.childAges.join(', ')})` : ''
                  }`
                : ''
            } - ₹${rc.stayTotal.toLocaleString('en-IN')}]`
        )
        .join(' ');

      const roomIdsJoined = roomCalculations.map((rc) => rc.assignedCatId).join(', ');
      const roomNamesJoined =
        totalRooms > 1
          ? roomCalculations
              .map((rc) => `Room ${rc.roomNumber}: ${rc.assignedCategory.name}`)
              .join(' | ')
          : room.name;

      const payload = {
        guest_name: guestName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        room_id: roomIdsJoined,
        room_name: roomNamesJoined,
        check_in: checkIn,
        check_out: checkOut,
        nights,
        rooms_count: totalRooms,
        adults_count: totalAdults,
        children_count: totalChildren,
        extra_charges_total: totalExtraCharges,
        total_price: totalEstimatedAmount,
        idempotency_key: idempotencyKey,
        // The server re-prices the stay from these inputs with live tariffs; total_price above is
        // only the guest's on-screen estimate and is never trusted.
        meal_plan: mealPlan,
        rooms_config: roomCalculations.map((rc) => ({
          room_id: rc.assignedCatId,
          adults: rc.adults,
          children: rc.children,
          child_ages: rc.childAges.length === rc.children ? rc.childAges : undefined,
        })),
        addons: {
          airport_transfer: includeAirportTransfer,
          bike_rental: includeBikeRental,
        },
        special_requests: [
          `[Multi-Room Booking: ${totalRooms} Rooms • ${totalAdults} Adults${
            totalChildren > 0 ? `, ${totalChildren} Child` : ''
          }]`,
          roomSummaryStr,
          `[Meal Plan: ${mealPlan}]`,
          includeAirportTransfer ? `[Add-on: Airport/Railway Station Transfer (+${airportTransferLabel})]` : '',
          includeBikeRental ? `[Add-on: Scooty/Bike Rental (+₹${bikeCharge})]` : '',
          specialRequests.trim(),
        ]
          .filter(Boolean)
          .join(' '),
      };

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setBookingRef(data.data?.booking_reference || '');
        const serverTotal = Number(data.data?.total_price);
        setConfirmedTotal(Number.isFinite(serverTotal) && serverTotal > 0 ? serverTotal : null);
        setSuccess(true);
        setIdempotencyKey(`bk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
      } else {
        setErrorMsg(data.error || 'Failed to process booking reservation.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error while booking.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setSuccess(false);
    setConfirmedTotal(null);
    setErrorMsg('');
    setGuestName('');
    setPhone('');
    setEmail('');
    setIncludeAirportTransfer(false);
    setIncludeBikeRental(false);
    onClose();
  };

  const getWhatsAppBookingLink = () => {
    const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
    const addonsList = [
      includeAirportTransfer ? `• Airport/Station Cab Transfer (+${airportTransferLabel})` : '',
      includeBikeRental ? `• Scooty/Motorcycle Rental (+₹${bikeCharge})` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const roomsBreakdownText = roomCalculations
      .map(
        (rc) =>
          `• *Room ${rc.roomNumber} (${rc.assignedCategory.name}):* ${rc.adults} Adults${
            rc.children > 0
              ? `, ${rc.children} Child (Age: ${rc.childAges.join(', ') || '5'})`
              : ''
          } — ₹${rc.stayTotal.toLocaleString('en-IN')} (${nights} nights @ ₹${rc.nightlyTotal.toLocaleString('en-IN')}/nt)`
      )
      .join('\n');

    const text = encodeURIComponent(
      `Hello Savera Homestay! I just placed a booking reservation on your website.\n\n` +
        `*Reference ID:* ${bookingRef}\n` +
        `*Total Accommodation:* ${totalRooms} ${totalRooms === 1 ? 'Room' : 'Rooms'}\n` +
        `*Dates:* ${checkIn} → ${checkOut} (${nights} ${nights === 1 ? 'night' : 'nights'})\n` +
        `*Meal Plan:* ${mealPlan}\n` +
        `*Total Guests:* ${totalAdults} Adults${totalChildren > 0 ? `, ${totalChildren} Child` : ''}\n\n` +
        `*Room Allocation & Tariffs:*\n${roomsBreakdownText}\n\n` +
        `*Verified Total Tariff:* ₹${(confirmedTotal ?? totalEstimatedAmount).toLocaleString('en-IN')}\n` +
        `*Primary Guest:* ${guestName}\n` +
        `*Phone:* ${phone}\n` +
        (addonsList ? `\n*Add-ons:*\n${addonsList}\n` : '') +
        `\nPlease share the UPI / Bank account details to confirm my reservation.`
    );
    return `https://wa.me/${cleanNumber}?text=${text}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-sand-200 overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#142820] text-white p-5 sm:p-6 relative shrink-0">
          <button
            onClick={handleResetAndClose}
            aria-label="Close modal"
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2 mb-1.5">
            <span className="inline-flex items-center space-x-1.5 bg-white/10 text-[#C5A059] text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-[#C5A059]/30">
              <Sparkles className="w-3 h-3 text-[#C5A059]" />
              <span>DIRECT RESERVATION</span>
            </span>
            <span className="text-xs text-[#FAF8F5]/80 font-medium">• Live Backend PMS Tariffs</span>
          </div>

          <h3 className="font-bold text-xl sm:text-2xl text-white font-serif tracking-tight leading-tight">
            {totalRooms > 1 ? `${totalRooms} Rooms Reservation` : room.name}
          </h3>
          <p className="text-xs text-[#FAF8F5]/80 font-light mt-0.5">
            {totalRooms > 1
              ? `Multi-Room Group Booking (${totalGuests} Guests · ${totalAdults} Adults${totalChildren > 0 ? `, ${totalChildren} Child` : ''})`
              : room.tagline || 'Boutique Himalayan Mountain Stay · Darjeeling'}
          </p>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {success ? (
            <div className="text-center py-6 sm:py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h4
                className="text-2xl font-bold text-[#0B1733]"
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                Reservation Request Placed!
              </h4>
              <div className="inline-block bg-primary-50 text-primary-900 font-mono text-sm px-4 py-1.5 rounded-xl font-bold border border-primary-200">
                Universal Booking ID: {bookingRef}
              </div>

              <div className="max-w-md mx-auto bg-gray-50 border border-gray-200 rounded-2xl p-4 text-left text-xs space-y-2 text-gray-700">
                <div className="flex justify-between font-semibold text-gray-900 pb-1.5 border-b border-gray-200">
                  <span>{totalRooms} {totalRooms === 1 ? 'Room' : 'Rooms'} · {nights} {nights === 1 ? 'Night' : 'Nights'} ({mealPlan})</span>
                  <span className="text-primary-700 text-sm font-bold">₹{(confirmedTotal ?? totalEstimatedAmount).toLocaleString('en-IN')}</span>
                </div>
                <div className="text-gray-600">
                  📅 {checkIn} → {checkOut}
                </div>
                <div className="text-gray-600">
                  👥 {totalAdults} Adults{totalChildren > 0 ? `, ${totalChildren} Child` : ''}
                </div>
                <div className="pt-1.5 border-t border-gray-200 space-y-1">
                  {roomCalculations.map((rc) => (
                    <div key={rc.roomNumber} className="flex justify-between text-gray-800">
                      <span>Room {rc.roomNumber} ({rc.assignedCategory.name}):</span>
                      <span className="font-semibold">{inr(rc.stayTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 max-w-md mx-auto">
                <a
                  href={getWhatsAppBookingLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center space-x-2 bg-[#25D366] hover:bg-[#20bd5a] text-white py-3.5 px-4 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
                >
                  <span>Confirm with Host on WhatsApp</span>
                </a>
              </div>

              <button
                onClick={handleResetAndClose}
                className="text-xs text-gray-500 hover:text-gray-700 underline pt-2 block mx-auto cursor-pointer"
              >
                Done / Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                  {errorMsg}
                </div>
              )}

              {/* Check-in / Check-out Date Range Picker */}
              <div>
                <DateRangePicker
                  checkIn={checkIn}
                  checkOut={checkOut}
                  onChange={(range) => {
                    setCheckIn(range.checkIn);
                    setCheckOut(range.checkOut);
                  }}
                  showPresets={true}
                />
              </div>

              {/* ========================================================================= */}
              {/* GOIBIBO-STYLE ROOMS & GUEST OCCUPANCY ALLOCATION */}
              {/* ========================================================================= */}
              <div className="bg-[#F8FAFC] p-3.5 sm:p-4 rounded-2xl border border-gray-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                      <Bed className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">
                        Rooms & Guests Allocation
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {totalRooms} {totalRooms === 1 ? 'Room' : 'Rooms'} · {totalGuests} {totalGuests === 1 ? 'Guest' : 'Guests'} ({totalAdults} Adults{totalChildren > 0 ? `, ${totalChildren} Child` : ''})
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Live Tariffs Matching PMS
                  </span>
                </div>

                {/* Individual Room Cards */}
                <div className="space-y-3 pt-1">
                  {roomsConfig.map((r, roomIdx) => {
                    const assignedCatId = normalizeCategoryId(r.roomId || room.id);
                    const currentCalc = roomCalculations[roomIdx];
                    const { maxAdults: maxCapAdults, maxChildren: maxCapChildren } = categoryCapacity(
                      assignedCatId,
                      activeRoomsList.find((rm) => rm.id === assignedCatId)
                    );

                    return (
                      <div
                        key={r.roomNumber || roomIdx}
                        className="bg-white rounded-xl border border-gray-200 p-3 sm:p-3.5 space-y-2.5 shadow-2xs"
                      >
                        {/* Room Header with Category Selector */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-md bg-[#0B1733] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                              {roomIdx + 1}
                            </span>
                            <span className="text-xs font-bold text-gray-900 shrink-0">
                              Room {roomIdx + 1}
                            </span>

                            {/* Category Selector Dropdown */}
                            <div className="relative">
                              <select
                                value={assignedCatId}
                                onChange={(e) => handleUpdateRoomCategory(roomIdx, e.target.value)}
                                className="bg-[#F3F7FF] border border-[#C7D4F5] text-[#0B1733] text-xs font-semibold rounded-lg px-2.5 py-1 pr-6 appearance-none focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                              >
                                {activeRoomsList.map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.name} (Max {cat.capacity_adults} Adults)
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end space-x-2">
                            {currentCalc && currentCalc.priced && tariffStatus === 'ready' ? (
                              <span className="text-xs font-bold text-primary-700">
                                ₹{currentCalc.stayTotal.toLocaleString('en-IN')}{' '}
                                <span className="text-[10px] text-gray-500 font-normal">
                                  (₹{currentCalc.nightlyTotal.toLocaleString('en-IN')}/nt)
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-primary-700">{priceUnavailableLabel}</span>
                            )}

                            {roomsConfig.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveRoom(roomIdx)}
                                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded transition-colors flex items-center space-x-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Remove</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Adult and Child Steppers Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {/* Adults */}
                          <div className="flex items-center justify-between bg-gray-50/80 p-2 rounded-lg border border-gray-100">
                            <div>
                              <div className="text-xs font-bold text-gray-800">Adults</div>
                              <div className="text-[10px] text-gray-500">Max {maxCapAdults} for this room</div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateAdults(roomIdx, -1)}
                                disabled={r.adults <= 1}
                                className="w-7 h-7 rounded-full bg-white border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-gray-700 cursor-pointer shadow-2xs"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-5 text-center font-bold text-xs text-[#0B1733]">
                                {r.adults}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateAdults(roomIdx, 1)}
                                disabled={r.adults >= maxCapAdults}
                                className="w-7 h-7 rounded-full bg-primary-50 border border-primary-500 text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shadow-2xs"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Children */}
                          <div className="flex items-center justify-between bg-gray-50/80 p-2 rounded-lg border border-gray-100">
                            <div>
                              <div className="text-xs font-bold text-gray-800">Children</div>
                              <div className="text-[10px] text-gray-500">0 - 12 years</div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateChildren(roomIdx, -1)}
                                disabled={r.children <= 0}
                                className="w-7 h-7 rounded-full bg-white border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-gray-700 cursor-pointer shadow-2xs"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-5 text-center font-bold text-xs text-[#0B1733]">
                                {r.children}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateChildren(roomIdx, 1)}
                                disabled={r.children >= maxCapChildren}
                                className="w-7 h-7 rounded-full bg-primary-50 border border-primary-500 text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shadow-2xs"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Extra Bed & Child Surcharge details */}
                        {currentCalc && currentCalc.priced && (currentCalc.extraAdultsCount > 0 || currentCalc.extraChildrenCount > 0) && (
                          <div className="flex flex-wrap gap-2 text-[11px] pt-0.5">
                            {currentCalc.extraAdultsCount > 0 && (
                              <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                +{currentCalc.extraAdultsCount} Extra Adult @ ₹{currentCalc.extraAdultRate}/nt
                              </span>
                            )}
                            {currentCalc.extraChildrenCount > 0 && (
                              <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                +{currentCalc.extraChildrenCount} Child @ ₹{currentCalc.extraChildRate}/nt
                              </span>
                            )}
                          </div>
                        )}

                        {/* Child Age Dropdown if Children > 0 */}
                        {r.children > 0 && (
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-dashed border-gray-100">
                            {Array.from({ length: r.children }).map((_, cIdx) => (
                              <div key={cIdx}>
                                <label className="text-[10px] font-bold text-amber-900 block mb-0.5">
                                  Child {cIdx + 1} Age
                                </label>
                                <select
                                  value={r.childAges?.[cIdx] ?? 5}
                                  onChange={(e) =>
                                    handleUpdateChildAge(
                                      roomIdx,
                                      cIdx,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-full bg-amber-50/50 border border-amber-200 rounded-lg px-2 py-1 text-xs font-semibold text-[#0B1733]"
                                >
                                  <option value={0}>&lt; 1 yr (Infant)</option>
                                  <option value={1}>1 year</option>
                                  <option value={2}>2 years</option>
                                  <option value={3}>3 years</option>
                                  <option value={4}>4 years</option>
                                  <option value={5}>5 years</option>
                                  <option value={6}>6 years</option>
                                  <option value={7}>7 years</option>
                                  <option value={8}>8 years</option>
                                  <option value={9}>9 years</option>
                                  <option value={10}>10 years</option>
                                  <option value={11}>11 years</option>
                                  <option value={12}>12 years</option>
                                </select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Another Room Button */}
                {roomsConfig.length < 7 && (
                  <button
                    type="button"
                    onClick={handleAddRoom}
                    className="w-full py-2.5 px-3 border border-dashed border-primary-300 hover:border-primary-500 bg-white hover:bg-primary-50 text-primary-700 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Another Room ({roomsConfig.length + 1} of 7)</span>
                  </button>
                )}
              </div>

              {/* Meal Plan Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-1.5 flex items-center justify-between">
                  <span>Select Meal Plan</span>
                  <span className="text-[10px] text-gray-500 font-medium">Included Farmhouse Dining</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      plan: 'EP' as const,
                      title: 'EP (Room Only)',
                      desc: 'Meals extra à la carte',
                    },
                    {
                      plan: 'CP' as const,
                      title: 'CP (Breakfast)',
                      desc: 'Farmhouse Breakfast included',
                    },
                    {
                      plan: 'MAP' as const,
                      title: 'MAP (Half Board)',
                      desc: 'Breakfast + Pahadi Dinner',
                    },
                    {
                      plan: 'AP' as const,
                      title: 'AP (Full Board)',
                      desc: 'All 3 Meals Included',
                    },
                  ].map((item) => (
                    <button
                      key={item.plan}
                      type="button"
                      onClick={() => setMealPlan(item.plan)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        mealPlan === item.plan
                          ? 'bg-[#0B1733] border-[#0B1733] text-white shadow-sm ring-1 ring-[#0B1733]'
                          : 'bg-sand-50/70 border-sand-300 text-gray-900 hover:bg-sand-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{item.plan}</span>
                        {mealPlanPreviewRates[item.plan] !== undefined && (
                          <span
                            className={`text-[11px] font-bold ${
                              mealPlan === item.plan ? 'text-amber-300' : 'text-primary-700'
                            }`}
                          >
                            ₹{mealPlanPreviewRates[item.plan]!.toLocaleString('en-IN')}/nt
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] block opacity-80 mt-0.5 line-clamp-1">
                        {item.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Travel & Mountain Mobility Add-ons */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-gray-900">
                  Travel & Mountain Mobility Add-ons (Optional)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`p-2.5 rounded-xl border flex items-center space-x-2.5 cursor-pointer text-xs transition-colors ${
                      includeAirportTransfer
                        ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                        : 'bg-sand-50/70 border-sand-300 text-forest-900 hover:bg-sand-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={includeAirportTransfer}
                      onChange={(e) => setIncludeAirportTransfer(e.target.checked)}
                      className="w-4 h-4 rounded text-forest-800"
                    />
                    <div>
                      <span className="font-bold block">Airport / Cab Transfer</span>
                      <span className="text-[10px] text-gray-500 block">Bagdogra (IXB) / NJP (+{airportTransferLabel})</span>
                    </div>
                  </label>

                  <label
                    className={`p-2.5 rounded-xl border flex items-center space-x-2.5 cursor-pointer text-xs transition-colors ${
                      includeBikeRental
                        ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                        : 'bg-sand-50/70 border-sand-300 text-forest-900 hover:bg-sand-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={includeBikeRental}
                      onChange={(e) => setIncludeBikeRental(e.target.checked)}
                      className="w-4 h-4 rounded text-forest-800"
                    />
                    <div>
                      <span className="font-bold block">Scooty / Bike Rental</span>
                      <span className="text-[10px] text-gray-500 block">Enfield / Activa (+₹{(bikeRatePerNight * nights).toLocaleString('en-IN')} for stay)</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Exact Itemized Rate Breakdown Matching Backend */}
              {checkIn && checkOut && (
                <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-[#C7D4F5] text-xs text-gray-900 space-y-2.5">
                  <div className="flex items-center justify-between font-bold text-gray-900 border-b border-gray-200 pb-2">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Live Backend Rate Breakdown ({totalRooms} {totalRooms === 1 ? 'Room' : 'Rooms'})</span>
                    </span>
                    <span className="text-primary-700 font-bold">
                      {nights} {nights === 1 ? 'Night' : 'Nights'}
                    </span>
                  </div>

                  {/* Room by Room Itemization */}
                  <div className="space-y-1.5">
                    {roomCalculations.map((rc) => (
                      <div key={rc.roomNumber} className="flex justify-between items-baseline text-gray-800">
                        <div>
                          <span className="font-bold text-gray-900">Room {rc.roomNumber}:</span>{' '}
                          <span className="font-medium">{rc.assignedCategory.name}</span>
                          <span className="text-gray-500 text-[11px] block">
                            {rc.adults} Adults{rc.children > 0 ? `, ${rc.children} Child` : ''} · {inr(rc.nightlyTotal)}/nt × {nights} {nights === 1 ? 'night' : 'nights'}
                            {(rc.extraAdultsCount > 0 || rc.extraChildrenCount > 0) && (
                              <span className="text-amber-700 ml-1">
                                (Extra guests included)
                              </span>
                            )}
                          </span>
                        </div>
                        <span className="font-bold text-[#0B1733] shrink-0 ml-2">
                          {inr(rc.stayTotal)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Addons if any */}
                  {(includeAirportTransfer || includeBikeRental) && (
                    <div className="pt-1.5 border-t border-dashed border-gray-200 space-y-1">
                      {includeAirportTransfer && (
                        <div className="flex justify-between text-gray-700 text-[11px]">
                          <span>Airport / Station Transfer</span>
                          <span className="font-semibold">{airportTransferLabel}</span>
                        </div>
                      )}
                      {includeBikeRental && (
                        <div className="flex justify-between text-gray-700 text-[11px]">
                          <span>Scooty / Bike Rental ({nights} days)</span>
                          <span className="font-semibold">₹{bikeCharge.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {stayGst && stayGst.gstAmount > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>
                        GST{' '}
                        {Object.keys(stayGst.byRate)
                          .filter((r) => stayGst.byRate[Number(r)].gst > 0)
                          .map((r) => `${r}%`)
                          .join(' + ')}
                        {stayGst.addonsGst > 0 ? ` on rooms + ${gstConfig.transportRate}% on add-ons` : ' on rooms'}
                        {gstConfig.tariffsIncludeGst ? ' (included)' : ''}
                      </span>
                      <span className="font-semibold">₹{stayGst.gstAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-gray-600 pt-1.5 border-t border-gray-200">
                    <span>Selected Meal Plan</span>
                    <span className="font-semibold text-emerald-700">
                      {mealPlan === 'EP'
                        ? 'EP (Room Only)'
                        : mealPlan === 'CP'
                        ? 'CP (Breakfast Included)'
                        : mealPlan === 'MAP'
                        ? 'MAP (Breakfast + Dinner)'
                        : 'AP (All 3 Meals Included)'}
                    </span>
                  </div>

                  <div className="border-t border-gray-300 pt-2.5 flex justify-between items-baseline font-bold text-sm text-[#0B1733]">
                    <div>
                      <span className="text-base font-bold">Total Stay Tariff</span>
                      <span className="block text-[11px] text-gray-500 font-normal">
                        ({totalRooms} {totalRooms === 1 ? 'Room' : 'Rooms'} · {nights} {nights === 1 ? 'Night' : 'Nights'} · Live tariff incl. GST on rooms)
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-primary-900">
                      {pricingReady ? `₹${totalEstimatedAmount.toLocaleString('en-IN')}` : priceUnavailableLabel}
                    </span>
                  </div>
                </div>
              )}

              {/* Primary Guest Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">
                    Primary Guest Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-sand-50/50 border border-sand-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">
                    Phone / WhatsApp *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      placeholder="+91 81012 98882"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-sand-50/50 border border-sand-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-1">
                  Email Address <span className="text-gray-400 font-normal">(for confirmation voucher)</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-sand-50/50 border border-sand-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-1">
                  Special Requests / Arrival Time
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mountain view preference, arrival at 4 PM"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  className="w-full px-3 py-2.5 bg-sand-50/50 border border-sand-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white"
                />
              </div>

              <div className="pt-2">
                {restrictionMsg && (
                  <p className="mb-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                    {restrictionMsg} Please adjust your dates.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading || Boolean(restrictionMsg)}
                  className="w-full bg-[#C85A32] hover:bg-[#B34D28] text-white font-semibold py-3.5 px-4 rounded-2xl shadow-[0_4px_14px_rgba(200,90,50,0.3)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center space-x-2 text-sm sm:text-base cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Submitting Reservation to PMS...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 text-white" />
                      <span>
                        Confirm Reservation ({totalRooms} {totalRooms === 1 ? 'Room' : 'Rooms'}{pricingReady ? ` · ₹${totalEstimatedAmount.toLocaleString('en-IN')}` : ''})
                      </span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-center text-gray-400">
                Zero upfront booking fee. Host contacts you to confirm and provide secure UPI payment options.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
