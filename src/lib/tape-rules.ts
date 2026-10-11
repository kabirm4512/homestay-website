import type { CRMBooking, PhysicalRoom, RoomBlock } from '@/types/crm';
import { addCalendarDays, isCalendarDate, nightsBetween, todayInIST } from '@/lib/tariff-calculator';

/**
 * Tape chart rules shared by the browser and the server. The tape chart has three separate
 * flows, each with its own rules, and each can take several rooms at once (a group):
 *
 * - Check in: guests arrive today and go into the rooms. ID is required.
 * - Pre-book: a confirmed reservation for today or a later date.
 * - Hold: the rooms are kept off sale for some nights (a guest who hasn't confirmed, repairs,
 *   owner use). A hold can release itself after some hours, or last until released, and can
 *   be turned into a pre-booking or check-in.
 *
 * (Bookings with status 'hold' from before this change still expire the same way.)
 */

export const HOLD_DURATION_OPTIONS = [2, 6, 24, 48] as const;
export const DEFAULT_HOLD_HOURS = 24;
export const MIN_HOLD_MINUTES = 30;
export const MAX_HOLD_HOURS = 7 * 24;

/** Keeps a hold expiry between 30 minutes and 7 days from now. */
export function clampHoldExpiry(requested: Date, now: Date = new Date()): Date {
  const min = now.getTime() + MIN_HOLD_MINUTES * 60_000;
  const max = now.getTime() + MAX_HOLD_HOURS * 3_600_000;
  const t = requested.getTime();
  if (!Number.isFinite(t)) return new Date(now.getTime() + DEFAULT_HOLD_HOURS * 3_600_000);
  return new Date(Math.min(max, Math.max(min, t)));
}

export function holdExpiryFromHours(hours: number, now: Date = new Date()): Date {
  const h = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_HOLD_HOURS;
  return clampHoldExpiry(new Date(now.getTime() + h * 3_600_000), now);
}

/** A desk hold whose expiry has passed. It no longer takes the room (holds set before expiry existed never expire). */
export function isHoldExpired(b: Pick<CRMBooking, 'bookingStatus' | 'holdExpiresAt'>, now: Date = new Date()): boolean {
  return b.bookingStatus === 'hold' && Boolean(b.holdExpiresAt) && new Date(b.holdExpiresAt as string).getTime() <= now.getTime();
}

/** Does this booking take its room on its nights? (Cancelled, departed and expired holds do not.) */
export function bookingTakesRoom(b: Pick<CRMBooking, 'bookingStatus' | 'holdExpiresAt'>, now: Date = new Date()): boolean {
  if (b.bookingStatus === 'cancelled' || b.bookingStatus === 'checked_out') return false;
  return !isHoldExpired(b, now);
}

