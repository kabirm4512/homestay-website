'use client';

import { useState, useEffect, useCallback } from 'react';
import { Room, HeroSlide, Booking } from '@/types';
import { INITIAL_ROOMS, INITIAL_BOOKINGS } from '@/lib/mock-data';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Bed,
  Sparkles,
  ArrowRight,
  Search,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  Users,
  ShieldCheck,
  Building,
} from 'lucide-react';

interface HeroCarouselProps {
  slides: HeroSlide[];
  rooms?: Room[];
  onOpenInquiry: (initialDates?: { checkIn: string; checkOut: string; guests: number }) => void;
  onBookRoom?: (room: Room, dates?: { checkIn: string; checkOut: string }) => void;
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

export default function HeroCarousel({
  slides,
  rooms = [],
  onOpenInquiry,
  onBookRoom,
}: HeroCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Date helper functions
  const getTodayStr = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
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

  // Quick search form state
  const [checkIn, setCheckIn] = useState(getTodayStr());
  const [checkOut, setCheckOut] = useState(getTomorrowStr());
  const [roomsCount, setRoomsCount] = useState(1);

  // Live availability modal state
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const [availabilityResults, setAvailabilityResults] = useState<CategoryAvailability[]>([]);
  const [cachedBookings, setCachedBookings] = useState<Booking[]>([]);
  const [stayNights, setStayNights] = useState(1);
  const [availabilityError, setAvailabilityError] = useState('');

  const nextSlide = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = () => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  };

