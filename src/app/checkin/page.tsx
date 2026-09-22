'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  Camera,
  Upload,
  CheckCircle2,
  Calendar,
  BedDouble,
  User,
  Phone,
  Mail,
  MapPin,
  Utensils,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  Search,
  ExternalLink,
  Trees,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { CRMBooking, Guest } from '@/types/crm';

const ROOM_OPTIONS = [
  { id: 'room-101', roomNumber: 101, name: 'Room 101 - Sunrise Mountain Balcony' },
  { id: 'room-102', roomNumber: 102, name: 'Room 102 - Valley Vista Balcony' },
  { id: 'room-103', roomNumber: 103, name: 'Room 103 - Himalayan Mist Balcony' },
  { id: 'room-104', roomNumber: 104, name: 'Room 104 - Pine Whispers Balcony' },
  { id: 'room-201', roomNumber: 201, name: 'Room 201 - Kanchenjunga Suite' },
  { id: 'room-202', roomNumber: 202, name: 'Room 202 - Alpine Grand Suite' },
  { id: 'room-203', roomNumber: 203, name: 'Room 203 - Celestial Penthouse Suite' },
];

function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function CheckinContent() {
  const searchParams = useSearchParams();
  const bookingParam = searchParams.get('booking');

  const { bookings, updateBookingGuestDetails, showToast } = useCRM();

  const [bookingQuery, setBookingQuery] = useState('');
  const [activeBooking, setActiveBooking] = useState<CRMBooking | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('room-101');
  const [selectedCheckInDate, setSelectedCheckInDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedCheckOutDate, setSelectedCheckOutDate] = useState(() => new Date(Date.now() + 86400000).toISOString().split('T')[0]);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [nationality, setNationality] = useState('Indian');
  const [idType, setIdType] = useState('Aadhaar Card');
  const [idNumber, setIdNumber] = useState('');
  const [idDocumentUrl, setIdDocumentUrl] = useState('');
  const [idDocumentBackUrl, setIdDocumentBackUrl] = useState('');
  const [dietaryPreferences, setDietaryPreferences] = useState('');
  const [hospitalityPreferences, setHospitalityPreferences] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  // Status & Success state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const loadBookingIntoForm = (b: CRMBooking) => {
    setActiveBooking(b);
    setNotFound(false);
    setSelectedRoomId(b.roomId || 'room-101');
    setSelectedCheckInDate(b.checkInDate || new Date().toISOString().split('T')[0]);
    setSelectedCheckOutDate(b.checkOutDate || new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    setFullName(b.guest.fullName || '');
    setPhone(b.guest.phone || '');
    setEmail(b.guest.email || '');
    setCity(b.guest.city || '');
    setAddress(b.guest.address || '');
    setNationality(b.guest.nationality || 'Indian');
    setIdType(b.guest.idType || 'Aadhaar Card');
    setIdNumber(b.guest.idNumber || '');
    setIdDocumentUrl(b.guest.idDocumentUrl || '');
    setIdDocumentBackUrl(b.guest.idDocumentBackUrl || '');
    setDietaryPreferences(b.guest.dietaryPreferences || '');
    setHospitalityPreferences(b.guest.hospitalityPreferences || '');
    setSpecialRequests(b.specialRequests || '');

    if (b.documentStatus === 'submitted' || b.documentStatus === 'verified') {
      setIsSubmitted(true);
    } else {
      setIsSubmitted(false);
    }
  };

  // Resolve booking from query param or search
  useEffect(() => {
    if (!bookingParam) return;

    const query = bookingParam.trim().toLowerCase();
    const queryDigits = query.replace(/[^0-9]/g, '');
    const normParamPhone = normalizePhone(query);

    const localFound = bookings.find((b) => {
      if (b.id.toLowerCase() === query) return true;
      if (b.bookingReference.toLowerCase() === query) return true;
      if (b.guest?.phone) {
        const bNorm = normalizePhone(b.guest.phone);
        if (normParamPhone && normParamPhone.length >= 6 && bNorm === normParamPhone) return true;
        if (queryDigits && queryDigits.length >= 6 && b.guest.phone.replace(/[^0-9]/g, '').includes(queryDigits)) return true;
      }
      return false;
    });

    if (localFound) {
      loadBookingIntoForm(localFound);
      return;
    }

    // Check localStorage directly
    try {
      const raw = localStorage.getItem('wp_crm_bookings');
      if (raw) {
        const parsed: CRMBooking[] = JSON.parse(raw);
        const rawFound = parsed.find((b) => {
          if (b.id.toLowerCase() === query) return true;
          if (b.bookingReference.toLowerCase() === query) return true;
          if (b.guest?.phone) {
            const bNorm = normalizePhone(b.guest.phone);
            if (normParamPhone && normParamPhone.length >= 6 && bNorm === normParamPhone) return true;
          }
          return false;
        });
        if (rawFound) {
          loadBookingIntoForm(rawFound);
          return;
        }
      }
    } catch {}

    // Check backend server API
    fetch(`/api/checkin?query=${encodeURIComponent(bookingParam)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && json.booking) {
          loadBookingIntoForm(json.booking);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true));
  }, [bookingParam, bookings]);

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingQuery.trim()) return;

    setIsSearching(true);
    setNotFound(false);

    const query = bookingQuery.trim().toLowerCase();
    const cleanDigits = query.replace(/[^0-9]/g, '');
    const cleanQueryPhone = normalizePhone(query);

    // 1. First check local CRM state
    const found = bookings.find((b) => {
      if (b.bookingReference.toLowerCase() === query) return true;
      if (b.id.toLowerCase() === query) return true;
      if (b.guest?.phone) {
        const bNorm = normalizePhone(b.guest.phone);
        if (cleanQueryPhone && cleanQueryPhone.length >= 6) {
          if (bNorm === cleanQueryPhone || bNorm.endsWith(cleanQueryPhone) || cleanQueryPhone.endsWith(bNorm)) {
            return true;
          }
        }
        if (cleanDigits && cleanDigits.length >= 6 && b.guest.phone.replace(/[^0-9]/g, '').includes(cleanDigits)) {
          return true;
        }
      }
      if (b.guest?.fullName && b.guest.fullName.toLowerCase().includes(query)) return true;
      return false;
    });

    if (found) {
      loadBookingIntoForm(found);
      setIsSearching(false);
      return;
    }

    // 2. Query backend checkin API
    try {
      const res = await fetch(`/api/checkin?query=${encodeURIComponent(bookingQuery.trim())}`);
      const json = await res.json();
      if (res.ok && json.success && json.booking) {
        loadBookingIntoForm(json.booking);
        updateBookingGuestDetails(json.booking.id, json.booking.guest, json.booking);
        setIsSearching(false);
        return;
      }
    } catch (err) {
      console.warn('API checkin search failed:', err);
    }

    setIsSearching(false);
    setNotFound(true);
  };

  const startDirectSelfCheckin = (queryStr: string) => {
    const cleanDigits = queryStr.replace(/[^0-9]/g, '');
    const initialPhone = cleanDigits.length >= 7 ? cleanDigits : '';
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const walkInBooking: CRMBooking = {
      id: `walkin-${Date.now()}`,
      bookingReference: `WP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      roomId: 'room-101',
      roomNumber: 101,
      roomName: 'Room 101 - Sunrise Mountain Balcony',
      guestId: `gst-${Date.now()}`,
      guest: {
        id: `gst-${Date.now()}`,
        fullName: '',
        phone: initialPhone,
        nationality: 'Indian',
        idType: 'Aadhaar Card',
        documentStatus: 'pending',
        totalLifetimeStays: 1,
      },
      checkInDate: today,
      checkOutDate: tomorrow,
      tapeStatus: 'checked_in',
      bookingStatus: 'checked_in',
      mealPlan: 'CP',
      adultsCount: 2,
      childrenCount: 0,
      roomRatePerNight: 4500,
      totalNights: 1,
      totalRoomAmount: 4500,
      documentStatus: 'pending',
    };

    setIsWalkIn(true);
    setSelectedRoomId('room-101');
    setSelectedCheckInDate(today);
    setSelectedCheckOutDate(tomorrow);
    loadBookingIntoForm(walkInBooking);
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Photo is too large. Please select an image under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setter(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBooking) return;

    if (!fullName.trim()) {
      alert('Please enter your full legal name');
      return;
    }

    if (!phone.trim()) {
      alert('Please enter your mobile phone number');
      return;
    }

    if (!idNumber.trim() && !idDocumentUrl) {
      alert('Please enter your ID document number and upload a photo of your ID.');
      return;
    }

    setIsSubmitting(true);

    const guestUpdates: Partial<Guest> & { fullName: string; phone: string } = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      city: city.trim() || undefined,
      address: address.trim() || undefined,
      nationality: nationality || 'Indian',
      idType,
      idNumber: idNumber.trim() || undefined,
      idDocumentUrl: idDocumentUrl || undefined,
      idDocumentBackUrl: idDocumentBackUrl || undefined,
      dietaryPreferences: dietaryPreferences.trim() || undefined,
      hospitalityPreferences: hospitalityPreferences.trim() || undefined,
      documentStatus: 'submitted',
    };

    const targetRoom = ROOM_OPTIONS.find((r) => r.id === selectedRoomId);

    const payload = {
      bookingId: activeBooking.id.startsWith('walkin-') ? undefined : activeBooking.id,
      bookingReference: activeBooking.bookingReference,
      guest: guestUpdates,
      roomId: isWalkIn ? selectedRoomId : activeBooking.roomId,
      roomName: isWalkIn ? (targetRoom?.name || activeBooking.roomName) : activeBooking.roomName,
      roomNumber: isWalkIn ? (targetRoom?.roomNumber || activeBooking.roomNumber) : activeBooking.roomNumber,
      checkInDate: isWalkIn ? selectedCheckInDate : activeBooking.checkInDate,
      checkOutDate: isWalkIn ? selectedCheckOutDate : activeBooking.checkOutDate,
      specialRequests: specialRequests.trim() || undefined,
    };

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (res.ok && resData.success && resData.booking) {
        setActiveBooking(resData.booking);
        updateBookingGuestDetails(resData.booking.id, guestUpdates, {
          specialRequests: specialRequests.trim() || undefined,
          documentStatus: 'submitted',
        });
      } else {
        updateBookingGuestDetails(activeBooking.id, guestUpdates, {
          specialRequests: specialRequests.trim() || undefined,
          documentStatus: 'submitted',
        });
      }
    } catch (err) {
      console.warn('Server check-in sync failed, updated locally:', err);
      updateBookingGuestDetails(activeBooking.id, guestUpdates, {
        specialRequests: specialRequests.trim() || undefined,
        documentStatus: 'submitted',
      });
    }

    // Direct localStorage sync for cross-tab persistence
    try {
      const raw = localStorage.getItem('wp_crm_bookings');
      if (raw) {
        const parsed: CRMBooking[] = JSON.parse(raw);
        const updated = parsed.map((b) => {
          if (b.id === activeBooking.id) {
            return {
              ...b,
              specialRequests: specialRequests.trim() || undefined,
              documentStatus: 'submitted' as const,
              guest: {
                ...b.guest,
                ...guestUpdates,
                documentStatus: 'submitted' as const,
              },
            };
          }
          return b;
        });
        localStorage.setItem('wp_crm_bookings', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
      }
    } catch {}

    setIsSubmitting(false);
    setIsSubmitted(true);
    showToast('Guest registration and documents submitted successfully!');
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-forest-950 pb-16">
      {/* Top Header */}
      <header className="bg-forest-950 text-white border-b border-forest-900 sticky top-0 z-30 shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Trees className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-lg text-white leading-tight">
                Savera Homestay
              </h1>
              <p className="text-[11px] text-amber-300/90 tracking-wide font-medium">
                Guest Digital Check-In &amp; ID Verification
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-sand-300 block">Need help?</span>
            <a
              href="tel:+919876543210"
              className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
            >
              +91 98765 43210
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8">
        {/* Reservation Search Bar (if no active booking selected) */}
        {!activeBooking && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-sand-200 text-center space-y-4">
              <div className="w-14 h-14 rounded-3xl bg-forest-900 text-sand-200 flex items-center justify-center mx-auto shadow-sm">
                <ShieldCheck className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-2xl text-forest-950">
                  Welcome to Savera Homestay
                </h2>
                <p className="text-xs sm:text-sm text-forest-700 max-w-md mx-auto mt-1">
                  Please enter your <strong>Booking Reference</strong> or registered <strong>Phone Number</strong> to complete your digital registration.
                </p>
              </div>

              <form onSubmit={handleManualSearch} className="max-w-md mx-auto space-y-3 pt-2">
                <div className="relative">
                  <Search className="w-5 h-5 text-forest-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={bookingQuery}
                    onChange={(e) => {
                      setBookingQuery(e.target.value);
                      setNotFound(false);
                    }}
                    placeholder="e.g. WP-2026-101 or 9911233445"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-sand-300 bg-sand-50/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-forest-800 focus:bg-white text-forest-950"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="w-full py-3 bg-forest-900 hover:bg-forest-800 active:scale-98 text-white rounded-2xl font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-60"
                >
                  {isSearching ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Searching Reservation...</span>
                    </>
                  ) : (
                    <span>Find My Reservation</span>
                  )}
                </button>
              </form>

              <div className="pt-1 text-center">
                <Link
                  href="/portal"
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-forest-900 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3.5 py-1.5 rounded-full transition-colors shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Looking for the All-in-One Guest Portal &amp; Bills? Click here →</span>
                </Link>
              </div>

              {notFound && (
                <div className="p-4 bg-amber-50/90 border border-amber-300/80 rounded-2xl text-left space-y-3 max-w-md mx-auto animate-fade-in shadow-sm">
                  <div className="flex items-start space-x-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-forest-950 text-xs sm:text-sm">
                        No reservation found for <span className="underline font-mono text-amber-900">{bookingQuery}</span>
                      </p>
                      <p className="text-[11px] text-forest-700 mt-1 leading-relaxed">
                        Arrived directly or booked via WhatsApp/Call? You can proceed immediately with self check-in registration &amp; ID upload below.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-200 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => startDirectSelfCheckin(bookingQuery)}
                      className="flex-1 py-2.5 px-3 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Start Direct Self Check-In</span>
                    </button>
                    <a
                      href="tel:+919876543210"
                      className="py-2.5 px-3 bg-white hover:bg-sand-100 text-forest-900 border border-sand-300 rounded-xl font-bold text-xs transition-colors flex items-center justify-center space-x-1"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call Reception</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Demo Pickers if available */}
            {bookings.length > 0 && (
              <div className="bg-white/80 rounded-2xl p-5 border border-sand-200 text-xs text-forest-700">
                <span className="font-bold text-forest-900 block mb-2">
                  Or select from existing reservations on this device:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {bookings.slice(0, 4).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => loadBookingIntoForm(b)}
                      className="p-3 rounded-xl border border-sand-200 hover:border-forest-700 hover:bg-sand-50 text-left transition-colors flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-forest-950">{b.guest.fullName}</p>
                        <p className="text-[10px] text-forest-600">
                          {b.roomName} • {b.bookingReference}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sand-200 text-forest-800">
                        {b.checkInDate}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Reservation Form View */}
        {activeBooking && !isSubmitted && (
          <div className="space-y-6 animate-fade-in">
            {/* Reservation Summary Card */}
            <div className="bg-gradient-to-br from-forest-950 via-forest-900 to-forest-950 text-white rounded-3xl p-6 shadow-xl border border-forest-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300 block">
                      {isWalkIn ? 'Direct Registration' : 'Confirmed Reservation'}
                    </span>
                    {isWalkIn && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        Self Check-In
                      </span>
                    )}
                  </div>
                  <h2 className="font-serif font-bold text-xl sm:text-2xl text-white">
                    {activeBooking.roomName}
                  </h2>
                  <p className="text-xs text-sand-300 mt-0.5">
                    Room {activeBooking.roomNumber} • Booking Ref: <strong>#{activeBooking.bookingReference}</strong>
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-sand-300 block">Stay Duration</span>
                    <span className="text-sm font-bold text-amber-300">
                      {activeBooking.totalNights} {activeBooking.totalNights === 1 ? 'Night' : 'Nights'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveBooking(null);
                      setIsWalkIn(false);
                      setNotFound(false);
                    }}
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium cursor-pointer ml-2"
                  >
                    Change
                  </button>
                </div>
              </div>

              {isWalkIn ? (
                <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] text-sand-300 uppercase font-bold block mb-1">
                      Assigned Room
                    </label>
                    <select
                      value={selectedRoomId}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setSelectedRoomId(newId);
                        const match = ROOM_OPTIONS.find((r) => r.id === newId);
                        if (match) {
                          setActiveBooking((prev) =>
                            prev ? { ...prev, roomId: match.id, roomNumber: match.roomNumber, roomName: match.name } : null
                          );
                        }
                      }}
                      className="w-full p-2.5 rounded-xl bg-forest-900 border border-white/20 text-white font-semibold text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    >
                      {ROOM_OPTIONS.map((r) => (
                        <option key={r.id} value={r.id} className="bg-forest-950 text-white">
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-sand-300 uppercase font-bold block mb-1">
                      Check-In Date
                    </label>
                    <input
                      type="date"
                      value={selectedCheckInDate}
                      onChange={(e) => setSelectedCheckInDate(e.target.value)}
                      className="w-full p-2 rounded-xl bg-forest-900 border border-white/20 text-white font-medium text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-sand-300 uppercase font-bold block mb-1">
                      Check-Out Date
                    </label>
                    <input
                      type="date"
                      value={selectedCheckOutDate}
                      onChange={(e) => setSelectedCheckOutDate(e.target.value)}
                      className="w-full p-2 rounded-xl bg-forest-900 border border-white/20 text-white font-medium text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
                  <div>
                    <span className="text-[10px] text-sand-300 uppercase font-bold block">
                      Check-In
                    </span>
                    <span className="font-bold text-white flex items-center space-x-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-300" />
                      <span>{activeBooking.checkInDate}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-sand-300 uppercase font-bold block">
                      Check-Out
                    </span>
                    <span className="font-bold text-white flex items-center space-x-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-300" />
                      <span>{activeBooking.checkOutDate}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-sand-300 uppercase font-bold block">
                      Guests
                    </span>
                    <span className="font-bold text-white mt-0.5 block">
                      {activeBooking.adultsCount} Adults{activeBooking.childrenCount > 0 ? `, ${activeBooking.childrenCount} Child` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-sand-300 uppercase font-bold block">
                      Meal Plan
                    </span>
                    <span className="font-bold text-amber-300 mt-0.5 block">
                      {activeBooking.mealPlan} Included
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Check-In Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-sand-200 space-y-8">
              {/* Section 1: Guest Contact Information */}
              <div>
                <div className="flex items-center space-x-2 border-b border-sand-200 pb-3 mb-4">
                  <User className="w-5 h-5 text-forest-700" />
                  <h3 className="font-serif font-bold text-lg text-forest-950">
                    1. Guest Contact &amp; Residential Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-forest-800 block mb-1">
                      Full Legal Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="As per Government ID"
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-forest-950 font-medium focus:bg-white focus:ring-2 focus:ring-forest-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-forest-800 block mb-1">
                      Mobile / WhatsApp Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-forest-950 font-medium focus:bg-white focus:ring-2 focus:ring-forest-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-forest-800 block mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-forest-950 focus:bg-white focus:ring-2 focus:ring-forest-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-forest-800 block mb-1">
                      Nationality
                    </label>
                    <input
                      type="text"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      placeholder="Indian"
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-forest-950 focus:bg-white focus:ring-2 focus:ring-forest-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-forest-800 block mb-1">
                      City &amp; State *
                    </label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Kolkata, West Bengal"
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-forest-950 focus:bg-white focus:ring-2 focus:ring-forest-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-forest-800 block mb-1">
                      Residential Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street, area, postal code"
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-forest-950 focus:bg-white focus:ring-2 focus:ring-forest-800 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Government ID & Document Upload */}
              <div>
                <div className="flex items-center space-x-2 border-b border-sand-200 pb-3 mb-4">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h3 className="font-serif font-bold text-lg text-forest-950">
                      2. Government ID Verification &amp; Photo Upload *
                    </h3>
                    <p className="text-[11px] text-forest-600">
                      Mandatory as per state hospitality and tourism regulations.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-4">
                  <div>
                    <label className="font-bold text-forest-800 block mb-1">
                      Government ID Type *
                    </label>
                    <select
                      value={idType}
                      onChange={(e) => setIdType(e.target.value)}
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 font-bold text-forest-950 focus:bg-white focus:ring-2 focus:ring-forest-800 focus:outline-none"
                    >
                      <option value="Aadhaar Card">Aadhaar Card (UIDAI)</option>
                      <option value="Passport & ILP">Passport &amp; Inner Line Permit (ILP)</option>
                      <option value="Driver License">Driving License</option>
                      <option value="Voter ID Card">Voter ID (Election Card)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-forest-800 block mb-1">
                      Document / ID Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      placeholder="e.g. 5432-8765-1098"
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 font-mono font-bold text-forest-950 focus:bg-white focus:ring-2 focus:ring-forest-800 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Photo Upload Drops: Front and Back */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Front Side */}
                  <div className="border-2 border-dashed border-sand-300 hover:border-forest-600 rounded-3xl p-5 text-center bg-sand-50/60 transition-colors">
                    <span className="text-xs font-bold text-forest-900 block mb-1">
                      ID Photo (Front Page) *
                    </span>
                    <span className="text-[11px] text-forest-600 block mb-3">
                      Capture photo with phone camera or upload image
                    </span>

                    {idDocumentUrl ? (
                      <div className="space-y-2">
                        <div className="w-full h-36 rounded-2xl overflow-hidden bg-white border border-sand-300 shadow-inner">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={idDocumentUrl}
                            alt="Front ID Upload"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setIdDocumentUrl('')}
                          className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                        >
                          Change / Remove Photo
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-sand-200 shadow-xs cursor-pointer hover:bg-sand-50 transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-forest-900 text-sand-200 flex items-center justify-center mb-2 shadow-xs">
                          <Camera className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-forest-950">
                          Take Photo / Choose File
                        </span>
                        <span className="text-[10px] text-forest-500 mt-0.5">
                          JPG, PNG, PDF up to 5MB
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, setIdDocumentUrl)}
                        />
                      </label>
                    )}
                  </div>

                  {/* Back Side */}
                  <div className="border-2 border-dashed border-sand-300 hover:border-forest-600 rounded-3xl p-5 text-center bg-sand-50/60 transition-colors">
                    <span className="text-xs font-bold text-forest-900 block mb-1">
                      ID Photo (Back Page / Address)
                    </span>
                    <span className="text-[11px] text-forest-600 block mb-3">
                      Recommended for Aadhaar &amp; Voter ID
                    </span>

                    {idDocumentBackUrl ? (
                      <div className="space-y-2">
                        <div className="w-full h-36 rounded-2xl overflow-hidden bg-white border border-sand-300 shadow-inner">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={idDocumentBackUrl}
                            alt="Back ID Upload"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setIdDocumentBackUrl('')}
                          className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                        >
                          Change / Remove Photo
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-sand-200 shadow-xs cursor-pointer hover:bg-sand-50 transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-sand-200 text-forest-800 flex items-center justify-center mb-2 shadow-xs">
                          <Upload className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-forest-950">
                          Upload Back / Address Side
                        </span>
                        <span className="text-[10px] text-forest-500 mt-0.5">
                          Optional secondary page
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, setIdDocumentBackUrl)}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Dietary & Stay Preferences */}
              <div>
                <div className="flex items-center space-x-2 border-b border-sand-200 pb-3 mb-4">
                  <Utensils className="w-5 h-5 text-amber-700" />
                  <h3 className="font-serif font-bold text-lg text-forest-950">
                    3. Hospitality &amp; Dining Preferences
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-forest-800 block mb-1">
                      Dietary Preferences / Allergies
                    </label>
                    <input
                      type="text"
                      value={dietaryPreferences}
                      onChange={(e) => setDietaryPreferences(e.target.value)}
                      placeholder="e.g. Vegetarian, Jain, Peanut Allergy, Vegan"
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-forest-950 focus:bg-white focus:ring-2 focus:ring-forest-800 focus:outline-none"
                    />
                    <span className="text-[10px] text-forest-600 mt-1 block">
                      Directly routed to our kitchen staff before your meal preparation.
                    </span>
                  </div>

                  <div>
                    <label className="font-bold text-forest-800 block mb-1">
                      Special Requests / Room Preferences
                    </label>
                    <input
                      type="text"
                      value={hospitalityPreferences}
                      onChange={(e) => setHospitalityPreferences(e.target.value)}
                      placeholder="e.g. Extra duvet, hot water flask, arriving around 2 PM"
                      className="w-full p-3 rounded-xl border border-sand-300 bg-sand-50/50 text-forest-950 focus:bg-white focus:ring-2 focus:ring-forest-800 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="p-4 bg-sand-50 rounded-2xl border border-sand-200">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    required
                    className="w-5 h-5 mt-0.5 rounded text-forest-900 border-sand-300 focus:ring-forest-700"
                  />
                  <span className="text-xs text-forest-800 leading-relaxed">
                    I declare that the government identification details and documents provided above are genuine and accurate for verification during my stay at <strong>Savera Homestay</strong>.
                  </span>
                </label>
              </div>

              {/* Submit CTA */}
              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-emerald-700 hover:bg-emerald-600 active:scale-98 text-white rounded-2xl font-bold text-base shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Submitting Documents...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Submit Digital Registration &amp; Documents</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Success Confirmation View */}
        {activeBooking && isSubmitted && (
          <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-sand-200 text-center space-y-6 animate-fade-in">
            <div className="w-20 h-20 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-50">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest block mb-1">
                Verification Received
              </span>
              <h2 className="font-serif font-bold text-2xl sm:text-3xl text-forest-950">
                Registration Complete!
              </h2>
              <p className="text-sm text-forest-700 max-w-md mx-auto mt-2">
                Thank you, <strong>{fullName || activeBooking.guest.fullName}</strong>. Your documents and guest details have been safely received by the Savera Homestay team.
              </p>
            </div>

            {/* Quick Stay Confirmation Card */}
            <div className="bg-sand-50 p-5 rounded-2xl border border-sand-200 max-w-md mx-auto text-xs text-left space-y-2">
              <div className="flex items-center justify-between border-b border-sand-200 pb-2">
                <span className="text-forest-600">Assigned Accommodation:</span>
                <strong className="text-forest-950">{activeBooking.roomName}</strong>
              </div>
              <div className="flex items-center justify-between border-b border-sand-200 pb-2">
                <span className="text-forest-600">Dates:</span>
                <strong>{activeBooking.checkInDate} to {activeBooking.checkOutDate}</strong>
              </div>
              <div className="flex items-center justify-between border-b border-sand-200 pb-2">
                <span className="text-forest-600">Document Status:</span>
                <span className="font-bold text-emerald-700 flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Submitted for Arrival Verification</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-forest-600">In-Room Dining:</span>
                <strong className="text-amber-800">QR Code Active Upon Arrival</strong>
              </div>
            </div>

            {/* Useful Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <a
                href="https://maps.google.com/?q=Savera+Homestay+Darjeeling"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-6 py-3 bg-forest-900 hover:bg-forest-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center space-x-2"
              >
                <MapPin className="w-4 h-4" />
                <span>Get Estate Directions</span>
              </a>

              <a
                href="tel:+919876543210"
                className="w-full sm:w-auto px-6 py-3 bg-sand-100 hover:bg-sand-200 text-forest-900 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-2"
              >
                <Phone className="w-4 h-4" />
                <span>Call Estate Reception</span>
              </a>

              <button
                type="button"
                onClick={() => setIsSubmitted(false)}
                className="w-full sm:w-auto px-6 py-3 border border-sand-300 hover:bg-sand-50 text-forest-700 rounded-xl text-xs font-bold transition-colors"
              >
                Edit Details
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CheckinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
          <div className="text-center space-y-2">
            <div className="w-10 h-10 border-4 border-forest-900 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-forest-800">Loading digital check-in...</p>
          </div>
        </div>
      }
    >
      <CheckinContent />
    </Suspense>
  );
}
