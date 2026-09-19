'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trees, Phone, Calendar, Menu, X, ShieldCheck } from 'lucide-react';
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

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm py-3 border-b border-sand-200'
          : 'bg-gradient-to-b from-black/60 via-black/30 to-transparent py-5 text-white'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-3 group">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
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
              className={`text-xs uppercase tracking-widest block font-medium ${
                scrolled ? 'text-forest-600' : 'text-sand-200 drop-shadow-sm'
              }`}
            >
              Boutique Mountain Stay
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center space-x-8">
          <a
            href="#rooms"
            className={`text-sm font-medium transition-colors hover:text-sand-400 ${
              scrolled ? 'text-gray-700' : 'text-white'
            }`}
          >
            Rooms & Rates
          </a>
          <a
            href="#travel-rentals"
            className={`text-sm font-medium transition-colors hover:text-sand-400 ${
              scrolled ? 'text-gray-700' : 'text-white'
            }`}
          >
            Travel & Rentals
          </a>
          <a
            href="#about"
            className={`text-sm font-medium transition-colors hover:text-sand-400 ${
              scrolled ? 'text-gray-700' : 'text-white'
            }`}
          >
            The Experience
          </a>
          <a
            href="#reviews"
            className={`text-sm font-medium transition-colors hover:text-sand-400 ${
              scrolled ? 'text-gray-700' : 'text-white'
            }`}
          >
            Guest Reviews
          </a>
          <a
            href="#location"
            className={`text-sm font-medium transition-colors hover:text-sand-400 ${
              scrolled ? 'text-gray-700' : 'text-white'
            }`}
          >
            Location
          </a>
          <Link
            href="/admin"
            className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center space-x-1 ${
              scrolled
                ? 'border-gray-300 text-gray-600 hover:text-forest-800 hover:border-forest-600'
                : 'border-white/30 text-white/80 hover:text-white hover:border-white'
            }`}
            title="Admin Dashboard"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin</span>
          </Link>
        </nav>

        {/* Right CTA / Phone & PWA Install */}
        <div className="hidden lg:flex items-center space-x-3">
          <PWAInstaller variant="button" />
          <a
            href={`tel:${phone.replace(/\s+/g, '')}`}
            className={`flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              scrolled
                ? 'text-forest-800 bg-forest-50 hover:bg-forest-100'
                : 'text-white bg-white/10 backdrop-blur-sm hover:bg-white/20'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>{phone}</span>
          </a>
          <button
            onClick={onCheckAvailability || onOpenInquiry}
            className="flex items-center space-x-2 bg-forest-800 hover:bg-forest-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-sand-300" />
            <span>Book Your Stay</span>
          </button>
        </div>

        {/* Mobile menu trigger & Install button */}
        <div className="flex md:hidden items-center space-x-2">
          <PWAInstaller variant="button" className="px-2.5 py-1.5 text-[11px]" />
          <button
            onClick={onCheckAvailability || onOpenInquiry}
            className="text-xs bg-forest-800 hover:bg-forest-900 text-white font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
          >
            Book
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-2 rounded-lg transition-colors ${
              scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/20'
            }`}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/98 text-gray-800 border-b border-sand-200 px-6 py-6 shadow-xl space-y-4">
          <nav className="flex flex-col space-y-3 font-medium text-base">
            <a
              href="#rooms"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-forest-800 border-b border-gray-100"
            >
              Rooms & Rates
            </a>
            <a
              href="#travel-rentals"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-forest-800 border-b border-gray-100 flex items-center justify-between"
            >
              <span>Travel, Transfers & Rentals</span>
              <span className="text-[10px] uppercase font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">New</span>
            </a>
            <a
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-forest-800 border-b border-gray-100"
            >
              The Experience & About
            </a>
            <a
              href="#reviews"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-forest-800 border-b border-gray-100"
            >
              Google Reviews (4.9 ★)
            </a>
            <a
              href="#location"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-forest-800 border-b border-gray-100"
            >
              Location & Getting Here
            </a>
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 text-sm text-forest-700 flex items-center space-x-2"
            >
              <ShieldCheck className="w-4 h-4 text-forest-600" />
              <span>Owner & Admin Portal</span>
            </Link>
          </nav>
          <div className="pt-2 flex flex-col space-y-2.5">
            <PWAInstaller variant="banner" />
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                (onCheckAvailability || onOpenInquiry)();
              }}
              className="w-full bg-forest-800 hover:bg-forest-900 text-white py-3 rounded-xl font-semibold text-center flex items-center justify-center space-x-2 cursor-pointer shadow-md"
            >
              <Calendar className="w-4 h-4 text-sand-300" />
              <span>Check Availability & Book</span>
            </button>
            <a
              href={`tel:${phone.replace(/\s+/g, '')}`}
              className="w-full border border-sand-300 text-forest-900 py-2.5 rounded-xl font-medium text-center text-sm flex items-center justify-center space-x-2"
            >
              <Phone className="w-4 h-4 text-forest-600" />
              <span>Call Us: {phone}</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
