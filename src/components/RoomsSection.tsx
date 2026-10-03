'use client';

import { useState, useEffect, useMemo } from 'react';
import { Room } from '@/types';
import {
  calculateDynamicTariff,
  DynamicTariffResult,
  addCalendarDays,
  BASE_OCCUPANCY_ADULTS,
  calendarDayOfWeek,
  resolveSeasonForNight,
  todayInIST,
  tomorrowInIST,
} from '@/lib/tariff-calculator';
import { useLiveTariffs } from '@/lib/live-tariffs';
import DateRangePicker, { addDays, formatHumanDate, calculateNights } from './DateRangePicker';
import {
  Users,
  Bed,
  Maximize2,
  Check,
  ArrowRight,
  MessageSquare,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Utensils,
  Calendar,
  CalendarDays,
  ShieldCheck,
  Flame,
  Info,
} from 'lucide-react';

interface RoomsSectionProps {
  rooms: Room[];
  onBookRoom: (
    room: Room,
    dates?: { checkIn: string; checkOut: string },
    mealPlan?: 'EP' | 'CP' | 'MAP' | 'AP'
  ) => void;
  onEnquireRoom: (room: Room, dates?: { checkIn: string; checkOut: string }) => void;
  initialDates?: { checkIn: string; checkOut: string };
  onDatesChange?: (dates: { checkIn: string; checkOut: string }) => void;
}