  useEffect(() => {
    if (isHovered || slides.length <= 1) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 6000);
    return () => clearInterval(timer);
  }, [isHovered, slides.length, nextSlide]);

  // Handle Check-in date change with automatic Check-out advancement
  const handleCheckInChange = (newCheckIn: string) => {
    setCheckIn(newCheckIn);
    if (!checkOut || checkOut <= newCheckIn) {
      const d = new Date(newCheckIn);
      d.setDate(d.getDate() + 1);
      setCheckOut(d.toISOString().split('T')[0]);
    }
  };

  // Core availability calculation logic
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
        // Interval overlap condition: check_in < outDate && check_out > inDate
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

  // Handle Check Availability click
  const handleCheckAvailability = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAvailabilityError('');

    const effectiveCheckIn = checkIn || getTodayStr();
    let effectiveCheckOut = checkOut;
    if (!effectiveCheckOut || effectiveCheckOut <= effectiveCheckIn) {
      const d = new Date(effectiveCheckIn);
      d.setDate(d.getDate() + 1);
      effectiveCheckOut = d.toISOString().split('T')[0];
      setCheckOut(effectiveCheckOut);
    }
    if (!checkIn) setCheckIn(effectiveCheckIn);

    setIsChecking(true);

    try {
      let bookingsList = cachedBookings;
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
        if (bookingsList.length === 0) bookingsList = INITIAL_BOOKINGS;
      }

      const { list, nights } = calculateAvailability(
        effectiveCheckIn,
        effectiveCheckOut,
        bookingsList
      );
      setAvailabilityResults(list);
      setStayNights(nights);
      setIsAvailabilityOpen(true);
    } catch {
      setAvailabilityError('Unable to check live availability right now. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  // Instant update when modifying dates inside the modal
  const handleModalDateChange = (newIn: string, newOut: string) => {
    setCheckIn(newIn);
    setCheckOut(newOut);
    const { list, nights } = calculateAvailability(newIn, newOut, cachedBookings);
    setAvailabilityResults(list);
    setStayNights(nights);
  };

  // Select a category to book directly
  const handleSelectRoomToBook = (room: Room) => {
    setIsAvailabilityOpen(false);
    if (onBookRoom) {
      onBookRoom(room, { checkIn, checkOut });
    } else {
      onOpenInquiry({ checkIn, checkOut, guests: roomsCount * 2 });
    }
  };

  // Inquire about a category
  const handleInquireCategory = (room: Room) => {
    setIsAvailabilityOpen(false);
    onOpenInquiry({ checkIn, checkOut, guests: roomsCount * 2 });
  };

  if (!slides || slides.length === 0) return null;

  // Aggregate stats across homestay for the modal
  const totalHomestayRooms = availabilityResults.reduce(
    (acc, item) => acc + item.totalCapacity,
    0
  );
  const totalAvailableRooms = availabilityResults.reduce(
    (acc, item) => acc + item.availableCount,
    0
  );

  return (
    <>
      <div
        className="relative w-full min-h-[90vh] lg:min-h-[95vh] flex items-center justify-center overflow-hidden bg-forest-950"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Carousel Background Images */}
        {slides.map((slide, index) => (
          <div
            key={slide.id || index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === current
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-105 pointer-events-none'
            }`}
            style={{ transition: 'opacity 1s ease-in-out, transform 8s ease-out' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.image}
              alt={slide.title}
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/50" />
          </div>
        ))}

        {/* Hero Content Overlay */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-20 sm:pt-24 pb-72 sm:pb-44 lg:pb-36 text-white">
          {slides[current]?.badge && (
            <div className="inline-flex items-center space-x-2 bg-white/15 backdrop-blur-md px-4 py-1.5 rounded-full text-sand-200 text-xs sm:text-sm font-medium tracking-wide uppercase mb-6 border border-white/20 animate-fade-in">
              <Sparkles className="w-3.5 h-3.5 text-sand-300" />
              <span>{slides[current].badge}</span>
            </div>
          )}

          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 max-w-4xl mx-auto leading-tight drop-shadow-md">
            {slides[current]?.title}
          </h1>

          <p className="text-sand-100 text-base sm:text-xl max-w-2xl mx-auto font-light leading-relaxed mb-8 drop-shadow">
            {slides[current]?.subtitle}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
            <a
              href="#rooms"
              className="inline-flex items-center space-x-2 bg-sand-400 hover:bg-sand-500 text-forest-950 font-semibold px-6 py-3.5 rounded-xl shadow-lg transition-transform hover:-translate-y-0.5"
            >
              <span>Explore Rooms & Rates</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <button
              onClick={() => onOpenInquiry({ checkIn, checkOut, guests: roomsCount * 2 })}
              className="inline-flex items-center space-x-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-medium px-6 py-3.5 rounded-xl border border-white/30 transition-colors"
            >
              <span>Instant Inquiry</span>
            </button>
          </div>
        </div>

        {/* Floating Full-Size Check-in, Check-out & Number of Rooms Booking Bar */}
        <div className="absolute bottom-5 sm:bottom-8 left-3 right-3 sm:left-6 sm:right-6 lg:left-8 lg:right-8 z-20 max-w-4xl mx-auto">
          <form
            onSubmit={handleCheckAvailability}
            className="w-full bg-white/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl shadow-2xl border border-white/50 grid grid-cols-1 sm:grid-cols-4 gap-2.5 sm:gap-3 items-stretch text-forest-950"
          >
            {/* Check-in Container (Full size & styled) */}
            <div className="w-full bg-sand-50/90 hover:bg-sand-100/90 transition-colors border border-sand-200/90 rounded-xl px-3.5 py-2.5 flex flex-col justify-center focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-600/20">
              <label className="text-[11px] font-bold uppercase tracking-wider text-forest-800 flex items-center space-x-1.5 mb-1 select-none">
                <Calendar className="w-3.5 h-3.5 text-forest-600 shrink-0" />
                <span>Check-in</span>
              </label>
              <input
                type="date"
                required
                value={checkIn}
                min={getTodayStr()}
                onChange={(e) => handleCheckInChange(e.target.value)}
                className="w-full block min-w-full bg-transparent text-sm sm:text-base font-semibold text-forest-950 focus:outline-none cursor-pointer"
              />
            </div>

            {/* Check-out Container (Full size & styled) */}
            <div className="w-full bg-sand-50/90 hover:bg-sand-100/90 transition-colors border border-sand-200/90 rounded-xl px-3.5 py-2.5 flex flex-col justify-center focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-600/20">
              <label className="text-[11px] font-bold uppercase tracking-wider text-forest-800 flex items-center space-x-1.5 mb-1 select-none">
                <Calendar className="w-3.5 h-3.5 text-forest-600 shrink-0" />
                <span>Check-out</span>
              </label>
              <input
                type="date"
                required
                value={checkOut}
                min={checkIn || getTodayStr()}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full block min-w-full bg-transparent text-sm sm:text-base font-semibold text-forest-950 focus:outline-none cursor-pointer"
              />
            </div>

            {/* Number of Rooms Container (Full size & styled) */}
            <div className="w-full bg-sand-50/90 hover:bg-sand-100/90 transition-colors border border-sand-200/90 rounded-xl px-3.5 py-2.5 flex flex-col justify-center focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-600/20">
              <label className="text-[11px] font-bold uppercase tracking-wider text-forest-800 flex items-center space-x-1.5 mb-1 select-none">
                <Bed className="w-3.5 h-3.5 text-forest-600 shrink-0" />
                <span>Number of Rooms</span>
              </label>
              <select
                value={roomsCount}
                onChange={(e) => setRoomsCount(Number(e.target.value))}
                className="w-full block min-w-full bg-transparent text-sm sm:text-base font-semibold text-forest-950 focus:outline-none cursor-pointer"
              >
                <option value={1}>1 Room</option>
                <option value={2}>2 Rooms</option>
                <option value={3}>3 Rooms</option>
                <option value={4}>4 Rooms</option>
                <option value={5}>5 Rooms</option>
                <option value={6}>6 Rooms</option>
                <option value={7}>All 7 Rooms (Entire Homestay)</option>
              </select>
            </div>

            {/* Check Availability Action Button */}
            <div className="w-full flex items-center">
              <button
                type="submit"
                disabled={isChecking}
                className="w-full h-full min-h-[50px] sm:min-h-[56px] bg-forest-800 hover:bg-forest-900 active:scale-[0.99] text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 text-sm sm:text-base disabled:opacity-80 cursor-pointer"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-sand-300 shrink-0" />
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 text-sand-300 shrink-0" />
                    <span className="truncate">Check Availability</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {availabilityError && (
            <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2 shadow-sm">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{availabilityError}</span>
            </div>
          )}
        </div>

        {/* Manual Slide Navigation Controls */}
        <button
          onClick={prevSlide}
          aria-label="Previous Slide"
          className="hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full bg-black/30 hover:bg-black/60 text-white backdrop-blur-sm border border-white/20 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
          onClick={nextSlide}
          aria-label="Next Slide"
          className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full bg-black/30 hover:bg-black/60 text-white backdrop-blur-sm border border-white/20 transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Slide Indicators / Dots */}
        <div className="hidden sm:flex absolute bottom-28 left-0 right-0 z-20 items-center justify-center space-x-2.5">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrent(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`transition-all duration-300 rounded-full ${
                index === current
                  ? 'w-8 h-2.5 bg-sand-300 shadow-sm'
                  : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LIVE INVENTORY AVAILABILITY MODAL */}
      {/* ========================================================================= */}
      {isAvailabilityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-sand-200 overflow-hidden my-6 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-forest-900 text-white p-5 sm:p-6 relative shrink-0">
              <button
                onClick={() => setIsAvailabilityOpen(false)}
                aria-label="Close modal"
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-2 mb-1">
                <span className="inline-flex items-center space-x-1.5 bg-emerald-500/20 text-emerald-300 text-[10px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>LIVE INVENTORY CHECK</span>
                </span>
                <span className="text-xs text-sand-300 font-medium">
                  • Verified Real-Time
                </span>
              </div>

              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                Available Rooms & Rates
              </h3>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-sand-200">
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

            {/* Summary & Date Adjustment Bar */}
            <div className="bg-sand-50/90 border-b border-sand-200 px-5 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2">
                {totalAvailableRooms > 0 ? (
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
                {roomsCount > 1 && (
                  <span className="text-xs text-gray-600 hidden md:inline">
                    {totalAvailableRooms >= roomsCount
                      ? 'Party requirement met across estate categories.'
                      : 'Fewer rooms left than requested quantity.'}
                  </span>
                )}
              </div>

              {/* Quick Date Modifier */}
              <div className="flex items-center space-x-2 text-xs">
                <label className="text-gray-500 font-medium hidden sm:inline">
                  Change dates:
                </label>
                <input
                  type="date"
                  value={checkIn}
                  min={getTodayStr()}
                  onChange={(e) => {
                    const newIn = e.target.value;
                    let newOut = checkOut;
                    if (newOut <= newIn) {
                      const d = new Date(newIn);
                      d.setDate(d.getDate() + 1);
                      newOut = d.toISOString().split('T')[0];
                    }
                    handleModalDateChange(newIn, newOut);
                  }}
                  className="bg-white border border-sand-300 rounded-lg px-2 py-1 text-xs text-forest-900 focus:outline-none"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={checkOut}
                  min={checkIn}
                  onChange={(e) => handleModalDateChange(checkIn, e.target.value)}
                  className="bg-white border border-sand-300 rounded-lg px-2 py-1 text-xs text-forest-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Scrollable Room Categories List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
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
                        src={room.images?.[0] || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80'}
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

                      <p className="text-xs text-gray-500 line-clamp-1">
                        {room.tagline || room.description}
                      </p>

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

              {/* Full Estate Buyout Notice (When user requests 5-7 rooms or all rooms) */}
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
                      setIsAvailabilityOpen(false);
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
                    setIsAvailabilityOpen(false);
                    onOpenInquiry({ checkIn, checkOut, guests: roomsCount * 2 });
                  }}
                  className="text-xs text-forest-800 hover:text-forest-950 underline font-medium px-2 py-1 cursor-pointer"
                >
                  Need Custom Assistance?
                </button>
                <button
                  onClick={() => setIsAvailabilityOpen(false)}
                  className="bg-sand-200 hover:bg-sand-300 text-forest-900 text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
