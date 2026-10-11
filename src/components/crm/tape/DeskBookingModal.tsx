'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BedDouble, Check, Copy, ExternalLink, FileText, LogIn, MessageSquare, Minus, Plus, Upload, X, CalendarCheck, AlertCircle } from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { useSiteContact } from '@/lib/contact';
import type { CRMBooking, MealPlan, PaymentMethod, RoomBlock } from '@/types/crm';
import { addCalendarDays, nightsBetween, todayInIST } from '@/lib/tariff-calculator';
import { calculateStayGst } from '@/lib/gst';
import { accommodationGstForTotal } from '@/lib/folio';
import { INDIAN_STATES } from '@/lib/booking-id';
import { readDocumentFile } from '@/lib/image-upload';
import { hasGuestId, newGroupId, roomBusyReason, roomViewLabel } from '@/lib/tape-rules';

export type DeskBookingMode = 'checkin' | 'prebook';

export interface DeskBookingPrefill {
  roomIds?: string[];
  checkInDate?: string;
  checkOutDate?: string;
  guestName?: string;
  guestPhone?: string;
  /** Holds these rooms come from: they count as free here and are used up on save. */
  fromHolds?: RoomBlock[];
}

interface RoomLine {
  roomId: string;
  adults: number;
  children: number;
  childAges: (number | null)[];
  manualRate: number | null;
}

const ID_TYPES = ['Aadhaar Card', 'Passport', 'Driving Licence', 'Voter ID', 'PAN Card', 'Inner Line Permit', 'Other'];

/**
 * The tape chart's Check in and Pre-book flows. Both take one guest and one or more rooms
 * (a group booking): one booking per room, linked by a group id, sharing the guest.
 * Check in is for arrivals today and needs the guest's ID; Pre-book is a confirmed
 * reservation for today or later.
 */