/** "expires in 3 h 20 m" / "expired 40 m ago" */
export function describeHoldExpiry(holdExpiresAt: string | undefined, now: Date = new Date()): string {
  if (!holdExpiresAt) return 'no expiry set';
  const diff = new Date(holdExpiresAt).getTime() - now.getTime();
  const mins = Math.round(Math.abs(diff) / 60_000);
  const text = mins >= 48 * 60 ? `${Math.round(mins / 1440)} d` : mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60 ? `${mins % 60} m` : ''}`.trim() : `${mins} m`;
  return diff > 0 ? `expires in ${text}` : `expired ${text} ago`;
}

/** A hold keeps the room off sale until its expiry (no expiry = until released). */
export function blockIsActive(block: Pick<RoomBlock, 'expiresAt'>, now: Date = new Date()): boolean {
  return !block.expiresAt || new Date(block.expiresAt).getTime() > now.getTime();
}

export function blockCoversNight(block: Pick<RoomBlock, 'fromDate' | 'toDate'>, night: string): boolean {
  return night >= block.fromDate && night < block.toDate;
}

export function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom < bTo && aTo > bFrom;
}

/** Guest identity on file: an ID number or a photo of the ID. */
export function hasGuestId(guest: Pick<CRMBooking['guest'], 'idNumber' | 'idDocumentUrl'> | undefined): boolean {
  return Boolean(guest && ((guest.idNumber || '').trim().length >= 4 || guest.idDocumentUrl));
}

export interface HoldInput {
  roomIds: string[];
  fromDate: string;
  toDate: string;
  /** Why the rooms are held (a guest name alone is enough). */
  reason?: string;
  guestName?: string;
  guestPhone?: string;
  /** Hours until the hold releases itself; null/undefined = until released. */
  releaseAfterHours?: number | null;
}

/** The label a hold shows on the chart. */
export function holdLabel(h: Pick<RoomBlock, 'reason' | 'guestName'>): string {
  const reason = (h.reason || '').trim();
  const name = (h.guestName || '').trim();
  if (name && reason && !reason.includes(name)) return `${name} · ${reason}`;
  return reason || name || 'Hold';
}

/** Validation for a new hold; returns an error message or null. */
export function validateHoldInput(h: HoldInput, opts: { today?: string; isAdmin?: boolean } = {}): string | null {
  const today = opts.today || todayInIST();
  if (!Array.isArray(h.roomIds) || h.roomIds.length === 0) return 'Choose at least one room to hold.';
  if (new Set(h.roomIds).size !== h.roomIds.length) return 'A room is listed twice.';
  if (!isCalendarDate(String(h.fromDate)) || !isCalendarDate(String(h.toDate))) return 'A hold needs a first night and an end date.';
  if (h.toDate <= h.fromDate) return 'The room must be free again after the first held night.';
  const nights = nightsBetween(h.fromDate, h.toDate) ?? 0;
  if (nights > 180) return 'A hold can cover at most 180 nights.';
  if (h.fromDate < today && !opts.isAdmin) return 'A hold cannot start in the past.';
  if ((h.reason || '').trim().length < 3 && (h.guestName || '').trim().length < 2) {
    return 'Add who the rooms are held for, or the reason (e.g. geyser repair).';
  }
  if (h.releaseAfterHours != null && !(h.releaseAfterHours >= 0.5 && h.releaseAfterHours <= MAX_HOLD_HOURS)) {
    return `A hold can release itself after 30 minutes to ${MAX_HOLD_HOURS / 24} days, or last until released.`;
  }
  return null;
}

export interface CheckInContext {
  today?: string;
  now?: Date;
  room?: Pick<PhysicalRoom, 'id' | 'roomNumber' | 'currentStatus'> | null;
  /** Other bookings (any status); the one being checked in is ignored. */
  bookings: Pick<CRMBooking, 'id' | 'roomId' | 'bookingStatus' | 'checkInDate' | 'checkOutDate' | 'guest' | 'holdExpiresAt'>[];
  blocks: Pick<RoomBlock, 'roomId' | 'fromDate' | 'toDate' | 'reason' | 'guestName' | 'expiresAt'>[];
}

export type CheckInProblemCode = 'BAD_STATUS' | 'TOO_EARLY' | 'STAY_OVER' | 'ROOM_BLOCKED' | 'ROOM_OCCUPIED' | 'ROOM_OUT_OF_SERVICE' | 'ID_REQUIRED';

/**
 * Can this booking be checked in now? Returns the first problem, or null. The server
 * runs the same check; the desk uses it to explain why the button is disabled.
 */
export function checkInProblem(
  booking: Pick<CRMBooking, 'id' | 'roomId' | 'roomNumber' | 'bookingStatus' | 'checkInDate' | 'checkOutDate' | 'guest'>,
  ctx: CheckInContext,
  opts: { skipIdCheck?: boolean } = {}
): { code: CheckInProblemCode; message: string } | null {
  const today = ctx.today || todayInIST(ctx.now);
  if (booking.bookingStatus !== 'confirmed' && booking.bookingStatus !== 'hold') {
    return { code: 'BAD_STATUS', message: `This booking is ${booking.bookingStatus.replace('_', ' ')}; only a pre-booking or hold can be checked in.` };
  }
  if (booking.checkInDate > today) {
    return { code: 'TOO_EARLY', message: `This stay starts on ${booking.checkInDate}. Guests can be checked in from their arrival day.` };
  }
  if (booking.checkOutDate <= today) {
    return { code: 'STAY_OVER', message: `This stay ended on ${booking.checkOutDate}. Change the dates or mark it a no-show.` };
  }
  const block = ctx.blocks.find((k) => k.roomId === booking.roomId && blockCoversNight(k, today) && blockIsActive(k, ctx.now));
  if (block) {
    return { code: 'ROOM_BLOCKED', message: `Room ${booking.roomNumber} is on hold tonight (${holdLabel(block)}). Release the hold or move the guest.` };
  }
  const inHouse = ctx.bookings.find((o) => o.id !== booking.id && o.roomId === booking.roomId && o.bookingStatus === 'checked_in');
  if (inHouse) {
    return {
      code: 'ROOM_OCCUPIED',
      message: `Room ${booking.roomNumber} still has ${inHouse.guest?.fullName || 'a guest'} in-house (due out ${inHouse.checkOutDate}). Check them out first.`,
    };
  }
  if (ctx.room?.currentStatus === 'maintenance') {
    return { code: 'ROOM_OUT_OF_SERVICE', message: `Room ${booking.roomNumber} is marked out of service tonight. Put it back in service first.` };
  }
  if (!opts.skipIdCheck && !hasGuestId(booking.guest)) {
    return { code: 'ID_REQUIRED', message: 'Add the guest’s ID number or a photo of their ID before checking in.' };
  }
  return null;
}

/** What an empty tape-chart cell offers for a night. */
export function cellActions(night: string, opts: { today?: string; isAdmin?: boolean } = {}) {
  const today = opts.today || todayInIST();
  const past = night < today;
  return {
    checkIn: night === today,
    preBook: !past || Boolean(opts.isAdmin),
    hold: !past || Boolean(opts.isAdmin),
    past,
  };
}

export { addCalendarDays };

/** Display-only room labels for the tape chart (pricing categories are unchanged). */
const ROOM_VIEW_LABELS: Record<number, string> = {
  101: 'Kanchenjunga View with Balcony',
  102: 'Kanchenjunga View with Balcony',
  103: 'Valley View with Balcony',
  104: 'Forest View with Balcony',
  201: 'Premium View Suite',
  202: 'Premium View Suite',
  203: 'Premium View Suite',
};

export function roomViewLabel(room: Pick<PhysicalRoom, 'roomNumber' | 'categoryName'>): string {
  return ROOM_VIEW_LABELS[room.roomNumber] || room.categoryName || '';
}

/** Short filter-chip names for the view groups. */
export function roomViewShort(label: string): string {
  return label.replace(/ with Balcony$/, '').replace(/ Suite$/, ' Suites');
}

/**
 * Why a room can't be taken for [from, to) — a stay or an active hold on those nights — or
 * null when it is free. (Client-side preview; the server checks again, with website requests.)
 */
export function roomBusyReason(
  roomId: string,
  from: string,
  to: string,
  bookings: Pick<CRMBooking, 'id' | 'roomId' | 'bookingStatus' | 'checkInDate' | 'checkOutDate' | 'guest' | 'holdExpiresAt'>[],
  holds: Pick<RoomBlock, 'id' | 'roomId' | 'fromDate' | 'toDate' | 'reason' | 'guestName' | 'expiresAt'>[],
  opts: { ignoreHoldIds?: string[]; now?: Date } = {}
): string | null {
  const now = opts.now || new Date();
  const stay = bookings.find((b) => b.roomId === roomId && bookingTakesRoom(b, now) && rangesOverlap(b.checkInDate, b.checkOutDate, from, to));
  if (stay) return `Booked: ${stay.guest?.fullName || 'guest'} ${stay.checkInDate} → ${stay.checkOutDate}`;
  const hold = holds.find(
    (h) => h.roomId === roomId && !(opts.ignoreHoldIds || []).includes(h.id) && blockIsActive(h, now) && rangesOverlap(h.fromDate, h.toDate, from, to)
  );
  if (hold) return `On hold: ${holdLabel(hold)}`;
  return null;
}

export function newGroupId(): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `grp-${rnd}`;
}
