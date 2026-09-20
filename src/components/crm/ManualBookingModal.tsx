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
  FileText,
  CheckCircle2,
  Sparkles,
  MapPin,
  Utensils,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { MealPlan, RoomTapeStatus, PaymentMethod, CRMBooking } from '@/types/crm';

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
  const { rooms, calculateDynamicTariff, createManualBooking, showToast } = useCRM();

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

  // Stay occupancy & status
  const [adultsCount, setAdultsCount] = useState<number>(2);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [tapeStatus, setTapeStatus] = useState<RoomTapeStatus>('confirmed');

  // Advance Payment
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<PaymentMethod>('upi');

  // Guest Details
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

  // Mandates & Notes
  const [dietaryPreferences, setDietaryPreferences] = useState<string>('');
  const [hospitalityPreferences, setHospitalityPreferences] = useState<string>('');
  const [specialRequests, setSpecialRequests] = useState<string>('');
  const [staffNotes, setStaffNotes] = useState<string>('');

  // Active step for multi-step smooth entry: 1 = Room & Rate, 2 = Guest & Documents
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      const room = defaultRoomId
        ? rooms.find((r) => r.id === defaultRoomId) || rooms[0]
        : rooms[0];
      setSelectedRoomId(room?.id || '');

      const start = defaultDate || new Date().toISOString().split('T')[0];
      setCheckInDate(start);

      // Default 1 night
      const next = new Date(start);
      next.setDate(next.getDate() + 1);
      setCheckOutDate(next.toISOString().split('T')[0]);

      setUseManualRate(true);
      setManualRatePerNight(4500);
      setCustomTotalTariff(null);
      setMealPlan('CP');
      setAdultsCount(2);
      setChildrenCount(0);
      setTapeStatus('confirmed');
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
      setDietaryPreferences('');
      setHospitalityPreferences('');
      setSpecialRequests('');
      setStaffNotes('');
      setCurrentStep(1);
    }
  }, [isOpen, defaultRoomId, defaultDate, rooms]);

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

  // Standard tariff suggestion from dynamic pricing engine
  const standardTariff = useMemo(() => {
    if (!activeRoom || !checkInDate || !checkOutDate) return null;
    try {
      return calculateDynamicTariff(activeRoom.id, checkInDate, checkOutDate, mealPlan);
    } catch {
      return null;
    }
  }, [activeRoom, checkInDate, checkOutDate, mealPlan, calculateDynamicTariff]);

  // Update default manual rate when standard tariff calculates
  useEffect(() => {
    if (standardTariff && !useManualRate) {
      setManualRatePerNight(standardTariff.avgRatePerNight);
    }
  }, [standardTariff, useManualRate]);

  // Total tariff computed
  const effectiveTotalAmount = useMemo(() => {
    if (customTotalTariff !== null && customTotalTariff > 0) {
      return customTotalTariff;
    }
    return totalNights * manualRatePerNight;
  }, [totalNights, manualRatePerNight, customTotalTariff]);

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
      showToast('Document image uploaded and converted successfully');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRoomId) {
      showToast('Please select a physical room to assign', 'error');
      return;
    }

    if (!checkInDate || !checkOutDate) {
      showToast('Please specify valid check-in and check-out dates', 'error');
      return;
    }

    if (!guestName.trim()) {
      showToast('Guest Full Name is required', 'error');
      setCurrentStep(2);
      return;
    }

    if (!guestPhone.trim()) {
      showToast('Guest Phone / WhatsApp Number is required', 'error');
      setCurrentStep(2);
      return;
    }

    const newBooking = createManualBooking({
      roomId: selectedRoomId,
      checkInDate,
      checkOutDate,
      roomRatePerNight: manualRatePerNight,
      totalRoomAmount: effectiveTotalAmount,
      mealPlan,
      adultsCount,
      childrenCount,
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

    if (onBookingCreated) {
      onBookingCreated(newBooking);
    }
    onClose();
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
                  Manual Reservation &amp; Room Assignment
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Custom Tariff
                </span>
              </div>
              <p className="text-xs text-sand-300 mt-0.5">
                Assign a physical room, apply custom rate overrides, and capture guest verification documents.
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
              onClick={() => setCurrentStep(1)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1.5 ${
                currentStep === 1
                  ? 'bg-forest-900 text-white shadow-xs'
                  : 'text-forest-700 hover:text-forest-950 hover:bg-sand-200'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-forest-800 text-[10px] flex items-center justify-center">1</span>
              <span>Room &amp; Custom Tariff</span>
            </button>
            <span className="text-forest-400">→</span>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1.5 ${
                currentStep === 2
                  ? 'bg-forest-900 text-white shadow-xs'
                  : 'text-forest-700 hover:text-forest-950 hover:bg-sand-200'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-forest-800 text-[10px] flex items-center justify-center">2</span>
              <span>Guest Details &amp; Documents</span>
            </button>
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-forest-600 font-medium">Estimated Stay Tariff:</span>
            <span className="ml-1.5 font-bold font-mono text-sm text-forest-950">
              ₹{effectiveTotalAmount.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-forest-950">
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
                          <span>Current Status:</span>
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

              {/* 3. Manual Rate Per Night & Tariff Control */}
              <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
                  <div className="flex items-center space-x-2">
                    <Tag className="w-4 h-4 text-amber-700" />
                    <h4 className="font-serif font-bold text-sm text-amber-950">
                      Tariff &amp; Pricing Mode
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
                      Enable Manual Rate Override
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
                      Manual Rate Per Night (₹) *
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
                        placeholder="e.g., 4000"
                      />
                    </div>
                    <span className="text-[10px] text-amber-800 mt-1 block">
                      Multiplied by {totalNights} nights = ₹{(totalNights * manualRatePerNight).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-amber-950 block mb-1">
                      Or Direct Total Stay Tariff (₹) (Optional Lump Sum)
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
                        placeholder="Leave blank to use per-night calculation"
                      />
                    </div>
                    <span className="text-[10px] text-amber-800 mt-1 block">
                      Effective Total Tariff: <strong>₹{effectiveTotalAmount.toLocaleString('en-IN')}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Meal Plan & Occupancy */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    <option value="EP">EP — Room Only (No Meals)</option>
                    <option value="CP">CP — Bed &amp; Breakfast</option>
                    <option value="MAP">MAP — Half Board (Breakfast + Dinner)</option>
                    <option value="AP">AP — Full Board (All 3 Meals)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-forest-800 block mb-1">
                    Adults Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={adultsCount}
                    onChange={(e) => setAdultsCount(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-forest-800 block mb-1">
                    Children Count
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={childrenCount}
                    onChange={(e) => setChildrenCount(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white font-medium"
                  />
                </div>
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
                    <option value="confirmed">Confirmed (Guaranteed)</option>
                    <option value="hold">Hold (Tentative reservation)</option>
                    <option value="checked_in">Checked-In (Immediate in-house)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-forest-800 block mb-1">
                    Advance Deposit Collected (₹)
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
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              {/* Primary Contact Details */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-forest-700" />
                  <h4 className="font-serif font-bold text-sm text-forest-950">
                    Primary Guest Information
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-forest-800 block mb-1">
                      Guest Full Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-forest-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="e.g. Aditi Chatterjee"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-sand-300 bg-white text-forest-950 font-medium focus:ring-2 focus:ring-forest-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-forest-800 block mb-1">
                      Phone / WhatsApp Number *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-forest-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="e.g. +91 98765 43210"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-sand-300 bg-white text-forest-950 font-medium focus:ring-2 focus:ring-forest-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-forest-800 block mb-1">
                      Email Address
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
                    <label className="text-xs font-bold text-forest-800 block mb-1">
                      Nationality
                    </label>
                    <input
                      type="text"
                      value={guestNationality}
                      onChange={(e) => setGuestNationality(e.target.value)}
                      placeholder="Indian"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-sand-300 bg-white text-forest-950 focus:ring-2 focus:ring-forest-700"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-forest-800 block mb-1 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-forest-600" />
                      <span>City / State</span>
                    </label>
                    <input
                      type="text"
                      value={guestCity}
                      onChange={(e) => setGuestCity(e.target.value)}
                      placeholder="e.g., Kolkata, West Bengal"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-sand-300 bg-white text-forest-950 focus:ring-2 focus:ring-forest-700"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-forest-800 block mb-1">
                      Residential Address
                    </label>
                    <input
                      type="text"
                      value={guestAddress}
                      onChange={(e) => setGuestAddress(e.target.value)}
                      placeholder="Street, locality, postal code"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-sand-300 bg-white text-forest-950 focus:ring-2 focus:ring-forest-700"
                    />
                  </div>
                </div>
              </div>

              {/* ID Document & Verification Entry */}
              <div className="bg-sand-50 p-5 rounded-2xl border border-sand-200 space-y-4">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-serif font-bold text-sm text-forest-950">
                    Government ID Document &amp; Permits
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-forest-800 block mb-1">
                      ID Document Type
                    </label>
                    <select
                      value={idType}
                      onChange={(e) => setIdType(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white font-medium text-forest-900"
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
                      className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white font-mono text-forest-950"
                    />
                  </div>
                </div>

                {/* Document Photo Upload (Front & Back) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Front Upload */}
                  <div className="border-2 border-dashed border-sand-300 rounded-2xl p-4 text-center bg-white">
                    <span className="text-xs font-bold text-forest-800 block mb-2">
                      Front Side / Photo Page
                    </span>
                    {idDocumentUrl ? (
                      <div className="space-y-2">
                        <div className="w-full h-28 rounded-xl overflow-hidden bg-sand-100 border border-sand-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={idDocumentUrl}
                            alt="Front ID"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setIdDocumentUrl('')}
                          className="text-[11px] text-rose-600 font-bold hover:underline"
                        >
                          Remove Photo
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-3 cursor-pointer hover:bg-sand-50 rounded-xl transition-colors">
                        <Upload className="w-6 h-6 text-forest-500 mb-1" />
                        <span className="text-xs font-bold text-forest-900">Upload Front Photo</span>
                        <span className="text-[10px] text-forest-600">JPG, PNG up to 5MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, setIdDocumentUrl)}
                        />
                      </label>
                    )}
                  </div>

                  {/* Back Upload */}
                  <div className="border-2 border-dashed border-sand-300 rounded-2xl p-4 text-center bg-white">
                    <span className="text-xs font-bold text-forest-800 block mb-2">
                      Back Side / Address Page (Optional)
                    </span>
                    {idDocumentBackUrl ? (
                      <div className="space-y-2">
                        <div className="w-full h-28 rounded-xl overflow-hidden bg-sand-100 border border-sand-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={idDocumentBackUrl}
                            alt="Back ID"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setIdDocumentBackUrl('')}
                          className="text-[11px] text-rose-600 font-bold hover:underline"
                        >
                          Remove Photo
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-3 cursor-pointer hover:bg-sand-50 rounded-xl transition-colors">
                        <Upload className="w-6 h-6 text-forest-500 mb-1" />
                        <span className="text-xs font-bold text-forest-900">Upload Back Photo</span>
                        <span className="text-[10px] text-forest-600">JPG, PNG up to 5MB</span>
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

                <p className="text-[11px] text-forest-600 italic">
                  Note: If documents are not handy right now, you can create the reservation and share the self-check-in link with the guest via WhatsApp!
                </p>
              </div>

              {/* Preferences & Staff Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-forest-800 block mb-1">
                    Dietary Mandates &amp; Allergies
                  </label>
                  <input
                    type="text"
                    value={dietaryPreferences}
                    onChange={(e) => setDietaryPreferences(e.target.value)}
                    placeholder="e.g. Vegetarian, Jain, Peanut allergy"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-sand-300 bg-white text-forest-950"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-forest-800 block mb-1">
                    Hospitality &amp; Room Setup
                  </label>
                  <input
                    type="text"
                    value={hospitalityPreferences}
                    onChange={(e) => setHospitalityPreferences(e.target.value)}
                    placeholder="e.g. Extra blanket, hot water flask at 7 AM"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-sand-300 bg-white text-forest-950"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-forest-800 block mb-1">
                    Internal Staff Notes (Discounts, Special Instructions)
                  </label>
                  <input
                    type="text"
                    value={staffNotes}
                    onChange={(e) => setStaffNotes(e.target.value)}
                    placeholder="e.g. Corporate discount approved by manager, arriving via NJP transfer."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-sand-300 bg-white text-forest-950"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-sand-200 flex items-center justify-between">
            {currentStep === 1 ? (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-sand-300 font-bold text-xs text-forest-700 hover:bg-sand-100 transition-colors"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-5 py-2.5 rounded-xl border border-sand-300 font-bold text-xs text-forest-700 hover:bg-sand-100 transition-colors"
              >
                ← Back to Room &amp; Tariff
              </button>
            )}

            <div className="flex items-center space-x-3">
              {currentStep === 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-2.5 bg-forest-900 hover:bg-forest-800 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>Next: Guest Details &amp; Docs →</span>
                </button>
              ) : (
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm &amp; Assign Room</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
