'use client';

import { useState, useEffect, useMemo } from 'react';
import { Room } from '@/types';
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
} from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  rooms?: Room[];
  initialDates?: { checkIn?: string; checkOut?: string } | null;
  initialMealPlan?: 'EP' | 'CP' | 'MAP' | 'AP';
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
  const [mealPlan, setMealPlan] = useState<'EP' | 'CP' | 'MAP' | 'AP'>('CP');

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

  // Sync initial dates, meal plan & room configuration when modal is triggered
  useEffect(() => {
    if (isOpen) {
      if (initialMealPlan) {
        setMealPlan(initialMealPlan);
      }
      if (initialDates) {
        if (initialDates.checkIn) setCheckIn(initialDates.checkIn);
        if (initialDates.checkOut) setCheckOut(initialDates.checkOut);
      } else {
        const today = getTodayStr();
        setCheckIn(today);
        setCheckOut(getNextDayStr(today));
      }
      if (initialRoomsConfig && initialRoomsConfig.length > 0) {
        setRoomsConfig(initialRoomsConfig);
      } else {
        setRoomsConfig([
          {
            roomNumber: 1,
            adults: 2,
            children: 0,
            childAges: [],
          },
        ]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialDates, initialMealPlan, initialRoomsConfig]);

  if (!isOpen || !room) return null;

  // Calculate nights
  let nights = 1;
  if (checkIn && checkOut) {
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
    if (diff > 0) nights = diff;
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
    const next = Math.min(4, Math.max(1, current + delta));
    updated[index] = { ...updated[index], adults: next };
    setRoomsConfig(updated);
  };

  const handleUpdateChildren = (index: number, delta: number) => {
    const updated = [...roomsConfig];
    const current = updated[index].children || 0;
    const next = Math.min(2, Math.max(0, current + delta));

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

  // Tariff & Capacity Rules
  const baseAdults = room.base_adults || 2;
  const extraAdultRate =
    room.extra_adult_charge ?? room.tariffs?.extraAdultRate ?? 1200;
  const extraChildRate =
    room.extra_child_charge ?? room.tariffs?.extraChildRate ?? 600;

  const planRates: Record<'EP' | 'CP' | 'MAP' | 'AP', number> = {
    EP: room.tariffs?.regular?.EP || room.price_per_night,
    CP:
      room.tariffs?.regular?.CP ||
      (room.tariffs?.regular?.EP
        ? room.tariffs.regular.EP + 700
        : room.price_per_night + 700),
    MAP:
      room.tariffs?.regular?.MAP ||
      (room.tariffs?.regular?.EP
        ? room.tariffs.regular.EP + 1700
        : room.price_per_night + 1700),
    AP:
      room.tariffs?.regular?.AP ||
      (room.tariffs?.regular?.EP
        ? room.tariffs.regular.EP + 2700
        : room.price_per_night + 2700),
  };

  const effectiveNightlyRate = planRates[mealPlan] || room.price_per_night;

  // Aggregate room calculations
  const totalRooms = roomsConfig.length;
  const totalAdults = roomsConfig.reduce((sum, r) => sum + (r.adults || 0), 0);
  const totalChildren = roomsConfig.reduce((sum, r) => sum + (r.children || 0), 0);
  const totalGuests = totalAdults + totalChildren;

  // Per-room cost calculations
  const roomCalculations = roomsConfig.map((r, idx) => {
    const extraAdults = Math.max(0, (r.adults || 1) - baseAdults);
    const extraChildren = Math.max(0, r.children || 0);
    const extraAdultsCostPerNight = extraAdults * extraAdultRate;
    const extraChildrenCostPerNight = extraChildren * extraChildRate;
    const totalExtraPerNight = extraAdultsCostPerNight + extraChildrenCostPerNight;
    const nightlyTotal = effectiveNightlyRate + totalExtraPerNight;
    const stayTotal = nightlyTotal * nights;

    return {
      roomNumber: idx + 1,
      adults: r.adults,
      children: r.children,
      childAges: r.childAges || [],
      extraAdults,
      extraChildren,
      extraAdultsCostPerNight,
      extraChildrenCostPerNight,
      nightlyTotal,
      stayTotal,
    };
  });

  const baseStayAllRooms = totalRooms * effectiveNightlyRate * nights;
  const totalExtraCharges = roomCalculations.reduce(
    (sum, rc) =>
      sum +
      (rc.extraAdultsCostPerNight + rc.extraChildrenCostPerNight) * nights,
    0
  );
  const totalEstimatedAmount = baseStayAllRooms + totalExtraCharges;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!guestName.trim() || !phone.trim() || !checkIn || !checkOut) {
      setErrorMsg('Please complete your name, phone number, and both check-in/out dates.');
      return;
    }

    setLoading(true);

    try {
      const roomSummaryStr = roomCalculations
        .map(
          (rc) =>
            `[Room ${rc.roomNumber}: ${rc.adults} Adults${
              rc.children > 0
                ? `, ${rc.children} Child${
                    rc.childAges.length > 0 ? ` (Age ${rc.childAges.join(', ')})` : ''
                  }`
                : ''
            }]`
        )
        .join(' ');

      const payload = {
        guest_name: guestName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        room_id: room.id,
        room_name:
          totalRooms > 1
            ? `${room.name} (${totalRooms} Rooms)`
            : room.name,
        check_in: checkIn,
        check_out: checkOut,
        nights,
        rooms_count: totalRooms,
        adults_count: totalAdults,
        children_count: totalChildren,
        extra_charges_total: totalExtraCharges,
        total_price: totalEstimatedAmount,
        special_requests: [
          `[Multi-Room Booking: ${totalRooms} Rooms • ${totalAdults} Adults${
            totalChildren > 0 ? `, ${totalChildren} Child` : ''
          }]`,
          roomSummaryStr,
          `[Meal Plan: ${mealPlan}]`,
          includeAirportTransfer ? '[Add-on: Airport/Railway Station Transfer]' : '',
          includeBikeRental ? '[Add-on: Scooty/Bike Rental]' : '',
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
        setBookingRef(data.data?.booking_reference || 'SH-2K2609' + Math.floor(100 + Math.random() * 900));
        setSuccess(true);
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
      includeAirportTransfer ? '• Airport/Station Cab Transfer' : '',
      includeBikeRental ? '• Scooty/Motorcycle Rental' : '',
    ]
      .filter(Boolean)
      .join('\n');

    const roomsBreakdownText = roomCalculations
      .map(
        (rc) =>
          `• *Room ${rc.roomNumber}:* ${rc.adults} Adults${
            rc.children > 0
              ? `, ${rc.children} Child (Age: ${rc.childAges.join(', ') || '5'})`
              : ''
          } — ₹${rc.stayTotal.toLocaleString()}`
      )
      .join('\n');

    const text = encodeURIComponent(
      `Hello Savera Homestay! I just placed a booking reservation on your website.\n\n` +
        `*Reference:* ${bookingRef}\n` +
        `*Accommodation:* ${room.name} (${totalRooms} ${totalRooms === 1 ? 'Room' : 'Rooms'})\n` +
        `*Dates:* ${checkIn} → ${checkOut} (${nights} ${nights === 1 ? 'night' : 'nights'})\n` +
        `*Meal Plan:* ${mealPlan}\n` +
        `*Total Guests:* ${totalAdults} Adults${totalChildren > 0 ? `, ${totalChildren} Child` : ''}\n\n` +
        `*Room Allocation & Tariffs:*\n${roomsBreakdownText}\n\n` +
        `*Estimated Total Tariff:* ₹${totalEstimatedAmount.toLocaleString()}\n` +
        `*Guest:* ${guestName}\n` +
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
        <div className="bg-[#0B1733] text-white p-5 sm:p-6 relative shrink-0">
          <button
            onClick={handleResetAndClose}
            aria-label="Close modal"
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2 mb-1.5">
            <span className="inline-flex items-center space-x-1.5 bg-primary-500/25 text-primary-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-primary-400/30">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>DIRECT RESERVATION</span>
            </span>
            <span className="text-xs text-sand-300 font-medium">• Instant Direct Host Rates</span>
          </div>

          <h3
            className="font-bold text-xl sm:text-2xl text-white tracking-tight leading-tight"
            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
          >
            {room.name}
          </h3>
          <p className="text-xs text-sand-200 font-light mt-0.5">
            {room.tagline || 'Boutique Himalayan Mountain Stay · Darjeeling'}
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
                Booking ID: {bookingRef}
              </div>

              <div className="max-w-md mx-auto bg-gray-50 border border-gray-200 rounded-2xl p-4 text-left text-xs space-y-1.5 text-gray-700">
                <div className="flex justify-between font-semibold text-gray-900 pb-1 border-b border-gray-200">
                  <span>{totalRooms} {totalRooms === 1 ? 'Room' : 'Rooms'} · {nights} {nights === 1 ? 'Night' : 'Nights'}</span>
                  <span className="text-primary-700">₹{totalEstimatedAmount.toLocaleString()}</span>
                </div>
                <div className="text-gray-600">
                  📅 {checkIn} → {checkOut}
                </div>
                <div className="text-gray-600">
                  👥 {totalAdults} Adults{totalChildren > 0 ? `, ${totalChildren} Child` : ''}
                </div>
                <div className="pt-1 text-[11px] text-gray-500">
                  {roomCalculations.map((rc) => (
                    <div key={rc.roomNumber}>
                      Room {rc.roomNumber}: {rc.adults} Adults{rc.children > 0 ? `, ${rc.children} Child` : ''}
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
                        Rooms & Guests (Goibibo Model)
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {totalRooms} {totalRooms === 1 ? 'Room' : 'Rooms'} · {totalGuests} {totalGuests === 1 ? 'Guest' : 'Guests'} ({totalAdults} Adults{totalChildren > 0 ? `, ${totalChildren} Child` : ''})
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md border border-primary-200/50">
                    Base: 2 Adults / Room
                  </span>
                </div>

                {/* Individual Room Cards */}
                <div className="space-y-3 pt-1">
                  {roomsConfig.map((r, roomIdx) => {
                    const extraAdultsInRoom = Math.max(0, (r.adults || 1) - baseAdults);
                    const extraChildrenInRoom = Math.max(0, r.children || 0);

                    return (
                      <div
                        key={r.roomNumber || roomIdx}
                        className="bg-white rounded-xl border border-gray-200 p-3 sm:p-3.5 space-y-2.5 shadow-2xs"
                      >
                        {/* Room Header */}
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-md bg-[#0B1733] text-white text-[11px] font-bold flex items-center justify-center">
                              {roomIdx + 1}
                            </span>
                            <span className="text-xs font-bold text-gray-900">
                              Room {roomIdx + 1}
                            </span>
                            <span className="text-[10px] text-gray-500 font-normal">
                              ({r.adults} Adults{r.children > 0 ? `, ${r.children} Child` : ''})
                            </span>
                          </div>

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

                        {/* Adult and Child Steppers Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {/* Adults */}
                          <div className="flex items-center justify-between bg-gray-50/80 p-2 rounded-lg border border-gray-100">
                            <div>
                              <div className="text-xs font-bold text-gray-800">Adults</div>
                              <div className="text-[10px] text-gray-500">12+ years</div>
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
                                disabled={r.adults >= 4}
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
                                disabled={r.children >= 2}
                                className="w-7 h-7 rounded-full bg-primary-50 border border-primary-500 text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shadow-2xs"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Extra Bed & Child Notes */}
                        {(extraAdultsInRoom > 0 || extraChildrenInRoom > 0) && (
                          <div className="flex flex-wrap gap-2 text-[11px] pt-1">
                            {extraAdultsInRoom > 0 && (
                              <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                +{extraAdultsInRoom} Extra Adult Mattress (+₹{extraAdultRate}/nt)
                              </span>
                            )}
                            {extraChildrenInRoom > 0 && (
                              <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                +{extraChildrenInRoom} Child (+₹{extraChildRate}/nt)
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
                  <span className="text-[10px] text-gray-500 font-medium">Included Dining</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMealPlan('EP')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      mealPlan === 'EP'
                        ? 'bg-[#0B1733] border-[#0B1733] text-white shadow-sm'
                        : 'bg-sand-50/70 border-sand-300 text-forest-950 hover:bg-sand-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">EP (Room Only)</span>
                      <span className={`text-[10px] font-bold ${mealPlan === 'EP' ? 'text-amber-300' : 'text-forest-700'}`}>
                        ₹{planRates.EP.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-[10px] block opacity-80 mt-0.5">Stay without meals</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMealPlan('CP')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      mealPlan === 'CP'
                        ? 'bg-[#0B1733] border-[#0B1733] text-white shadow-sm'
                        : 'bg-sand-50/70 border-sand-300 text-forest-950 hover:bg-sand-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">CP (Breakfast)</span>
                      <span className={`text-[10px] font-bold ${mealPlan === 'CP' ? 'text-amber-300' : 'text-forest-700'}`}>
                        ₹{planRates.CP.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-[10px] block opacity-80 mt-0.5">Complimentary Breakfast</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMealPlan('MAP')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      mealPlan === 'MAP'
                        ? 'bg-[#0B1733] border-[#0B1733] text-white shadow-sm'
                        : 'bg-sand-50/70 border-sand-300 text-forest-950 hover:bg-sand-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">MAP (Half Board)</span>
                      <span className={`text-[10px] font-bold ${mealPlan === 'MAP' ? 'text-amber-300' : 'text-forest-700'}`}>
                        ₹{planRates.MAP.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-[10px] block opacity-80 mt-0.5">Breakfast + Pahadi Dinner</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMealPlan('AP')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      mealPlan === 'AP'
                        ? 'bg-[#0B1733] border-[#0B1733] text-white shadow-sm'
                        : 'bg-sand-50/70 border-sand-300 text-forest-950 hover:bg-sand-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">AP (Full Board)</span>
                      <span className={`text-[10px] font-bold ${mealPlan === 'AP' ? 'text-amber-300' : 'text-forest-700'}`}>
                        ₹{planRates.AP.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-[10px] block opacity-80 mt-0.5">All 3 Meals Included</span>
                  </button>
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
                      <span className="text-[10px] text-gray-500 block">Bagdogra (IXB) / NJP from ₹2,800</span>
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
                      <span className="text-[10px] text-gray-500 block">Enfield / Activa from ₹800/day</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Price Calculation Card (Goibibo Style Itemized Breakdown) */}
              {checkIn && checkOut && (
                <div className="bg-sand-100/70 p-3.5 rounded-2xl border border-sand-200 text-xs text-forest-900 space-y-2">
                  <div className="flex items-center justify-between font-bold text-gray-900 border-b border-sand-200 pb-1.5">
                    <span>Itemized Rate Breakdown ({totalRooms} {totalRooms === 1 ? 'Room' : 'Rooms'})</span>
                    <span className="text-primary-700">
                      {nights} {nights === 1 ? 'Night' : 'Nights'}
                    </span>
                  </div>

                  {/* Room by Room Breakdown */}
                  {roomCalculations.map((rc) => (
                    <div key={rc.roomNumber} className="flex justify-between text-gray-700">
                      <div>
                        <span className="font-semibold text-gray-900">Room {rc.roomNumber}:</span>{' '}
                        {rc.adults} Adults{rc.children > 0 ? `, ${rc.children} Child` : ''}
                        {(rc.extraAdults > 0 || rc.extraChildren > 0) && (
                          <span className="text-[10px] text-amber-700 block">
                            Includes{' '}
                            {[
                              rc.extraAdults > 0 ? `${rc.extraAdults} Extra Bed @ ₹${extraAdultRate}/nt` : '',
                              rc.extraChildren > 0 ? `${rc.extraChildren} Child @ ₹${extraChildRate}/nt` : '',
                            ].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-[#0B1733]">₹{rc.stayTotal.toLocaleString()}</span>
                    </div>
                  ))}

                  <div className="flex justify-between text-gray-600 pt-1 border-t border-sand-200">
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

                  <div className="border-t border-sand-300 pt-2 flex justify-between items-baseline font-bold text-sm text-[#0B1733]">
                    <div>
                      <span>Estimated Total</span>
                      <span className="block text-[10px] text-gray-500 font-normal">
                        ({totalRooms} {totalRooms === 1 ? 'Room' : 'Rooms'} · {nights} {nights === 1 ? 'Night' : 'Nights'} · All Taxes Included)
                      </span>
                    </div>
                    <span className="text-xl font-bold text-primary-900">
                      ₹{totalEstimatedAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Guest Details */}
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
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#FE6E00] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] text-white font-bold py-3.5 px-4 rounded-2xl shadow-[0_4px_14px_rgba(254,110,0,0.35)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center space-x-2 text-sm sm:text-base cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Submitting Reservation...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 text-white" />
                      <span>
                        Confirm Reservation ({totalRooms} {totalRooms === 1 ? 'Room' : 'Rooms'} · ₹{totalEstimatedAmount.toLocaleString()})
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
