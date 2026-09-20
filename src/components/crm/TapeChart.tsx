'use client';

import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  Mail,
  ShieldCheck,
  Coffee,
  HeartHandshake,
  CheckCircle2,
  LogIn,
  LogOut,
  X,
  FileText,
  Clock,
  Sparkles,
  Share2,
  Copy,
  Check,
  MessageCircle,
  ExternalLink,
  Plus,
  MapPin,
  Upload,
  Eye,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { CRMBooking, PhysicalRoom, RoomTapeStatus, MealPlan } from '@/types/crm';
import ManualBookingModal from './ManualBookingModal';

export default function TapeChart() {
  const {
    rooms,
    bookings,
    updateRoomStatus,
    updateGuestPreferences,
    updateBookingGuestDetails,
    updateBookingDocumentStatus,
    checkInRoom,
    checkOutRoom,
    showToast,
  } = useCRM();

  // Date range state: start date for the 10-day viewing window
  const [baseDate, setBaseDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [selectedBooking, setSelectedBooking] = useState<CRMBooking | null>(null);
  const [isEditingGuest, setIsEditingGuest] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNationality, setEditNationality] = useState('Indian');
  const [editIdType, setEditIdType] = useState('Aadhaar Card');
  const [editIdNumber, setEditIdNumber] = useState('');
  const [editIdDocumentUrl, setEditIdDocumentUrl] = useState('');
  const [editIdDocumentBackUrl, setEditIdDocumentBackUrl] = useState('');
  const [editDietary, setEditDietary] = useState('');
  const [editHospitality, setEditHospitality] = useState('');
  const [editSpecialRequests, setEditSpecialRequests] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Manual booking modal state
  const [isManualBookingModalOpen, setIsManualBookingModalOpen] = useState(false);
  const [manualBookingDefaultRoomId, setManualBookingDefaultRoomId] = useState('');
  const [manualBookingDefaultDate, setManualBookingDefaultDate] = useState('');

  // Share link & image modal state
  const [copiedLink, setCopiedLink] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Generate 10 consecutive dates for the X-axis
  const dateColumns = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [baseDate]);

  const formatDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handlePrevDay = () => {
    const next = new Date(baseDate);
    next.setDate(baseDate.getDate() - 3);
    setBaseDate(next);
  };

  const handleNextDay = () => {
    const next = new Date(baseDate);
    next.setDate(baseDate.getDate() + 3);
    setBaseDate(next);
  };

  const handleToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setBaseDate(d);
  };

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    if (filterCategory === 'all') return rooms;
    return rooms.filter((r) => r.categoryCode === filterCategory);
  }, [rooms, filterCategory]);

  // Check if a room is occupied/reserved on a specific date
  const getBookingForRoomDate = (roomId: string, dateStr: string) => {
    return bookings.find((b) => {
      if (b.roomId !== roomId) return false;
      return dateStr >= b.checkInDate && dateStr < b.checkOutDate;
    });
  };

  const openGuestDrawer = (booking: CRMBooking) => {
    setSelectedBooking(booking);
    setEditName(booking.guest.fullName);
    setEditPhone(booking.guest.phone);
    setEditEmail(booking.guest.email || '');
    setEditCity(booking.guest.city || '');
    setEditAddress(booking.guest.address || '');
    setEditNationality(booking.guest.nationality || 'Indian');
    setEditIdType(booking.guest.idType || 'Aadhaar Card');
    setEditIdNumber(booking.guest.idNumber || '');
    setEditIdDocumentUrl(booking.guest.idDocumentUrl || '');
    setEditIdDocumentBackUrl(booking.guest.idDocumentBackUrl || '');
    setEditDietary(booking.guest.dietaryPreferences || '');
    setEditHospitality(booking.guest.hospitalityPreferences || '');
    setEditSpecialRequests(booking.specialRequests || '');
    setIsEditingGuest(false);
    setCopiedLink(false);
  };

  const handleSaveGuest = () => {
    if (!selectedBooking) return;

    const docStatus =
      editIdDocumentUrl || editIdNumber
        ? selectedBooking.documentStatus === 'verified'
          ? 'verified'
          : 'submitted'
        : selectedBooking.documentStatus || 'pending';

    const guestUpdates = {
      fullName: editName.trim(),
      phone: editPhone.trim(),
      email: editEmail.trim() || undefined,
      city: editCity.trim() || undefined,
      address: editAddress.trim() || undefined,
      nationality: editNationality || 'Indian',
      idType: editIdType,
      idNumber: editIdNumber.trim() || undefined,
      idDocumentUrl: editIdDocumentUrl || undefined,
      idDocumentBackUrl: editIdDocumentBackUrl || undefined,
      dietaryPreferences: editDietary.trim() || undefined,
      hospitalityPreferences: editHospitality.trim() || undefined,
      documentStatus: docStatus,
    };

    updateBookingGuestDetails(selectedBooking.id, guestUpdates, {
      specialRequests: editSpecialRequests.trim() || undefined,
    });

    // Update local copy
    setSelectedBooking({
      ...selectedBooking,
      specialRequests: editSpecialRequests.trim() || undefined,
      documentStatus: docStatus,
      guest: {
        ...selectedBooking.guest,
        ...guestUpdates,
      },
    });

    setIsEditingGuest(false);
  };

  const getShareableCheckinUrl = (bookingId: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/checkin?booking=${bookingId}`;
    }
    return `/checkin?booking=${bookingId}`;
  };

  const handleCopyShareableLink = (bookingId: string) => {
    const url = getShareableCheckinUrl(bookingId);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      showToast('Check-in & document upload link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleShareWhatsApp = (booking: CRMBooking) => {
    const url = getShareableCheckinUrl(booking.id);
    const cleanPhone = (booking.guest.whatsappNumber || booking.guest.phone).replace(/[^0-9]/g, '');
    const message = encodeURIComponent(
      `Namaste ${booking.guest.fullName}! 🌿\n\nGreetings from Savera Homestay. We look forward to hosting you in ${booking.roomName} (${booking.checkInDate} to ${booking.checkOutDate}).\n\nTo ensure a seamless contactless check-in, please verify your details and upload your government ID document at this secure link:\n${url}\n\nWarm regards,\nSavera Homestay Team`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const handleDrawerFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    isFront: boolean
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file too large (maximum 5MB)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (isFront) {
        setEditIdDocumentUrl(dataUrl);
      } else {
        setEditIdDocumentBackUrl(dataUrl);
      }
      showToast(`${isFront ? 'Front' : 'Back'} ID document photo uploaded`);
    };
    reader.readAsDataURL(file);
  };

  // Status badge styling helper
  const getStatusStyle = (status: RoomTapeStatus) => {
    switch (status) {
      case 'hold':
        return {
          bg: 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200',
          badge: 'bg-amber-500 text-forest-950',
          dot: 'bg-amber-500',
          label: 'Hold (Tentative)',
        };
      case 'confirmed':
        return {
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200',
          badge: 'bg-emerald-600 text-white',
          dot: 'bg-emerald-500',
          label: 'Confirmed / Paid',
        };
      case 'checked_in':
        return {
          bg: 'bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200',
          badge: 'bg-blue-600 text-white',
          dot: 'bg-blue-500',
          label: 'Checked-In (In House)',
        };
      case 'maintenance':
        return {
          bg: 'bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200',
          badge: 'bg-rose-600 text-white',
          dot: 'bg-rose-500',
          label: 'Under Maintenance',
        };
      default:
        return {
          bg: 'bg-sand-50 text-forest-800 border-sand-200 hover:bg-white',
          badge: 'bg-gray-400 text-white',
          dot: 'bg-gray-400',
          label: 'Available',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Tape Chart Header & Filters */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-sand-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-2xl bg-forest-900 text-sand-200 flex items-center justify-center shadow-xs">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-xl text-forest-950">
                  The Tape Chart (Core Homestay CRM)
                </h2>
                <p className="text-xs text-forest-700">
                  Multi-room timeline view across 7 physical rooms & 3 categories.
                </p>
              </div>
            </div>
          </div>

          {/* Controls: Range navigation & Legend */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter */}
            <div className="flex items-center space-x-1.5 bg-sand-100/80 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setFilterCategory('all')}
                className={`min-h-[36px] px-3 py-1 rounded-lg transition-all ${
                  filterCategory === 'all'
                    ? 'bg-forest-900 text-white shadow-xs'
                    : 'text-forest-700 hover:text-forest-950'
                }`}
              >
                All 7 Rooms
              </button>
              <button
                onClick={() => setFilterCategory('deluxe_mountain')}
                className={`min-h-[36px] px-3 py-1 rounded-lg transition-all ${
                  filterCategory === 'deluxe_mountain'
                    ? 'bg-forest-900 text-white shadow-xs'
                    : 'text-forest-700 hover:text-forest-950'
                }`}
              >
                Deluxe Mtn Balcony (3)
              </button>
              <button
                onClick={() => setFilterCategory('deluxe_forest')}
                className={`min-h-[36px] px-3 py-1 rounded-lg transition-all ${
                  filterCategory === 'deluxe_forest'
                    ? 'bg-forest-900 text-white shadow-xs'
                    : 'text-forest-700 hover:text-forest-950'
                }`}
              >
                Deluxe Forest Balcony (1)
              </button>
              <button
                onClick={() => setFilterCategory('premium_suite')}
                className={`min-h-[36px] px-3 py-1 rounded-lg transition-all ${
                  filterCategory === 'premium_suite'
                    ? 'bg-forest-900 text-white shadow-xs'
                    : 'text-forest-700 hover:text-forest-950'
                }`}
              >
                Premium Suites (3)
              </button>
            </div>

            {/* Date Navigator */}
            <div className="flex items-center space-x-1 bg-sand-100/80 p-1 rounded-xl">
              <button
                onClick={handlePrevDay}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center p-1.5 rounded-lg text-forest-800 hover:bg-white transition-colors"
                title="Shift 3 days earlier"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleToday}
                className="min-h-[36px] px-3 py-1 text-xs font-bold rounded-lg hover:bg-white text-forest-900 transition-colors cursor-pointer"
                title="Jump to today"
              >
                Today
              </button>
              <button
                onClick={handleNextDay}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center p-1.5 rounded-lg text-forest-800 hover:bg-white transition-colors"
                title="Shift 3 days later"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* New Manual Reservation CTA */}
            <button
              onClick={() => {
                setManualBookingDefaultRoomId('');
                setManualBookingDefaultDate(formatDateKey(baseDate));
                setIsManualBookingModalOpen(true);
              }}
              className="min-h-[38px] px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-forest-950 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Manual Reservation</span>
            </button>
          </div>
        </div>

        {/* Color Legend Bar */}
        <div className="mt-4 pt-4 border-t border-sand-200 flex flex-wrap items-center gap-4 text-xs">
          <span className="text-[11px] uppercase tracking-wider text-forest-600 font-bold">
            Tape Statuses:
          </span>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-md bg-amber-400" />
            <span className="font-medium text-forest-900">Hold (Tentative)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-md bg-emerald-500" />
            <span className="font-medium text-forest-900">Confirmed / Paid</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-md bg-blue-500" />
            <span className="font-medium text-forest-900">Checked-In (Active Concierge)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-md bg-rose-500" />
            <span className="font-medium text-forest-900">Under Maintenance</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-md bg-sand-200 border border-sand-300" />
            <span className="font-medium text-forest-700">Available</span>
          </div>
        </div>
      </div>

      {/* Visual Tape Chart Grid */}
      <div className="bg-white rounded-3xl shadow-sm border border-sand-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left min-w-[950px]">
            {/* Table Header: Dates (X-axis) */}
            <thead>
              <tr className="bg-forest-900 text-white border-b border-forest-800">
                <th className="sticky left-0 z-20 bg-forest-900 px-4 py-3.5 w-64 text-xs font-serif font-bold tracking-wide border-r border-forest-800">
                  Physical Room & Category
                </th>
                {dateColumns.map((d, i) => {
                  const dateKey = formatDateKey(d);
                  const isToday = dateKey === formatDateKey(new Date());
                  return (
                    <th
                      key={i}
                      className={`px-2.5 py-3 text-center text-xs font-semibold border-r border-forest-800/60 transition-colors ${
                        isToday ? 'bg-forest-800 text-amber-300 font-bold' : ''
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-wider text-sand-300">
                        {d.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="text-sm font-mono mt-0.5">
                        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      {isToday && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-amber-400 text-forest-950 text-[9px] font-extrabold rounded-full">
                          TODAY
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body: 7 Rooms (Y-axis) */}
            <tbody className="divide-y divide-sand-200">
              {filteredRooms.map((room) => {
                return (
                  <tr key={room.id} className="hover:bg-sand-50/50 transition-colors group">
                    {/* Sticky Room Label */}
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-sand-50/90 px-4 py-3.5 border-r border-sand-200 shadow-xs">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-md bg-forest-100 text-forest-900 text-xs font-mono font-bold flex items-center justify-center">
                              {room.roomNumber}
                            </span>
                            <span className="font-serif font-bold text-xs text-forest-950">
                              {room.name.split(' - ')[1] || room.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-forest-600 block mt-0.5">
                            {room.categoryName} • Fl {room.floorLevel}
                          </span>
                        </div>

                        {/* Room Status Indicator Dropdown */}
                        <select
                          value={room.currentStatus}
                          onChange={(e) => updateRoomStatus(room.id, e.target.value as RoomTapeStatus)}
                          className="text-[10px] font-bold uppercase rounded-lg border border-sand-300 bg-sand-50 text-forest-800 py-1 px-1.5 focus:ring-1 focus:ring-forest-700"
                        >
                          <option value="available">Available</option>
                          <option value="checked_in">Checked-In</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="hold">Hold</option>
                          <option value="maintenance">Maintenance</option>
                        </select>
                      </div>
                    </td>

                    {/* Date Cells */}
                    {dateColumns.map((d, dIdx) => {
                      const dateKey = formatDateKey(d);
                      const booking = getBookingForRoomDate(room.id, dateKey);
                      const isMaintenance = room.currentStatus === 'maintenance';

                      if (isMaintenance) {
                        return (
                          <td
                            key={dIdx}
                            className="px-1 py-1.5 border-r border-sand-200 text-center bg-rose-50/80"
                          >
                            <div className="h-12 rounded-xl bg-rose-100/90 border border-rose-300 flex flex-col items-center justify-center p-1 text-[10px] text-rose-800">
                              <span className="font-bold">Maintenance</span>
                              <span className="text-[9px] text-rose-600">Geyser Repair</span>
                            </div>
                          </td>
                        );
                      }

                      if (booking) {
                        const style = getStatusStyle(booking.tapeStatus);
                        const isStart = booking.checkInDate === dateKey;
                        const isEnd = booking.checkOutDate === dateKey;

                        return (
                          <td
                            key={dIdx}
                            className="px-1 py-1.5 border-r border-sand-200"
                          >
                            <button
                              onClick={() => openGuestDrawer(booking)}
                              className={`w-full h-12 rounded-xl p-1.5 text-left border shadow-xs transition-all flex flex-col justify-between overflow-hidden cursor-pointer ${style.bg}`}
                              title={`Click to inspect ${booking.guest.fullName}'s stay & folio`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[11px] truncate leading-tight">
                                  {booking.guest.fullName.split(' ')[0]}
                                </span>
                                <span className={`text-[9px] font-mono px-1 py-0.2 rounded font-extrabold ${style.badge}`}>
                                  {booking.mealPlan}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-forest-700">
                                <span className="text-[9px] opacity-80">
                                  {isStart ? '↳ In' : isEnd ? 'Out ↵' : 'Stay'}
                                </span>
                                <span className="text-[9px] font-mono font-medium">
                                  ₹{booking.roomRatePerNight}
                                </span>
                              </div>
                            </button>
                          </td>
                        );
                      }

                      // Empty available cell
                      return (
                        <td
                          key={dIdx}
                          className="px-1 py-1.5 border-r border-sand-200 text-center"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setManualBookingDefaultRoomId(room.id);
                              setManualBookingDefaultDate(dateKey);
                              setIsManualBookingModalOpen(true);
                            }}
                            className="w-full h-12 rounded-xl border border-dashed border-sand-300/90 hover:border-amber-600 hover:bg-amber-50/50 transition-all flex flex-col items-center justify-center cursor-pointer text-[10px] text-forest-600 hover:text-amber-900 group"
                            title={`Click to manually book Room ${room.roomNumber} on ${dateKey}`}
                          >
                            <Plus className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all text-amber-700" />
                            <span className="text-[9px] font-bold opacity-60 group-hover:opacity-100">Assign</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Guest Drawer / Profile & Preferences Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div
            className="w-full max-w-xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right duration-200"
          >
            {/* Drawer Header */}
            <div className="sticky top-0 z-10 bg-forest-900 text-white p-5 flex items-center justify-between border-b border-forest-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-forest-800 flex items-center justify-center border border-forest-700">
                  <User className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-white">
                    {selectedBooking.guest.fullName}
                  </h3>
                  <span className="text-xs text-sand-300">
                    Booking #{selectedBooking.bookingReference} • {selectedBooking.roomName}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="min-h-[44px] min-w-[44px] p-2 rounded-xl hover:bg-forest-800 text-sand-300 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1 text-forest-950">
              {/* Check-In / Check-Out Quick Action Bar */}
              <div className="bg-sand-50 p-4 rounded-2xl border border-sand-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-forest-600 block">
                    Current Stay State
                  </span>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span
                      className={`inline-flex items-center space-x-1 text-xs font-extrabold px-2.5 py-1 rounded-full ${
                        selectedBooking.tapeStatus === 'checked_in'
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : selectedBooking.tapeStatus === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current" />
                      <span>{selectedBooking.tapeStatus.toUpperCase()}</span>
                    </span>
                    <span className="text-xs text-forest-700">
                      Meal Plan: <strong>{selectedBooking.mealPlan}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {selectedBooking.tapeStatus !== 'checked_in' ? (
                    <button
                      onClick={() => {
                        checkInRoom(selectedBooking.id);
                        setSelectedBooking({
                          ...selectedBooking,
                          tapeStatus: 'checked_in',
                          bookingStatus: 'checked_in',
                        });
                      }}
                      className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center space-x-1.5"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Check-In Guest</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        checkOutRoom(selectedBooking.id);
                        setSelectedBooking(null);
                      }}
                      className="min-h-[44px] px-4 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center space-x-1.5"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Check-Out Room</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Stay Dates & Tariff Card */}
              <div className="bg-white p-4 rounded-2xl border border-sand-200 text-xs space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-[10px] text-forest-600 uppercase font-bold block">
                      Check-In Date
                    </span>
                    <span className="font-bold text-forest-900">{selectedBooking.checkInDate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-forest-600 uppercase font-bold block">
                      Check-Out Date
                    </span>
                    <span className="font-bold text-forest-900">{selectedBooking.checkOutDate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-forest-600 uppercase font-bold block">
                      Total Nights
                    </span>
                    <span className="font-bold text-forest-900">{selectedBooking.totalNights} Nights</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-forest-600 uppercase font-bold block">
                      Tariff / Night
                    </span>
                    <div className="flex items-center space-x-1">
                      <span className="font-mono font-bold text-forest-900">
                        ₹{selectedBooking.roomRatePerNight.toLocaleString('en-IN')}
                      </span>
                      {selectedBooking.isManualRate && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                          Manual
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-sand-100 flex items-center justify-between text-xs">
                  <div className="text-forest-700">
                    Total Stay Amount:{' '}
                    <strong className="font-mono text-forest-950">
                      ₹{selectedBooking.totalRoomAmount.toLocaleString('en-IN')}
                    </strong>
                  </div>
                  {selectedBooking.advancePaid ? (
                    <div className="text-emerald-700 font-semibold">
                      Advance Paid:{' '}
                      <span className="font-mono font-bold">
                        ₹{selectedBooking.advancePaid.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ) : (
                    <span className="text-amber-700 text-[11px] font-medium">
                      No Advance Recorded
                    </span>
                  )}
                </div>
              </div>

              {/* Shareable Guest Check-In & Document Upload Link Box */}
              <div className="bg-gradient-to-br from-forest-900 via-forest-950 to-forest-900 text-white p-5 rounded-2xl border border-forest-800 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Share2 className="w-4 h-4 text-amber-300" />
                    <h4 className="font-serif font-bold text-sm text-white">
                      Guest Self Check-In &amp; Document Upload Link
                    </h4>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                      selectedBooking.documentStatus === 'verified'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                        : selectedBooking.documentStatus === 'submitted'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                    }`}
                  >
                    {selectedBooking.documentStatus === 'verified'
                      ? 'ID Verified ✓'
                      : selectedBooking.documentStatus === 'submitted'
                      ? 'Documents Submitted'
                      : 'Pending Guest Upload'}
                  </span>
                </div>

                <p className="text-xs text-sand-300 leading-relaxed">
                  Send this link to <strong className="text-white">{selectedBooking.guest.fullName}</strong>. They can verify their reservation, review their stay details, and upload front &amp; back photos of their government ID before arrival.
                </p>

                {/* Link Bar */}
                <div className="bg-white/10 p-2.5 rounded-xl border border-white/15 flex items-center justify-between gap-2">
                  <div className="font-mono text-[11px] text-amber-200 truncate select-all flex-1">
                    {getShareableCheckinUrl(selectedBooking.id)}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyShareableLink(selectedBooking.id)}
                    className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 active:scale-95 text-forest-950 font-bold text-xs flex items-center space-x-1 shrink-0 transition-all cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleShareWhatsApp(selectedBooking)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Send via WhatsApp</span>
                  </button>

                  <a
                    href={getShareableCheckinUrl(selectedBooking.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-sand-200 hover:text-white font-bold text-xs flex items-center space-x-1.5 transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Guest Portal</span>
                  </a>

                  {selectedBooking.documentStatus === 'submitted' && (
                    <button
                      type="button"
                      onClick={() => updateBookingDocumentStatus(selectedBooking.id, 'verified')}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-forest-950 font-bold text-xs flex items-center space-x-1.5 transition-all ml-auto cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve &amp; Verify ID</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Guest Profile & Government ID Verification Section */}
              <div className="bg-sand-50 p-5 rounded-2xl border border-sand-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-serif font-bold text-sm text-forest-900">
                      Guest Profile &amp; ID Documents
                    </h4>
                  </div>
                  {!isEditingGuest ? (
                    <button
                      onClick={() => setIsEditingGuest(true)}
                      className="text-xs text-forest-700 hover:text-forest-950 font-bold underline cursor-pointer"
                    >
                      Edit Profile &amp; Documents
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveGuest}
                      className="min-h-[36px] px-3.5 py-1.5 bg-forest-900 hover:bg-forest-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Save Changes
                    </button>
                  )}
                </div>

                {isEditingGuest ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-forest-800 block mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white text-forest-950"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-forest-800 block mb-1">
                          Phone / WhatsApp *
                        </label>
                        <input
                          type="text"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white text-forest-950"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-forest-800 block mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white text-forest-950"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-forest-800 block mb-1">
                          Nationality
                        </label>
                        <input
                          type="text"
                          value={editNationality}
                          onChange={(e) => setEditNationality(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white text-forest-950"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-forest-800 block mb-1">
                          City / State
                        </label>
                        <input
                          type="text"
                          value={editCity}
                          onChange={(e) => setEditCity(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white text-forest-950"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-forest-800 block mb-1">
                          Residential Address
                        </label>
                        <input
                          type="text"
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white text-forest-950"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-forest-800 block mb-1">
                          ID Document Type
                        </label>
                        <select
                          value={editIdType}
                          onChange={(e) => setEditIdType(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white font-medium text-forest-950"
                        >
                          <option value="Aadhaar Card">Aadhaar Card</option>
                          <option value="Passport & ILP">Passport &amp; Inner Line Permit</option>
                          <option value="Driver License">Driver License</option>
                          <option value="Voter ID Card">Voter ID Card</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-forest-800 block mb-1">
                          ID Document Number
                        </label>
                        <input
                          type="text"
                          value={editIdNumber}
                          onChange={(e) => setEditIdNumber(e.target.value)}
                          placeholder="e.g. 1234-5678-9012"
                          className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white font-mono text-forest-950"
                        />
                      </div>
                    </div>

                    {/* Photo Upload in Edit Mode */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="p-3 bg-white rounded-xl border border-sand-300 text-center">
                        <span className="text-[11px] font-bold text-forest-800 block mb-1.5">
                          Front ID Photo
                        </span>
                        {editIdDocumentUrl ? (
                          <div className="space-y-1.5">
                            <div className="w-full h-24 rounded-lg overflow-hidden bg-sand-100 border border-sand-200">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={editIdDocumentUrl} alt="Front ID" className="w-full h-full object-contain" />
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditIdDocumentUrl('')}
                              className="text-[10px] text-rose-600 font-bold hover:underline"
                            >
                              Remove Photo
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center p-3 cursor-pointer hover:bg-sand-50 rounded-lg">
                            <Upload className="w-5 h-5 text-forest-500 mb-1" />
                            <span className="text-xs font-bold text-forest-900">Upload Front</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleDrawerFileUpload(e, true)}
                            />
                          </label>
                        )}
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-sand-300 text-center">
                        <span className="text-[11px] font-bold text-forest-800 block mb-1.5">
                          Back ID Photo (Optional)
                        </span>
                        {editIdDocumentBackUrl ? (
                          <div className="space-y-1.5">
                            <div className="w-full h-24 rounded-lg overflow-hidden bg-sand-100 border border-sand-200">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={editIdDocumentBackUrl} alt="Back ID" className="w-full h-full object-contain" />
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditIdDocumentBackUrl('')}
                              className="text-[10px] text-rose-600 font-bold hover:underline"
                            >
                              Remove Photo
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center p-3 cursor-pointer hover:bg-sand-50 rounded-lg">
                            <Upload className="w-5 h-5 text-forest-500 mb-1" />
                            <span className="text-xs font-bold text-forest-900">Upload Back</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleDrawerFileUpload(e, false)}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-forest-600" />
                        <span className="font-medium">{selectedBooking.guest.phone}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-forest-600" />
                        <span className="font-medium">{selectedBooking.guest.email || 'No email provided'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-forest-600" />
                        <span>
                          {selectedBooking.guest.city || selectedBooking.guest.address
                            ? `${selectedBooking.guest.city || ''} ${selectedBooking.guest.address || ''}`
                            : 'No address logged'}
                        </span>
                      </div>
                      <div className="text-forest-700">
                        Nationality: <strong>{selectedBooking.guest.nationality || 'Indian'}</strong>
                      </div>
                      <div className="sm:col-span-2 text-forest-900 bg-white p-2.5 rounded-xl border border-sand-200">
                        <strong>{selectedBooking.guest.idType || 'Government ID'}:</strong>{' '}
                        <span className="font-mono font-bold">
                          {selectedBooking.guest.idNumber || 'Not provided yet'}
                        </span>
                      </div>
                    </div>

                    {/* ID Photos Previews */}
                    <div>
                      <span className="text-[11px] font-bold text-forest-800 uppercase block mb-2">
                        Government ID Document Photos
                      </span>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Front Thumbnail */}
                        <div className="bg-white p-2.5 rounded-xl border border-sand-200">
                          <span className="text-[10px] font-bold text-forest-600 block mb-1">
                            Front Page
                          </span>
                          {selectedBooking.guest.idDocumentUrl ? (
                            <div
                              onClick={() => setEnlargedImage(selectedBooking.guest.idDocumentUrl || null)}
                              className="w-full h-28 rounded-lg overflow-hidden bg-sand-100 border border-sand-200 relative group cursor-pointer"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={selectedBooking.guest.idDocumentUrl}
                                alt="Front ID"
                                className="w-full h-full object-contain"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                                <Eye className="w-4 h-4 mr-1" /> View Full
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-28 rounded-lg bg-sand-100 border border-dashed border-sand-300 flex flex-col items-center justify-center text-forest-500 text-[10px]">
                              <FileText className="w-5 h-5 mb-1" />
                              <span>No Front Image</span>
                            </div>
                          )}
                        </div>

                        {/* Back Thumbnail */}
                        <div className="bg-white p-2.5 rounded-xl border border-sand-200">
                          <span className="text-[10px] font-bold text-forest-600 block mb-1">
                            Back / Address Page
                          </span>
                          {selectedBooking.guest.idDocumentBackUrl ? (
                            <div
                              onClick={() => setEnlargedImage(selectedBooking.guest.idDocumentBackUrl || null)}
                              className="w-full h-28 rounded-lg overflow-hidden bg-sand-100 border border-sand-200 relative group cursor-pointer"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={selectedBooking.guest.idDocumentBackUrl}
                                alt="Back ID"
                                className="w-full h-full object-contain"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                                <Eye className="w-4 h-4 mr-1" /> View Full
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-28 rounded-lg bg-sand-100 border border-dashed border-sand-300 flex flex-col items-center justify-center text-forest-500 text-[10px]">
                              <FileText className="w-5 h-5 mb-1" />
                              <span>No Back Image</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Dietary & Hospitality Preferences */}
              <div className="bg-sand-50 p-5 rounded-2xl border border-sand-200 space-y-4">
                <div className="flex items-center space-x-2">
                  <Coffee className="w-4 h-4 text-amber-700" />
                  <h4 className="font-serif font-bold text-sm text-forest-900">
                    Dietary &amp; Hospitality Mandates
                  </h4>
                </div>

                {isEditingGuest ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-forest-800 block mb-1">
                        Dietary Preferences &amp; Allergies
                      </label>
                      <textarea
                        rows={2}
                        value={editDietary}
                        onChange={(e) => setEditDietary(e.target.value)}
                        placeholder="e.g., Strict Jain, Peanut Allergy, Vegan"
                        className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white text-forest-950"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-forest-800 block mb-1">
                        Hospitality &amp; Room Preferences
                      </label>
                      <textarea
                        rows={2}
                        value={editHospitality}
                        onChange={(e) => setEditHospitality(e.target.value)}
                        placeholder="e.g., Extra warm duvet, fireplace prepped at 6 PM"
                        className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white text-forest-950"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-forest-800 block mb-1">
                        Special Requests / Staff Notes
                      </label>
                      <textarea
                        rows={2}
                        value={editSpecialRequests}
                        onChange={(e) => setEditSpecialRequests(e.target.value)}
                        placeholder="e.g., Late arrival, manual discount agreed with guest"
                        className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white text-forest-950"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-sand-200">
                      <span className="text-[10px] uppercase font-bold text-terracotta-700 block mb-0.5">
                        Dietary Mandate (Sent to Kitchen):
                      </span>
                      <p className="text-forest-900 font-medium">
                        {selectedBooking.guest.dietaryPreferences || 'Standard mountain palate (No known allergies)'}
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-sand-200">
                      <span className="text-[10px] uppercase font-bold text-forest-700 block mb-0.5">
                        Hospitality &amp; Room Setup:
                      </span>
                      <p className="text-forest-900 font-medium">
                        {selectedBooking.guest.hospitalityPreferences || 'Standard room setup requested.'}
                      </p>
                    </div>

                    {selectedBooking.specialRequests && (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950">
                        <span className="text-[10px] uppercase font-bold text-amber-800 block mb-0.5">
                          Reservation Notes:
                        </span>
                        <p className="italic">&ldquo;{selectedBooking.specialRequests}&rdquo;</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-sand-100 border-t border-sand-200 flex items-center justify-between">
              <span className="text-xs text-forest-700 font-mono">
                Booking Reference: {selectedBooking.bookingReference}
              </span>
              <button
                onClick={() => setSelectedBooking(null)}
                className="min-h-[44px] px-5 py-2 bg-forest-900 text-white font-bold text-xs rounded-xl hover:bg-forest-800 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Photo Modal */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-white rounded-3xl p-2 overflow-hidden shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enlargedImage}
              alt="Government ID Full Preview"
              className="max-w-full max-h-[80vh] object-contain rounded-2xl mx-auto"
            />
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-forest-950/80 text-white flex items-center justify-center hover:bg-forest-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Manual Booking & Room Assignment Modal */}
      <ManualBookingModal
        isOpen={isManualBookingModalOpen}
        onClose={() => setIsManualBookingModalOpen(false)}
        defaultRoomId={manualBookingDefaultRoomId}
        defaultDate={manualBookingDefaultDate}
        onBookingCreated={(newBk) => {
          setSelectedBooking(newBk);
          openGuestDrawer(newBk);
        }}
      />
    </div>
  );
}
