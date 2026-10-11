'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, LogIn, Upload, X } from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import type { CRMBooking } from '@/types/crm';
import { readDocumentFile } from '@/lib/image-upload';
import { checkInProblem, hasGuestId } from '@/lib/tape-rules';

const ID_TYPES = ['Aadhaar Card', 'Passport', 'Driving Licence', 'Voter ID', 'PAN Card', 'Inner Line Permit', 'Other'];

/**
 * Check in an arriving pre-booking. For a group, every room of the group arriving today is
 * offered, so the whole party is checked in in one go. The guest's ID is required.
 */
export default function CheckInModal({ booking, onClose, onDone }: { booking: CRMBooking | null; onClose: () => void; onDone?: () => void }) {
  const { bookings, rooms, roomBlocks, checkInBooking, showToast } = useCRM();
  const [selected, setSelected] = useState<string[]>([]);
  const [idType, setIdType] = useState('Aadhaar Card');
  const [idNumber, setIdNumber] = useState('');
  const [idFront, setIdFront] = useState('');
  const [idBack, setIdBack] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);

  const party = useMemo(() => {
    if (!booking) return [];
    const list = booking.groupId ? bookings.filter((b) => b.groupId === booking.groupId && (b.bookingStatus === 'confirmed' || b.bookingStatus === 'hold')) : [booking];
    return [...list].sort((a, b) => a.roomNumber - b.roomNumber);
  }, [booking, bookings]);

  useEffect(() => {
    if (!booking) return;
    setIdType(booking.guest.idType || 'Aadhaar Card');
    setIdNumber(booking.guest.idNumber || '');
    setIdFront('');
    setIdBack('');
    setSaving(false);
    setFailed([]);
    setSelected(party.map((b) => b.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id]);

  if (!booking) return null;

  const problemFor = (b: CRMBooking) =>
    checkInProblem(
      { ...b, guest: { ...b.guest, idNumber: idNumber || b.guest.idNumber, idDocumentUrl: idFront || b.guest.idDocumentUrl } },
      { room: rooms.find((r) => r.id === b.roomId), bookings, blocks: roomBlocks }
    );
  const hasId = hasGuestId({ idNumber: idNumber || booking.guest.idNumber, idDocumentUrl: idFront || booking.guest.idDocumentUrl });

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>, set: (v: string) => void) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      set(await readDocumentFile(file));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not read this file', 'error');
    }
  };

  const submit = async () => {
    setSaving(true);
    const bad: string[] = [];
    for (const id of selected) {
      const b = party.find((x) => x.id === id);
      if (!b) continue;
      const ok = await checkInBooking(id, {
        idType,
        idNumber: idNumber.trim() || undefined,
        idDocumentUrl: idFront || undefined,
        idDocumentBackUrl: idBack || undefined,
      });
      if (!ok) bad.push(`Room ${b.roomNumber}`);
    }
    setSaving(false);
    setFailed(bad);
    if (bad.length === 0) {
      onDone?.();
      onClose();
    }
  };

  const field = 'w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white';
  const ready = selected.length > 0 && hasId && selected.every((id) => {
    const b = party.find((x) => x.id === id);
    return b && !problemFor(b);
  });

  return (
    <div className="fixed inset-0 z-[60] bg-forest-950/70 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Check in">
        <div className="bg-blue-700 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-serif font-bold text-lg flex items-center gap-2">
              <LogIn className="w-5 h-5" /> Check in {booking.guest.fullName}
            </h3>
            <p className="text-[11px] text-white/80">
              {booking.checkInDate} → {booking.checkOutDate}
              {party.length > 1 ? ` · group of ${party.length} rooms` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-xs text-forest-950">
          <div className="space-y-1.5">
            <span className="font-bold block">Rooms</span>
            {party.map((b) => {
              const p = problemFor(b);
              const blocking = p && p.code !== 'ID_REQUIRED';
              return (
                <label key={b.id} className={`flex items-start gap-2 p-2.5 rounded-xl border ${blocking ? 'border-rose-200 bg-rose-50' : 'border-sand-200'}`}>
                  <input
                    type="checkbox"
                    disabled={Boolean(blocking)}
                    checked={selected.includes(b.id) && !blocking}
                    onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, b.id] : prev.filter((x) => x !== b.id)))}
                    className="mt-0.5"
                  />
                  <span>
                    <strong className="font-mono">Room {b.roomNumber}</strong> · {b.adultsCount} adult{b.adultsCount > 1 ? 's' : ''}
                    {b.childrenCount ? `, ${b.childrenCount} child${b.childrenCount > 1 ? 'ren' : ''}` : ''} · {b.bookingReference}
                    {blocking && <span className="block text-rose-700">{p!.message}</span>}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3 space-y-2">
            <p className="font-bold">
              Guest ID {booking.guest.idDocumentUrl ? <span className="font-normal text-emerald-700">(photo on file)</span> : null}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <select value={idType} onChange={(e) => setIdType(e.target.value)} className={field}>
                {ID_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="ID number" className={field} />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: idFront ? 'Front photo ✓' : 'Photo of ID (front)', set: setIdFront },
                { label: idBack ? 'Back photo ✓' : 'Back (optional)', set: setIdBack },
              ].map((f) => (
                <label key={f.label} className="px-3 py-2 rounded-xl border border-dashed border-sand-400 bg-white font-semibold cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> {f.label}
                  <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => onFile(e, f.set)} />
                </label>
              ))}
            </div>
            {!hasId && <p className="text-blue-800">Add the ID number or a photo to check in.</p>}
          </div>

          {failed.length > 0 && (
            <p className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-rose-800 flex gap-1.5" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" /> Not checked in: {failed.join(', ')}. See the error message for the reason.
            </p>
          )}
        </div>

        <div className="border-t border-sand-200 px-5 py-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-sand-300 font-bold text-xs">
            Cancel
          </button>
          <button type="button" disabled={!ready || saving} onClick={submit} className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs disabled:opacity-50">
            {saving ? 'Checking in…' : `Check in ${selected.length > 1 ? `${selected.length} rooms` : 'room'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
