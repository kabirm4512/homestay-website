'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, PauseCircle, X } from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { addCalendarDays, nightsBetween, todayInIST } from '@/lib/tariff-calculator';
import { HOLD_DURATION_OPTIONS, roomBusyReason, roomViewLabel, validateHoldInput } from '@/lib/tape-rules';

/**
 * The tape chart's Hold flow: keep one or more rooms off sale for some nights — for a guest
 * who hasn't confirmed, or for repairs / owner use. A hold can release itself after some
 * hours, or last until released.
 */
export default function HoldModal({
  isOpen,
  onClose,
  prefill,
}: {
  isOpen: boolean;
  onClose: () => void;
  prefill?: { roomIds?: string[]; fromDate?: string };
}) {
  const { rooms, bookings, roomBlocks, addRoomHold, currentUser } = useCRM();
  const today = todayInIST();
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(addCalendarDays(today, 1));
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [reason, setReason] = useState('');
  const [release, setRelease] = useState<number | null>(24);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const start = prefill?.fromDate && prefill.fromDate >= today ? prefill.fromDate : today;
    setRoomIds(prefill?.roomIds || []);
    setFromDate(start);
    setToDate(addCalendarDays(start, 1));
    setGuestName('');
    setGuestPhone('');
    setReason('');
    setRelease(24);
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const sortedRooms = useMemo(() => [...rooms].sort((a, b) => a.roomNumber - b.roomNumber), [rooms]);
  const busy = useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const r of rooms) out[r.id] = toDate > fromDate ? roomBusyReason(r.id, fromDate, toDate, bookings, roomBlocks) : null;
    return out;
  }, [rooms, bookings, roomBlocks, fromDate, toDate]);
  const nights = Math.max(1, nightsBetween(fromDate, toDate) ?? 1);

  if (!isOpen) return null;

  const submit = async () => {
    const input = { roomIds, fromDate, toDate, reason: reason.trim() || undefined, guestName: guestName.trim() || undefined, guestPhone: guestPhone.trim() || undefined, releaseAfterHours: release };
    const err = validateHoldInput(input, { isAdmin: currentUser?.role === 'admin' }) || (roomIds.find((id) => busy[id]) ? `Room ${rooms.find((r) => r.id === roomIds.find((id) => busy[id]))?.roomNumber}: ${busy[roomIds.find((id) => busy[id]) as string]}` : null);
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    const saved = await addRoomHold(input);
    setSaving(false);
    if (saved) onClose();
  };

  const field = 'w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white';

  return (
    <div className="fixed inset-0 z-50 bg-forest-950/70 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Hold rooms">
        <div className="bg-amber-500 text-forest-950 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/30 flex items-center justify-center">
              <PauseCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg">Hold</h3>
              <p className="text-[11px]">Keep rooms off sale: a guest who hasn&apos;t confirmed, repairs or owner use.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-white/30 hover:bg-white/50 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-xs text-forest-950">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="font-bold block">First night</span>
              <input
                type="date"
                value={fromDate}
                min={currentUser?.role === 'admin' ? undefined : today}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  if (toDate <= e.target.value) setToDate(addCalendarDays(e.target.value, 1));
                }}
                className={field}
              />
            </label>
            <label className="space-y-1">
              <span className="font-bold block">Free again on</span>
              <input type="date" value={toDate} min={addCalendarDays(fromDate, 1)} onChange={(e) => setToDate(e.target.value)} className={field} />
            </label>
          </div>

          <div className="space-y-1.5">
            <span className="font-bold block">
              Rooms <span className="font-normal text-forest-600">({roomIds.length} selected · {nights} night{nights > 1 ? 's' : ''})</span>
            </span>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {sortedRooms.map((r) => {
                const selected = roomIds.includes(r.id);
                const reasonBusy = busy[r.id];
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={Boolean(reasonBusy) && !selected}
                    title={reasonBusy || roomViewLabel(r)}
                    onClick={() => {
                      setError(null);
                      setRoomIds((prev) => (prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id]));
                    }}
                    className={`min-h-[48px] rounded-xl border font-mono font-bold text-sm ${
                      selected ? 'bg-amber-500 border-amber-600 text-forest-950' : reasonBusy ? 'bg-sand-100 text-forest-400 border-sand-200 line-through cursor-not-allowed' : 'bg-white border-sand-300 hover:bg-amber-50'
                    }`}
                  >
                    {r.roomNumber}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Held for (guest name, optional)" className={field} />
            <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Guest mobile (optional)" inputMode="tel" className={field} />
          </div>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. awaiting advance / geyser repair / owner's family" className={field} />

          <div className="space-y-1.5">
            <span className="font-bold block">Release the hold</span>
            <div className="flex flex-wrap gap-2">
              {HOLD_DURATION_OPTIONS.map((h) => (
                <button key={h} type="button" onClick={() => setRelease(h)} className={`px-3 py-2 rounded-xl border font-bold ${release === h ? 'bg-forest-900 text-white border-forest-900' : 'border-sand-300'}`}>
                  after {h} h
                </button>
              ))}
              <button type="button" onClick={() => setRelease(null)} className={`px-3 py-2 rounded-xl border font-bold ${release === null ? 'bg-forest-900 text-white border-forest-900' : 'border-sand-300'}`}>
                Until I release it
              </button>
            </div>
            <p className="text-[11px] text-forest-600">
              {release === null ? 'Use this for repairs or owner use. The rooms stay off sale until someone releases the hold.' : `If nobody confirms it, the rooms go back on sale after ${release} hours.`}
            </p>
          </div>

          {error && (
            <p className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-rose-800 flex gap-1.5" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="border-t border-sand-200 px-5 py-3 flex justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-sand-300 font-bold text-xs">
            Cancel
          </button>
          <button type="button" disabled={saving} onClick={submit} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-forest-950 font-bold text-xs disabled:opacity-60">
            {saving ? 'Saving…' : `Hold ${roomIds.length > 1 ? `${roomIds.length} rooms` : roomIds.length === 1 ? `room ${rooms.find((r) => r.id === roomIds[0])?.roomNumber}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
