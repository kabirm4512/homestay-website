'use client';

import { useState, useEffect, useCallback } from 'react';
import { HeroSlide } from '@/types';
import { ChevronLeft, ChevronRight, Calendar, Users, Sparkles, ArrowRight } from 'lucide-react';

interface HeroCarouselProps {
  slides: HeroSlide[];
  onOpenInquiry: (initialDates?: { checkIn: string; checkOut: string; guests: number }) => void;
}

export default function HeroCarousel({ slides, onOpenInquiry }: HeroCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Quick search form state
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);

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

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenInquiry({ checkIn, checkOut, guests });
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
            index === current ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
          }`}
          style={{ transition: 'opacity 1s ease-in-out, transform 8s ease-out' }}
        >
          {/* Background image with overlay gradient */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.image}
            alt={slide.title}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/50" />
        </div>
      ))}

      {/* Hero Content Overlay */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-24 pb-36 text-white">
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
        <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
          <a
            href="#rooms"
            className="inline-flex items-center space-x-2 bg-sand-400 hover:bg-sand-500 text-forest-950 font-semibold px-6 py-3.5 rounded-xl shadow-lg transition-transform hover:-translate-y-0.5"
          >
            <span>Explore Rooms & Rates</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          <button
            onClick={() => onOpenInquiry()}
            className="inline-flex items-center space-x-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-medium px-6 py-3.5 rounded-xl border border-white/30 transition-colors"
          >
            <span>Instant Inquiry</span>
          </button>
        </div>
      </div>

      {/* Floating Check-in & Search Booking Bar */}
      <div className="absolute bottom-6 sm:bottom-10 left-4 right-4 z-20 max-w-4xl mx-auto">
        <form
          onSubmit={handleQuickSearch}
          className="bg-white/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl shadow-2xl border border-white/40 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center text-forest-950"
        >
          <div className="flex flex-col px-3 py-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-forest-700 flex items-center space-x-1 mb-1">
              <Calendar className="w-3.5 h-3.5 text-forest-600" />
              <span>Check-in</span>
            </label>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="bg-transparent text-sm font-medium text-forest-950 focus:outline-none"
            />
          </div>

          <div className="flex flex-col px-3 py-1 sm:border-l border-sand-200">
            <label className="text-xs font-semibold uppercase tracking-wider text-forest-700 flex items-center space-x-1 mb-1">
              <Calendar className="w-3.5 h-3.5 text-forest-600" />
              <span>Check-out</span>
            </label>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="bg-transparent text-sm font-medium text-forest-950 focus:outline-none"
            />
          </div>

          <div className="flex flex-col px-3 py-1 sm:border-l border-sand-200">
            <label className="text-xs font-semibold uppercase tracking-wider text-forest-700 flex items-center space-x-1 mb-1">
              <Users className="w-3.5 h-3.5 text-forest-600" />
              <span>Guests</span>
            </label>
            <select
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className="bg-transparent text-sm font-medium text-forest-950 focus:outline-none cursor-pointer"
            >
              <option value={1}>1 Guest</option>
              <option value={2}>2 Guests</option>
              <option value={3}>3 Guests</option>
              <option value={4}>4 Guests</option>
              <option value={6}>5+ Guests (Full Villa)</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              className="w-full bg-forest-800 hover:bg-forest-900 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition-colors flex items-center justify-center space-x-2 text-sm"
            >
              <span>Check Rates</span>
              <ArrowRight className="w-4 h-4 text-sand-300" />
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
      <div className="absolute bottom-28 sm:bottom-28 left-0 right-0 z-20 flex items-center justify-center space-x-2.5">
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
