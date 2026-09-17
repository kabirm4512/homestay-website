'use client';

import { useState, useEffect, useCallback } from 'react';
import { Room, HeroSlide } from '@/types';
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
      setCheckOut(getNextDayStr(newCheckIn));
    }
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
            className="inline-flex items-center space-x-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-medium px-6 py-3.5 rounded-xl border border-white/30 transition-colors cursor-pointer"
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
              min={checkIn ? getNextDayStr(checkIn) : getTomorrowStr()}
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
              className="w-full h-full min-h-[50px] sm:min-h-[56px] bg-forest-800 hover:bg-forest-900 active:scale-[0.99] text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 text-sm sm:text-base cursor-pointer"
            >
              <Search className="w-4 h-4 text-sand-300 shrink-0" />
              <span className="truncate">Check Availability</span>
            </button>
          </div>
        </form>
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
  );
}
