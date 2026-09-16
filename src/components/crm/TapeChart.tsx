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
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { CRMBooking, PhysicalRoom, RoomTapeStatus, MealPlan } from '@/types/crm';

export default function TapeChart() {
  const {
    rooms,
    bookings,
    updateRoomStatus,
    updateGuestPreferences,
    checkInRoom,
    checkOutRoom,
    showToast,
  } = useCRM();

  // Date range state: start date for the 10-day viewing window
  const [baseDate, setBaseDate] = useState<Date>(() => {
    // default around current time: Sept 14, 2026
    return new Date(2026, 8, 14); // Months are 0-indexed: 8 = September
  });

  const [selectedBooking, setSelectedBooking] = useState<CRMBooking | null>(null);
  const [isEditingGuest, setIsEditingGuest] = useState(false);
  const [editDietary, setEditDietary] = useState('');
  const [editHospitality, setEditHospitality] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editName, setEditName] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

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
    setBaseDate(new Date(2026, 8, 14));
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
    setEditDietary(booking.guest.dietaryPreferences || '');
    setEditHospitality(booking.guest.hospitalityPreferences || '');
    setIsEditingGuest(false);
  };

  const handleSaveGuest = () => {
    if (!selectedBooking) return;
    updateGuestPreferences(selectedBooking.guestId, {
      fullName: editName,
      phone: editPhone,
      dietaryPreferences: editDietary,
      hospitalityPreferences: editHospitality,
    });
    // Update local state copy
    setSelectedBooking({
      ...selectedBooking,
      guest: {
        ...selectedBooking.guest,
        fullName: editName,
        phone: editPhone,
        dietaryPreferences: editDietary,
        hospitalityPreferences: editHospitality,
      },
    });
    setIsEditingGuest(false);
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
                onClick={() => setFilterCategory('luxury_suite')}
                className={`min-h-[36px] px-3 py-1 rounded-lg transition-all ${
                  filterCategory === 'luxury_suite'
                    ? 'bg-forest-900 text-white shadow-xs'
                    : 'text-forest-700 hover:text-forest-950'
                }`}
              >
                Suites (2)
              </button>
              <button
                onClick={() => setFilterCategory('cottage')}
                className={`min-h-[36px] px-3 py-1 rounded-lg transition-all ${
                  filterCategory === 'cottage'
                    ? 'bg-forest-900 text-white shadow-xs'
                    : 'text-forest-700 hover:text-forest-950'
                }`}
              >
                Cottages (2)
              </button>
              <button
                onClick={() => setFilterCategory('deluxe_pine')}
                className={`min-h-[36px] px-3 py-1 rounded-lg transition-all ${
                  filterCategory === 'deluxe_pine'
                    ? 'bg-forest-900 text-white shadow-xs'
                    : 'text-forest-700 hover:text-forest-950'
                }`}
              >
                Deluxe Pine (3)
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
                className="min-h-[36px] px-2.5 py-1 text-xs font-bold rounded-lg hover:bg-white text-forest-900 transition-colors"
              >
                Mid-Sept 2026
              </button>
              <button
                onClick={handleNextDay}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center p-1.5 rounded-lg text-forest-800 hover:bg-white transition-colors"
                title="Shift 3 days later"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
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
                  const isToday = dateKey === '2026-09-16';
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
                      const isMaintenance = room.currentStatus === 'maintenance' && dateKey <= '2026-09-17';

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
                          <div
                            onClick={() =>
                              showToast(`Room ${room.roomNumber} is open on ${dateKey}. Ready to assign.`, 'info')
                            }
                            className="w-full h-12 rounded-xl border border-dashed border-sand-300/80 hover:border-forest-600 hover:bg-sand-50 transition-all flex items-center justify-center cursor-pointer text-[10px] text-sand-400 hover:text-forest-700"
                          >
                            <span>Open</span>
                          </div>
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-sand-200 text-xs">
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
                  <span className="font-mono font-bold text-forest-900">₹{selectedBooking.roomRatePerNight}</span>
                </div>
              </div>

              {/* Guest Profile & ID Preview Section */}
              <div className="bg-sand-50 p-5 rounded-2xl border border-sand-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-serif font-bold text-sm text-forest-900">
                      ID Document & Permit Verification
                    </h4>
                  </div>
                  {!isEditingGuest ? (
                    <button
                      onClick={() => setIsEditingGuest(true)}
                      className="text-xs text-forest-700 hover:text-forest-950 font-bold underline"
                    >
                      Edit Profile
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveGuest}
                      className="min-h-[36px] px-3 py-1 bg-forest-900 hover:bg-forest-800 text-white rounded-lg text-xs font-bold"
                    >
                      Save Changes
                    </button>
                  )}
                </div>

                {isEditingGuest ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-forest-800 block mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-forest-800 block mb-1">
                        Phone / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-forest-600" />
                      <span>{selectedBooking.guest.phone}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-forest-600" />
                      <span>{selectedBooking.guest.email || 'No email provided'}</span>
                    </div>
                    <div className="sm:col-span-2 text-forest-700">
                      <strong>ID Type:</strong> {selectedBooking.guest.idType || 'Aadhaar / Passport'} ({selectedBooking.guest.idNumber || 'Verified on arrival'})
                    </div>
                  </div>
                )}

                {/* ID / Permit Photo Upload Preview */}
                <div>
                  <span className="text-[11px] font-bold text-forest-800 uppercase block mb-2">
                    ID / Permit Photo Preview
                  </span>
                  <div className="flex items-center space-x-4">
                    <div className="w-32 h-24 rounded-xl overflow-hidden border-2 border-forest-200 bg-sand-200 shadow-inner relative shrink-0">
                      {selectedBooking.guest.idDocumentUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={selectedBooking.guest.idDocumentUrl}
                          alt="Government ID Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-forest-500 text-[10px]">
                          <FileText className="w-5 h-5 mb-1" />
                          <span>No Image</span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-forest-700 space-y-1">
                      <p className="font-semibold">Verification Status: Verified ✓</p>
                      <p className="text-[11px] text-gray-500">
                        {selectedBooking.guest.totalLifetimeStays > 1
                          ? `Repeat Guest (${selectedBooking.guest.totalLifetimeStays} stays on estate)`
                          : 'First-time mountain visitor'}
                      </p>
                      <label className="inline-block cursor-pointer text-forest-800 hover:text-forest-950 underline text-[11px] font-bold">
                        Replace / Upload ID Photo
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={() => showToast('New ID document photo uploaded and stored successfully.')}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dietary & Hospitality Preferences */}
              <div className="bg-sand-50 p-5 rounded-2xl border border-sand-200 space-y-4">
                <div className="flex items-center space-x-2">
                  <Coffee className="w-4 h-4 text-amber-700" />
                  <h4 className="font-serif font-bold text-sm text-forest-900">
                    Dietary & Hospitality Mandates
                  </h4>
                </div>

                {isEditingGuest ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-forest-800 block mb-1">
                        Dietary Preferences & Allergies
                      </label>
                      <textarea
                        rows={2}
                        value={editDietary}
                        onChange={(e) => setEditDietary(e.target.value)}
                        placeholder="e.g., Strict Jain, Peanut Allergy, Vegan"
                        className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-forest-800 block mb-1">
                        Hospitality & Room Preferences
                      </label>
                      <textarea
                        rows={2}
                        value={editHospitality}
                        onChange={(e) => setEditHospitality(e.target.value)}
                        placeholder="e.g., Extra warm duvet, fireplace prepped at 6 PM"
                        className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white"
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
                        Hospitality & Room Setup:
                      </span>
                      <p className="text-forest-900 font-medium">
                        {selectedBooking.guest.hospitalityPreferences || 'Standard room setup requested.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Special Booking Note */}
              {selectedBooking.specialRequests && (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950">
                  <span className="text-[10px] font-bold uppercase tracking-wide block text-amber-800 mb-1">
                    Special Reservation Request:
                  </span>
                  <p className="italic">&ldquo;{selectedBooking.specialRequests}&rdquo;</p>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-sand-100 border-t border-sand-200 flex items-center justify-between">
              <span className="text-xs text-forest-700 font-mono">
                Folio ID: FOL-2026-{selectedBooking.roomNumber}01
              </span>
              <button
                onClick={() => setSelectedBooking(null)}
                className="min-h-[44px] px-5 py-2 bg-forest-900 text-white font-bold text-xs rounded-xl hover:bg-forest-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
