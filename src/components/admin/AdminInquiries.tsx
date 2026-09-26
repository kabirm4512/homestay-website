'use client';

import { useState } from 'react';
import { Inquiry } from '@/types';
import {
  Search,
  MessageSquare,
  Phone,
  MessageCircle,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Save,
  User,
  Calendar
} from 'lucide-react';

interface AdminInquiriesProps {
  inquiries: Inquiry[];
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export default function AdminInquiries({
  inquiries,
  onRefresh,
  showToast,
}: AdminInquiriesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [notesState, setNotesState] = useState<{ [id: string]: string }>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Filter inquiries
  const filteredInquiries = inquiries.filter((inq) => {
    const matchesSearch =
      inq.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inq.phone.includes(searchTerm) ||
      (inq.email && inq.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inq.room_name && inq.room_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' ? true : inq.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handle status update
  const handleUpdateStatus = async (id: string, newStatus: Inquiry['status']) => {
    setUpdatingStatusId(id);
    try {
      const currentNotes = notesState[id] !== undefined ? notesState[id] : inquiries.find(i => i.id === id)?.internal_notes;
      const res = await fetch('/api/inquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: newStatus,
          internal_notes: currentNotes,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`Inquiry status set to ${newStatus}`);
        onRefresh();
      } else {
        showToast('Failed to update status', 'error');
      }
    } catch {
      showToast('Error updating status', 'error');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Handle internal notes save
  const handleSaveNotes = async (inq: Inquiry) => {
    setSavingNoteId(inq.id);
    const noteText = notesState[inq.id] !== undefined ? notesState[inq.id] : inq.internal_notes || '';
    try {
      const res = await fetch('/api/inquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: inq.id,
          status: inq.status,
          internal_notes: noteText,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Internal note saved successfully!');
        onRefresh();
      } else {
        showToast('Failed to save note', 'error');
      }
    } catch {
      showToast('Error saving note', 'error');
    } finally {
      setSavingNoteId(null);
    }
  };

  const getStatusBadge = (status: Inquiry['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center space-x-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#FAF3E0] text-[#8C6D1F] border border-[#E8D4A2]">
            <Clock className="w-3 h-3 text-[#C5A059]" />
            <span>Pending Action</span>
          </span>
        );
      case 'contacted':
        return (
          <span className="inline-flex items-center space-x-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#E8F2EC] text-[#1E3A2F] border border-[#C5DDCF]">
            <CheckCircle2 className="w-3 h-3 text-[#1E3A2F]" />
            <span>Contacted</span>
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center space-x-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#E8F5E9] text-[#1B5E20] border border-[#A5D6A7]">
            <CheckCircle2 className="w-3 h-3 text-[#1B5E20]" />
            <span>Converted to Booking</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center space-x-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#F5F5F5] text-[#616161] border border-[#E0E0E0]">
            <XCircle className="w-3 h-3" />
            <span>Closed / Cancelled</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search & Filter Header */}
      <div className="bg-[#FAF8F5] p-4 sm:p-5 rounded-2xl border border-[#E5DEC9] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#5C6D66] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search inquiries by guest name, phone, room, or message..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5DEC9] rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#142820] text-[#142820] placeholder:text-[#5C6D66]/70 shadow-2xs"
          />
        </div>

        <div className="flex items-center space-x-1 bg-[#EAE4D7] p-1 rounded-xl text-xs overflow-x-auto">
          {['all', 'pending', 'contacted', 'confirmed', 'cancelled'].map((tab) => {
            const count =
              tab === 'all'
                ? inquiries.length
                : inquiries.filter((i) => i.status === tab).length;
            const isActive = statusFilter === tab;

            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-all whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-[#142820] text-[#FAF8F5] shadow-xs'
                    : 'text-[#5C6D66] hover:text-[#142820] hover:bg-white/50'
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-[#C5A059] text-[#142820]' : 'bg-[#DCD4C1] text-[#142820]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inquiries Cards List */}
      <div className="space-y-4">
        {filteredInquiries.map((inq) => {
          const cleanPhone = (inq.phone || '').replace(/[^0-9]/g, '');
          const currentNote = notesState[inq.id] !== undefined ? notesState[inq.id] : inq.internal_notes || '';
          const isNoteModified = notesState[inq.id] !== undefined && notesState[inq.id] !== (inq.internal_notes || '');

          const waReplyMessage = encodeURIComponent(
            `Namaste ${inq.guest_name}! Warm greetings from Savera Homestay, Rishyap (Kalimpong).\n\nThank you for reaching out regarding ${
              inq.room_name ? inq.room_name : 'your mountain retreat'
            }${inq.check_in ? ` for dates ${inq.check_in} to ${inq.check_out}` : ''}.\n\nWe would be thrilled to host you overlooking the majestic Kanchenjunga peaks! How can we assist you with confirming your stay?`
          );

          const waQuoteMessage = encodeURIComponent(
            `Namaste ${inq.guest_name}! Here is our tariff quote for your stay at Savera Homestay, Rishyap:\n\n` +
            `🏡 Room: ${inq.room_name || 'Deluxe Mountain View Room'}\n` +
            `📅 Dates: ${inq.check_in && inq.check_out ? `${inq.check_in} to ${inq.check_out}` : 'Requested Dates'}\n` +
            `👥 Guests: ${inq.guests_count || 2} Guests\n` +
            `☕ Inclusions: Complimentary Organic Hill Breakfast & Wi-Fi\n` +
            `🏔️ Peak Facing View: 180° Panoramic Kanchenjunga Balcony\n\n` +
            `Would you like us to hold this room for you? We can send a secure reservation link right away.`
          );

          return (
            <div
              key={inq.id}
              className="bg-white rounded-2xl border border-[#E5DEC9] shadow-xs p-5 hover:border-[#142820]/30 transition-all flex flex-col space-y-4"
            >
              {/* Row 1: Header info & Status */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#142820] text-[#FAF8F5] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                    <User className="w-4 h-4 text-[#C5A059]" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-base text-[#142820]">
                      {inq.guest_name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C6D66]">
                      <span className="font-mono font-medium">{inq.phone}</span>
                      {inq.email && <span>• {inq.email}</span>}
                      {inq.source && (
                        <span className="text-[10px] uppercase font-bold text-[#142820] bg-[#FAF8F5] border border-[#E5DEC9] px-2 py-0.5 rounded-md">
                          {inq.source}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
                  {getStatusBadge(inq.status)}

                  <select
                    value={inq.status}
                    disabled={updatingStatusId === inq.id}
                    onChange={(e) =>
                      handleUpdateStatus(inq.id, e.target.value as Inquiry['status'])
                    }
                    className="bg-[#FAF8F5] border border-[#E5DEC9] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#142820] focus:ring-2 focus:ring-[#142820] cursor-pointer"
                  >
                    <option value="pending">Mark Pending</option>
                    <option value="contacted">Mark Contacted</option>
                    <option value="confirmed">Mark Confirmed</option>
                    <option value="cancelled">Mark Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Room requested & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E5DEC9]">
                <div>
                  <span className="text-[10px] text-[#5C6D66] uppercase font-bold tracking-wider block">
                    Interested Room
                  </span>
                  <span className="font-bold text-[#142820] text-xs sm:text-sm">
                    {inq.room_name || 'General Inquiry (Any Room)'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#5C6D66] uppercase font-bold tracking-wider block">
                    Proposed Dates
                  </span>
                  <span className="font-bold text-[#142820] flex items-center space-x-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-[#C85A32]" />
                    <span>
                      {inq.check_in && inq.check_out
                        ? `${inq.check_in} to ${inq.check_out}`
                        : 'Dates not specified'}
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#5C6D66] uppercase font-bold tracking-wider block">
                    Guests Count
                  </span>
                  <span className="font-bold text-[#142820] mt-0.5 block">
                    {inq.guests_count || 2} Guests
                  </span>
                </div>
              </div>

              {/* Row 3: Guest Message */}
              {inq.message && (
                <div className="p-3.5 bg-[#FAF8F5]/80 rounded-xl border border-[#E5DEC9] text-xs text-[#142820]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5C6D66] block mb-1">
                    Guest Message:
                  </span>
                  <p className="italic text-[#1E3A2F]">&ldquo;{inq.message}&rdquo;</p>
                </div>
              )}

              {/* Row 4: Internal Notes & Quick Action buttons */}
              <div className="flex flex-col md:flex-row items-stretch md:items-end justify-between gap-4 pt-3 border-t border-[#E5DEC9]">
                {/* Notes box */}
                <div className="flex-1 max-w-xl">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#142820] flex items-center space-x-1.5">
                      <FileText className="w-3 h-3 text-[#C85A32]" />
                      <span>Internal Staff Notes</span>
                    </label>
                    {isNoteModified && (
                      <span className="text-[10px] text-[#C85A32] font-bold animate-pulse">
                        Unsaved edits
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentNote}
                      onChange={(e) =>
                        setNotesState({ ...notesState, [inq.id]: e.target.value })
                      }
                      placeholder="Add private staff note (e.g. offered 10% discount, airport cab booked)..."
                      className="flex-1 px-3 py-2 bg-[#FAF8F5] border border-[#E5DEC9] rounded-xl text-xs focus:ring-2 focus:ring-[#142820] focus:bg-white text-[#142820]"
                    />
                    <button
                      type="button"
                      disabled={savingNoteId === inq.id}
                      onClick={() => handleSaveNotes(inq)}
                      className="px-3.5 py-2 bg-[#142820] hover:bg-[#1E3A2F] text-[#FAF8F5] rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs shrink-0 cursor-pointer transition-colors"
                    >
                      <Save className="w-3.5 h-3.5 text-[#C5A059]" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>

                {/* Direct Action buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <a
                    href={`https://wa.me/${cleanPhone}?text=${waReplyMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 text-xs font-bold text-white bg-[#1E3A2F] hover:bg-[#142820] px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>WhatsApp Guest</span>
                  </a>

                  <a
                    href={`https://wa.me/${cleanPhone}?text=${waQuoteMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 text-xs font-bold text-white bg-[#C85A32] hover:bg-[#B34D28] px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    <span>Send Tariff Quote</span>
                  </a>

                  <a
                    href={`tel:${cleanPhone}`}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#142820] bg-[#FAF8F5] hover:bg-[#EAE4D7] border border-[#E5DEC9] px-3 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#5C6D66]" />
                    <span>Call</span>
                  </a>
                </div>
              </div>
            </div>
          );
        })}

        {filteredInquiries.length === 0 && (
          <div className="bg-[#FAF8F5] rounded-2xl border border-[#E5DEC9] p-12 text-center">
            <MessageSquare className="w-12 h-12 text-[#5C6D66]/40 mx-auto mb-3" />
            <h3 className="font-serif text-base font-bold text-[#142820]">No inquiries found</h3>
            <p className="text-xs text-[#5C6D66] mt-1">
              Check other status tabs or clear your search term.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