export default function RoomsSection({
  rooms,
  onBookRoom,
  onEnquireRoom,
  initialDates,
  onDatesChange,
}: RoomsSectionProps) {
  const getTodayStr = () => todayInIST();
  const getTomorrowStr = () => tomorrowInIST();

  // Travel Stay Dates state
  const [checkIn, setCheckIn] = useState<string>(initialDates?.checkIn || getTodayStr());
  const [checkOut, setCheckOut] = useState<string>(() => {
    const defaultIn = initialDates?.checkIn || getTodayStr();
    if (initialDates?.checkOut && initialDates.checkOut > defaultIn) {
      return initialDates.checkOut;
    }
    return getTomorrowStr();
  });

  // Store current image index per room
  const [activeImageIndices, setActiveImageIndices] = useState<Record<string, number>>({});
  // Store selected meal plan per room ('CP' by default)
  const [selectedPlans, setSelectedPlans] = useState<Record<string, 'EP' | 'CP' | 'MAP' | 'AP'>>({});
  // Store state for expanding detailed tariff view per room
  const [expandedTariffs, setExpandedTariffs] = useState<Record<string, boolean>>({});
  // Live tariffs & seasonal dates from the backend (no seed fallback: while loading or on
  // failure, cards show "price on request" instead of a possibly stale number)
  const {
    status: tariffStatus,
    tariffs: liveTariffs,
    seasonalDateRanges: liveSeasonalRanges,
    gstConfig,
  } = useLiveTariffs();
  const gstNote = gstConfig.tariffsIncludeGst ? 'incl. GST' : '+ GST';

  // Sync with external initial dates if changed
  useEffect(() => {
    if (initialDates?.checkIn) {
      setCheckIn(initialDates.checkIn);
      const safeOut = (!initialDates.checkOut || initialDates.checkOut <= initialDates.checkIn)
        ? addDays(initialDates.checkIn, 1)
        : initialDates.checkOut;
      setCheckOut(safeOut);
    }
  }, [initialDates?.checkIn, initialDates?.checkOut]);

  // If the page stays open past midnight (IST), move a past check-in date to today so the
  // card always shows a bookable night's price.
  useEffect(() => {
    const roll = () => {
      const today = getTodayStr();
      setCheckIn((prev) => {
        if (prev >= today) return prev;
        setCheckOut((out) => (out > today ? out : addDays(today, 1)));
        return today;
      });
    };
    const id = setInterval(roll, 60_000);
    document.addEventListener('visibilitychange', roll);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', roll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDatesChange = (range: { checkIn: string; checkOut: string; nights: number }) => {
    const safeIn = range.checkIn || getTodayStr();
    const safeOut = (!range.checkOut || range.checkOut <= safeIn) ? addDays(safeIn, 1) : range.checkOut;
    setCheckIn(safeIn);
    setCheckOut(safeOut);
    if (onDatesChange) {
      onDatesChange({ checkIn: safeIn, checkOut: safeOut });
    }
  };

  const stayNights = Math.max(1, calculateNights(checkIn, checkOut));

  // Determine active season badge based on selected dates
  const activeSeasonInfo = useMemo(() => {
    let hasPeak = false;
    let hasOffSeason = false;
    let matchedSeasonName = '';

    // Same per-night season resolution as the pricing engine (IST calendar dates)
    for (let i = 0; i < stayNights; i++) {
      const night = resolveSeasonForNight(addCalendarDays(checkIn, i), liveSeasonalRanges ?? []);
      if (night.seasonType === 'season') {
        hasPeak = true;
        matchedSeasonName = night.name;
      } else if (night.seasonType === 'off_season') {
        hasOffSeason = true;
        if (!hasPeak) matchedSeasonName = night.name;
      }
    }

    if (hasPeak) {
      return {
        type: 'season' as const,
        badge: '🔥 Peak Holiday Season Rate',
        label: matchedSeasonName || 'High Demand Holiday Season',
        colorClass: 'bg-amber-100 text-amber-900 border-amber-300',
      };
    }
    if (hasOffSeason) {
      return {
        type: 'off_season' as const,
        badge: '🌿 Green Season Special Tariff',
        label: matchedSeasonName || 'Monsoon / Value Season',
        colorClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      };
    }
    return {
      type: 'regular' as const,
      badge: '🌲 Standard Season Rate',
      label: 'Direct host rates with signature organic breakfast',
      colorClass: 'bg-[#142820]/10 text-[#142820] border-[#142820]/20',
    };
  }, [checkIn, stayNights, liveSeasonalRanges]);

  const nextImage = (roomId: string, total: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndices((prev) => ({
      ...prev,
      [roomId]: ((prev[roomId] || 0) + 1) % total,
    }));
  };

  const prevImage = (roomId: string, total: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndices((prev) => ({
      ...prev,
      [roomId]: ((prev[roomId] || 0) - 1 + total) % total,
    }));
  };

  return (
    <section id="rooms" className="py-20 sm:py-28 bg-[#FAF8F5] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[#142820] bg-[#142820]/5 border border-[#142820]/10 px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 mb-3 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#C85A32]" />
            <span>Handcrafted Accommodations</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#142820] font-serif tracking-tight leading-tight mb-4">
            Suites &amp; Mountain Residencies
          </h2>
          <p className="text-[#5C6D66] text-base sm:text-lg font-normal leading-relaxed">
            Each private sanctuary is crafted with Himalayan cedar, sweeping valley balconies, and warm bespoke comforts. Live tariffs recalculate dynamically as you choose your travel dates.
          </p>
          <div className="w-16 h-0.5 bg-[#C85A32] mx-auto rounded-full mt-6" />
        </div>

        {/* Live Stay Dates & Seasonal Tariff Selector Bar */}
        <div className="mb-14 max-w-4xl mx-auto bg-white rounded-3xl p-4 sm:p-6 shadow-[0_8px_30px_rgba(20,40,32,0.06)] border border-[#E5DEC9]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EBE5DA] mb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#C85A32] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>Live PMS Pricing by Date</span>
              </span>
              <h3 className="text-base sm:text-lg font-bold text-[#142820] font-serif">
                Select Stay Dates to View Live Rates
              </h3>
            </div>
            {/* Active Season Pill */}
            <div className={`self-start sm:self-center px-3 py-1 rounded-full text-xs font-bold border flex items-center space-x-1.5 ${activeSeasonInfo.colorClass}`}>
              <span>{activeSeasonInfo.badge}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="md:col-span-2">
              <DateRangePicker
                checkIn={checkIn}
                checkOut={checkOut}
                onChange={handleDatesChange}
                popoverPosition="bottom"
                showPresets={true}
              />
            </div>

            {/* Quick helper pills */}
            <div className="flex flex-col justify-center space-y-2 bg-[#FAF8F5] p-3 rounded-2xl border border-[#EBE5DA]">
              <div className="text-xs text-[#5C6D66] font-medium flex items-center justify-between">
                <span>Selected Stay:</span>
                <span className="font-bold text-[#142820] bg-white px-2.5 py-0.5 rounded-full border border-[#E5DEC9]">
                  {stayNights} {stayNights === 1 ? 'Night' : 'Nights'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleDatesChange({ checkIn: getTodayStr(), checkOut: addDays(getTodayStr(), 1), nights: 1 })}
                  className="text-[11px] font-semibold text-[#142820] bg-white hover:bg-[#F2ECE0] border border-[#E5DEC9] px-2.5 py-1 rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  Tonight (1 Nt)
                </button>
                <button
                  type="button"
                  onClick={() => handleDatesChange({ checkIn: getTodayStr(), checkOut: addDays(getTodayStr(), 2), nights: 2 })}
                  className="text-[11px] font-semibold text-[#142820] bg-white hover:bg-[#F2ECE0] border border-[#E5DEC9] px-2.5 py-1 rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  2 Nights
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // IST calendar maths (toISOString() picked Thursday→Saturday before 5:30am IST)
                    const today = getTodayStr();
                    const day = calendarDayOfWeek(today) ?? 0;
                    const daysUntilFri = (5 - day + 7) % 7 || 7;
                    const friStr = addCalendarDays(today, daysUntilFri);
                    const sunStr = addCalendarDays(friStr, 2);
                    handleDatesChange({ checkIn: friStr, checkOut: sunStr, nights: 2 });
                  }}
                  className="text-[11px] font-semibold text-[#C85A32] bg-[#C85A32]/10 hover:bg-[#C85A32]/20 border border-[#C85A32]/30 px-2.5 py-1 rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  This Weekend
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Room Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {rooms.map((room) => {
            const images = room.images && room.images.length > 0
              ? room.images
              : ['/images/hero/deluxe-bedroom-suite.jpg'];
            const currentImgIndex = activeImageIndices[room.id] || 0;

            // Compute dynamic live rates matching backend PMS for selected travel dates
            // Compute live rates with the canonical engine (same maths as the CRM and booking API)
            const priceFor = (plan: 'EP' | 'CP' | 'MAP' | 'AP'): DynamicTariffResult | null =>
              tariffStatus === 'ready'
                ? calculateDynamicTariff({
                    roomId: room.id,
                    checkIn,
                    checkOut,
                    mealPlan: plan,
                    tariffsMap: liveTariffs,
                    seasonalDateRanges: liveSeasonalRanges,
                  })
                : null;
            const dynamicResults: Record<'EP' | 'CP' | 'MAP' | 'AP', DynamicTariffResult | null> = {
              EP: priceFor('EP'),
              CP: priceFor('CP'),
              MAP: priceFor('MAP'),
              AP: priceFor('AP'),
            };
            const priceUnavailableLabel = tariffStatus === 'loading' ? 'Loading live rates…' : 'Price on request';

            const activePlan = selectedPlans[room.id] || 'CP';
            const activeResult = dynamicResults[activePlan];
            const currentRate = activeResult ? activeResult.avgRatePerNight : null;
            const totalStayPrice = activeResult ? activeResult.totalAmount : null;
            const isTariffOpen = !!expandedTariffs[room.id];

            return (
              <div
                key={room.id}
                className="bg-white rounded-3xl overflow-hidden border border-[#EBE5DA] shadow-[0_8px_30px_rgba(20,40,32,0.06)] hover:shadow-[0_22px_45px_rgba(20,40,32,0.12)] hover:-translate-y-1 transition-all duration-300 flex flex-col group"
              >
                {/* Image Gallery with Controls */}
                <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-[#ECE7DC]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={images[currentImgIndex]}
                    alt={room.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 filter brightness-[0.98] contrast-[1.02]"
                  />

                  {/* Room Type & Active Meal Plan Badge */}
                  <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1.5">
                    <span className="bg-[#142820]/85 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20 flex items-center space-x-1 shadow-sm">
                      <Sparkles className="w-3 h-3 text-[#C5A059]" />
                      <span>{room.room_type || 'Boutique Suite'}</span>
                    </span>
                    {activePlan === 'CP' && (
                      <span className="bg-[#142820]/90 backdrop-blur-md text-[#E8DCC4] text-xs font-medium px-2.5 py-1 rounded-full border border-[#C5A059]/40 flex items-center space-x-1.5 shadow-sm">
                        <Coffee className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Farmhouse Breakfast Included</span>
                      </span>
                    )}
                    {activePlan === 'MAP' && (
                      <span className="bg-[#C85A32]/95 backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-full border border-white/30 flex items-center space-x-1.5 shadow-sm">
                        <Utensils className="w-3.5 h-3.5 text-white" />
                        <span>Breakfast + Mountain Dinner</span>
                      </span>
                    )}
                    {activePlan === 'AP' && (
                      <span className="bg-[#142820]/95 backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-full border border-white/30 flex items-center space-x-1.5 shadow-sm">
                        <Utensils className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>All Meals Included (Full Board)</span>
                      </span>
                    )}
                    {activePlan === 'EP' && (
                      <span className="bg-black/70 backdrop-blur-md text-gray-200 text-xs font-medium px-2.5 py-1 rounded-full border border-white/20 flex items-center space-x-1.5 shadow-sm">
                        <Bed className="w-3.5 h-3.5 text-gray-300" />
                        <span>Room Only (EP)</span>
                      </span>
                    )}
                  </div>

                  {/* Room Inventory & Numbers Badge */}
                  <div className="absolute top-4 right-4 z-10">
                    <span className="bg-black/60 backdrop-blur-md text-[#E8DCC4] text-xs font-medium px-3 py-1 rounded-full border border-white/15">
                      {room.id === 'room-cat-1' || room.name.includes('Mountain View with Balcony')
                        ? 'Rooms 101, 102, 103'
                        : room.id === 'room-cat-2' || room.name.includes('Forest View')
                        ? 'Room 104'
                        : 'Suites 201, 202, 203'}
                    </span>
                  </div>

                  {/* Image Navigation Arrows */}
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={(e) => prevImage(room.id, images.length, e)}
                        aria-label="Previous photo"
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#142820]/60 hover:bg-[#142820]/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => nextImage(room.id, images.length, e)}
                        aria-label="Next photo"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#142820]/60 hover:bg-[#142820]/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {/* Photo Dots */}
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center space-x-1.5 z-10">
                        {images.map((_, i) => (
                          <span
                            key={i}
                            className={`w-2 h-2 rounded-full transition-all ${
                              i === currentImgIndex ? 'bg-white scale-125' : 'bg-white/50'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Content Container */}
                <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Title & Tagline */}
                    <h3 className="text-xl sm:text-2xl font-bold text-[#142820] font-serif mb-1 group-hover:text-[#C85A32] transition-colors">
                      {room.name}
                    </h3>
                    {room.tagline && (
                      <p className="text-xs sm:text-sm text-[#5C6D66] font-medium mb-4">
                        {room.tagline}
                      </p>
                    )}

                    {/* Room Attributes */}
                    <div className="grid grid-cols-3 gap-2 py-3 mb-4 border-y border-[#EBE5DA] text-xs text-[#5C6D66]">
                      <div className="flex items-center space-x-1.5">
                        <Users className="w-4 h-4 text-[#142820] flex-shrink-0" />
                        <span>{room.capacity_adults} Adults {room.capacity_children > 0 && `+ ${room.capacity_children}`}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Bed className="w-4 h-4 text-[#142820] flex-shrink-0" />
                        <span className="truncate">{room.bed_type}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Maximize2 className="w-4 h-4 text-[#142820] flex-shrink-0" />
                        <span>{room.room_size_sqft} sq ft</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-[#4A5752] text-sm leading-relaxed mb-4 line-clamp-3">
                      {room.description}
                    </p>

                    {/* Amenities tags */}
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {room.amenities.slice(0, 4).map((amenity, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center space-x-1 text-xs bg-[#FAF8F5] text-[#142820] border border-[#E5DEC9] px-2.5 py-1 rounded-full font-medium"
                        >
                          <Check className="w-3 h-3 text-[#C85A32]" />
                          <span>{amenity}</span>
                        </span>
                      ))}
                      {room.amenities.length > 4 && (
                        <span className="text-xs text-[#5C6D66] bg-[#F2ECE0] px-2 py-1 rounded-full font-medium">
                          +{room.amenities.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pricing, Tariffs & Action Buttons */}
                  <div className="pt-4 border-t border-[#EBE5DA]">
                    {/* Interactive Meal Plan Selector Tabs */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#142820]">
                          Select Meal Plan
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedTariffs((prev) => ({ ...prev, [room.id]: !prev[room.id] }))}
                          className="text-[11px] font-semibold text-[#C85A32] hover:text-[#B34D28] underline cursor-pointer"
                        >
                          {isTariffOpen ? 'Hide plan comparison' : 'Compare all plans'}
                        </button>
                      </div>

                      {/* 4 Plan Chips */}
                      <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#FAF8F5] rounded-2xl border border-[#E8E2D5]">
                        {(['EP', 'CP', 'MAP', 'AP'] as const).map((plan) => {
                          const isSelected = activePlan === plan;
                          const planRate = dynamicResults[plan]?.avgRatePerNight ?? null;
                          return (
                            <button
                              key={plan}
                              type="button"
                              onClick={() => setSelectedPlans((prev) => ({ ...prev, [room.id]: plan }))}
                              className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#142820] text-white shadow-sm font-bold'
                                  : 'text-[#4B5E54] hover:bg-[#F2ECE0] font-medium'
                              }`}
                            >
                              <div className="text-xs leading-tight font-semibold">{plan}</div>
                              <div className={`text-[10px] leading-tight mt-0.5 ${isSelected ? 'text-[#C5A059]' : 'text-[#7B8B84]'}`}>
                                {planRate !== null ? `₹${planRate.toLocaleString('en-IN')}` : '—'}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Plan Detail Line */}
                      <div className="mt-2 text-xs text-[#142820] flex items-center justify-between bg-[#F5EFE6] px-3 py-1.5 rounded-xl border border-[#DFD7C7]">
                        <span className="font-medium">
                          {activePlan === 'EP' && 'EP: Room Only (Meals à la carte)'}
                          {activePlan === 'CP' && 'CP: Farmhouse Breakfast included'}
                          {activePlan === 'MAP' && 'MAP: Farmhouse Breakfast & Dinner included'}
                          {activePlan === 'AP' && 'AP: All Farm Meals included (Full Board)'}
                        </span>
                        <span className="text-[11px] text-[#2C6B4F] font-semibold">Direct Host Rate</span>
                      </div>

                      {/* Collapsible Tariff Comparison Table */}
                      {isTariffOpen && activeResult && totalStayPrice !== null && (
                        <div className="mt-2.5 p-3.5 bg-white border border-[#E8E2D5] rounded-2xl text-xs space-y-2 animate-fade-in shadow-xs">
                          <div className="flex items-center justify-between border-b border-[#EBE5DA] pb-1.5">
                            <span className="text-[11px] font-bold text-[#142820] uppercase tracking-wider">
                              Daily Rate Breakdown ({stayNights} {stayNights === 1 ? 'Night' : 'Nights'})
                            </span>
                            <span className="text-[10px] text-[#C85A32] font-semibold">{activePlan} Plan</span>
                          </div>
                          <div className="space-y-1">
                            {activeResult.breakdown.map((item, bIdx) => (
                              <div key={bIdx} className="flex justify-between items-center text-[#5C6D66]">
                                <span>{formatHumanDate(item.date, 'full')}:</span>
                                <span className="font-semibold text-[#142820]">
                                  ₹{item.amount.toLocaleString('en-IN')} ({item.rateName})
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="pt-2 border-t border-[#EBE5DA] flex justify-between font-bold text-[#142820]">
                            <span>Total for {stayNights} {stayNights === 1 ? 'Night' : 'Nights'}:</span>
                            <span className="text-[#C85A32] text-sm">₹{totalStayPrice.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Prominent Price & Stay Total Display */}
                    <div className="flex items-baseline justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs uppercase tracking-wider text-[#7B8B84] block font-medium">
                            {activePlan} Nightly Rate
                          </span>
                          {activeSeasonInfo.type === 'season' && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md">
                              Peak Rate
                            </span>
                          )}
                          {activeSeasonInfo.type === 'off_season' && (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">
                              Special Value
                            </span>
                          )}
                        </div>
                        {currentRate !== null ? (
                          <div className="flex items-baseline space-x-1">
                            <span className="text-3xl font-bold text-[#142820] font-serif">
                              ₹{currentRate.toLocaleString('en-IN')}
                            </span>
                            <span className="text-xs text-[#7B8B84]">/ night {gstNote}</span>
                          </div>
                        ) : (
                          <div className="flex items-baseline space-x-1">
                            <span className="text-xl font-bold text-[#142820] font-serif">{priceUnavailableLabel}</span>
                          </div>
                        )}
                        {stayNights > 1 && totalStayPrice !== null && (
                          <span className="text-xs font-semibold text-[#C85A32] block mt-0.5">
                            Total: ₹{totalStayPrice.toLocaleString('en-IN')} {gstNote} for {stayNights} nights
                          </span>
                        )}
                        <span className="text-[11px] text-[#5C6D66] block mt-0.5 font-medium">
                          Base {BASE_OCCUPANCY_ADULTS} Adults {activeResult?.extraAdultRate ? `· Extra Adult: +₹${activeResult.extraAdultRate.toLocaleString('en-IN')}/night` : ''}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#7B8B84] block font-medium uppercase">Dates</span>
                        <span className="text-xs font-semibold text-[#142820] block">
                          {formatHumanDate(checkIn, 'short')} → {formatHumanDate(checkOut, 'short')}
                        </span>
                        <span className="text-[10px] text-[#5C6D66] block">
                          ({stayNights} {stayNights === 1 ? 'night' : 'nights'})
                        </span>
                      </div>
                    </div>

                    {/* Dual Action Buttons: Book and Enquire */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => onBookRoom(room, { checkIn, checkOut }, activePlan)}
                        className="w-full bg-[#C85A32] hover:bg-[#B34D28] text-white text-sm font-semibold py-3 px-3 rounded-2xl shadow-[0_4px_14px_rgba(200,90,50,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <span>Reserve Suite</span>
                        <ArrowRight className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={() => onEnquireRoom(room, { checkIn, checkOut })}
                        className="w-full bg-[#FAF8F5] hover:bg-[#F2ECE0] text-[#142820] border border-[#D5CDBD] text-sm font-semibold py-3 px-3 rounded-2xl transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4 text-[#142820]" />
                        <span>Quick Inquiry</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

