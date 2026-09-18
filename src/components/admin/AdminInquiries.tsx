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
          <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3" />
            <span>Pending Action</span>
          </span>
        );
      case 'contacted':
        return (
          <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
            <CheckCircle2 className="w-3 h-3" />
            <span>Contacted</span>
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            <span>Converted to Booking</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
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
      <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search inquiries by guest name, phone, room, or message..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-sand-50/60 border border-sand-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white text-forest-950"
          />
        </div>

        <div className="flex items-center space-x-1.5 bg-sand-100 p-1 rounded-xl text-xs overflow-x-auto">
          {['all', 'pending', 'contacted', 'confirmed', 'cancelled'].map((tab) => (
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

      {/* Inquiries Cards List */}
      <div className="space-y-4">
        {filteredInquiries.map((inq) => {
          const cleanPhone = (inq.phone || '').replace(/[^0-9]/g, '');
          const currentNote = notesState[inq.id] !== undefined ? notesState[inq.id] : inq.internal_notes || '';
          const isNoteModified = notesState[inq.id] !== undefined && notesState[inq.id] !== (inq.internal_notes || '');

          const waReplyMessage = encodeURIComponent(
            `Namaste ${inq.guest_name}! Thank you for inquiring with Savera Homestay regarding ${
              inq.room_name ? inq.room_name : 'your mountain getaway'
            }${inq.check_in ? ` for dates ${inq.check_in} to ${inq.check_out}` : ''}. We would be thrilled to host you! How can we assist you with your booking?`
          );

          return (
            <div
              key={inq.id}
              className="bg-white rounded-2xl border border-sand-200 shadow-sm p-5 hover:border-sand-300 transition-all flex flex-col space-y-4"
            >
              {/* Row 1: Header info & Status */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-forest-100 text-forest-800 flex items-center justify-center font-bold text-xs shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-sm text-forest-950">
                      {inq.guest_name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>{inq.phone}</span>
                      {inq.email && <span>• {inq.email}</span>}
                      {inq.source && (
                        <span className="text-[10px] uppercase font-semibold text-gray-400 bg-sand-100 px-1.5 py-0.5 rounded">
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
                    className="bg-sand-50 border border-sand-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-forest-900 focus:ring-2 focus:ring-forest-600"
                  >
                    <option value="pending">Mark Pending</option>
                    <option value="contacted">Mark Contacted</option>
                    <option value="confirmed">Mark Confirmed</option>
                    <option value="cancelled">Mark Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Room requested & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-sand-50/70 p-3 rounded-xl border border-sand-200">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                    Interested Room
                  </span>
                  <span className="font-bold text-forest-950">
                    {inq.room_name || 'General Inquiry (Any Room)'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                    Proposed Dates
                  </span>
                  <span className="font-semibold text-forest-900 flex items-center space-x-1">
                    <Calendar className="w-3 h-3 text-forest-600" />
                    <span>
                      {inq.check_in && inq.check_out
                        ? `${inq.check_in} to ${inq.check_out}`
                        : 'Dates not specified'}
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                    Guests Count
                  </span>
                  <span className="font-semibold text-forest-900">
                    {inq.guests_count || 2} Guests
                  </span>
                </div>
              </div>

              {/* Row 3: Guest Message */}
              {inq.message && (
                <div className="p-3 bg-white rounded-xl border border-sand-200 text-xs text-forest-950">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">
                    Guest Message:
                  </span>
                  <p className="italic text-gray-700">&ldquo;{inq.message}&rdquo;</p>
                </div>
              )}

              {/* Row 4: Internal Notes & Quick Action buttons */}
              <div className="flex flex-col md:flex-row items-stretch md:items-end justify-between gap-4 pt-3 border-t border-sand-200">
                {/* Notes box */}
                <div className="flex-1 max-w-xl">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold uppercase text-forest-900 flex items-center space-x-1">
                      <FileText className="w-3 h-3 text-forest-600" />
                      <span>Internal Staff Notes</span>
                    </label>
                    {isNoteModified && (
                      <span className="text-[10px] text-amber-700 font-semibold animate-pulse">
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
                      placeholder="Add private staff note (e.g. offered 10% discount, flight lands at 3 PM)..."
                      className="flex-1 px-3 py-1.5 bg-sand-50 border border-sand-300 rounded-lg text-xs focus:ring-2 focus:ring-forest-600 focus:bg-white"
                    />
                    <button
                      type="button"
                      disabled={savingNoteId === inq.id}
                      onClick={() => handleSaveNotes(inq)}
                      className="px-3 py-1.5 bg-forest-800 hover:bg-forest-900 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-sm shrink-0"
                    >
                      <Save className="w-3 h-3 text-sand-300" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>

                {/* Direct Action buttons */}
                <div className="flex items-center space-x-2 shrink-0">
                  <a
                    href={`https://wa.me/${cleanPhone}?text=${waReplyMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-3.5 py-2 rounded-xl transition-colors shadow-sm"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                    <span>WhatsApp Guest</span>
                  </a>

                  <a
                    href={`tel:${cleanPhone}`}
                    className="inline-flex items-center space-x-1.5 text-xs font-semibold text-forest-800 bg-sand-100 hover:bg-sand-200 px-3 py-2 rounded-xl transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call</span>
                  </a>
                </div>
              </div>
            </div>
          );
        })}

        {filteredInquiries.length === 0 && (
          <div className="bg-white rounded-2xl border border-sand-200 p-12 text-center">
            <MessageSquare className="w-12 h-12 text-sand-300 mx-auto mb-3" />
            <h3 className="font-serif text-base font-bold text-forest-950">No inquiries found</h3>
            <p className="text-xs text-gray-500 mt-1">
              Check other status tabs or clear your search term.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
