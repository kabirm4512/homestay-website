'use client';

import { useState, useEffect } from 'react';
import { Room } from '@/types';
import DateRangePicker from './DateRangePicker';
import { X, Calendar, User, Phone, Mail, CheckCircle, Loader2, CreditCard } from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  initialDates?: { checkIn?: string; checkOut?: string } | null;
  whatsappNumber?: string;
}

export default function BookingModal({
  isOpen,
  onClose,
  room,
  initialDates = null,
  whatsappNumber = '918101298882',
}: BookingModalProps) {
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [mealPlan, setMealPlan] = useState<'EP' | 'CP' | 'MAP' | 'AP'>('CP');
  const [specialRequests, setSpecialRequests] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [bookingRef, setBookingRef] = useState('');

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

  const handleCheckInChange = (newCheckIn: string) => {
    setCheckIn(newCheckIn);
    if (!checkOut || checkOut <= newCheckIn) {
      setCheckOut(getNextDayStr(newCheckIn));
    }
  };

  // Sync initial dates when modal is triggered
  useEffect(() => {
    if (isOpen && initialDates) {
      if (initialDates.checkIn) setCheckIn(initialDates.checkIn);
      if (initialDates.checkOut) setCheckOut(initialDates.checkOut);
    }
  }, [isOpen, initialDates]);

  if (!isOpen || !room) return null;

  // Calculate nights and dynamic estimated total based on meal plan
  let nights = 1;
  if (checkIn && checkOut) {
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
    if (diff > 0) nights = diff;
  }

  const mealPlanOffsets: Record<'EP' | 'CP' | 'MAP' | 'AP', number> = {
    EP: -500,
    CP: 0,
    MAP: 1000,
    AP: 2000,
  };

  const effectiveNightlyRate = Math.max(1000, room.price_per_night + mealPlanOffsets[mealPlan]);
  const estimatedTotal = nights * effectiveNightlyRate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!guestName.trim() || !phone.trim() || !checkIn || !checkOut) {
      setErrorMsg('Please complete your name, phone number, and both check-in/out dates.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        guest_name: guestName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        room_id: room.id,
        room_name: room.name,
        check_in: checkIn,
        check_out: checkOut,
        nights,
        total_price: estimatedTotal,
        special_requests: `[Meal Plan: ${mealPlan}] ${specialRequests.trim()}`.trim(),
      };

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setBookingRef(data.data?.booking_reference || 'WP-' + Math.floor(1000 + Math.random() * 9000));
        setSuccess(true);
      } else {
        setErrorMsg(data.error || 'Failed to process booking reservation.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error while booking.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setSuccess(false);
    setErrorMsg('');
    setGuestName('');
    setPhone('');
    setEmail('');
    onClose();
  };

  const getWhatsAppBookingLink = () => {
    const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `Hello! I just placed a booking request on your website.\n\n*Reference:* ${bookingRef}\n*Room:* ${room.name}\n*Meal Plan:* ${mealPlan}\n*Guest:* ${guestName}\n*Phone:* ${phone}\n*Dates:* ${checkIn} to ${checkOut} (${nights} nights)\n*Total:* ₹${estimatedTotal.toLocaleString()}\n\nPlease let me know the bank/UPI details to confirm my reservation.`
    );
    return `https://wa.me/${cleanNumber}?text=${text}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-sand-200 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-forest-900 text-white p-6 relative">
          <button
            onClick={handleResetAndClose}
            aria-label="Close modal"
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <span className="text-xs uppercase tracking-widest text-sand-300 font-semibold block mb-1">
            Instant Direct Reservation
          </span>
          <h3 className="font-serif text-2xl font-bold text-white">{room.name}</h3>
          <p className="text-xs text-sand-200 mt-1 font-light">
            ₹{room.price_per_night.toLocaleString()} / night • Includes Complimentary Gourmet Breakfast
          </p>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h4 className="font-serif text-2xl font-bold text-forest-950">
                Reservation Request Placed!
              </h4>
              <div className="inline-block bg-sand-100 text-forest-900 font-mono text-sm px-4 py-1.5 rounded-lg font-bold border border-sand-300">
                Ref: {bookingRef}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
                Your reservation for <span className="font-semibold text-gray-900">{room.name}</span> ({nights} {nights === 1 ? 'night' : 'nights'}) has been registered directly with the host.
              </p>

              <div className="pt-2">
                <a
                  href={getWhatsAppBookingLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center space-x-2 bg-[#25D366] hover:bg-[#20bd5a] text-white py-3.5 px-4 rounded-xl font-semibold text-sm shadow-md transition-all"
                >
                  <span>Confirm with Host on WhatsApp</span>
                </a>
              </div>

              <button
                onClick={handleResetAndClose}
                className="text-xs text-gray-500 hover:text-gray-700 underline pt-2 block mx-auto"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                  {errorMsg}
                </div>
              )}

              {/* Check-in / Check-out Date Range Picker */}
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

              {/* Meal Plan Selector */}
              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1.5 flex items-center justify-between">
                  <span>Select Meal Plan</span>
                  <span className="text-[10px] text-forest-700 font-medium">Included Dining</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMealPlan('EP')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      mealPlan === 'EP'
                        ? 'bg-forest-900 border-forest-900 text-white shadow-sm'
                        : 'bg-sand-50/70 border-sand-300 text-forest-950 hover:bg-sand-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">EP (Room Only)</span>
                      <span className="text-[10px] opacity-80">-₹500</span>
                    </div>
                    <span className="text-[10px] block opacity-80 mt-0.5">Stay without meals</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMealPlan('CP')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      mealPlan === 'CP'
                        ? 'bg-forest-900 border-forest-900 text-white shadow-sm'
                        : 'bg-sand-50/70 border-sand-300 text-forest-950 hover:bg-sand-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">CP (Breakfast)</span>
                      <span className="text-[10px] text-amber-300 font-bold">Standard</span>
                    </div>
                    <span className="text-[10px] block opacity-80 mt-0.5">Fresh Gourmet Breakfast</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMealPlan('MAP')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      mealPlan === 'MAP'
                        ? 'bg-forest-900 border-forest-900 text-white shadow-sm'
                        : 'bg-sand-50/70 border-sand-300 text-forest-950 hover:bg-sand-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">MAP (Half Board)</span>
                      <span className="text-[10px] opacity-80">+₹1,000</span>
                    </div>
                    <span className="text-[10px] block opacity-80 mt-0.5">Breakfast + Pahadi Dinner</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMealPlan('AP')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      mealPlan === 'AP'
                        ? 'bg-forest-900 border-forest-900 text-white shadow-sm'
                        : 'bg-sand-50/70 border-sand-300 text-forest-950 hover:bg-sand-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">AP (Full Board)</span>
                      <span className="text-[10px] opacity-80">+₹2,000</span>
                    </div>
                    <span className="text-[10px] block opacity-80 mt-0.5">All 3 Meals Included</span>
                  </button>
                </div>
              </div>

              {/* Price Calculation Card */}
              {checkIn && checkOut && (
                <div className="bg-sand-100/70 p-3.5 rounded-xl border border-sand-200 text-xs text-forest-900 space-y-1.5">
                  <div className="flex justify-between">
                    <span>
                      Rate ({mealPlan}): ₹{effectiveNightlyRate.toLocaleString()} × {nights} {nights === 1 ? 'night' : 'nights'}
                    </span>
                    <span>₹{estimatedTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-forest-700">
                    <span>Selected Plan</span>
                    <span className="font-semibold text-emerald-700">
                      {mealPlan === 'EP'
                        ? 'Room Only'
                        : mealPlan === 'CP'
                        ? 'Breakfast Included'
                        : mealPlan === 'MAP'
                        ? 'Breakfast + Dinner Included'
                        : 'All Meals (Breakfast, Lunch, Dinner)'}
                    </span>
                  </div>
                  <div className="border-t border-sand-300 pt-1 flex justify-between font-bold text-sm text-forest-950">
                    <span>Estimated Total</span>
                    <span>₹{estimatedTotal.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Guest Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Guest Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Your full name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-sand-50/50 border border-sand-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Phone / WhatsApp *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      placeholder="+91 81012 98882"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-sand-50/50 border border-sand-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Email Address <span className="text-gray-400 font-normal">(for confirmation voucher)</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-sand-50/50 border border-sand-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Special Requests / Arrival Time
                </label>
                <input
                  type="text"
                  placeholder="e.g. Vegetarian breakfast, late check-in at 6 PM"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  className="w-full px-3 py-2 bg-sand-50/50 border border-sand-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-forest-800 hover:bg-forest-900 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center space-x-2 text-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-sand-300" />
                      <span>Submitting Reservation...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 text-sand-300" />
                      <span>Confirm Reservation Request</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-center text-gray-400">
                Zero upfront payment required right now. Host verifies availability before payment.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
