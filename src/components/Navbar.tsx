'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Trees,
  Phone,
  Calendar,
  Menu,
  X,
  Bed,
  Compass,
  Sparkles,
  Star,
  MapPin,
  ChevronRight,
  MessageCircle,
  Coffee,
} from 'lucide-react';
import PWAInstaller from '@/components/pwa/PWAInstaller';

interface NavbarProps {
  homestayName?: string;
  phone?: string;
  onOpenInquiry: () => void;
  onCheckAvailability?: () => void;
}

export default function Navbar({
  homestayName = 'Savera Homestay',
  phone = '+91 81012 98882',
  onOpenInquiry,
  onCheckAvailability,
}: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  // Handle ESC key to close mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const handleBookingAction = () => {
    setMobileMenuOpen(false);
    if (onCheckAvailability) {
      onCheckAvailability();
    } else {
      onOpenInquiry();
    }
  };

  const cleanPhone = phone.replace(/\s+/g, '');

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'bg-[#FAF8F5]/95 backdrop-blur-xl shadow-xs py-3 border-b border-sand-200/80 text-[#142820]'
            : 'bg-gradient-to-b from-[#142820]/90 via-[#142820]/40 to-transparent py-4 sm:py-5 text-white'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                scrolled
                  ? 'bg-primary-900 text-white shadow-md shadow-primary-900/15'
                  : 'bg-white/20 text-white backdrop-blur-md group-hover:bg-white/30 border border-white/20'
              }`}
            >
              <Trees className="w-5 h-5 text-brass-400" />
            </div>
            <div>
              <span
                className={`font-serif font-bold text-lg sm:text-xl tracking-tight block ${
                  scrolled ? 'text-[#142820]' : 'text-white drop-shadow-sm'
                }`}
              >
                {homestayName}
              </span>
              <span
                className={`text-[10px] sm:text-[11px] uppercase tracking-widest block font-medium ${
                  scrolled ? 'text-primary-700' : 'text-brass-300 drop-shadow-sm'
                }`}
              >
                Boutique Mountain Retreat · Darjeeling
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-6 lg:space-x-8 font-sans">
            <a
              href="#about"
              className={`text-xs sm:text-sm font-medium tracking-wide transition-colors ${
                scrolled ? 'text-gray-700 hover:text-primary-800' : 'text-white/90 hover:text-white'
              }`}
            >
              The Experience
            </a>
            <a
              href="#rooms"
              className={`text-xs sm:text-sm font-medium tracking-wide transition-colors ${
                scrolled ? 'text-gray-700 hover:text-primary-800' : 'text-white/90 hover:text-white'
              }`}
            >
              Suites &amp; Tariffs
            </a>
            <a
              href="#travel-rentals"
              className={`text-xs sm:text-sm font-medium tracking-wide transition-colors ${
                scrolled ? 'text-gray-700 hover:text-primary-800' : 'text-white/90 hover:text-white'
              }`}
            >
              Mountain Mobility
            </a>
            <a
              href="#reviews"
              className={`text-xs sm:text-sm font-medium tracking-wide transition-colors ${
                scrolled ? 'text-gray-700 hover:text-primary-800' : 'text-white/90 hover:text-white'
              }`}
            >
              Guest Reviews
            </a>
            <a
              href="#location"
              className={`text-xs sm:text-sm font-medium tracking-wide transition-colors ${
                scrolled ? 'text-gray-700 hover:text-primary-800' : 'text-white/90 hover:text-white'
              }`}
            >
              Location
            </a>
          </nav>

          {/* Right CTA / Install App & Booking Button (Desktop) */}
          <div className="hidden lg:flex items-center space-x-3">
            <PWAInstaller variant="button" />
            <button
              onClick={handleBookingAction}
              className="flex items-center space-x-2 bg-gradient-to-r from-[#C85A32] to-[#B64B25] hover:from-[#B64B25] hover:to-[#973B1C] text-white font-medium text-xs sm:text-sm px-5 py-2.5 rounded-full shadow-[0_4px_14px_rgba(200,90,50,0.3)] transition-all hover:scale-102 active:scale-98 cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-white" />
              <span>Check Availability</span>
            </button>
          </div>

          {/* Mobile Right Bar: Book Button + Hamburger Toggle */}
          <div className="flex md:hidden items-center space-x-2">
            <button
              onClick={handleBookingAction}
              className="text-xs bg-gradient-to-r from-[#C85A32] to-[#B64B25] active:scale-95 text-white font-medium px-3.5 py-1.5 rounded-full shadow-md cursor-pointer flex items-center space-x-1"
            >
              <Calendar className="w-3.5 h-3.5 text-white" />
              <span>Book</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                scrolled
                  ? 'text-[#142820] hover:bg-sand-100'
                  : 'text-white bg-black/40 backdrop-blur-md hover:bg-black/60 border border-white/20'
              }`}
              aria-label="Open mobile navigation menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* FULL-SCREEN LUXURY MOBILE NAVIGATION DRAWER */}
      {/* ========================================================================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-[#142820] text-white flex flex-col animate-fade-in overflow-hidden">
          {/* Drawer Top Bar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#142820]/95 backdrop-blur-md shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-primary-800 border border-primary-700 flex items-center justify-center shadow-md">
                <Trees className="w-5 h-5 text-brass-400" />
              </div>
              <div>
                <span
                  className="font-serif font-bold text-lg tracking-tight block text-white"
                >
                  {homestayName}
                </span>
                <span className="text-[10px] uppercase tracking-widest block font-medium text-brass-300">
                  Boutique Mountain Retreat · Darjeeling
                </span>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all cursor-pointer border border-white/10"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-gray-200" />
            </button>
          </div>

          {/* Scrollable Menu Items */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-sand-300/70 font-semibold px-2">
              Guest Directory & Services
            </div>

            <nav className="space-y-2">
              {/* 1. The Experience & Story */}
              <a
                href="#about"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] transition-all group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-primary-950/70 flex items-center justify-center text-brass-400 border border-primary-800/60 shrink-0 shadow-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-serif font-bold text-base text-white group-hover:text-brass-300 transition-colors">
                      The Experience & Story
                    </div>
                    <p className="text-xs text-sand-200/80 font-light mt-0.5 truncate">
                      Pine forest walks, bonfire evenings & local Himalayan hospitality
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </a>

              {/* 2. Rooms & Tariffs */}
              <a
                href="#rooms"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] active:bg-white/[0.12] border border-white/[0.08] transition-all group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-primary-950/70 flex items-center justify-center text-brass-400 border border-primary-800/60 shrink-0 shadow-sm">
                    <Bed className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-serif font-bold text-base text-white group-hover:text-brass-300 transition-colors flex items-center space-x-2">
                      <span className="truncate">Suites & Tariffs</span>
                      <span className="text-[10px] font-sans font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center space-x-1 shrink-0">
                        <Coffee className="w-2.5 h-2.5 text-emerald-400" />
                        <span>Breakfast Included</span>
                      </span>
                    </div>
                    <p className="text-xs text-sand-200/80 font-light mt-0.5 truncate">
                      Heritage cedar rooms, private balconies & mountain valley views
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </a>

              {/* 3. Travel, Transfers & Scooty Rentals */}
              <a
                href="#travel-rentals"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] active:bg-white/[0.12] border border-white/[0.08] transition-all group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-primary-950/70 flex items-center justify-center text-brass-400 border border-primary-800/60 shrink-0 shadow-sm">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-serif font-bold text-base text-white group-hover:text-brass-300 transition-colors flex items-center space-x-2">
                      <span className="truncate">Mountain Mobility</span>
                      <span className="text-[10px] font-sans font-medium bg-primary-900 text-brass-300 border border-primary-700 px-2 py-0.5 rounded-full shrink-0">
                        Cabs & Bikes
                      </span>
                    </div>
                    <p className="text-xs text-sand-200/80 font-light mt-0.5 truncate">
                      Bagdogra/NJP cabs, Mirik tours & Royal Enfield / Scooty rentals
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </a>

              {/* 6. Google Guest Reviews */}
              <a
                href="#reviews"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] transition-all group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-primary-950/70 flex items-center justify-center text-brass-400 border border-primary-800/60 shrink-0 shadow-sm">
                    <Star className="w-5 h-5 text-brass-400 fill-brass-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-serif font-bold text-base text-white group-hover:text-brass-300 transition-colors flex items-center space-x-2">
                      <span className="truncate">Guest Reviews</span>
                      <span className="text-[10px] font-sans font-medium bg-brass-500/20 text-brass-300 border border-brass-500/40 px-2 py-0.5 rounded-full shrink-0">
                        ★ 4.9 Rating
                      </span>
                    </div>
                    <p className="text-xs text-sand-200/80 font-light mt-0.5 truncate">
                      100% verified traveler ratings & reviews
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </a>

              {/* 7. Location & Getting Here */}
              <a
                href="#location"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] transition-all group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-primary-950/70 flex items-center justify-center text-brass-400 border border-primary-800/60 shrink-0 shadow-sm">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-serif font-bold text-base text-white group-hover:text-brass-300 transition-colors">
                      Location & Route Guide
                    </div>
                    <p className="text-xs text-sand-200/80 font-light mt-0.5 truncate">
                      Darjeeling hills directions, altitude & weather tips
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </a>
            </nav>
          </div>

          {/* Bottom Dock Action Area */}
          <div className="p-4 sm:p-5 border-t border-white/10 bg-[#142820]/95 backdrop-blur-md space-y-2.5 shrink-0">
            {/* Primary Direct Booking CTA in Terracotta */}
            <button
              onClick={handleBookingAction}
              className="w-full bg-gradient-to-r from-[#C85A32] to-[#B64B25] hover:from-[#B64B25] hover:to-[#973B1C] active:scale-98 text-white py-3.5 px-4 rounded-full font-medium text-sm shadow-[0_4px_14px_rgba(200,90,50,0.35)] flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-white" />
              <span>Check Availability & Book</span>
            </button>

            {/* Quick Contact Buttons: WhatsApp & Phone */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href="https://wa.me/918101298882?text=Hello%20Savera%20Homestay!%20I%20would%20like%20to%20inquire%20about%20booking%20a%20stay."
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#25D366] hover:bg-[#20bd5a] active:scale-98 text-white py-2.5 px-3 rounded-full font-medium text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all"
              >
                <MessageCircle className="w-4 h-4 fill-white shrink-0" />
                <span>WhatsApp</span>
              </a>

              <a
                href={`tel:${cleanPhone}`}
                className="bg-white/10 hover:bg-white/20 active:scale-98 border border-white/20 text-white py-2.5 px-3 rounded-full font-medium text-xs flex items-center justify-center space-x-1.5 transition-all"
              >
                <Phone className="w-4 h-4 text-brass-300 shrink-0" />
                <span className="truncate">Call Host</span>
              </a>
            </div>

            {/* Optional PWA Install Banner */}
            <div className="pt-1 flex justify-center">
              <PWAInstaller variant="banner" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
