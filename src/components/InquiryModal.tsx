'use client';

import { useState, useEffect } from 'react';
import { Room } from '@/types';
import DateRangePicker from './DateRangePicker';
import { X, Calendar, User, Phone, Mail, Users, MessageSquare, CheckCircle, Loader2 } from 'lucide-react';

interface InquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms?: Room[];
  selectedRoom?: Room | null;
  initialDates?: { checkIn: string; checkOut: string; guests: number } | null;
  whatsappNumber?: string;
}

export default function InquiryModal({
  isOpen,
  onClose,
  rooms = [],
  selectedRoom = null,
  initialDates = null,
  whatsappNumber = '919876543210',
}: InquiryModalProps) {
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestsCount, setGuestsCount] = useState(2);
  const [roomId, setRoomId] = useState('');
  const [message, setMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedData, setSubmittedData] = useState<any>(null);

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

  // Synchronize initial dates or selected room when modal opens
  useEffect(() => {
    if (selectedRoom) {
      setRoomId(selectedRoom.id);
    } else if (rooms.length > 0 && !roomId) {
      setRoomId(rooms[0].id);
    }

    if (initialDates) {
      if (initialDates.checkIn) setCheckIn(initialDates.checkIn);
      if (initialDates.checkOut) setCheckOut(initialDates.checkOut);
      if (initialDates.guests) setGuestsCount(initialDates.guests);
    }
  }, [selectedRoom, rooms, initialDates, roomId]);

  if (!isOpen) return null;

  const currentSelectedRoom = rooms.find((r) => r.id === roomId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!guestName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Please provide a contact phone or WhatsApp number.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        guest_name: guestName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        check_in: checkIn || null,
        check_out: checkOut || null,
        guests_count: Number(guestsCount),
        room_id: roomId || null,
        room_name: currentSelectedRoom?.name || 'Any Available Suite',
        message: message.trim(),
        source: 'inquiry_modal',
      };

      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmittedData(data.data || payload);
        setSuccess(true);
      } else {
        setErrorMsg(data.error || 'Failed to submit inquiry. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error while submitting inquiry.');
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
    setMessage('');
    onClose();
  };

  const getWhatsAppForwardLink = () => {
    const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
    const roomTxt = currentSelectedRoom ? currentSelectedRoom.name : 'Any room';
    const datesTxt = checkIn && checkOut ? `${checkIn} to ${checkOut}` : 'Dates flexible';
    const text = encodeURIComponent(
      `Hello! I just submitted an inquiry on your website.\n\n*Name:* ${guestName}\n*Phone:* ${phone}\n*Dates:* ${datesTxt}\n*Guests:* ${guestsCount}\n*Room:* ${roomTxt}\n*Notes:* ${message || 'None'}\n\nCould you please confirm availability?`
    );
    return `https://wa.me/${cleanNumber}?text=${text}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-sand-200 overflow-hidden my-8">
        {/* Header with Title and Close Button */}
        <div className="bg-forest-900 text-white p-6 sm:p-7 relative">
          <button
            onClick={handleResetAndClose}
            aria-label="Close modal"
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <span className="text-xs uppercase tracking-widest text-sand-300 font-semibold block mb-1">
            Direct Homestay Reservation
          </span>
          <h3 className="font-serif text-2xl font-bold text-white">
            {selectedRoom ? `Inquire for ${selectedRoom.name}` : 'Check Availability & Rates'}
          </h3>
          <p className="text-xs sm:text-sm text-sand-100/80 mt-1 font-light">
            Our family host will confirm your dates directly with zero booking commissions.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h4 className="font-serif text-2xl font-bold text-forest-950">
                Inquiry Received!
              </h4>
              <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
                Thank you, <span className="font-semibold text-gray-900">{guestName}</span>. We have
                received your stay request and our caretaker will call or text you shortly on{' '}
                <span className="font-semibold text-gray-900">{phone}</span>.
              </p>

              {/* Instant WhatsApp confirmation button */}
              <div className="pt-2">
                <a
                  href={getWhatsAppForwardLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center space-x-2 bg-[#25D366] hover:bg-[#20bd5a] text-white py-3.5 px-4 rounded-xl font-semibold text-sm shadow-md transition-all"
                >
                  <span>Fast-Track on WhatsApp</span>
                </a>
              </div>

              <button
                onClick={handleResetAndClose}
                className="text-xs text-gray-500 hover:text-gray-700 underline pt-2 block mx-auto"
              >
                Close this window
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                  {errorMsg}
                </div>
              )}

              {/* Guest Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Your Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maya Verma"
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
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-sand-50/50 border border-sand-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Email (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1">
                  Email Address <span className="text-gray-400 font-normal">(optional for receipt)</span>
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

              {/* Dates: Check-in and Check-out */}
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

              {/* Room Selection & Number of Guests */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Preferred Room
                  </label>
                  <select
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-sand-50/50 border border-sand-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white cursor-pointer"
                  >
                    <option value="">Any Available Room</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (₹{r.price_per_night}/n)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1 flex items-center space-x-1">
                    <Users className="w-3.5 h-3.5 text-forest-700" />
                    <span>Total Guests</span>
                  </label>
                  <select
                    value={guestsCount}
                    onChange={(e) => setGuestsCount(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-sand-50/50 border border-sand-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white cursor-pointer"
                  >
                    <option value={1}>1 Guest</option>
                    <option value={2}>2 Guests</option>
                    <option value={3}>3 Guests</option>
                    <option value={4}>4 Guests</option>
                    <option value={5}>5 Guests</option>
                    <option value={8}>6+ Guests (Entire Property)</option>
                  </select>
                </div>
              </div>

              {/* Message / Special Requests */}
              <div>
                <label className="block text-xs font-semibold text-forest-900 mb-1 flex items-center space-x-1">
                  <MessageSquare className="w-3.5 h-3.5 text-forest-700" />
                  <span>Message / Special Requests</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Questions about pickup, pets, meals, or flexible check-in times..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-sand-50/50 border border-sand-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-forest-800 hover:bg-forest-900 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center space-x-2 text-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-sand-300" />
                      <span>Saving directly to Supabase...</span>
                    </>
                  ) : (
                    <span>Submit Inquiry</span>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-center text-gray-400">
                Direct booking guarantee • Best rates guaranteed • No cancellation surprises
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
