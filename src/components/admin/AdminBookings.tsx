'use client';

import { useState } from 'react';
import { Booking } from '@/types';
import {
  Search,
  Calendar,
  Phone,
  MessageCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  User,
  Eye,
  X
} from 'lucide-react';

interface AdminBookingsProps {
  bookings: Booking[];
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export default function AdminBookings({
  bookings,
  onRefresh,
  showToast,
}: AdminBookingsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Update Status via API
  const handleUpdateStatus = async (
    bookingId: string,
    newStatus: Booking['status'],
    newPayment?: Booking['payment_status']
  ) => {
    setUpdatingId(bookingId);
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: bookingId,
          status: newStatus,
          payment_status: newPayment,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`Booking updated to ${newStatus}`);
        onRefresh();
        if (selectedBooking && selectedBooking.id === bookingId) {
          setSelectedBooking({
            ...selectedBooking,
            status: newStatus,
            payment_status: newPayment || selectedBooking.payment_status,
          });
        }
      } else {
        showToast('Failed to update booking status', 'error');
      }
    } catch {
      showToast('Error updating booking', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.booking_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.phone.includes(searchTerm) ||
      b.room_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' ? true : b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            <span>Confirmed</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3" />
            <span>Pending Review</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
            <CheckCircle2 className="w-3 h-3" />
            <span>Completed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
            <XCircle className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return null;
    }
  };

  const getPaymentBadge = (payment: Booking['payment_status']) => {
    switch (payment) {
      case 'fully_paid':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Paid in Full</span>;
      case 'deposit_paid':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Deposit Paid</span>;
      case 'unpaid':
      default:
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Payment Pending</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header filter controls */}
      <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search bookings by guest name, phone, room, or reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-sand-50/60 border border-sand-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white text-forest-950"
          />
        </div>

        <div className="flex items-center space-x-1.5 bg-sand-100 p-1 rounded-xl text-xs overflow-x-auto">
          {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg font-medium capitalize transition-colors whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-white text-forest-900 shadow-sm'
                  : 'text-gray-600 hover:text-forest-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List / Table */}
      <div className="space-y-4">
        {filteredBookings.map((b) => {
          const cleanPhone = (b.phone || '').replace(/[^0-9]/g, '');
          const waMessage = encodeURIComponent(
            `Namaste ${b.guest_name}! Savera Homestay is confirming your reservation [${b.booking_reference}] for ${b.room_name} from ${b.check_in} to ${b.check_out}. Please let us know if you need any travel assistance!`
          );

          return (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-sand-200 shadow-sm p-5 hover:border-sand-300 transition-colors flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
            >
              {/* Left Details */}
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-forest-900 bg-sand-100 px-2 py-0.5 rounded border border-sand-300">
                    {b.booking_reference}
                  </span>
                  {getStatusBadge(b.status)}
                  {getPaymentBadge(b.payment_status)}
                </div>

                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-forest-100 text-forest-800 flex items-center justify-center font-bold text-xs">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-sm text-forest-950">
                      {b.guest_name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>{b.phone}</span>
                      {b.email && <span>• {b.email}</span>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-600 bg-sand-50/70 p-2.5 rounded-xl border border-sand-200">
                  <div>
                    <span className="text-[11px] text-gray-400 block uppercase">Room</span>
                    <span className="font-semibold text-forest-900">{b.room_name}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 block uppercase">Dates & Nights</span>
                    <span className="font-semibold text-forest-900">
                      {b.check_in} → {b.check_out} ({b.nights}N)
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 block uppercase">Total Amount</span>
                    <span className="font-serif font-bold text-forest-900 text-sm">
                      ₹{Number(b.total_price).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {b.special_requests && (
                  <p className="text-xs text-gray-600 italic bg-amber-50/60 p-2 rounded-lg border border-amber-100">
                    <strong>Note from guest:</strong> &ldquo;{b.special_requests}&rdquo;
                  </p>
                )}
              </div>

              {/* Right Action Controls */}
              <div className="w-full lg:w-auto flex flex-col sm:flex-row lg:flex-col items-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-sand-200 shrink-0">
                {/* Status selection buttons */}
                <div className="flex items-center space-x-1 text-xs">
                  <label className="text-[11px] text-gray-500 mr-1 hidden sm:inline">Status:</label>
                  <select
                    value={b.status}
                    disabled={updatingId === b.id}
                    onChange={(e) =>
                      handleUpdateStatus(b.id, e.target.value as Booking['status'])
                    }
                    className="bg-sand-50 border border-sand-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-forest-900 focus:ring-2 focus:ring-forest-600"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  <select
                    value={b.payment_status}
                    disabled={updatingId === b.id}
                    onChange={(e) =>
                      handleUpdateStatus(
                        b.id,
                        b.status,
                        e.target.value as Booking['payment_status']
                      )
                    }
                    className="bg-sand-50 border border-sand-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-forest-900 focus:ring-2 focus:ring-forest-600"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="deposit_paid">Deposit Paid</option>
                    <option value="fully_paid">Fully Paid</option>
                  </select>
                </div>

                {/* Direct Action buttons */}
                <div className="flex items-center space-x-2">
                  <a
                    href={`https://wa.me/${cleanPhone}?text=${waMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-xl transition-colors shadow-sm"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                    <span>WhatsApp</span>
                  </a>

                  <a
                    href={`tel:${cleanPhone}`}
                    className="inline-flex items-center space-x-1 text-xs font-semibold text-forest-800 bg-sand-100 hover:bg-sand-200 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call</span>
                  </a>

                  <button
                    onClick={() => setSelectedBooking(b)}
                    className="inline-flex items-center space-x-1 text-xs font-semibold text-forest-800 bg-sand-100 hover:bg-sand-200 px-2.5 py-1.5 rounded-xl transition-colors"
                    title="View details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredBookings.length === 0 && (
          <div className="bg-white rounded-2xl border border-sand-200 p-12 text-center">
            <Calendar className="w-12 h-12 text-sand-300 mx-auto mb-3" />
            <h3 className="font-serif text-base font-bold text-forest-950">No bookings match your criteria</h3>
            <p className="text-xs text-gray-500 mt-1">
              Check other status tabs or clear your search term.
            </p>
          </div>
        )}
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-sand-200 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-sand-200">
              <div>
                <span className="text-[11px] font-mono uppercase bg-sand-100 px-2 py-0.5 rounded text-forest-900">
                  {selectedBooking.booking_reference}
                </span>
                <h3 className="font-serif text-lg font-bold text-forest-950 mt-1">
                  Reservation Overview
                </h3>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-sand-50 rounded-xl border border-sand-200 space-y-1">
                <div className="font-bold text-forest-950 text-sm">{selectedBooking.guest_name}</div>
                <div className="text-gray-600">Phone: {selectedBooking.phone}</div>
                {selectedBooking.email && <div className="text-gray-600">Email: {selectedBooking.email}</div>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-sand-50 rounded-xl border border-sand-200">
                  <span className="text-gray-400 text-[10px] uppercase block">Room</span>
                  <span className="font-bold text-forest-900">{selectedBooking.room_name}</span>
                </div>
                <div className="p-3 bg-sand-50 rounded-xl border border-sand-200">
                  <span className="text-gray-400 text-[10px] uppercase block">Total Price</span>
                  <span className="font-serif font-bold text-forest-900 text-sm">
                    ₹{Number(selectedBooking.total_price).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-sand-50 rounded-xl border border-sand-200">
                <span className="text-gray-400 text-[10px] uppercase block">Stay Dates</span>
                <span className="font-semibold text-forest-900">
                  {selectedBooking.check_in} to {selectedBooking.check_out} ({selectedBooking.nights} nights)
                </span>
              </div>

              {selectedBooking.special_requests && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-amber-800 text-[10px] uppercase font-bold block">Special Request</span>
                  <p className="text-gray-700 mt-0.5">{selectedBooking.special_requests}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-sand-200 flex justify-end">
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-4 py-2 rounded-xl bg-forest-800 text-white font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