export default function DeskBookingModal({
  mode,
  isOpen,
  onClose,
  prefill,
}: {
  mode: DeskBookingMode;
  isOpen: boolean;
  onClose: () => void;
  prefill?: DeskBookingPrefill;
}) {
  const { rooms, bookings, roomBlocks, calculateDynamicTariff, createManualBooking, checkGroupRooms, getVoucherLink, showToast, gstConfig, currentUser, tariffsStatus } = useCRM();
  const siteContact = useSiteContact();
  const isManager = currentUser?.role === 'manager';
  const isCheckIn = mode === 'checkin';
  const today = todayInIST();

  const [checkInDate, setCheckInDate] = useState(today);
  const [checkOutDate, setCheckOutDate] = useState(addCalendarDays(today, 1));
  const [mealPlan, setMealPlan] = useState<MealPlan>('CP');
  const [lines, setLines] = useState<RoomLine[]>([]);
  const [useManualRate, setUseManualRate] = useState(false);

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestCity, setGuestCity] = useState('');
  const [guestState, setGuestState] = useState('West Bengal');
  const [nationality, setNationality] = useState('Indian');
  const [idType, setIdType] = useState('Aadhaar Card');
  const [idNumber, setIdNumber] = useState('');
  const [idFront, setIdFront] = useState('');
  const [idBack, setIdBack] = useState('');
  const [dietary, setDietary] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [staffNotes, setStaffNotes] = useState('');

  const [advancePaid, setAdvancePaid] = useState(0);
  const [advanceMethod, setAdvanceMethod] = useState<PaymentMethod>('upi');
  const [advanceSignOff, setAdvanceSignOff] = useState(false);

  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CRMBooking[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [voucherUrl, setVoucherUrl] = useState('');

  const fromHolds = useMemo(() => prefill?.fromHolds || [], [prefill]);
  const fromHoldIds = useMemo(() => fromHolds.map((h) => h.id), [fromHolds]);

  // Reset when opened
  useEffect(() => {
    if (!isOpen) return;
    const start = isCheckIn ? today : prefill?.checkInDate && prefill.checkInDate >= today ? prefill.checkInDate : prefill?.checkInDate || today;
    const end = prefill?.checkOutDate && prefill.checkOutDate > start ? prefill.checkOutDate : addCalendarDays(start, 1);
    setCheckInDate(start);
    setCheckOutDate(end);
    setMealPlan('CP');
    setLines((prefill?.roomIds || []).map((roomId) => ({ roomId, adults: 2, children: 0, childAges: [], manualRate: null })));
    setUseManualRate(false);
    setGuestName(prefill?.guestName || '');
    setGuestPhone(prefill?.guestPhone || '');
    setGuestEmail('');
    setGuestCity('');
    setGuestState('West Bengal');
    setNationality('Indian');
    setIdType('Aadhaar Card');
    setIdNumber('');
    setIdFront('');
    setIdBack('');
    setDietary('');
    setSpecialRequests('');
    setStaffNotes(fromHolds.length ? `From hold: ${fromHolds[0].reason}` : '');
    setAdvancePaid(0);
    setAdvanceMethod('upi');
    setAdvanceSignOff(false);
    setProblems([]);
    setSaving(false);
    setCreated(null);
    setCopied(false);
    setVoucherUrl('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode]);

  const nights = Math.max(1, nightsBetween(checkInDate, checkOutDate) ?? 1);
  const sortedRooms = useMemo(() => [...rooms].sort((a, b) => a.roomNumber - b.roomNumber), [rooms]);

  const busy = useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const r of rooms) {
      out[r.id] = checkOutDate > checkInDate ? roomBusyReason(r.id, checkInDate, checkOutDate, bookings, roomBlocks, { ignoreHoldIds: fromHoldIds }) : null;
      if (!out[r.id] && isCheckIn) {
        const inHouse = bookings.find((b) => b.roomId === r.id && b.bookingStatus === 'checked_in');
        if (inHouse) out[r.id] = `In-house: ${inHouse.guest.fullName} (due out ${inHouse.checkOutDate})`;
        else if (r.currentStatus === 'maintenance') out[r.id] = 'Out of service tonight';
      }
    }
    return out;
  }, [rooms, bookings, roomBlocks, checkInDate, checkOutDate, fromHoldIds, isCheckIn]);

  const toggleRoom = (roomId: string) => {
    setProblems([]);
    setLines((prev) => (prev.some((l) => l.roomId === roomId) ? prev.filter((l) => l.roomId !== roomId) : [...prev, { roomId, adults: 2, children: 0, childAges: [], manualRate: null }]));
  };
  const updateLine = (roomId: string, patch: Partial<RoomLine>) => setLines((prev) => prev.map((l) => (l.roomId === roomId ? { ...l, ...patch } : l)));

  // Price per room: the live tariff engine (same as the website), or a manual nightly rate.
  const priced = useMemo(
    () =>
      lines.map((l) => {
        const ages = l.childAges.slice(0, l.children);
        const knownAges = ages.length === l.children && ages.every((a) => typeof a === 'number') ? (ages as number[]) : undefined;
        let tariff = null;
        try {
          tariff = calculateDynamicTariff(l.roomId, checkInDate, checkOutDate, mealPlan, l.adults, l.children, knownAges);
        } catch {
          tariff = null;
        }
        const liveRate = tariff ? Math.round(tariff.baseAmount / Math.max(1, tariff.nights)) : null;
        const manual = useManualRate ? l.manualRate ?? liveRate ?? 0 : null;
        const total = manual !== null ? manual * nights + (tariff ? tariff.extraAdultsCharge + tariff.extraChildrenCharge : 0) : tariff?.totalAmount ?? 0;
        const gst = manual !== null ? accommodationGstForTotal(total, nights, gstConfig) : tariff ? calculateStayGst(tariff, gstConfig).gstAmount : 0;
        return { line: l, tariff, liveRate, rate: manual ?? liveRate ?? 0, total, gst, knownAges };
      }),
    [lines, checkInDate, checkOutDate, mealPlan, useManualRate, nights, gstConfig, calculateDynamicTariff]
  );
  const grandTotal = priced.reduce((s, p) => s + p.total + (gstConfig.tariffsIncludeGst ? 0 : p.gst), 0);

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

  const validate = (): string | null => {
    if (lines.length === 0) return 'Choose at least one room.';
    if (checkOutDate <= checkInDate) return 'Check-out must be after check-in.';
    if (isCheckIn && checkInDate !== today) return 'Check-in is for guests arriving today. Use Pre-book for a later date.';
    if (!isCheckIn && checkInDate < today && currentUser?.role !== 'admin') return 'A pre-booking cannot start in the past.';
    const taken = lines.find((l) => busy[l.roomId]);
    if (taken) return `Room ${rooms.find((r) => r.id === taken.roomId)?.roomNumber}: ${busy[taken.roomId]}.`;
    if (guestName.trim().length < 2) return 'Add the guest’s name.';
    if (guestPhone.replace(/\D/g, '').length < 10) return 'Add the guest’s mobile number (10 digits).';
    if (isCheckIn && !hasGuestId({ idNumber, idDocumentUrl: idFront })) return 'Check-in needs the guest’s ID number or a photo of their ID.';
    const unpriced = priced.find((p) => !p.tariff && !useManualRate);
    if (unpriced) {
      return tariffsStatus === 'ready'
        ? `No live tariff for room ${rooms.find((r) => r.id === unpriced.line.roomId)?.roomNumber} with this meal plan and occupancy. Tick "Manual rate".`
        : 'Live tariffs have not loaded yet. Wait a moment or tick "Manual rate".';
    }
    if (useManualRate && priced.some((p) => !(p.rate > 0))) return 'Enter a nightly rate for every room.';
    if (isManager && advancePaid > 0 && !advanceSignOff) return 'Tick the confirmation to sign the advance you received.';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setProblems([err]);
      return;
    }
    setSaving(true);
    setProblems([]);
    // A group is checked as a whole first, so it is never half booked. (One room needs no
    // pre-check: its save is checked by the server.) If the pre-check itself is unavailable,
    // the rooms are still saved one by one and each save is checked by the server.
    if (lines.length > 1) {
      const serverProblems = await checkGroupRooms({ roomIds: lines.map((l) => l.roomId), checkInDate, checkOutDate, fromHoldIds, checkInNow: isCheckIn });
      if (serverProblems === null) {
        setSaving(false);
        return;
      }
      if (serverProblems !== 'unavailable' && serverProblems.length > 0) {
        setProblems(serverProblems.map((p) => p.message));
        setSaving(false);
        return;
      }
    }

    const groupId = lines.length > 1 ? newGroupId() : undefined;
    const guestId = `guest-${newGroupId().slice(4)}`;
    const results: CRMBooking[] = [];
    priced.forEach((p, i) => {
      const hold = fromHolds.find((h) => h.roomId === p.line.roomId);
      const b = createManualBooking({
        roomId: p.line.roomId,
        checkInDate,
        checkOutDate,
        roomRatePerNight: p.rate,
        totalRoomAmount: p.total,
        mealPlan,
        adultsCount: p.line.adults,
        childrenCount: p.line.children,
        childAges: p.knownAges,
        pricedExtras: p.tariff
          ? {
              extraAdultsCount: p.tariff.extraAdultsCount,
              extraAdultsCharge: p.tariff.extraAdultsCharge,
              extraChildrenCount: p.tariff.extraChildrenCount,
              extraChildrenCharge: p.tariff.extraChildrenCharge,
            }
          : undefined,
        extraAdultChargePerNight: p.tariff?.extraAdultRate,
        extraChildChargePerNight: p.tariff?.extraChildRate,
        status: isCheckIn ? 'checked_in' : 'confirmed',
        specialRequests: specialRequests.trim() || undefined,
        notes: [staffNotes.trim(), groupId ? `Group of ${lines.length} rooms` : ''].filter(Boolean).join(' · ') || undefined,
        isManualRate: useManualRate,
        gstAmount: p.gst,
        // The advance is recorded once, on the first room's bill
        advancePaid: i === 0 && isManager && advancePaid > 0 ? advancePaid : undefined,
        advancePaymentMethod: i === 0 && isManager && advancePaid > 0 ? advanceMethod : undefined,
        advanceSignOffConfirmed: i === 0 && isManager && advancePaid > 0 ? advanceSignOff : undefined,
        deskFlow: isCheckIn ? 'walk_in' : 'pre_booking',
        groupId,
        groupSize: groupId ? lines.length : undefined,
        guestId,
        fromHoldBlockId: hold?.id,
        silent: true,
        guest: {
          fullName: guestName.trim(),
          phone: guestPhone.trim(),
          email: guestEmail.trim() || undefined,
          idType,
          idNumber: idNumber.trim() || undefined,
          // Each room's booking carries the lead guest's ID (check-in is per room)
          idDocumentUrl: idFront || undefined,
          idDocumentBackUrl: idBack || undefined,
          city: guestCity.trim() || undefined,
          state: guestState,
          nationality,
          dietaryPreferences: dietary.trim() || undefined,
        },
      });
      if (b) results.push(b);
    });
    setSaving(false);
    if (results.length === 0) return;
    setCreated(results);
    showToast(
      `${isCheckIn ? 'Checked in' : 'Pre-booked'} ${results.length} room${results.length > 1 ? 's' : ''} (${results.map((r) => r.roomNumber).join(', ')}) for ${guestName.trim()}.`
    );
  };

  // ---------------------------------------------------------------- handover
  // The server's copy (its booking reference is the one that counts); undefined = refused and undone.
  const live = useMemo(() => (created || []).map((c) => bookings.find((b) => b.id === c.id)), [created, bookings]);
  const refused = Boolean(created) && live.some((b) => !b);
  const shown = (created || []).map((c, i) => live[i] || c);
  const first = shown[0];

  // Booking voucher (pre-bookings): a shareable confirmation page for the guest
  useEffect(() => {
    if (!created || isCheckIn || voucherUrl) return;
    let cancelled = false;
    void getVoucherLink(created[0].id).then((url) => {
      if (!cancelled && url) setVoucherUrl(url);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created, isCheckIn]);

  const portalLink = useMemo(() => {
    if (!first) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/guest-portal?booking=${encodeURIComponent(first.bookingReference)}&phone=${encodeURIComponent(guestPhone.replace(/\D/g, '').slice(-10))}`;
  }, [first, guestPhone]);
  const message = useMemo(() => {
    if (!created) return '';
    const roomsText = shown.map((b) => `Room ${b.roomNumber}`).join(', ');
    const refs = Array.from(new Set(shown.map((b) => b.bookingReference))).join(', ');
    return isCheckIn
      ? `🌿 *Welcome to Savera Homestay!*\n\nDear ${guestName.trim()},\n\nYou are checked in to ${roomsText} (${checkInDate} → ${checkOutDate}).\nBooking ID: ${refs}\n\nYour guest portal (bill, in-room dining, requests):\n${portalLink}\n\n📞 Front desk: ${siteContact.frontDeskPhone}\n— Team Savera Homestay`
      : `🌿 *Savera Homestay – booking confirmed*\n\nDear ${guestName.trim()},\n\nYour stay is confirmed: ${roomsText}, ${checkInDate} → ${checkOutDate} (${nights} night${nights > 1 ? 's' : ''}, ${mealPlan}).\nBooking ID: ${refs}\nTotal: ₹${Math.round(grandTotal).toLocaleString('en-IN')}${advancePaid > 0 ? ` · Advance received: ₹${advancePaid.toLocaleString('en-IN')}` : ''}\n\n📄 *Your booking voucher:*\n${voucherUrl || '(preparing…)'}\n\nGuest portal (complete your check-in details before you arrive):\n${portalLink}\n\n📞 Front desk: ${siteContact.frontDeskPhone}\n— Team Savera Homestay`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created, live, isCheckIn, guestName, checkInDate, checkOutDate, portalLink, siteContact.frontDeskPhone, nights, mealPlan, grandTotal, advancePaid, voucherUrl]);

  if (!isOpen) return null;

  const title = isCheckIn ? 'Check in' : 'Pre-book';
  const Icon = isCheckIn ? LogIn : CalendarCheck;
  const field = 'w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white';

  return (
    <div className="fixed inset-0 z-50 bg-forest-950/70 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={`${isCheckIn ? 'bg-blue-700' : 'bg-emerald-700'} text-white px-5 py-4 flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg">{title}</h3>
              <p className="text-[11px] text-white/80">
                {isCheckIn ? 'Guests arriving now. One guest, one or more rooms.' : 'Confirmed reservation for today or a later date. One guest, one or more rooms.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {created ? (
          <div className="p-5 space-y-4 overflow-y-auto text-forest-950">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
              <p className="font-bold text-sm text-emerald-900 flex items-center gap-2">
                <Check className="w-4 h-4" />
                {isCheckIn ? 'Checked in' : 'Pre-booked'}: {shown.map((b) => `Room ${b.roomNumber} (${b.bookingReference})`).join(' · ')}
              </p>
              <p className="text-[11px] text-emerald-800 mt-1">The rooms appear on the tape chart once the server has saved them (a refusal shows as an error and is undone).</p>
            </div>
            {refused && (
              <p className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex gap-1.5" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0" /> The server refused {live.filter((b) => !b).length === shown.length ? 'this booking' : 'part of this booking'} (see the error message). Do not send the voucher; close this and try again.
              </p>
            )}
            {!isCheckIn && !refused && (
              <div className="rounded-2xl border border-[#25D366]/40 bg-[#25D366]/5 p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-bold text-sm flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> Booking voucher
                  </p>
                  <p className="text-[11px] text-forest-700">{voucherUrl ? 'Ready. Sends to the guest’s WhatsApp with the voucher link.' : 'Preparing the voucher link…'}</p>
                </div>
                <a
                  href={voucherUrl ? `https://wa.me/${waDigits(guestPhone)}?text=${encodeURIComponent(message)}` : undefined}
                  aria-disabled={!voucherUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`min-h-[44px] px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 text-white ${voucherUrl ? 'bg-[#25D366] hover:bg-[#20ba5a]' : 'bg-gray-300 pointer-events-none'}`}
                >
                  <MessageSquare className="w-4 h-4" /> Send voucher on WhatsApp
                </a>
                {voucherUrl && (
                  <a href={voucherUrl} target="_blank" rel="noopener noreferrer" className="min-h-[44px] px-3 py-2 border border-sand-300 rounded-xl font-bold text-xs flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4" /> View voucher
                  </a>
                )}
              </div>
            )}
            <pre className="whitespace-pre-wrap font-sans text-xs bg-sand-50 border border-sand-200 rounded-xl p-3 max-h-56 overflow-y-auto">{message}</pre>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {isCheckIn ? (
                <a
                  href={`https://wa.me/${waDigits(guestPhone)}?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-3 py-2 bg-[#25D366] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="w-4 h-4" /> Send on WhatsApp
                </a>
              ) : (
                <span className="hidden sm:block" />
              )}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(message);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                }}
                className="min-h-[44px] px-3 py-2 border border-sand-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy message'}
              </button>
              <button type="button" onClick={() => window.open(portalLink, '_blank')} className="min-h-[44px] px-3 py-2 border border-sand-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5">
                <ExternalLink className="w-4 h-4" /> Open guest portal
              </button>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="px-5 py-2.5 bg-forest-900 text-white rounded-xl font-bold text-xs">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-5 overflow-y-auto flex-1 text-forest-950 text-xs">
              {/* Dates & meal plan */}
              <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className="space-y-1">
                  <span className="font-bold block">Check-in</span>
                  <input
                    type="date"
                    value={checkInDate}
                    disabled={isCheckIn}
                    min={currentUser?.role === 'admin' ? undefined : today}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCheckInDate(v);
                      if (checkOutDate <= v) setCheckOutDate(addCalendarDays(v, 1));
                    }}
                    className={`${field} disabled:bg-sand-100`}
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-bold block">Check-out</span>
                  <input type="date" value={checkOutDate} min={addCalendarDays(checkInDate, 1)} onChange={(e) => setCheckOutDate(e.target.value)} className={field} />
                </label>
                <label className="space-y-1">
                  <span className="font-bold block">Meal plan</span>
                  <select value={mealPlan} onChange={(e) => setMealPlan(e.target.value as MealPlan)} className={field}>
                    <option value="EP">EP (room only)</option>
                    <option value="CP">CP (breakfast)</option>
                    <option value="MAP">MAP (breakfast + dinner)</option>
                    <option value="AP">AP (all meals)</option>
                  </select>
                </label>
                <div className="space-y-1">
                  <span className="font-bold block">Nights</span>
                  <div className="p-2.5 rounded-xl bg-sand-50 border border-sand-200 font-mono font-bold">{nights}</div>
                </div>
              </section>

              {/* Rooms */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold uppercase tracking-wider text-forest-800">Rooms {lines.length > 1 && <span className="normal-case text-forest-600">· group of {lines.length}</span>}</h4>
                  <label className="flex items-center gap-1.5 font-semibold">
                    <input type="checkbox" checked={useManualRate} onChange={(e) => setUseManualRate(e.target.checked)} /> Manual rate
                  </label>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {sortedRooms.map((r) => {
                    const selected = lines.some((l) => l.roomId === r.id);
                    const reason = busy[r.id];
                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled={Boolean(reason) && !selected}
                        onClick={() => toggleRoom(r.id)}
                        title={reason || roomViewLabel(r)}
                        aria-pressed={selected}
                        className={`min-h-[52px] rounded-xl border text-center px-1 py-1.5 transition-all ${
                          selected
                            ? reason
                              ? 'bg-rose-600 text-white border-rose-700'
                              : 'bg-forest-900 text-white border-forest-900 ring-2 ring-amber-400/60'
                            : reason
                            ? 'bg-sand-100 text-forest-400 border-sand-200 cursor-not-allowed line-through'
                            : 'bg-white hover:bg-sand-50 border-sand-300 text-forest-900'
                        }`}
                      >
                        <span className="block font-mono font-bold text-sm">{r.roomNumber}</span>
                        <span className="block text-[9px] leading-tight opacity-80">{reason ? (reason.startsWith('On hold') ? 'on hold' : reason.startsWith('In-house') ? 'occupied' : 'booked') : 'free'}</span>
                      </button>
                    );
                  })}
                </div>

                {priced.length > 0 && (
                  <div className="border border-sand-200 rounded-2xl divide-y divide-sand-200">
                    {priced.map((p) => {
                      const room = rooms.find((r) => r.id === p.line.roomId);
                      return (
                        <div key={p.line.roomId} className="p-3 flex flex-wrap items-center gap-3">
                          <span className="w-12 h-9 rounded-lg bg-forest-900 text-amber-300 font-mono font-bold flex items-center justify-center">{room?.roomNumber}</span>
                          <Stepper label="Adults" value={p.line.adults} min={1} max={6} onChange={(v) => updateLine(p.line.roomId, { adults: v })} />
                          <Stepper
                            label="Children"
                            value={p.line.children}
                            min={0}
                            max={4}
                            onChange={(v) => updateLine(p.line.roomId, { children: v, childAges: p.line.childAges.slice(0, v) })}
                          />
                          {p.line.children > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold">Ages</span>
                              {Array.from({ length: p.line.children }).map((_, i) => (
                                <input
                                  key={i}
                                  type="number"
                                  min={0}
                                  max={17}
                                  value={p.line.childAges[i] ?? ''}
                                  onChange={(e) => {
                                    const ages = [...p.line.childAges];
                                    ages[i] = e.target.value === '' ? null : Number(e.target.value);
                                    updateLine(p.line.roomId, { childAges: ages });
                                  }}
                                  className="w-11 p-1.5 rounded-lg border border-sand-300 text-center"
                                  aria-label={`Child ${i + 1} age, room ${room?.roomNumber}`}
                                />
                              ))}
                            </div>
                          )}
                          <div className="ml-auto text-right">
                            {useManualRate ? (
                              <label className="flex items-center gap-1">
                                <span className="text-[10px]">₹/night</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={p.line.manualRate ?? p.liveRate ?? ''}
                                  onChange={(e) => updateLine(p.line.roomId, { manualRate: e.target.value === '' ? null : Number(e.target.value) })}
                                  className="w-24 p-1.5 rounded-lg border border-sand-300 font-mono text-right"
                                />
                              </label>
                            ) : (
                              <span className="block text-[10px] text-forest-600">{p.tariff ? `₹${(p.liveRate ?? 0).toLocaleString('en-IN')}/night (live)` : 'no live tariff'}</span>
                            )}
                            <span className="block font-mono font-bold">₹{Math.round(p.total).toLocaleString('en-IN')}</span>
                          </div>
                          {busy[p.line.roomId] && <p className="w-full text-[11px] text-rose-700">{busy[p.line.roomId]} — remove this room or change dates.</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Guest */}
              <section className="space-y-3">
                <h4 className="font-bold uppercase tracking-wider text-forest-800">Guest {lines.length > 1 && <span className="normal-case text-forest-600">(lead guest for all rooms)</span>}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Full name *" className={field} autoComplete="off" />
                  <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Mobile / WhatsApp *" inputMode="tel" className={field} />
                  <input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Email" type="email" className={field} />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={guestCity} onChange={(e) => setGuestCity(e.target.value)} placeholder="City" className={field} />
                    <select value={guestState} onChange={(e) => setGuestState(e.target.value)} className={field}>
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={`rounded-2xl border p-3 space-y-2 ${isCheckIn ? 'border-blue-200 bg-blue-50/50' : 'border-sand-200 bg-sand-50'}`}>
                  <p className="font-bold">
                    Guest ID {isCheckIn ? <span className="text-blue-800">(required to check in: number or photo)</span> : <span className="font-normal text-forest-600">(optional now; needed at check-in)</span>}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select value={idType} onChange={(e) => setIdType(e.target.value)} className={field}>
                      {ID_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="ID number" className={field} />
                    <select value={nationality} onChange={(e) => setNationality(e.target.value)} className={field}>
                      <option>Indian</option>
                      <option>Foreign national</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <FileButton label={idFront ? 'Front photo ✓' : 'Photo of ID (front)'} onChange={(e) => onFile(e, setIdFront)} />
                    <FileButton label={idBack ? 'Back photo ✓' : 'Back (optional)'} onChange={(e) => onFile(e, setIdBack)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input value={dietary} onChange={(e) => setDietary(e.target.value)} placeholder="Dietary (e.g. Jain, veg)" className={field} />
                  <input value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Special requests" className={field} />
                  <input value={staffNotes} onChange={(e) => setStaffNotes(e.target.value)} placeholder="Staff notes" className={field} />
                </div>
              </section>

              {/* Advance */}
              {isManager ? (
                <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-sand-200 bg-sand-50 p-3">
                  <label className="space-y-1">
                    <span className="font-bold block">Advance received (₹)</span>
                    <input type="number" min={0} step="0.01" inputMode="decimal" value={advancePaid || ''} onChange={(e) => setAdvancePaid(Number(e.target.value) || 0)} className={`${field} font-mono`} />
                  </label>
                  <label className="space-y-1">
                    <span className="font-bold block">Method</span>
                    <select value={advanceMethod} onChange={(e) => setAdvanceMethod(e.target.value as PaymentMethod)} className={field}>
                      <option value="upi">UPI</option>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="card">Card</option>
                    </select>
                  </label>
                  {advancePaid > 0 && (
                    <label className="sm:col-span-3 flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                      <input type="checkbox" checked={advanceSignOff} onChange={(e) => setAdvanceSignOff(e.target.checked)} className="mt-0.5" />
                      <span>
                        I, <strong>{currentUser?.fullName}</strong>, confirm I received ₹{advancePaid.toLocaleString('en-IN')}.{lines.length > 1 ? ` It goes on room ${rooms.find((r) => r.id === lines[0].roomId)?.roomNumber}'s bill.` : ''}
                      </span>
                    </label>
                  )}
                </section>
              ) : (
                <p className="text-[11px] text-forest-600">Advances are recorded and signed by a manager (bookings list → bill → Record advance).</p>
              )}

              {problems.length > 0 && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-rose-800 space-y-1" role="alert">
                  {problems.map((p, i) => (
                    <p key={i} className="flex gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" /> {p}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-sand-200 px-5 py-3 flex items-center justify-between gap-3 shrink-0 bg-white">
              <div className="text-xs">
                <span className="text-forest-600">
                  {lines.length} room{lines.length === 1 ? '' : 's'} · {nights} night{nights > 1 ? 's' : ''}
                </span>
                <span className="block font-mono font-bold text-sm">₹{Math.round(grandTotal).toLocaleString('en-IN')}</span>
                <span className="block text-[10px] text-forest-500">{gstConfig.enabled ? 'incl. GST' : 'No GST'}</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-sand-300 font-bold text-xs">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSubmit}
                  className={`px-5 py-2.5 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-60 ${isCheckIn ? 'bg-blue-700 hover:bg-blue-600' : 'bg-emerald-700 hover:bg-emerald-600'}`}
                >
                  <BedDouble className="w-4 h-4" />
                  {saving ? 'Checking rooms…' : `${title} ${lines.length > 1 ? `${lines.length} rooms` : lines.length === 1 ? `room ${rooms.find((r) => r.id === lines[0].roomId)?.roomNumber}` : ''}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** WhatsApp number digits: 10-digit Indian mobiles get the 91 prefix. */
function waDigits(phone: string): string {
  const d = (phone || '').replace(/\D/g, '');
  return d.length === 10 ? `91${d}` : d;
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] font-bold">{label}</span>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="w-7 h-7 rounded-lg border border-sand-300 flex items-center justify-center" aria-label={`Fewer ${label.toLowerCase()}`}>
        <Minus className="w-3 h-3" />
      </button>
      <span className="w-5 text-center font-mono font-bold">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="w-7 h-7 rounded-lg border border-sand-300 flex items-center justify-center" aria-label={`More ${label.toLowerCase()}`}>
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

function FileButton({ label, onChange }: { label: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="px-3 py-2 rounded-xl border border-dashed border-sand-400 bg-white font-semibold cursor-pointer flex items-center gap-1.5">
      <Upload className="w-3.5 h-3.5" /> {label}
      <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={onChange} />
    </label>
  );
}
