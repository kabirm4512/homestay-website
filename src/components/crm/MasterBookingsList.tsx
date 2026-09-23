'use client';

import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Search,
  Filter,
  User,
  BedDouble,
  Receipt,
  UtensilsCrossed,
  Sparkles,
  Truck,
  Car,
  AlertTriangle,
  CheckCircle2,
  LogIn,
  LogOut,
  Eye,
  FileText,
  Clock,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  ArrowUpDown,
  Plus,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { CRMBooking, GuestFolio } from '@/types/crm';
import GuestCheckoutModal from './GuestCheckoutModal';

interface MasterBookingsListProps {
  onOpenManualBooking?: () => void;
}

export default function MasterBookingsList({ onOpenManualBooking }: MasterBookingsListProps) {
  const {
    bookings,
    folios,
    foodOrders,
    dispatchRequests,
    checkInRoom,
    currentUser,
    showToast,
  } = useCRM();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_house' | 'arriving' | 'dues' | 'checked_out'>('all');
  const [selectedBookingForCheckout, setSelectedBookingForCheckout] = useState<CRMBooking | null>(null);
  const [inspectBooking, setInspectBooking] = useState<CRMBooking | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Compute stats across all bookings
  const stats = useMemo(() => {
    let inHouse = 0;
    let arriving = 0;
    let withDues = 0;
    let totalDuesAmount = 0;
    let checkedOut = 0;

    bookings.forEach((b) => {
      if (b.tapeStatus === 'checked_in') inHouse++;
      if (b.checkInDate === todayStr && b.tapeStatus !== 'checked_in') arriving++;
      if (b.bookingStatus === 'checked_out') checkedOut++;

      const fol = folios.find((f) => f.bookingId === b.id || f.roomNumber === b.roomNumber);
      const due = fol ? fol.balanceDue : Math.max(0, b.totalRoomAmount - (b.advancePaid || 0));
      if (due > 0 && b.bookingStatus !== 'checked_out') {
        withDues++;
        totalDuesAmount += due;
      }
    });

    return { inHouse, arriving, withDues, totalDuesAmount, checkedOut };
  }, [bookings, folios, todayStr]);

  // Filtered and searched list
  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        // Status filter
        if (statusFilter === 'in_house' && b.tapeStatus !== 'checked_in') return false;
        if (statusFilter === 'arriving' && b.checkInDate !== todayStr) return false;
        if (statusFilter === 'checked_out' && b.bookingStatus !== 'checked_out') return false;

        const fol = folios.find((f) => f.bookingId === b.id || f.roomNumber === b.roomNumber);
        const due = fol ? fol.balanceDue : Math.max(0, b.totalRoomAmount - (b.advancePaid || 0));
        if (statusFilter === 'dues' && due <= 0) return false;

        // Search query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          b.guest.fullName.toLowerCase().includes(q) ||
          b.guest.phone.includes(q) ||
          b.bookingReference.toLowerCase().includes(q) ||
          String(b.roomNumber).includes(q) ||
          b.roomName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // In-house first, then by check-in date
        if (a.tapeStatus === 'checked_in' && b.tapeStatus !== 'checked_in') return -1;
        if (b.tapeStatus === 'checked_in' && a.tapeStatus !== 'checked_in') return 1;
        return new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime();
      });
  }, [bookings, folios, statusFilter, searchQuery, todayStr]);

  // Helper for itemized breakdown
  const getBookingBreakdown = (booking: CRMBooking) => {
    const fol = folios.find((f) => f.bookingId === booking.id || f.roomNumber === booking.roomNumber);
    const relatedFood = foodOrders.filter(
      (o) => (o.bookingId === booking.id || o.roomNumber === booking.roomNumber) && o.status !== 'cancelled'
    );
    const relatedDispatches = dispatchRequests.filter(
      (d) => (d.bookingId === booking.id || d.roomNumber === booking.roomNumber) && d.dispatchStatus !== 'cancelled'
    );

    const roomCharges = fol ? fol.totalRoomCharges : booking.totalRoomAmount;
    const fbCharges = fol ? fol.totalFbCharges : relatedFood.reduce((s, o) => s + o.totalAmount, 0);
    const addonCharges = fol ? fol.totalAddonCharges : relatedDispatches.reduce((s, d) => s + d.quotedPrice, 0);
    const netTotal = fol ? fol.netPayable : roomCharges + fbCharges + addonCharges;
    const totalPaid = fol ? fol.totalPaid : booking.advancePaid || 0;
    const balanceDue = fol ? fol.balanceDue : Math.max(0, netTotal - totalPaid);

    return {
      folio: fol,
      roomCharges,
      fbCharges,
      addonCharges,
      netTotal,
      totalPaid,
      balanceDue,
      relatedFoodCount: relatedFood.length,
      relatedDispatchesCount: relatedDispatches.length,
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Stat Summary */}
      <div className="bg-gradient-to-r from-[#0B1733] via-[#12234D] to-[#25479E] text-white rounded-3xl p-6 shadow-md border border-[#1E2D4A]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-forest-950 flex items-center justify-center font-bold shadow-xs shrink-0">
              <CalendarDays className="w-7 h-7" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-xl text-white">
                Master Bookings &amp; Stays Roster
              </h2>
              <p className="text-xs text-sand-300">
                Detailed audit list with check-in/out dates, advance paid, due balance, food bills, transfers &amp; celebrations.
              </p>
            </div>
          </div>

          {onOpenManualBooking && (
            <button
              onClick={onOpenManualBooking}
              className="px-4 py-2 bg-gradient-to-r from-[#FE6E00] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] text-white font-bold text-xs rounded-xl shadow transition-all flex items-center space-x-1.5 self-start md:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Manual Booking</span>
            </button>
          )}
        </div>

        {/* 4 Summary Pill Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/15">
            <span className="text-[10px] uppercase font-bold text-sand-300 block">Total Stays</span>
            <span className="text-2xl font-serif font-bold text-white block mt-0.5">{bookings.length}</span>
            <span className="text-[11px] text-emerald-300 font-medium">All Reservations</span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/15">
            <span className="text-[10px] uppercase font-bold text-sand-300 block">Currently In-House</span>
            <span className="text-2xl font-serif font-bold text-amber-300 block mt-0.5">{stats.inHouse}</span>
            <span className="text-[11px] text-sand-300 font-medium">Active Room Keys</span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/15">
            <span className="text-[10px] uppercase font-bold text-sand-300 block">Arriving Today</span>
            <span className="text-2xl font-serif font-bold text-sky-300 block mt-0.5">{stats.arriving}</span>
            <span className="text-[11px] text-sand-300 font-medium">Expected Check-Ins</span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/15">
            <span className="text-[10px] uppercase font-bold text-sand-300 block">Outstanding Dues</span>
            <span className="text-2xl font-serif font-bold text-rose-300 block mt-0.5">
              ₹{stats.totalDuesAmount.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-rose-200 font-medium">Across {stats.withDues} stays</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-sand-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-forest-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by guest name, phone, room # or booking reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-sand-300 rounded-xl focus:ring-2 focus:ring-[#25479E] focus:outline-none bg-sand-50/50"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-forest-900 text-sand-100 shadow-xs'
                : 'bg-sand-100 text-forest-700 hover:bg-sand-200'
            }`}
          >
            All Bookings ({bookings.length})
          </button>

          <button
            onClick={() => setStatusFilter('in_house')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'in_house'
                ? 'bg-[#25479E] text-white shadow-xs'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            In-House ({stats.inHouse})
          </button>

          <button
            onClick={() => setStatusFilter('arriving')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'arriving'
                ? 'bg-amber-500 text-forest-950 shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Arriving Today ({stats.arriving})
          </button>

          <button
            onClick={() => setStatusFilter('dues')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'dues'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            Pending Dues ({stats.withDues})
          </button>

          <button
            onClick={() => setStatusFilter('checked_out')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'checked_out'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            Checked-Out ({stats.checkedOut})
          </button>
        </div>
      </div>

      {/* Master Bookings Cards / Table List */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-sand-200 text-center shadow-xs">
          <CalendarDays className="w-12 h-12 text-forest-300 mx-auto mb-3" />
          <h4 className="font-serif font-bold text-base text-forest-950">No reservations match this filter</h4>
          <p className="text-xs text-forest-600 mt-1">Try resetting the search query or selecting a different status filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((b) => {
            const breakdown = getBookingBreakdown(b);
            const isInHouse = b.tapeStatus === 'checked_in';
            const isCheckedOut = b.bookingStatus === 'checked_out';

            return (
              <div
                key={b.id}
                className={`bg-white rounded-3xl p-5 border transition-all shadow-xs flex flex-col justify-between ${
                  isInHouse
                    ? 'border-blue-400 ring-2 ring-blue-300/30 bg-gradient-to-r from-blue-50/20 via-white to-white'
                    : isCheckedOut
                    ? 'border-sand-200 opacity-85'
                    : 'border-sand-300 hover:border-sand-400'
                }`}
              >
                {/* Row 1: Header (Room, Booking Ref, Status, Dates) */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-sand-200">
                  <div className="flex items-center space-x-3">
                    <span className="w-10 h-10 rounded-2xl bg-[#0B1733] text-amber-300 font-serif font-bold text-sm flex items-center justify-center shrink-0">
                      R{b.roomNumber}
                    </span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-forest-950">{b.roomName}</span>
                        <span className="font-mono text-xs font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded border border-primary-200">
                          #{b.bookingReference}
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-sand-200 text-forest-800 px-1.5 py-0.2 rounded">
                          {b.mealPlan}
                        </span>
                      </div>
                      <span className="text-xs text-forest-600">
                        {b.totalNights} Nights • {b.checkInDate} to {b.checkOutDate} • {b.adultsCount} Adults
                        {(b.childrenCount || 0) > 0 ? `, ${b.childrenCount} Ch` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Status & Manager Attribution */}
                  <div className="flex items-center space-x-2 self-start lg:self-auto">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                        isInHouse
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : isCheckedOut
                          ? 'bg-sand-200 text-forest-700'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      }`}
                    >
                      {isInHouse ? '● In-House' : isCheckedOut ? 'Checked Out' : 'Confirmed'}
                    </span>

                    {/* Manager who checked in/out */}
                    {(b.checkedInByManagerName || b.checkedOutByManagerName) && (
                      <span className="text-[10px] text-forest-600 font-medium bg-sand-100 px-2 py-1 rounded-lg border border-sand-200 flex items-center space-x-1">
                        <UserCheck className="w-3 h-3 text-forest-500" />
                        <span>
                          {b.checkedOutByManagerName
                            ? `Out: ${b.checkedOutByManagerName}`
                            : `In: ${b.checkedInByManagerName}`}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2: Guest Details & Document Status */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3 text-xs border-b border-sand-100">
                  <div>
                    <span className="text-[10px] text-forest-500 uppercase font-bold block">Guest Profile</span>
                    <span className="font-bold text-forest-950 text-sm block">{b.guest.fullName}</span>
                    <span className="text-forest-600 font-mono">{b.guest.phone}</span>
                    {b.guest.email && <span className="text-forest-500 block truncate">{b.guest.email}</span>}
                  </div>

                  <div>
                    <span className="text-[10px] text-forest-500 uppercase font-bold block">Address &amp; ID Proof</span>
                    <span className="text-forest-800 font-medium block">
                      {b.guest.address ? `${b.guest.address}, ${b.guest.city || ''}` : 'Address pending digital check-in'}
                    </span>
                    <div className="flex items-center space-x-2 mt-1">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          b.guest.documentStatus === 'verified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.guest.documentStatus === 'submitted'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        ID: {b.guest.documentStatus || 'Pending'}
                      </span>
                      {b.guest.idDocumentUrl && (
                        <a
                          href={b.guest.idDocumentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-[#25479E] font-bold hover:underline flex items-center space-x-0.5"
                        >
                          <FileText className="w-3 h-3" />
                          <span>View ID</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-forest-500 uppercase font-bold block">Preferences &amp; Requests</span>
                    <span className="text-forest-800 block">
                      {b.guest.dietaryPreferences ? `Diet: ${b.guest.dietaryPreferences}` : 'Standard Menu'}
                    </span>
                    {b.specialRequests && (
                      <span className="text-amber-800 font-semibold block text-[11px] truncate">
                        Note: {b.specialRequests}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 3: Itemized Financial Breakdown Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 py-3">
                  {/* Room Tariff */}
                  <div className="bg-sand-50 p-2.5 rounded-xl border border-sand-200">
                    <span className="text-[10px] font-bold text-forest-600 block uppercase">Room Stay</span>
                    <span className="font-mono font-bold text-xs text-forest-950 block">
                      ₹{breakdown.roomCharges.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] text-forest-500">₹{b.roomRatePerNight}/night</span>
                  </div>

                  {/* Food & Dine-in QR */}
                  <div className="bg-sand-50 p-2.5 rounded-xl border border-sand-200">
                    <span className="text-[10px] font-bold text-forest-600 block uppercase flex items-center space-x-1">
                      <UtensilsCrossed className="w-3 h-3 text-amber-600" />
                      <span>Food &amp; Dining</span>
                    </span>
                    <span className="font-mono font-bold text-xs text-forest-950 block">
                      ₹{breakdown.fbCharges.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] text-forest-500">{breakdown.relatedFoodCount} orders logged</span>
                  </div>

                  {/* Celebrations & Transfers */}
                  <div className="bg-sand-50 p-2.5 rounded-xl border border-sand-200">
                    <span className="text-[10px] font-bold text-forest-600 block uppercase flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-[#FE6E00]" />
                      <span>Add-ons &amp; Cab</span>
                    </span>
                    <span className="font-mono font-bold text-xs text-forest-950 block">
                      ₹{breakdown.addonCharges.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] text-forest-500">{breakdown.relatedDispatchesCount} services</span>
                  </div>

                  {/* Advance & Paid */}
                  <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-800 block uppercase">Total Paid</span>
                    <span className="font-mono font-bold text-xs text-emerald-950 block">
                      ₹{breakdown.totalPaid.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] text-emerald-700">
                      {b.advancePaid ? `Adv: ₹${b.advancePaid}` : 'No advance'}
                    </span>
                  </div>

                  {/* Balance Due */}
                  <div
                    className={`p-2.5 rounded-xl border ${
                      breakdown.balanceDue > 0
                        ? 'bg-rose-50 border-rose-300 text-rose-950'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase block">Balance Due</span>
                    <span className="font-mono font-bold text-sm block">
                      ₹{breakdown.balanceDue.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] font-semibold">
                      {breakdown.balanceDue > 0 ? 'Pending Collection' : 'Fully Cleared ✓'}
                    </span>
                  </div>
                </div>

                {/* Row 4: Action Controls */}
                <div className="pt-3 border-t border-sand-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="text-forest-600 font-mono">
                    Net Bill: <strong className="text-forest-950 font-bold">₹{breakdown.netTotal.toLocaleString('en-IN')}</strong>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Check In Action if confirmed */}
                    {b.tapeStatus !== 'checked_in' && !isCheckedOut && (
                      <button
                        onClick={() => {
                          checkInRoom(b.id, {
                            id: currentUser?.id || 'staff-1',
                            name: currentUser?.fullName || 'Duty Manager',
                          });
                        }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#25479E] hover:bg-[#1A3478] text-white shadow-2xs transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Check-In Guest</span>
                      </button>
                    )}

                    {/* Review Folio & Checkout Action */}
                    {isInHouse && (
                      <button
                        onClick={() => setSelectedBookingForCheckout(b)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-2xs transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Review Bills &amp; Checkout</span>
                      </button>
                    )}

                    {/* Settle/Inspect Button for checked out or non-inhouse */}
                    <button
                      onClick={() => setSelectedBookingForCheckout(b)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-forest-700 bg-sand-100 hover:bg-sand-200 border border-sand-300 transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>{isCheckedOut ? 'View Settled Folio' : 'Inspect Folio'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Guest Checkout Modal Instance */}
      {selectedBookingForCheckout && (
        <GuestCheckoutModal
          isOpen={Boolean(selectedBookingForCheckout)}
          booking={selectedBookingForCheckout}
          onClose={() => setSelectedBookingForCheckout(null)}
        />
      )}
    </div>
  );
}
