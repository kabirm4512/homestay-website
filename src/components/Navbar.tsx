'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Trees,
  Phone,
  Calendar,
  Menu,
  X,
  ShieldCheck,
  Bed,
  UtensilsCrossed,
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
            ? 'bg-white/95 backdrop-blur-md shadow-sm py-3 border-b border-sand-200 text-forest-950'
            : 'bg-gradient-to-b from-black/75 via-black/40 to-transparent py-4 sm:py-5 text-white'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                scrolled
                  ? 'bg-forest-800 text-white shadow-md'
                  : 'bg-white/20 text-white backdrop-blur-md group-hover:bg-white/30'
              }`}
            >
              <Trees className="w-5 h-5 text-sand-200" />
            </div>
            <div>
              <span
                className={`font-serif text-lg sm:text-xl font-bold tracking-tight block ${
                  scrolled ? 'text-forest-950' : 'text-white drop-shadow-sm'
                }`}
              >
                {homestayName}
              </span>
              <span
                className={`text-[11px] sm:text-xs uppercase tracking-widest block font-medium ${
                  scrolled ? 'text-forest-600' : 'text-sand-200 drop-shadow-sm'
                }`}
              >
                Boutique Mountain Stay
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-7 lg:space-x-8">
            <a
              href="#rooms"
              className={`text-sm font-medium transition-colors hover:text-amber-400 ${
                scrolled ? 'text-forest-900 hover:text-forest-700' : 'text-white'
              }`}
            >
              Rooms & Rates
            </a>
            <Link
              href="/concierge"
              className={`text-sm font-medium transition-colors hover:text-amber-400 flex items-center space-x-1.5 ${
                scrolled ? 'text-forest-900 hover:text-forest-700' : 'text-white'
              }`}
            >
              <span>Dine-In Menu</span>
              <span className="text-[10px] bg-amber-400 text-forest-950 font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                79 Dishes
              </span>
            </Link>
            <a
              href="#travel-rentals"
              className={`text-sm font-medium transition-colors hover:text-amber-400 ${
                scrolled ? 'text-forest-900 hover:text-forest-700' : 'text-white'
              }`}
            >
              Travel & Rentals
            </a>
            <a
              href="#about"
              className={`text-sm font-medium transition-colors hover:text-amber-400 ${
                scrolled ? 'text-forest-900 hover:text-forest-700' : 'text-white'
              }`}
            >
              The Experience
            </a>
            <a
              href="#reviews"
              className={`text-sm font-medium transition-colors hover:text-amber-400 ${
                scrolled ? 'text-forest-900 hover:text-forest-700' : 'text-white'
              }`}
            >
              Reviews
            </a>
            <a
              href="#location"
              className={`text-sm font-medium transition-colors hover:text-amber-400 ${
                scrolled ? 'text-forest-900 hover:text-forest-700' : 'text-white'
              }`}
            >
              Location
            </a>
            <Link
              href="/admin"
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors flex items-center space-x-1 ${
                scrolled
                  ? 'border-forest-200 bg-forest-50/50 text-forest-800 hover:bg-forest-100 hover:border-forest-300'
                  : 'border-white/30 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20'
              }`}
              title="Admin & Staff Portal"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Staff Login</span>
            </Link>
          </nav>

          {/* Right CTA / Phone & Booking Button (Desktop) */}
          <div className="hidden lg:flex items-center space-x-3">
            <PWAInstaller variant="button" />
            <a
              href={`tel:${cleanPhone}`}
              className={`flex items-center space-x-1.5 text-xs font-medium px-3.5 py-2 rounded-full transition-colors ${
                scrolled
                  ? 'text-forest-900 bg-sand-100 hover:bg-sand-200'
                  : 'text-white bg-white/15 backdrop-blur-md hover:bg-white/25 border border-white/20'
              }`}
            >
              <Phone className="w-3.5 h-3.5 text-amber-400" />
              <span>{phone}</span>
            </a>
            <button
              onClick={handleBookingAction}
              className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-forest-950 font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition-all hover:scale-102 active:scale-98 cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-forest-950" />
              <span>Book Your Stay</span>
            </button>
          </div>

          {/* Mobile Right Bar: Book Button + Hamburger Toggle */}
          <div className="flex md:hidden items-center space-x-2">
            <button
              onClick={handleBookingAction}
              className="text-xs bg-forest-850 hover:bg-forest-900 active:scale-95 text-white font-bold px-3 py-1.5 rounded-xl shadow-sm border border-forest-700 cursor-pointer flex items-center space-x-1"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-300" />
              <span>Book</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                scrolled
                  ? 'text-forest-950 hover:bg-sand-100'
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
        <div className="fixed inset-0 z-50 bg-forest-950 text-white flex flex-col animate-fade-in overflow-hidden">
          {/* Drawer Top Bar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-forest-800/80 bg-forest-900/95 backdrop-blur-md shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-forest-800 border border-forest-700 flex items-center justify-center shadow-md">
                <Trees className="w-5 h-5 text-sand-200" />
              </div>
              <div>
                <span className="font-serif text-lg font-bold tracking-tight block text-white">
                  {homestayName}
                </span>
                <span className="text-[10px] uppercase tracking-widest block font-semibold text-amber-400">
                  Boutique Mountain Stay
                </span>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all cursor-pointer border border-white/10"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-sand-200" />
            </button>
          </div>

          {/* Scrollable Menu Items */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-sand-400 font-bold px-2">
              Guest Directory & Experiences
            </div>

            <nav className="space-y-2">
              {/* 1. Rooms & Tariffs */}
              <a
                href="#rooms"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] active:bg-white/[0.12] border border-white/[0.08] transition-all group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-forest-900 flex items-center justify-center text-amber-300 border border-forest-700/80 shrink-0 shadow-sm">
                    <Bed className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-serif font-bold text-base text-white group-hover:text-amber-300 transition-colors flex items-center space-x-2">
                      <span className="truncate">Rooms & Tariffs</span>
                      <span className="text-[10px] font-sans font-bold bg-emerald-900/90 text-emerald-200 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center space-x-1 shrink-0">
                        <Coffee className="w-2.5 h-2.5 text-emerald-400" />
                        <span>Breakfast Included</span>
                      </span>
                    </div>
                    <p className="text-xs text-sand-300/80 font-light mt-0.5 truncate">
                      Heritage rooms, private balconies & mountain valley views
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-sand-400/60 group-hover:text-sand-200 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </a>

              {/* 2. In-Room Dine-In Menu (79 Items) */}
              <Link
                href="/concierge"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/[0.09] hover:bg-amber-500/[0.15] active:bg-amber-500/[0.2] border border-amber-500/30 transition-all group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-300 border border-amber-500/40 shrink-0 shadow-sm">
                    <UtensilsCrossed className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-serif font-bold text-base text-white group-hover:text-amber-200 transition-colors flex items-center space-x-2">
                      <span className="truncate">In-Room Dining Menu</span>
                      <span className="text-[10px] font-sans font-bold bg-amber-400 text-forest-950 px-2 py-0.5 rounded-full shrink-0 shadow-xs">
                        79 Items
                      </span>
                    </div>
                    <p className="text-xs text-sand-300/80 font-light mt-0.5 truncate">
                      Darjeeling first flush teas, breakfast, thalis & kitchen portal
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-amber-400/70 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </Link>

              {/* 3. Travel, Transfers & Scooty Rentals */}
              <a
                href="#travel-rentals"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] active:bg-white/[0.12] border border-white/[0.08] transition-all group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-forest-900 flex items-center justify-center text-amber-300 border border-forest-700/80 shrink-0 shadow-sm">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-serif font-bold text-base text-white group-hover:text-amber-300 transition-colors flex items-center space-x-2">
                      <span className="truncate">Travel & Mountain Mobility</span>
                      <span className="text-[10px] font-sans font-bold bg-forest-700 text-sand-200 border border-forest-600 px-2 py-0.5 rounded-full shrink-0">
                        Cabs & Bikes
                      </span>
                    </div>
                    <p className="text-xs text-sand-300/80 font-light mt-0.5 truncate">
                      Bagdogra/NJP cabs, Mirik tours & Royal Enfield / Scooty rentals
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-sand-400/60 group-hover:text-sand-200 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </a>

              {/* 4. The Experience & Story */}
              <a
                href="#about"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] active:bg-white/[0.12] border border-white/[0.08] transition-all group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-forest-900 flex items-center justify-center text-amber-300 border border-forest-700/80 shrink-0 shadow-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-serif font-bold text-base text-white group-hover:text-amber-300 transition-colors">
                      The Experience & Story
                    </div>
                    <p className="text-xs text-sand-300/80 font-light mt-0.5 truncate">
                      Pine forest walks, bonfire evenings & local Himalayan hospitality
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-sand-400/60 group-hover:text-sand-200 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </a>

              {/* 5. Google Guest Reviews */}
              <a
                href="#reviews"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] active:bg-white/[0.12] border border-white/[0.08] transition-all group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-forest-900 flex items-center justify-center text-amber-300 border border-forest-700/80 shrink-0 shadow-sm">
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-serif font-bold text-base text-white group-hover:text-amber-300 transition-colors flex items-center space-x-2">
                      <span className="truncate">Guest Reviews</span>
                      <span className="text-[10px] font-sans font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full shrink-0">
                        ★ 4.9 Rating
                      </span>
                    </div>
                    <p className="text-xs text-sand-300/80 font-light mt-0.5 truncate">
                      100% verified traveler ratings & handwritten notes
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-sand-400/60 group-hover:text-sand-200 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </a>

              {/* 6. Location & Getting Here */}
              <a
                href="#location"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] active:bg-white/[0.12] border border-white/[0.08] transition-all group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-forest-900 flex items-center justify-center text-amber-300 border border-forest-700/80 shrink-0 shadow-sm">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-serif font-bold text-base text-white group-hover:text-amber-300 transition-colors">
                      Location & Route Guide
                    </div>
                    <p className="text-xs text-sand-300/80 font-light mt-0.5 truncate">
                      Darjeeling hills directions, altitude & weather tips
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-sand-400/60 group-hover:text-sand-200 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </a>

              {/* 7. Staff & Admin Management Portal */}
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] transition-all group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-forest-900 flex items-center justify-center text-emerald-400 border border-forest-700/40 shrink-0 shadow-sm">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-serif font-bold text-sm text-sand-200 group-hover:text-white transition-colors flex items-center space-x-2">
                      <span className="truncate">Staff & Admin Portal</span>
                      <span className="text-[10px] font-sans font-bold bg-white/10 text-sand-300 px-2 py-0.5 rounded shrink-0">
                        Secure
                      </span>
                    </div>
                    <p className="text-xs text-sand-400/70 font-light mt-0.5 truncate">
                      Manage bookings, folios, room tariffs & kitchen
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-sand-400/40 group-hover:text-sand-200 transition-all shrink-0 ml-2" />
              </Link>
            </nav>
          </div>

          {/* Bottom Dock Action Area */}
          <div className="p-4 sm:p-5 border-t border-forest-800/80 bg-forest-900/95 backdrop-blur-md space-y-2.5 shrink-0">
            {/* Primary Direct Booking CTA */}
            <button
              onClick={handleBookingAction}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-98 text-forest-950 py-3.5 px-4 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-forest-950" />
              <span>Check Availability & Book Room</span>
            </button>

            {/* Quick Contact Buttons: WhatsApp & Phone */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href="https://wa.me/918101298882?text=Hello%20Savera%20Homestay!%20I%20would%20like%20to%20inquire%20about%20booking%20a%20stay."
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#25D366] hover:bg-[#20bd5a] active:scale-98 text-white py-2.5 px-3 rounded-xl font-semibold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all"
              >
                <MessageCircle className="w-4 h-4 fill-white shrink-0" />
                <span>WhatsApp</span>
              </a>

              <a
                href={`tel:${cleanPhone}`}
                className="bg-white/10 hover:bg-white/20 active:scale-98 border border-white/20 text-white py-2.5 px-3 rounded-xl font-semibold text-xs flex items-center justify-center space-x-1.5 transition-all"
              >
                <Phone className="w-4 h-4 text-amber-300 shrink-0" />
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
