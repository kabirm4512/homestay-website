'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  BedDouble,
  User,
  Phone,
  Mail,
  IndianRupee,
  CreditCard,
  ShieldCheck,
  Upload,
  CheckCircle2,
  Sparkles,
  MapPin,
  Utensils,
  AlertCircle,
  Tag,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Share2,
  Plus,
  Minus,
  Baby,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { MealPlan, RoomTapeStatus, PaymentMethod, CRMBooking } from '@/types/crm';
import { INITIAL_ROOM_SEASONAL_TARIFFS } from '@/lib/crm-data';

interface ManualBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRoomId?: string;
  defaultDate?: string;
  onBookingCreated?: (booking: CRMBooking) => void;
}

export default function ManualBookingModal({
  isOpen,
  onClose,
  defaultRoomId,
  defaultDate,
  onBookingCreated,
}: ManualBookingModalProps) {
  const { rooms, calculateDynamicTariff, createManualBooking, showToast, roomTariffs } = useCRM();

  // Selected room
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  // Dates
  const [checkInDate, setCheckInDate] = useState<string>('');
  const [checkOutDate, setCheckOutDate] = useState<string>('');

  // Tariff & Rate Mode
  const [useManualRate, setUseManualRate] = useState<boolean>(true);
  const [manualRatePerNight, setManualRatePerNight] = useState<number>(4500);
  const [customTotalTariff, setCustomTotalTariff] = useState<number | null>(null);
  const [mealPlan, setMealPlan] = useState<MealPlan>('CP');

  // Extra Occupants (defaults to 0 as requested)
  const [extraAdultsCount, setExtraAdultsCount] = useState<number>(0);
  const [extraChildrenCount, setExtraChildrenCount] = useState<number>(0);
  const [infantsCount, setInfantsCount] = useState<number>(0);
  const [extraAdultChargePerNight, setExtraAdultChargePerNight] = useState<number>(1200);
  const [extraChildChargePerNight, setExtraChildChargePerNight] = useState<number>(600);
  const [tapeStatus, setTapeStatus] = useState<RoomTapeStatus>('checked_in');

  // Advance Payment
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<PaymentMethod>('upi');

  // Stage 2: Guest Contact Details
  const [guestName, setGuestName] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestCity, setGuestCity] = useState<string>('');
  const [guestAddress, setGuestAddress] = useState<string>('');
  const [guestNationality, setGuestNationality] = useState<string>('Indian');
  const [idType, setIdType] = useState<string>('Aadhaar Card');
  const [idNumber, setIdNumber] = useState<string>('');
  const [idDocumentUrl, setIdDocumentUrl] = useState<string>('');
  const [idDocumentBackUrl, setIdDocumentBackUrl] = useState<string>('');
  const [showOptionalDocs, setShowOptionalDocs] = useState<boolean>(false);

  // Mandates & Notes
  const [dietaryPreferences, setDietaryPreferences] = useState<string>('');
  const [hospitalityPreferences, setHospitalityPreferences] = useState<string>('');
  const [specialRequests, setSpecialRequests] = useState<string>('');
  const [staffNotes, setStaffNotes] = useState<string>('');

  // Active step: 1 = Room & Tariffs, 2 = Guest Contact & Start Check-In, 3 = Handover & Portal Links
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [createdBooking, setCreatedBooking] = useState<CRMBooking | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      const room = defaultRoomId
        ? rooms.find((r) => r.id === defaultRoomId) || rooms[0]
        : rooms[0];
      const initialRoomId = room?.id || 'room-101';
      setSelectedRoomId(initialRoomId);

      const start = defaultDate || new Date().toISOString().split('T')[0];
      setCheckInDate(start);

      // Default 1 night
      const next = new Date(start);
      next.setDate(next.getDate() + 1);
      setCheckOutDate(next.toISOString().split('T')[0]);

      // Fetch dynamic rates from roomTariffs
      const tariffs = (roomTariffs && roomTariffs[initialRoomId]) || INITIAL_ROOM_SEASONAL_TARIFFS[initialRoomId];
      const adultRate = tariffs?.extraAdultRate ?? (initialRoomId.includes('20') ? 1500 : 1200);
      const childRate = tariffs?.extraChildRate ?? (initialRoomId.includes('20') ? 750 : 600);
      const baseNightly = tariffs?.regular?.CP ?? (initialRoomId.includes('20') ? 6500 : 4500);

      setExtraAdultChargePerNight(adultRate);
      setExtraChildChargePerNight(childRate);
      setManualRatePerNight(baseNightly);
      setUseManualRate(true);
      setCustomTotalTariff(null);
      setMealPlan('CP');
      setExtraAdultsCount(0);
      setExtraChildrenCount(0);
      setInfantsCount(0);
      setTapeStatus('checked_in');
      setAdvancePaid(0);
      setAdvancePaymentMethod('upi');

      setGuestName('');
      setGuestPhone('');
      setGuestEmail('');
      setGuestCity('');
      setGuestAddress('');
      setGuestNationality('Indian');
      setIdType('Aadhaar Card');
      setIdNumber('');
      setIdDocumentUrl('');
      setIdDocumentBackUrl('');
      setShowOptionalDocs(false);
      setDietaryPreferences('');
      setHospitalityPreferences('');
      setSpecialRequests('');
      setStaffNotes('');
      setCurrentStep(1);
      setCreatedBooking(null);
      setIsCopied(false);
    }
  }, [isOpen, defaultRoomId, defaultDate, rooms, roomTariffs]);

  // When room or meal plan changes, update rates from roomTariffs
  useEffect(() => {
    if (selectedRoomId) {
      const tariffs = (roomTariffs && roomTariffs[selectedRoomId]) || INITIAL_ROOM_SEASONAL_TARIFFS[selectedRoomId];
      if (tariffs) {
        if (tariffs.extraAdultRate) setExtraAdultChargePerNight(tariffs.extraAdultRate);
        if (tariffs.extraChildRate) setExtraChildChargePerNight(tariffs.extraChildRate);
        const baseRate = tariffs.regular?.[mealPlan] || (selectedRoomId.includes('20') ? 6500 : 4500);
        setManualRatePerNight(baseRate);
      }
    }
  }, [selectedRoomId, mealPlan, roomTariffs]);

  // Selected room object
  const activeRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId) || rooms[0];
  }, [rooms, selectedRoomId]);

  // Minimum checkout date (at least checkIn + 1 day)
  const minCheckOutDate = useMemo(() => {
    if (!checkInDate) return undefined;
    const next = new Date(checkInDate);
    next.setDate(next.getDate() + 1);
    return next.toISOString().split('T')[0];
  }, [checkInDate]);

  const handleCheckInDateChange = (newIn: string) => {
    setCheckInDate(newIn);
    if (!newIn) return;
    if (!checkOutDate || checkOutDate <= newIn) {
      const next = new Date(newIn);
      next.setDate(next.getDate() + 1);
      setCheckOutDate(next.toISOString().split('T')[0]);
    }
  };

  // Calculate nights
  const totalNights = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 1;
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diff = Math.max(0, end.getTime() - start.getTime());
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [checkInDate, checkOutDate]);

  // Extra Person Calculations (Infants are complimentary)
  const totalExtraAdultCharges = useMemo(
    () => extraAdultsCount * extraAdultChargePerNight * totalNights,
    [extraAdultsCount, extraAdultChargePerNight, totalNights]
  );
  const totalExtraChildCharges = useMemo(
    () => extraChildrenCount * extraChildChargePerNight * totalNights,
    [extraChildrenCount, extraChildChargePerNight, totalNights]
  );
  const totalExtraCharges = totalExtraAdultCharges + totalExtraChildCharges;

  // Standard tariff suggestion from dynamic pricing engine
  const standardTariff = useMemo(() => {
    if (!activeRoom || !checkInDate || !checkOutDate) return null;
    try {
      return calculateDynamicTariff(
        activeRoom.id,
        checkInDate,
        checkOutDate,
        mealPlan,
        2 + extraAdultsCount,
        extraChildrenCount
      );
    } catch {
      return null;
    }
  }, [activeRoom, checkInDate, checkOutDate, mealPlan, extraAdultsCount, extraChildrenCount, calculateDynamicTariff]);

  // Total tariff computed
  const effectiveTotalAmount = useMemo(() => {
    if (customTotalTariff !== null && customTotalTariff > 0) {
      return customTotalTariff;
    }
    return (totalNights * manualRatePerNight) + totalExtraCharges;
  }, [totalNights, manualRatePerNight, totalExtraCharges, customTotalTariff]);

  // File to base64 reader helper
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('File is too large. Please upload an image under 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setter(reader.result as string);
      showToast('Document image uploaded successfully');
    };
    reader.readAsDataURL(file);
  };

  // Start Check-In Form Handler
  const handleStartCheckIn = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRoomId) {
      showToast('Please select a physical room to assign', 'error');
      setCurrentStep(1);
      return;
    }

    if (!checkInDate || !checkOutDate) {
      showToast('Please specify valid check-in and check-out dates', 'error');
      setCurrentStep(1);
      return;
    }

    if (!guestName.trim()) {
      showToast('Guest Full Name is required', 'error');
      return;
    }

    if (!guestPhone.trim()) {
      showToast('Guest WhatsApp / Mobile Number is required', 'error');
      return;
    }

    const newBooking = createManualBooking({
      roomId: selectedRoomId,
      checkInDate,
      checkOutDate,
      roomRatePerNight: manualRatePerNight,
      totalRoomAmount: effectiveTotalAmount,
      mealPlan,
      adultsCount: 2 + extraAdultsCount,
      childrenCount: extraChildrenCount,
      infantsCount: infantsCount,
      extraAdultChargePerNight,
      extraChildChargePerNight,
      status: tapeStatus,
      specialRequests,
      notes: staffNotes,
      isManualRate: useManualRate,
      advancePaid: advancePaid > 0 ? advancePaid : undefined,
      advancePaymentMethod: advancePaid > 0 ? advancePaymentMethod : undefined,
      guest: {
        fullName: guestName.trim(),
        phone: guestPhone.trim(),
        email: guestEmail.trim() || undefined,
        idType,
        idNumber: idNumber.trim() || undefined,
        idDocumentUrl: idDocumentUrl || undefined,
        idDocumentBackUrl: idDocumentBackUrl || undefined,
        address: guestAddress.trim() || undefined,
        city: guestCity.trim() || undefined,
        nationality: guestNationality,
        dietaryPreferences: dietaryPreferences.trim() || undefined,
        hospitalityPreferences: hospitalityPreferences.trim() || undefined,
      },
    });

    setCreatedBooking(newBooking);
    setCurrentStep(3); // Advance to Handover / CTAs stage
    showToast(`Check-In started for Room ${activeRoom?.roomNumber || ''} (${guestName.trim()})`, 'success');

    if (onBookingCreated) {
      onBookingCreated(newBooking);
    }
  };

  // Build Portal Link & Welcoming WhatsApp text
  const cleanPhone = useMemo(() => {
    return guestPhone.replace(/[^0-9]/g, '').slice(-10);
  }, [guestPhone]);

  const guestFirstName = useMemo(() => {
    return (guestName || '').trim().split(' ')[0] || 'Guest';
  }, [guestName]);

  const portalLink = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const phoneParam = encodeURIComponent(cleanPhone);
    const nameParam = encodeURIComponent(guestFirstName);
    const bookingParam = createdBooking ? `&booking=${encodeURIComponent(createdBooking.bookingReference)}` : '';
    return `${origin}/portal?phone=${phoneParam}&name=${nameParam}${bookingParam}`;
  }, [cleanPhone, guestFirstName, createdBooking]);

  const welcomeMessage = useMemo(() => {
    const roomNum = activeRoom?.roomNumber || createdBooking?.roomNumber || '';
    const roomName = activeRoom?.name ? (activeRoom.name.split(' - ')[1] || activeRoom.name) : 'Deluxe Room';
    return `🌿 *Welcome to Savera Homestay!*

Dear ${guestName.trim() || 'Guest'},

We are delighted to welcome you! Check-in has been initiated for *Room ${roomNum} (${roomName})*.

👉 *Your Personal Guest Portal Link:*
${portalLink}

Through your portal, you can:
• Complete quick digital ID verification & upload
• View your booking details, stay tariff & meal plan
• Access your live room bill & download GST Tax Invoice
• Request special celebrations: Handcrafted Cake (₹1,000), Romantic Candlelight Dinner (₹2,000), or Flower Bed Decor (₹1,000)
• Browse & order from our In-Room Dine-In menu

📶 *High-Speed Wi-Fi:* Savera_Guest_HighSpeed (Password: saverahomestay)
📞 *Host & Front Desk:* +91 98320 22233

Wishing you a serene and memorable Himalayan stay!
— *Team Savera Homestay*`;
  }, [guestName, activeRoom, createdBooking, portalLink]);

  const whatsappShareUrl = useMemo(() => {
    const rawDigits = guestPhone.replace(/[^0-9]/g, '');
    const fullPhone = rawDigits.length === 10 ? `91${rawDigits}` : rawDigits;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(welcomeMessage)}`;
  }, [guestPhone, welcomeMessage]);

  const handleCopyMessage = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(welcomeMessage);
      setIsCopied(true);
      showToast('Welcome message and Guest Portal link copied to clipboard!');
      setTimeout(() => setIsCopied(false), 3000);
    }
  };

  const handleOpenGuestPortal = () => {
    if (typeof window !== 'undefined') {
      window.open(portalLink, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-forest-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-sand-300 w-full max-w-3xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-forest-900 via-forest-950 to-forest-900 text-white p-5 sm:p-6 flex items-center justify-between border-b border-forest-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-inner">
              <BedDouble className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-serif font-bold text-lg sm:text-xl text-white">
                  Manual Reservation &amp; Check-In
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Front Desk
                </span>
              </div>
              <p className="text-xs text-sand-300 mt-0.5">
                Assign room, configure extra occupants, and share instant self check-in link.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-sand-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Tabs */}
        <div className="bg-sand-100/90 border-b border-sand-200 px-6 py-2.5 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => currentStep !== 3 && setCurrentStep(1)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1.5 ${
                currentStep === 1
                  ? 'bg-forest-900 text-white shadow-xs'
                  : 'text-forest-700 hover:text-forest-950 hover:bg-sand-200'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-forest-800 text-[10px] flex items-center justify-center">1</span>
              <span>Room &amp; Tariffs</span>
            </button>

            <span className="text-forest-400">→</span>

            <button
              type="button"
              onClick={() => currentStep !== 3 && setCurrentStep(2)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1.5 ${
                currentStep === 2
                  ? 'bg-forest-900 text-white shadow-xs'
                  : 'text-forest-700 hover:text-forest-950 hover:bg-sand-200'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-forest-800 text-[10px] flex items-center justify-center">2</span>
              <span>Guest Contact</span>
            </button>

            <span className="text-forest-400">→</span>

            <div
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 ${
                currentStep === 3
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-forest-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-emerald-800 text-[10px] flex items-center justify-center">3</span>
              <span>Check-In &amp; Links</span>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-forest-600 font-medium">Stay Total:</span>
            <span className="ml-1.5 font-bold font-mono text-sm text-forest-950">
              ₹{effectiveTotalAmount.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-forest-950">
          {/* ================= STEP 1: ROOM & TARIFFS ================= */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fade-in">
              {/* 1. Room Selection */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-forest-800 block mb-2">
                  1. Select Physical Room to Assign *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {rooms.map((room) => {
                    const isSelected = room.id === selectedRoomId;
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-forest-900 text-white border-forest-900 shadow-md ring-2 ring-amber-400/50'
                            : 'bg-sand-50 hover:bg-white text-forest-900 border-sand-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                isSelected ? 'bg-amber-400 text-forest-950' : 'bg-sand-200 text-forest-800'
                              }`}
                            >
                              Room {room.roomNumber}
                            </span>
                            <span className="text-[10px] opacity-75 capitalize font-medium">
                              Fl {room.floorLevel}
                            </span>
                          </div>
                          <p className="font-serif font-bold text-xs truncate">
                            {room.name.split(' - ')[1] || room.name}
                          </p>
                          <p className={`text-[10px] mt-0.5 truncate ${isSelected ? 'text-sand-200' : 'text-forest-600'}`}>
                            {room.categoryName}
                          </p>
                        </div>
                        <div className="mt-2 pt-1.5 border-t border-current/10 flex items-center justify-between text-[10px]">
                          <span>Status:</span>
                          <span className="capitalize font-bold">{room.currentStatus}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Dates & Stay Calculation */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-sand-50 p-4 rounded-2xl border border-sand-200">
                <div>
                  <label className="text-xs font-bold text-forest-800 block mb-1 flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-forest-600" />
                    <span>Check-In Date *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={checkInDate}
                    onChange={(e) => handleCheckInDateChange(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white font-medium text-forest-950 focus:ring-2 focus:ring-forest-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-forest-800 block mb-1 flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-forest-600" />
                    <span>Check-Out Date *</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={minCheckOutDate}
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white font-medium text-forest-950 focus:ring-2 focus:ring-forest-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-forest-800 block mb-1">
                    Duration of Stay
                  </label>
                  <div className="p-2.5 bg-white rounded-xl border border-sand-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-forest-900">
                      {totalNights} {totalNights === 1 ? 'Night' : 'Nights'}
                    </span>
                    <span className="text-[10px] text-forest-600">Auto-computed</span>
                  </div>
                </div>
              </div>

              {/* 3. Tariff Mode & Base Room Rate */}
              <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
                  <div className="flex items-center space-x-2">
                    <Tag className="w-4 h-4 text-amber-700" />
                    <h4 className="font-serif font-bold text-sm text-amber-950">
                      Tariff &amp; Pricing (Fetched from Room Rates)
                    </h4>
                  </div>
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useManualRate}
                      onChange={(e) => setUseManualRate(e.target.checked)}
                      className="w-4 h-4 text-forest-800 rounded border-amber-300 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-amber-900">
                      Manual Rate Override
                    </span>
                  </label>
                </div>

                {standardTariff && (
                  <div className="flex items-center justify-between text-xs bg-white/70 p-2.5 rounded-xl border border-amber-200">
                    <span className="text-forest-700">
                      Standard Rack/Seasonal Tariff ({totalNights} nts, {mealPlan}):
                    </span>
                    <span className="font-mono font-bold text-forest-900">
                      ₹{standardTariff.totalAmount.toLocaleString('en-IN')} (Avg ₹{standardTariff.avgRatePerNight}/nt)
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-amber-950 block mb-1">
                      Room Rate Per Night (₹) *
                    </label>
                    <div className="relative">
                      <IndianRupee className="w-4 h-4 text-amber-700 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        min="0"
                        step="100"
                        required
                        value={manualRatePerNight}
                        onChange={(e) => {
                          setManualRatePerNight(Number(e.target.value));
                          setCustomTotalTariff(null);
                        }}
                        className="w-full pl-9 pr-3 py-2 text-sm font-bold font-mono rounded-xl border border-amber-300 bg-white text-forest-950 focus:ring-2 focus:ring-amber-500"
                        placeholder="e.g., 4500"
                      />
                    </div>
                    <span className="text-[10px] text-amber-800 mt-1 block">
                      Multiplied by {totalNights} night{totalNights > 1 ? 's' : ''} = ₹{(totalNights * manualRatePerNight).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-amber-950 block mb-1">
                      Direct Lump Sum Stay Tariff (₹) (Optional)
                    </label>
                    <div className="relative">
                      <IndianRupee className="w-4 h-4 text-amber-700 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        min="0"
                        value={customTotalTariff ?? ''}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          setCustomTotalTariff(val);
                          if (val && totalNights > 0) {
                            setManualRatePerNight(Math.round(val / totalNights));
                          }
                        }}
                        className="w-full pl-9 pr-3 py-2 text-sm font-bold font-mono rounded-xl border border-amber-300 bg-white text-forest-950 focus:ring-2 focus:ring-amber-500"
                        placeholder="Leave blank to use per-night rate"
                      />
                    </div>
                    <span className="text-[10px] text-amber-800 mt-1 block">
                      Effective Tariff: <strong>₹{effectiveTotalAmount.toLocaleString('en-IN')}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Occupancy: Extra Adults, Extra Children & Infants (All default to 0) */}
              <div className="bg-sand-50/80 p-5 rounded-2xl border border-sand-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-forest-700" />
                    <h4 className="font-serif font-bold text-sm text-forest-950">
                      Meal Plan &amp; Extra Occupants
                    </h4>
                  </div>
                  <span className="text-[10px] text-forest-600 bg-sand-200 px-2.5 py-0.5 rounded-full font-medium">
                    Base Capacity: 2 Adults Included
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {/* Meal Plan */}
                  <div>
                    <label className="text-xs font-bold text-forest-800 block mb-1 flex items-center space-x-1">
                      <Utensils className="w-3.5 h-3.5 text-forest-600" />
                      <span>Meal Plan</span>
                    </label>
                    <select
                      value={mealPlan}
                      onChange={(e) => setMealPlan(e.target.value as MealPlan)}
                      className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white font-bold text-forest-900"
                    >
                      <option value="EP">EP — Room Only</option>
                      <option value="CP">CP — Bed &amp; Breakfast</option>
                      <option value="MAP">MAP — Breakfast + Dinner</option>
                      <option value="AP">AP — Full Board (All Meals)</option>
                    </select>
                  </div>

                  {/* Extra Adults Counter (Default 0) */}
                  <div className="bg-white p-3 rounded-xl border border-sand-200">
                    <label className="text-xs font-bold text-forest-900 block mb-1">
                      Extra Adults
                    </label>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setExtraAdultsCount((c) => Math.max(0, c - 1))}
                        className="w-7 h-7 rounded-lg bg-sand-100 hover:bg-sand-200 text-forest-800 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold text-sm font-mono text-forest-950">
                        {extraAdultsCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExtraAdultsCount((c) => Math.min(4, c + 1))}
                        className="w-7 h-7 rounded-lg bg-sand-100 hover:bg-sand-200 text-forest-800 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[10px] text-forest-600 mt-1 block text-center">
                      {extraAdultsCount === 0 ? 'No extra adults' : `+${extraAdultsCount} extra adult${extraAdultsCount > 1 ? 's' : ''}`}
                    </span>
                  </div>

                  {/* Extra Children Counter (Default 0) */}
                  <div className="bg-white p-3 rounded-xl border border-sand-200">
                    <label className="text-xs font-bold text-forest-900 block mb-1">
                      Extra Children
                    </label>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setExtraChildrenCount((c) => Math.max(0, c - 1))}
                        className="w-7 h-7 rounded-lg bg-sand-100 hover:bg-sand-200 text-forest-800 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold text-sm font-mono text-forest-950">
                        {extraChildrenCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExtraChildrenCount((c) => Math.min(4, c + 1))}
                        className="w-7 h-7 rounded-lg bg-sand-100 hover:bg-sand-200 text-forest-800 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[10px] text-forest-600 mt-1 block text-center">
                      {extraChildrenCount === 0 ? 'No extra children' : `+${extraChildrenCount} child${extraChildrenCount > 1 ? 'ren' : ''}`}
                    </span>
                  </div>

                  {/* Infants Counter (Default 0, Complimentary) */}
                  <div className="bg-white p-3 rounded-xl border border-sand-200">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-forest-900 flex items-center space-x-1">
                        <Baby className="w-3.5 h-3.5 text-amber-600" />
                        <span>Infants</span>
                      </label>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                        Free
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setInfantsCount((c) => Math.max(0, c - 1))}
                        className="w-7 h-7 rounded-lg bg-sand-100 hover:bg-sand-200 text-forest-800 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold text-sm font-mono text-forest-950">
                        {infantsCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => setInfantsCount((c) => Math.min(3, c + 1))}
                        className="w-7 h-7 rounded-lg bg-sand-100 hover:bg-sand-200 text-forest-800 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[10px] text-emerald-800 font-medium mt-1 block text-center">
                      Complimentary (₹0)
                    </span>
                  </div>
                </div>

                {/* Conditional Extra Occupants Charges: ONLY shown if extra adults or children > 0 */}
                {(extraAdultsCount > 0 || extraChildrenCount > 0) && (
                  <div className="pt-3 border-t border-sand-200 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                    {/* Extra Adult Rate (shown only if extraAdultsCount > 0) */}
                    {extraAdultsCount > 0 && (
                      <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 shadow-2xs">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-amber-950">
                            Extra Adult Rate (₹ / night)
                          </label>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 font-bold">
                            = ₹{totalExtraAdultCharges.toLocaleString('en-IN')} ({totalNights}N)
                          </span>
                        </div>
                        <div className="relative">
                          <IndianRupee className="w-3.5 h-3.5 text-amber-700 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={extraAdultChargePerNight}
                            onChange={(e) => setExtraAdultChargePerNight(Number(e.target.value) || 0)}
                            className="w-full pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-amber-300 bg-white"
                          />
                        </div>
                        <span className="text-[10px] text-amber-800 mt-0.5 block">
                          Fetched from room tariffs. Applies to {extraAdultsCount} extra adult{extraAdultsCount > 1 ? 's' : ''}.
                        </span>
                      </div>
                    )}

                    {/* Extra Child Rate (shown only if extraChildrenCount > 0) */}
                    {extraChildrenCount > 0 && (
                      <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 shadow-2xs">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-emerald-950">
                            Extra Child Rate (₹ / night)
                          </label>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-950 font-bold">
                            = ₹{totalExtraChildCharges.toLocaleString('en-IN')} ({totalNights}N)
                          </span>
                        </div>
                        <div className="relative">
                          <IndianRupee className="w-3.5 h-3.5 text-emerald-700 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={extraChildChargePerNight}
                            onChange={(e) => setExtraChildChargePerNight(Number(e.target.value) || 0)}
                            className="w-full pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-emerald-300 bg-white"
                          />
                        </div>
                        <span className="text-[10px] text-emerald-800 mt-0.5 block">
                          Fetched from room tariffs. Applies to {extraChildrenCount} extra child{extraChildrenCount > 1 ? 'ren' : ''}.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 5. Booking Status & Advance Payment */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-sand-50 p-4 rounded-2xl border border-sand-200">
                <div>
                  <label className="text-xs font-bold text-forest-800 block mb-1">
                    Initial Booking Status *
                  </label>
                  <select
                    value={tapeStatus}
                    onChange={(e) => setTapeStatus(e.target.value as RoomTapeStatus)}
                    className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white font-bold text-forest-900"
                  >
                    <option value="checked_in">Checked-In (In-House Now)</option>
                    <option value="confirmed">Confirmed (Guaranteed)</option>
                    <option value="hold">Hold (Tentative reservation)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-forest-800 block mb-1">
                    Advance Collected (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={advancePaid || ''}
                    onChange={(e) => setAdvancePaid(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-forest-800 block mb-1 flex items-center space-x-1">
                    <CreditCard className="w-3.5 h-3.5 text-forest-600" />
                    <span>Advance Payment Method</span>
                  </label>
                  <select
                    value={advancePaymentMethod}
                    onChange={(e) => setAdvancePaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white font-medium text-forest-900"
                  >
                    <option value="upi">UPI / GPay / PhonePe</option>
                    <option value="cash">Cash at Reception</option>
                    <option value="bank_transfer">Direct Bank Transfer / NEFT</option>
                    <option value="card">Credit / Debit Card POS</option>
                  </select>
                </div>
              </div>

              {/* Step 1 Footer */}
              <div className="pt-4 border-t border-sand-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-sand-300 font-bold text-xs text-forest-700 hover:bg-sand-100 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-2.5 bg-forest-900 hover:bg-forest-800 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
                >
                  <span>Next: Guest Contact &amp; Start Check-In →</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 2: GUEST CONTACT & START CHECK-IN ================= */}
          {currentStep === 2 && (
            <form onSubmit={handleStartCheckIn} className="space-y-6 animate-fade-in">
              {/* Primary Contact Details */}
              <div className="bg-sand-50 p-5 rounded-2xl border border-sand-200 space-y-4">
                <div className="flex items-center space-x-2 border-b border-sand-200/80 pb-3">
                  <User className="w-4 h-4 text-forest-700" />
                  <div>
                    <h4 className="font-serif font-bold text-sm text-forest-950">
                      Guest Contact Information
                    </h4>
                    <p className="text-[11px] text-forest-600">
                      Enter guest name &amp; WhatsApp number to initiate check-in and generate self-portal link.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-forest-900 block mb-1">
                      Guest Full Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-forest-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        autoFocus
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="e.g. Aditi Chatterjee"
                        className="w-full pl-9 pr-3 py-2.5 text-sm font-semibold rounded-xl border border-sand-300 bg-white text-forest-950 focus:ring-2 focus:ring-forest-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-forest-900 block mb-1">
                      WhatsApp / Mobile Number *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-forest-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="w-full pl-9 pr-3 py-2.5 text-sm font-semibold rounded-xl border border-sand-300 bg-white text-forest-950 focus:ring-2 focus:ring-forest-700 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="text-xs font-bold text-forest-800 block mb-1">
                      Email Address (Optional)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-forest-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="aditi@example.com"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-sand-300 bg-white text-forest-950 focus:ring-2 focus:ring-forest-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-forest-800 block mb-1 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-forest-600" />
                      <span>City / State (Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={guestCity}
                      onChange={(e) => setGuestCity(e.target.value)}
                      placeholder="e.g., Kolkata, West Bengal"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-sand-300 bg-white text-forest-950 focus:ring-2 focus:ring-forest-700"
                    />
                  </div>
                </div>
              </div>

              {/* Optional Collapsible: ID Verification & Hospitality Notes */}
              <div className="border border-sand-200 rounded-2xl overflow-hidden bg-sand-50/50">
                <button
                  type="button"
                  onClick={() => setShowOptionalDocs(!showOptionalDocs)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-sand-100/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-forest-900">
                      Optional: Collect ID Documents &amp; Hospitality Notes Now
                    </span>
                    <span className="text-[10px] text-forest-600 bg-sand-200 px-2 py-0.5 rounded-full font-medium">
                      Or let guest upload in Portal
                    </span>
                  </div>
                  {showOptionalDocs ? (
                    <ChevronUp className="w-4 h-4 text-forest-600" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-forest-600" />
                  )}
                </button>

                {showOptionalDocs && (
                  <div className="p-4 pt-0 space-y-4 border-t border-sand-200/60">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-forest-800 block mb-1">
                          ID Document Type
                        </label>
                        <select
                          value={idType}
                          onChange={(e) => setIdType(e.target.value)}
                          className="w-full text-xs p-2 rounded-xl border border-sand-300 bg-white font-medium text-forest-900"
                        >
                          <option value="Aadhaar Card">Aadhaar Card (UIDAI)</option>
                          <option value="Passport & ILP">Passport &amp; Inner Line Permit (ILP)</option>
                          <option value="Driver License">Driver License</option>
                          <option value="Voter ID Card">Voter ID (Election Card)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-forest-800 block mb-1">
                          Document Number
                        </label>
                        <input
                          type="text"
                          value={idNumber}
                          onChange={(e) => setIdNumber(e.target.value)}
                          placeholder="e.g. 5432-8765-1098"
                          className="w-full text-xs p-2 rounded-xl border border-sand-300 bg-white font-mono text-forest-950"
                        />
                      </div>
                    </div>

                    {/* Document Uploads */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="border border-dashed border-sand-300 rounded-xl p-3 text-center bg-white">
                        <span className="text-[11px] font-bold text-forest-800 block mb-1.5">
                          Front Side Photo
                        </span>
                        {idDocumentUrl ? (
                          <div className="space-y-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={idDocumentUrl} alt="Front ID" className="w-full h-20 object-contain rounded-lg bg-sand-100" />
                            <button
                              type="button"
                              onClick={() => setIdDocumentUrl('')}
                              className="text-[10px] text-rose-600 font-bold hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center p-2 cursor-pointer hover:bg-sand-50 rounded-lg">
                            <Upload className="w-4 h-4 text-forest-500 mb-0.5" />
                            <span className="text-[11px] font-semibold text-forest-900">Upload Front</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, setIdDocumentUrl)}
                            />
                          </label>
                        )}
                      </div>

                      <div className="border border-dashed border-sand-300 rounded-xl p-3 text-center bg-white">
                        <span className="text-[11px] font-bold text-forest-800 block mb-1.5">
                          Back Side Photo
                        </span>
                        {idDocumentBackUrl ? (
                          <div className="space-y-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={idDocumentBackUrl} alt="Back ID" className="w-full h-20 object-contain rounded-lg bg-sand-100" />
                            <button
                              type="button"
                              onClick={() => setIdDocumentBackUrl('')}
                              className="text-[10px] text-rose-600 font-bold hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center p-2 cursor-pointer hover:bg-sand-50 rounded-lg">
                            <Upload className="w-4 h-4 text-forest-500 mb-0.5" />
                            <span className="text-[11px] font-semibold text-forest-900">Upload Back</span>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-[11px] font-bold text-forest-800 block mb-1">
                          Dietary Preferences
                        </label>
                        <input
                          type="text"
                          value={dietaryPreferences}
                          onChange={(e) => setDietaryPreferences(e.target.value)}
                          placeholder="e.g. Vegetarian, Jain"
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-sand-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-forest-800 block mb-1">
                          Staff Notes / Special Instructions
                        </label>
                        <input
                          type="text"
                          value={staffNotes}
                          onChange={(e) => setStaffNotes(e.target.value)}
                          placeholder="e.g. VIP guest, arriving via NJP"
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-sand-300 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2 Footer with CTA: Start Check-In */}
              <div className="pt-4 border-t border-sand-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-5 py-2.5 rounded-xl border border-sand-300 font-bold text-xs text-forest-700 hover:bg-sand-100 transition-colors"
                >
                  ← Back to Room &amp; Tariffs
                </button>

                <button
                  type="submit"
                  className="px-7 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg transition-all flex items-center space-x-2 cursor-pointer active:scale-95 ring-2 ring-emerald-400/40"
                >
                  <CheckCircle2 className="w-5 h-5 text-white" />
                  <span>Start Check-In</span>
                </button>
              </div>
            </form>
          )}

          {/* ================= STEP 3: HANDOVER & PORTAL LINKS ================= */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fade-in">
              {/* Success Badge */}
              <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-base text-emerald-950">
                    Check-In Successfully Initiated!
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Room {activeRoom?.roomNumber} assigned to <strong>{guestName}</strong>. Reservation Ref: <strong>{createdBooking?.bookingReference}</strong>.
                  </p>
                </div>
              </div>

              {/* Handover Actions Card */}
              <div className="bg-sand-50 p-5 rounded-2xl border border-sand-200 space-y-4">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <h4 className="font-serif font-bold text-sm text-forest-950">
                    Guest Portal &amp; Self-Service Handover
                  </h4>
                </div>
                <p className="text-xs text-forest-700">
                  Share the personalized guest portal link with the guest via WhatsApp so they can upload their ID proof, view their room folio, and request celebration add-ons. Alternatively, staff can continue formalities on the spot.
                </p>

                {/* WhatsApp Welcome Message Preview */}
                <div className="bg-white p-3.5 rounded-xl border border-sand-300 text-xs font-mono text-forest-800 space-y-1.5 max-h-48 overflow-y-auto">
                  <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                    WhatsApp Message Preview:
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-forest-900">
                    {welcomeMessage}
                  </pre>
                </div>

                {/* Two Main CTAs as requested: WhatsApp CTA and Open Guest Portal CTA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* CTA 1: WhatsApp Share */}
                  <a
                    href={whatsappShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[50px] px-4 py-3 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer text-center group"
                  >
                    <MessageSquare className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Send Welcome on WhatsApp</span>
                  </a>

                  {/* CTA 2: Open Guest Portal */}
                  <button
                    type="button"
                    onClick={handleOpenGuestPortal}
                    className="min-h-[50px] px-4 py-3 bg-forest-900 hover:bg-forest-800 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer text-center group"
                  >
                    <ExternalLink className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform" />
                    <span>Open Guest Portal (Staff Check-In)</span>
                  </button>
                </div>

                {/* Secondary Action: Copy text */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="text-xs text-forest-700 hover:text-forest-950 font-bold flex items-center space-x-1.5 cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-forest-500" />
                        <span>Copy Message &amp; Portal Link</span>
                      </>
                    )}
                  </button>

                  <span className="text-[11px] text-forest-500 font-mono truncate max-w-[280px]">
                    {portalLink}
                  </span>
                </div>
              </div>

              {/* Step 3 Footer */}
              <div className="pt-4 border-t border-sand-200 flex items-center justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-forest-900 hover:bg-forest-800 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Done &amp; Return to Tape Chart
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
