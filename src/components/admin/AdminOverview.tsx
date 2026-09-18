'use client';

import { Room, Inquiry, Booking } from '@/types';
import {
  DollarSign,
  CalendarCheck,
  MessageSquareText,
  BedDouble,
  ArrowUpRight,
  Phone,
  MessageCircle,
  Plus,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';

interface AdminOverviewProps {
  rooms: Room[];
  inquiries: Inquiry[];
  bookings: Booking[];
  onNavigateTab: (tab: 'rooms' | 'bookings' | 'inquiries' | 'cms') => void;
  onOpenAddRoom: () => void;
}

export default function AdminOverview({
  rooms,
  inquiries,
  bookings,
  onNavigateTab,
  onOpenAddRoom,
}: AdminOverviewProps) {
  // Compute analytics
  const totalRevenue = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);

  const pendingInquiriesCount = inquiries.filter((i) => i.status === 'pending').length;
  const pendingBookingsCount = bookings.filter((b) => b.status === 'pending').length;
  const confirmedBookingsCount = bookings.filter((b) => b.status === 'confirmed').length;

  const totalInventory = rooms.reduce((sum, r) => sum + (Number(r.total_inventory) || 0), 0);
  const availableInventory = rooms.reduce((sum, r) => sum + (Number(r.available_inventory) || 0), 0);

  const recentInquiries = inquiries.slice(0, 4);
  const recentBookings = bookings.slice(0, 4);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 1. Stat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Confirmed Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              Confirmed Revenue
            </span>
            <div className="text-2xl font-serif font-bold text-forest-950">
              ₹{totalRevenue.toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-forest-700 font-medium mt-1 inline-flex items-center">
              {confirmedBookingsCount} confirmed bookings
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Customer Bookings */}
        <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              Total Bookings
            </span>
            <div className="text-2xl font-serif font-bold text-forest-950">
              {bookings.length}
            </div>
            <span className="text-[11px] text-terracotta-600 font-medium mt-1 inline-flex items-center">
              {pendingBookingsCount} awaiting confirmation
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-terracotta-50 text-terracotta-600 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Guest Inquiries */}
        <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              Incoming Inquiries
            </span>
            <div className="text-2xl font-serif font-bold text-forest-950">
              {inquiries.length}
            </div>
            <span className="text-[11px] text-amber-700 font-medium mt-1 inline-flex items-center">
              {pendingInquiriesCount} new / pending reply
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <MessageSquareText className="w-5 h-5" />
          </div>
        </div>

        {/* Room Inventory */}
        <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              Room Inventory
            </span>
            <div className="text-2xl font-serif font-bold text-forest-950">
              {availableInventory} / {totalInventory}
            </div>
            <span className="text-[11px] text-forest-700 font-medium mt-1 inline-flex items-center">
              {rooms.length} room categories configured
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center">
            <BedDouble className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. Quick Action Bar */}
      <div className="bg-gradient-to-r from-forest-800 to-forest-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-sand-300 text-xs uppercase tracking-widest font-semibold mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Homestay Administration Center</span>
          </div>
          <h2 className="text-lg font-serif font-bold">Quick Management Actions</h2>
          <p className="text-forest-200 text-xs mt-0.5">
            Manage your rooms, review customer reservations, or customize website content.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={onOpenAddRoom}
            className="flex items-center space-x-1.5 bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-transform hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Room</span>
          </button>
          <button
            onClick={() => onNavigateTab('inquiries')}
            className="flex items-center space-x-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors backdrop-blur-sm"
          >
            <MessageSquareText className="w-4 h-4 text-sand-300" />
            <span>Respond to Inquiries ({pendingInquiriesCount})</span>
          </button>
          <button
            onClick={() => onNavigateTab('cms')}
            className="flex items-center space-x-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors backdrop-blur-sm"
          >
            <Sliders className="w-4 h-4 text-sand-300" />
            <span>Edit Hero & CMS</span>
          </button>
        </div>
      </div>

      {/* 3. Recent Activity Grid (Recent Inquiries & Recent Bookings) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Inquiries Card */}
        <div className="bg-white rounded-2xl border border-sand-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-serif text-base font-bold text-forest-950">
                Recent Guest Inquiries
              </h3>
              <p className="text-xs text-gray-500">
                Potential guests waiting for response
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('inquiries')}
              className="text-xs font-semibold text-forest-700 hover:text-forest-900 flex items-center space-x-1"
            >
              <span>View all</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentInquiries.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              No inquiries received yet.
            </div>
          ) : (
            <div className="space-y-3.5">
              {recentInquiries.map((inq) => {
                const cleanPhone = (inq.phone || '').replace(/[^0-9]/g, '');
                const waText = encodeURIComponent(
                  `Hello ${inq.guest_name}, thank you for inquiring with Savera Homestay regarding ${inq.room_name || 'your stay'}. We'd love to host you!`
                );
                return (
                  <div
                    key={inq.id}
                    className="p-3.5 rounded-xl border border-sand-200 bg-sand-50/50 hover:bg-sand-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="font-semibold text-xs text-forest-950">
                          {inq.guest_name}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {inq.room_name || 'General Inquiry'} • {inq.guests_count} Guests
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          inq.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : inq.status === 'contacted'
                            ? 'bg-blue-100 text-blue-800'
                            : inq.status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {inq.status}
                      </span>
                    </div>

                    {inq.message && (
                      <p className="text-xs text-gray-600 line-clamp-1 italic mb-2.5">
                        &ldquo;{inq.message}&rdquo;
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-sand-200 text-xs">
                      <span className="text-[11px] text-gray-500">
                        {inq.check_in && inq.check_out
                          ? `${inq.check_in} → ${inq.check_out}`
                          : inq.phone}
                      </span>
                      <div className="flex items-center space-x-2">
                        <a
                          href={`https://wa.me/${cleanPhone}?text=${waText}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-1 rounded-md"
                          title="Reply on WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                        <a
                          href={`tel:${cleanPhone}`}
                          className="inline-flex items-center space-x-1 text-[11px] font-medium text-forest-700 hover:text-forest-900 bg-sand-200/60 px-2 py-1 rounded-md"
                          title="Call guest"
                        >
                          <Phone className="w-3 h-3" />
                          <span>Call</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Bookings Card */}
        <div className="bg-white rounded-2xl border border-sand-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-serif text-base font-bold text-forest-950">
                Recent Bookings
              </h3>
              <p className="text-xs text-gray-500">
                Confirmed and pending reservations
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('bookings')}
              className="text-xs font-semibold text-forest-700 hover:text-forest-900 flex items-center space-x-1"
            >
              <span>View all</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentBookings.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              No bookings recorded yet.
            </div>
          ) : (
            <div className="space-y-3.5">
              {recentBookings.map((b) => (
                <div
                  key={b.id}
                  className="p-3.5 rounded-xl border border-sand-200 bg-sand-50/50 hover:bg-sand-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-forest-950">
                          {b.guest_name}
                        </span>
                        <span className="text-[10px] font-mono bg-sand-200/70 text-forest-800 px-1.5 py-0.5 rounded">
                          {b.booking_reference}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {b.room_name} • {b.nights} {b.nights === 1 ? 'Night' : 'Nights'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-serif font-bold text-xs text-forest-900">
                        ₹{Number(b.total_price).toLocaleString('en-IN')}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          b.status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : b.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-sand-200 text-xs">
                    <span className="text-[11px] text-gray-500">
                      {b.check_in} → {b.check_out}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                        b.payment_status === 'fully_paid'
                          ? 'text-emerald-700 bg-emerald-50'
                          : b.payment_status === 'deposit_paid'
                          ? 'text-blue-700 bg-blue-50'
                          : 'text-amber-700 bg-amber-50'
                      }`}
                    >
                      Payment: {b.payment_status?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
