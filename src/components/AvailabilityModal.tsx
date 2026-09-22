'use client';

import { useState, useEffect } from 'react';
import { Room, Booking } from '@/types';
import { INITIAL_ROOMS, INITIAL_BOOKINGS } from '@/lib/mock-data';
import DateRangePicker from './DateRangePicker';
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
} from 'lucide-react';

interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms?: Room[];
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialRoomsCount?: number;
  initialStep?: 'form' | 'results';
  onBookRoom: (room: Room, dates?: { checkIn: string; checkOut: string }) => void;
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

  const getStayNights = (inDate: string, outDate: string) => {
    if (!inDate || !outDate) return 1;
    try {
      const d1 = new Date(inDate + 'T00:00:00');
      const d2 = new Date(outDate + 'T00:00:00');
      const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
      return Math.max(1, diff);
    } catch {
      return 1;
    }
  };

  const [step, setStep] = useState<'form' | 'results'>(initialStep || 'form');
  const [checkIn, setCheckIn] = useState(initialCheckIn || getTodayStr());
  const [checkOut, setCheckOut] = useState(
    initialCheckOut || getNextDayStr(initialCheckIn || getTodayStr())
  );
  const [roomsCount, setRoomsCount] = useState(initialRoomsCount || 1);

  const [isChecking, setIsChecking] = useState(false);
  const [availabilityResults, setAvailabilityResults] = useState<CategoryAvailability[]>([]);
  const [cachedBookings, setCachedBookings] = useState<Booking[]>([]);
  const [stayNights, setStayNights] = useState(1);
  const [availabilityError, setAvailabilityError] = useState('');

  // Core calculation function
  const calculateAvailability = (
    inDate: string,
    outDate: string,
    bookingsList: Booking[]
  ) => {
    const d1 = new Date(inDate);
    const d2 = new Date(outDate);
    const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
    const nights = Math.max(1, diff);

    const activeRooms = rooms && rooms.length > 0 ? rooms : INITIAL_ROOMS;

    const list: CategoryAvailability[] = activeRooms.map((room) => {
      const bookedCount = bookingsList.filter((b) => {
        if (b.status === 'cancelled') return false;
        const matchesRoom =
          (b.room_id && b.room_id === room.id) ||
          (b.room_name && b.room_name.toLowerCase() === room.name.toLowerCase());
        if (!matchesRoom) return false;
        return b.check_in < outDate && b.check_out > inDate;
      }).length;

      const totalCapacity = room.total_inventory || 1;
      const availableCount = Math.max(0, totalCapacity - bookedCount);
      const nightlyRate = room.price_per_night;
      const totalStayPrice = nightlyRate * nights;

      return {
        room,
        totalCapacity,
        bookedCount,
        availableCount,
        nightlyRate,
        totalStayPrice,
        nights,
      };
    });

    return { list, nights };
  };

  // Perform inventory check
  const runLiveCheck = async (inDate: string, outDate: string) => {
    setIsChecking(true);
    setAvailabilityError('');

    try {
      let bookingsList = cachedBookings;
      if (bookingsList.length === 0) {
        try {
          const res = await fetch('/api/bookings');
          if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
              bookingsList = json.data;
              setCachedBookings(json.data);
            }
          }
        } catch {
          bookingsList = INITIAL_BOOKINGS;
        }
      }

      const { list, nights } = calculateAvailability(inDate, outDate, bookingsList);
      setAvailabilityResults(list);
      setStayNights(nights);
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
      if (initialRoomsCount) setRoomsCount(initialRoomsCount);

      const targetStep = initialStep || 'form';
      setStep(targetStep);

      if (targetStep === 'results') {
        runLiveCheck(effIn, effOut);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialCheckIn, initialCheckOut, initialRoomsCount, initialStep]);

  // Handle Check-in change with automatic Check-out advancement
  const handleCheckInChange = (newIn: string) => {
    setCheckIn(newIn);
    if (!checkOut || checkOut <= newIn) {
      setCheckOut(getNextDayStr(newIn));
    }
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
    runLiveCheck(effIn, effOut);
  };

  // Handle in-results inline date change
  const handleInlineCheckInChange = (newIn: string) => {
    let newOut = checkOut;
    if (!newOut || newOut <= newIn) {
      newOut = getNextDayStr(newIn);
    }
    handleModalDateChange(newIn, newOut);
  };

  const handleModalDateChange = (newIn: string, newOut: string) => {
    setCheckIn(newIn);
    setCheckOut(newOut);
    const { list, nights } = calculateAvailability(newIn, newOut, cachedBookings);
    setAvailabilityResults(list);
    setStayNights(nights);
  };

  const handleSelectRoomToBook = (room: Room) => {
    onClose();
    onBookRoom(room, { checkIn, checkOut });
  };

  const handleInquireCategory = (room: Room) => {
    onClose();
    onOpenInquiry({ checkIn, checkOut, guests: roomsCount * 2 });
  };

  if (!isOpen) return null;

  const totalHomestayRooms = availabilityResults.reduce(
    (acc, item) => acc + item.totalCapacity,
    0
  );
  const totalAvailableRooms = availabilityResults.reduce(
    (acc, item) => acc + item.availableCount,
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div
        className={`relative w-full ${
          step === 'form' ? 'max-w-2xl' : 'max-w-4xl'
        } bg-white rounded-3xl shadow-2xl border border-sand-200 overflow-hidden my-6 max-h-[92vh] flex flex-col transition-all duration-300`}
      >
        {/* =========================================================================
            STEP 1: ASK FOR CHECK-IN, CHECK-OUT, ROOMS WITH CHECK AVAILABILITY BUTTON
           ========================================================================= */}
        {step === 'form' ? (
          <>
            {/* Header */}
            <div className="bg-forest-900 text-white p-6 sm:p-7 relative shrink-0">
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-2 mb-2">
                <span className="inline-flex items-center space-x-1.5 bg-sand-400/20 text-sand-300 text-[11px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full border border-sand-400/30">
                  <Sparkles className="w-3.5 h-3.5 text-sand-400" />
                  <span>DIRECT HOMESTAY BOOKING</span>
                </span>
                <span className="text-xs text-sand-200/80 font-medium">• Live Inventory</span>
              </div>

              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Check Room Availability
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-sand-200 max-w-lg leading-relaxed">
                Select your check-in and check-out dates and required rooms to check live inventory across all our suites and cottages.
              </p>
            </div>

            {/* Step 1 Form Body */}
            <form onSubmit={handleFormCheckAvailability} className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">
              {/* Interactive Boutique Date Range Picker */}
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

              {/* Number of Rooms Container */}
              <div className="bg-sand-50/90 border border-sand-300/80 hover:border-forest-600/60 rounded-2xl p-4 transition-all focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-600/20">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-forest-900 flex items-center space-x-1.5 select-none">
                    <Bed className="w-4 h-4 text-forest-700 shrink-0" />
                    <span>Number of Rooms</span>
                  </label>
                  <span className="text-[11px] text-gray-500 font-medium">Estate Capacity: 7 Rooms</span>
                </div>
                <select
                  value={roomsCount}
                  onChange={(e) => setRoomsCount(Number(e.target.value))}
                  className="w-full bg-white border border-sand-300 rounded-xl px-3.5 py-2.5 text-sm sm:text-base font-semibold text-forest-950 focus:outline-none focus:ring-1 focus:ring-forest-600 cursor-pointer shadow-sm"
                >
                  <option value={1}>1 Room (Ideal for 1-2 Guests)</option>
                  <option value={2}>2 Rooms (Ideal for 3-4 Guests)</option>
                  <option value={3}>3 Rooms (Ideal for 5-6 Guests)</option>
                  <option value={4}>4 Rooms (Ideal for 7-8 Guests)</option>
                  <option value={5}>5 Rooms (Ideal for 9-10 Guests)</option>
                  <option value={6}>6 Rooms (Ideal for 11-12 Guests)</option>
                  <option value={7}>All 7 Rooms (Exclusive Estate Buyout - Up to 14+ Guests)</option>
                </select>
              </div>

              {/* Trip Summary Chip */}
              <div className="bg-sand-100/90 border border-sand-200 rounded-2xl p-3.5 flex items-center justify-between text-xs text-forest-950">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-forest-900">Duration:</span>
                  <span className="bg-forest-900 text-white font-bold px-2 py-0.5 rounded-md text-[11px]">
                    {getStayNights(checkIn, checkOut)} {getStayNights(checkIn, checkOut) === 1 ? 'Night' : 'Nights'}
                  </span>
                  <span className="text-gray-400 hidden sm:inline">•</span>
                  <span className="text-gray-700 hidden sm:inline">
                    {roomsCount} {roomsCount === 1 ? 'Room' : 'Rooms'} selected
                  </span>
                </div>
                <div className="text-[11px] text-forest-800 font-medium hidden xs:inline">
                  ⚡ Instant Live Inventory
                </div>
              </div>

              {/* Check Availability CTA Button */}
              <button
                type="submit"
                className="w-full bg-forest-800 hover:bg-forest-900 active:scale-[0.99] text-white font-bold py-4 px-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center space-x-2 text-base sm:text-lg cursor-pointer group"
              >
                <Search className="w-5 h-5 text-sand-300 group-hover:scale-110 transition-transform shrink-0" />
                <span>Check Availability</span>
                <ArrowRight className="w-4 h-4 text-sand-300 group-hover:translate-x-1 transition-transform shrink-0" />
              </button>

              {/* Trust Guarantees */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-sand-200">
                <div className="flex items-center space-x-1.5 text-[11px] text-forest-900 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Direct Rate Guarantee</span>
                </div>
                <div className="flex items-center space-x-1.5 text-[11px] text-forest-900 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Zero Booking Fees</span>
                </div>
                <div className="flex items-center space-x-1.5 text-[11px] text-forest-900 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Breakfast Included</span>
                </div>
                <div className="flex items-center space-x-1.5 text-[11px] text-forest-900 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Instant Verification</span>
                </div>
              </div>
            </form>

            {/* Step 1 Footer */}
            <div className="bg-gray-50 border-t border-sand-200 px-6 py-3.5 flex items-center justify-between gap-3 shrink-0 text-xs">
              <div className="flex items-center space-x-2 text-gray-500">
                <ShieldCheck className="w-4 h-4 text-forest-700 shrink-0" />
                <span>Official Homestay Reservation Channel</span>
              </div>
              <button
                onClick={onClose}
                className="bg-sand-200 hover:bg-sand-300 text-forest-900 font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          /* =========================================================================
              STEP 2: LIVE AVAILABILITY RESULTS WITH ROOM CATEGORIES & RATES
             ========================================================================= */
          <>
            {/* Modal Header */}
            <div className="bg-forest-900 text-white p-5 sm:p-6 relative shrink-0">
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
                <span className="text-xs text-sand-300 font-medium">• Verified Real-Time</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                    Available Rooms & Rates
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-sand-200">
                    <span className="font-semibold text-white">
                      📅 {formatDisplayDate(checkIn)} → {formatDisplayDate(checkOut)}
                    </span>
                    <span>•</span>
                    <span>
                      {stayNights} {stayNights === 1 ? 'Night' : 'Nights'}
                    </span>
                    <span>•</span>
                    <span>
                      Requested: {roomsCount} {roomsCount === 1 ? 'Room' : 'Rooms'}
                    </span>
                  </div>
                </div>

                {/* Change Dates / Back to Step 1 Button */}
                <button
                  onClick={() => setStep('form')}
                  className="inline-flex items-center space-x-1.5 bg-white/15 hover:bg-white/25 text-sand-100 hover:text-white text-xs font-semibold px-3.5 py-2 rounded-xl border border-white/20 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Dates / Rooms</span>
                </button>
              </div>
            </div>

            {/* Summary & Date Adjustment Bar */}
            <div className="bg-sand-50/90 border-b border-sand-200 px-5 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2">
                {isChecking ? (
                  <div className="inline-flex items-center space-x-2 text-xs font-semibold text-forest-800">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-forest-700" />
                    <span>Checking live estate availability...</span>
                  </div>
                ) : totalAvailableRooms > 0 ? (
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      {totalAvailableRooms} of {totalHomestayRooms} Rooms Open on Estate
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Fully Booked on Selected Dates</span>
                  </div>
                )}
                {roomsCount > 1 && !isChecking && (
                  <span className="text-xs text-gray-600 hidden md:inline">
                    {totalAvailableRooms >= roomsCount
                      ? 'Party requirement met across estate categories.'
                      : 'Fewer rooms left than requested quantity.'}
                  </span>
                )}
              </div>

              {/* Quick Date & Room Modifier */}
              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="bg-white hover:bg-sand-100 border border-sand-300 rounded-xl px-3 py-1.5 text-xs text-forest-900 font-semibold flex items-center space-x-1.5 cursor-pointer shadow-sm transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5 text-forest-700" />
                  <span>{formatDisplayDate(checkIn)} → {formatDisplayDate(checkOut)}</span>
                  <span className="text-[10px] text-forest-600 underline font-normal ml-1">Edit</span>
                </button>

                <select
                  value={roomsCount}
                  onChange={(e) => setRoomsCount(Number(e.target.value))}
                  className="bg-white border border-sand-300 rounded-xl px-2.5 py-1.5 text-xs text-forest-900 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value={1}>1 Room</option>
                  <option value={2}>2 Rooms</option>
                  <option value={3}>3 Rooms</option>
                  <option value={4}>4 Rooms</option>
                  <option value={5}>5 Rooms</option>
                  <option value={6}>6 Rooms</option>
                  <option value={7}>All 7 Rooms</option>
                </select>
              </div>
            </div>

            {/* Scrollable Room Categories List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {availabilityError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{availabilityError}</span>
                </div>
              )}

              {availabilityResults.map(({ room, totalCapacity, availableCount, totalStayPrice }) => {
                const isSufficient = availableCount >= roomsCount;
                const isSoldOut = availableCount === 0;

                return (
                  <div
                    key={room.id}
                    className={`rounded-2xl border transition-all overflow-hidden flex flex-col md:flex-row gap-4 p-4 items-center ${
                      isSoldOut
                        ? 'border-gray-200 bg-gray-50/70 opacity-80'
                        : 'border-sand-200 bg-white hover:border-forest-600/40 hover:shadow-md'
                    }`}
                  >
                    {/* Room Category Image */}
                    <div className="w-full md:w-48 h-40 md:h-36 rounded-xl overflow-hidden relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          room.images?.[0] ||
                          'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80'
                        }
                        alt={room.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-sand-200 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded">
                        {room.room_type}
                      </div>
                    </div>

                    {/* Room Category Details */}
                    <div className="flex-1 min-w-0 space-y-2 w-full text-left">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-serif text-lg sm:text-xl font-bold text-forest-950">
                          {room.name}
                        </h4>

                        {/* Live Inventory Status Badge */}
                        {isSoldOut ? (
                          <span className="inline-flex items-center space-x-1 bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold px-2.5 py-1 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            <span>Sold Out</span>
                          </span>
                        ) : isSufficient ? (
                          <span className="inline-flex items-center space-x-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold px-2.5 py-1 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>
                              {availableCount} of {totalCapacity} Available
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold px-2.5 py-1 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <span>
                              Only {availableCount} of {totalCapacity} Left
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          <Coffee className="w-3 h-3 text-emerald-600" />
                          <span>Breakfast included</span>
                        </span>
                        <p className="text-xs text-gray-500 line-clamp-1">
                          {room.tagline || room.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-forest-800">
                        <span className="flex items-center space-x-1">
                          <Users className="w-3.5 h-3.5 text-forest-600" />
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
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {room.amenities.slice(0, 3).map((amenity, idx) => (
                            <span
                              key={idx}
                              className="bg-sand-100 text-forest-900 text-[11px] px-2 py-0.5 rounded-md font-medium"
                            >
                              {amenity}
                            </span>
                          ))}
                          {room.amenities.length > 3 && (
                            <span className="text-[11px] text-gray-400 self-center">
                              +{room.amenities.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Pricing & Booking CTA */}
                    <div className="w-full md:w-52 flex md:flex-col justify-between md:justify-center items-center md:items-end gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-sand-100">
                      <div className="text-left md:text-right">
                        <div className="text-xs text-gray-500">Starting from</div>
                        <div className="text-lg sm:text-xl font-bold text-forest-900">
                          ₹{room.price_per_night.toLocaleString()}
                          <span className="text-xs font-normal text-gray-600"> /night</span>
                        </div>
                        <div className="text-[11px] text-emerald-700 font-semibold flex items-center md:justify-end gap-1">
                          <Coffee className="w-3 h-3 text-emerald-600" />
                          <span>Breakfast included</span>
                        </div>
                        <div className="text-[11px] text-forest-700 font-medium">
                          ₹{totalStayPrice.toLocaleString()} for {stayNights}{' '}
                          {stayNights === 1 ? 'night' : 'nights'}
                        </div>
                      </div>

                      {/* Action Button */}
                      {!isSoldOut ? (
                        <button
                          onClick={() => handleSelectRoomToBook(room)}
                          className="bg-forest-800 hover:bg-forest-900 active:scale-95 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
                        >
                          <span>Reserve Category</span>
                          <ArrowRight className="w-3.5 h-3.5 text-sand-300" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleInquireCategory(room)}
                          className="bg-sand-200 hover:bg-sand-300 text-forest-900 text-xs font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer"
                        >
                          <span>Join Waitlist</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Full Estate Buyout Notice */}
              {roomsCount >= 5 && (
                <div className="bg-sand-50 border border-sand-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-forest-950">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-sand-200 flex items-center justify-center shrink-0">
                      <Building className="w-5 h-5 text-forest-800" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-sm">
                        Planning an Exclusive Buyout (All 7 Rooms)?
                      </h5>
                      <p className="text-xs text-gray-600">
                        Enjoy private access to the entire estate, lawns, and dedicated chef for your group.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenInquiry({ checkIn, checkOut, guests: 14 });
                    }}
                    className="whitespace-nowrap bg-sand-400 hover:bg-sand-500 text-forest-950 text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-colors cursor-pointer"
                  >
                    Inquire Villa Buyout
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-sand-200 px-5 py-3.5 sm:px-6 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <ShieldCheck className="w-4 h-4 text-forest-700 shrink-0" />
                <span>Zero Booking Fees • Direct Best Rate Guarantee • Breakfast Included</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    onClose();
                    onOpenInquiry({ checkIn, checkOut, guests: roomsCount * 2 });
                  }}
                  className="text-xs text-forest-800 hover:text-forest-950 underline font-medium px-2 py-1 cursor-pointer"
                >
                  Need Custom Assistance?
                </button>
                <button
                  onClick={onClose}
                  className="bg-sand-200 hover:bg-sand-300 text-forest-900 text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
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
