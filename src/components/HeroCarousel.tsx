'use client';

import { useState, useEffect, useCallback } from 'react';
import { Room, HeroSlide } from '@/types';
import DateRangePicker from './DateRangePicker';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Bed,
  Sparkles,
  ArrowRight,
  Search,
} from 'lucide-react';

interface HeroCarouselProps {
  slides: HeroSlide[];
  rooms?: Room[];
  onOpenInquiry: (initialDates?: { checkIn: string; checkOut: string; guests: number }) => void;
  onBookRoom?: (room: Room, dates?: { checkIn: string; checkOut: string }) => void;
  onCheckAvailability?: (dates: { checkIn: string; checkOut: string; roomsCount: number }) => void;
}

export default function HeroCarousel({
  slides,
  onOpenInquiry,
  onCheckAvailability,
}: HeroCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

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

  // Quick search form state
  const [checkIn, setCheckIn] = useState(getTodayStr());
  const [checkOut, setCheckOut] = useState(getTomorrowStr());
  const [roomsCount, setRoomsCount] = useState(1);

  const nextSlide = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (isHovered || slides.length <= 1) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 6000);
    return () => clearInterval(timer);
  }, [isHovered, slides.length, nextSlide]);

  // Touch Swipe Handlers for Mobile Browsers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const distance = touchStartX - touchEndX;
    if (distance > 40) {
      nextSlide();
    } else if (distance < -40) {
      prevSlide();
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  // Handle Check Availability click
  const handleCheckAvailability = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const effectiveCheckIn = checkIn || getTodayStr();
    let effectiveCheckOut = checkOut;
    if (!effectiveCheckOut || effectiveCheckOut <= effectiveCheckIn) {
      effectiveCheckOut = getNextDayStr(effectiveCheckIn);
      setCheckOut(effectiveCheckOut);
    }
    if (!checkIn) setCheckIn(effectiveCheckIn);

    if (onCheckAvailability) {
      onCheckAvailability({
        checkIn: effectiveCheckIn,
        checkOut: effectiveCheckOut,
        roomsCount,
      });
    } else {
      onOpenInquiry({ checkIn: effectiveCheckIn, checkOut: effectiveCheckOut, guests: roomsCount * 2 });
    }
  };

  if (!slides || slides.length === 0) return null;

  return (
    <div
      className="relative w-full min-h-[84vh] sm:min-h-[90vh] lg:min-h-[95vh] flex items-center justify-center overflow-hidden bg-forest-950 select-none touch-pan-y"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Carousel Background Images with Soft, High-Clarity Gradient on Mobile */}
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
          {/* Mobile-optimized translucent gradient: reveals photo colors & mountain peaks */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/35 sm:from-black/85 sm:via-black/40 sm:to-black/50" />
        </div>
      ))}

      {/* Slide Counter Badge (Visible on all screens) */}
      <div className="absolute top-20 sm:top-24 right-3 sm:right-6 z-20 flex items-center space-x-1.5 bg-black/45 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 text-white text-[10px] sm:text-xs font-mono shadow-sm">
        <span className="font-bold text-sand-300">{current + 1}</span>
        <span className="text-white/40">/</span>
        <span className="text-white/80">{slides.length}</span>
      </div>

      {/* Hero Content Overlay: Streamlined to prioritize photography visibility */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-16 sm:pt-24 pb-48 sm:pb-36 lg:pb-32 text-white">
        {slides[current]?.badge && (
          <div className="inline-flex items-center space-x-1.5 sm:space-x-2 bg-black/35 backdrop-blur-md px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-sand-200 text-[10px] sm:text-xs font-medium tracking-wide uppercase mb-2.5 sm:mb-4 border border-white/20 animate-fade-in shadow-sm">
            <Sparkles className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-sand-300" />
            <span>{slides[current].badge}</span>
          </div>
        )}

        <h1 className="font-serif text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-2 sm:mb-4 max-w-4xl mx-auto leading-snug drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]">
          {slides[current]?.title}
        </h1>

        <p className="text-sand-100/95 text-xs sm:text-base lg:text-lg max-w-2xl mx-auto font-light leading-relaxed mb-3 sm:mb-6 line-clamp-2 sm:line-clamp-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          {slides[current]?.subtitle}
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-2.5 sm:gap-4 mb-2 sm:mb-6">
          <a
            href="#rooms"
            className="inline-flex items-center space-x-1.5 sm:space-x-2 bg-sand-400 hover:bg-sand-500 text-forest-950 font-semibold px-4 py-2 sm:px-6 sm:py-3.5 rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 text-xs sm:text-base"
          >
            <span>Explore Rooms</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => onOpenInquiry({ checkIn, checkOut, guests: roomsCount * 2 })}
            className="inline-flex items-center space-x-1.5 sm:space-x-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-medium px-4 py-2 sm:px-6 sm:py-3.5 rounded-xl border border-white/30 transition-colors cursor-pointer text-xs sm:text-base"
          >
            <span>Instant Inquiry</span>
          </button>
        </div>
      </div>

      {/* Floating Compact Check-in, Check-out & Number of Rooms Booking Bar */}
      <div className="absolute bottom-3 sm:bottom-6 left-3 right-3 sm:left-6 sm:right-6 lg:left-8 lg:right-8 z-20 max-w-4xl mx-auto">
        <form
          onSubmit={handleCheckAvailability}
          className="w-full bg-white/95 backdrop-blur-md p-2 sm:p-3.5 rounded-2xl shadow-2xl border border-white/50 grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-3 items-stretch text-forest-950"
        >
          {/* Check-in & Check-out Date Range Picker (2-column side-by-side on mobile) */}
          <div className="w-full sm:col-span-2">
            <DateRangePicker
              checkIn={checkIn}
              checkOut={checkOut}
              onChange={(range) => {
                setCheckIn(range.checkIn);
                setCheckOut(range.checkOut);
              }}
              popoverPosition="top"
              showPresets={true}
            />
          </div>

          {/* Rooms and Search Action in 2-column layout on mobile */}
          <div className="grid grid-cols-2 sm:contents gap-2">
            {/* Number of Rooms Container */}
            <div className="w-full bg-sand-50/90 hover:bg-sand-100/90 transition-colors border border-sand-200/90 rounded-xl px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 flex flex-col justify-center focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-600/20">
              <label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-forest-800 flex items-center space-x-1 sm:space-x-1.5 mb-0.5 sm:mb-1 select-none">
                <Bed className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-forest-600 shrink-0" />
                <span className="truncate">Rooms</span>
              </label>
              <select
                value={roomsCount}
                onChange={(e) => setRoomsCount(Number(e.target.value))}
                className="w-full block min-w-full bg-transparent text-xs sm:text-base font-semibold text-forest-950 focus:outline-none cursor-pointer"
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

            {/* Check Availability Action Button */}
            <div className="w-full flex items-center">
              <button
                type="submit"
                className="w-full h-full min-h-[44px] sm:min-h-[56px] bg-forest-800 hover:bg-forest-900 active:scale-[0.99] text-white font-semibold py-2 px-2.5 sm:py-3 sm:px-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 text-xs sm:text-base cursor-pointer"
              >
                <Search className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-sand-300 shrink-0" />
                <span className="truncate">Check Dates</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Slide Navigation Arrow Controls (Visible on mobile & desktop) */}
      <button
        onClick={prevSlide}
        aria-label="Previous Slide"
        className="flex absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-11 sm:h-11 items-center justify-center rounded-full bg-black/35 hover:bg-black/60 active:scale-95 text-white backdrop-blur-xs border border-white/20 transition-all"
      >
        <ChevronLeft className="w-4 h-4 sm:w-6 sm:h-6" />
      </button>

      <button
        onClick={nextSlide}
        aria-label="Next Slide"
        className="flex absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-11 sm:h-11 items-center justify-center rounded-full bg-black/35 hover:bg-black/60 active:scale-95 text-white backdrop-blur-xs border border-white/20 transition-all"
      >
        <ChevronRight className="w-4 h-4 sm:w-6 sm:h-6" />
      </button>

      {/* Slide Indicators / Dots (Positioned above the booking form, visible on all screens) */}
      <div className="flex absolute bottom-[126px] sm:bottom-28 left-0 right-0 z-20 items-center justify-center space-x-1.5 sm:space-x-2.5">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrent(index)}
            aria-label={`Go to slide ${index + 1}`}
            className={`transition-all duration-300 rounded-full cursor-pointer ${
              index === current
                ? 'w-6 sm:w-8 h-1.5 sm:h-2.5 bg-sand-300 shadow-md ring-1 ring-white/50'
                : 'w-1.5 sm:w-2.5 h-1.5 sm:h-2.5 bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
