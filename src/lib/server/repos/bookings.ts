import crypto from 'crypto';
import { getSql, SqlOrTx, Tx, withTx, lockInventory } from '../db';
import { HttpError } from '../http';
import { nextCounter } from '../counters';
import type { Booking } from '@/types';
import type { CRMBooking, Guest } from '@/types/crm';
import { addCalendarDays, nightsBetween, normalizeCategoryId, todayInIST } from '@/lib/tariff-calculator';
import { formatYearCode } from '@/lib/booking-id';
import { normalizePhone, normalizeReference } from '@/lib/phone';
import { listPhysicalRooms } from './physical-rooms';
import { listRoomCategories } from './rooms';
import { persistDataUrl } from './files';

/**
 * Bookings: website requests (kind 'web', type Booking) and front-desk bookings
 * (kind 'crm', type CRMBooking) share one table so inventory is counted once.
 */

export const HOLD_HOURS = Number(process.env.BOOKING_HOLD_HOURS || 24);

interface BookingRow {
  id: string;
  kind: 'web' | 'crm';
  reference: string;
  status: string;
  check_in: string | Date;
  check_out: string | Date;
  category_ids: string[];
  physical_room_id: string | null;
  linked_booking_id: string | null;
  guest_phone: string | null;
  hold_expires_at: Date | null;
  data: Booking | CRMBooking;
  created_at: Date;
}

function asDateStr(v: string | Date): string {
  return typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10);
}

function webFromRow(r: BookingRow): Booking {
  const b = r.data as Booking;
  return {
    ...b,
    id: r.id,
    booking_reference: r.reference,
    status: r.status as Booking['status'],
    check_in: asDateStr(r.check_in),
    check_out: asDateStr(r.check_out),
    hold_expires_at: r.hold_expires_at ? new Date(r.hold_expires_at).toISOString() : undefined,
    created_at: b.created_at || new Date(r.created_at).toISOString(),
  };
}

function crmFromRow(r: BookingRow): CRMBooking {
  const b = r.data as CRMBooking;
  return { ...b, id: r.id, bookingReference: r.reference, bookingStatus: r.status as CRMBooking['bookingStatus'] };
}

// ------------------------------------------------------------------ reads
export async function listWebBookings(db?: SqlOrTx): Promise<Booking[]> {
  const sql = db || getSql();
  const rows = await sql<BookingRow[]>`select * from pms.bookings where kind = 'web' order by created_at desc`;
  return rows.map(webFromRow);
}

export async function listCrmBookings(db?: SqlOrTx): Promise<CRMBooking[]> {
  const sql = db || getSql();
  const rows = await sql<BookingRow[]>`select * from pms.bookings where kind = 'crm' order by check_in desc, created_at desc`;
  return rows.map(crmFromRow);
}

export async function getBookingRow(id: string, db?: SqlOrTx): Promise<BookingRow | null> {
  const sql = db || getSql();
  const rows = await sql<BookingRow[]>`select * from pms.bookings where id = ${id}`;
  return rows[0] || null;
}

export async function getCrmBooking(id: string, db?: SqlOrTx): Promise<CRMBooking | null> {
  const row = await getBookingRow(id, db);
  return row && row.kind === 'crm' ? crmFromRow(row) : null;
}

// ------------------------------------------------------------------ availability
export interface CategoryAvailability {
  inventory: number;
  booked: number;
  available: number;
}

const WEB_ACTIVE = ['confirmed', 'completed'];
const CRM_INACTIVE = ['cancelled', 'checked_out'];

function webBlocksInventory(r: BookingRow, now: Date): boolean {
  if (WEB_ACTIVE.includes(r.status)) return true;
  if (r.status === 'pending') return !r.hold_expires_at || new Date(r.hold_expires_at) > now;
  return false;
}

/**
 * Rooms available per category for the stay [checkIn, checkOut), counting website
 * requests (confirmed, or pending within their hold) and front-desk bookings.
 * Uses the busiest night in the range.
 */
export async function getAvailability(checkIn: string, checkOut: string, opts: { excludeBookingId?: string } = {}, db?: SqlOrTx): Promise<Record<string, CategoryAvailability>> {
  const sql = db || getSql();
  const nights = nightsBetween(checkIn, checkOut);
  if (nights === null || nights < 1) throw new HttpError(400, 'Check-out must be after check-in.');
  if (nights > 60) throw new HttpError(400, 'Stays longer than 60 nights need a direct enquiry.');

  const [categories, physicalRooms, rows] = await Promise.all([
    listRoomCategories({ includeInactive: true }, sql),
    listPhysicalRooms(sql),
    sql<BookingRow[]>`select * from pms.bookings where check_in < ${checkOut} and check_out > ${checkIn}`,
  ]);

  const inventory: Record<string, number> = {};
  for (const pr of physicalRooms) {
    if (pr.currentStatus === 'maintenance') continue;
    const cat = normalizeCategoryId(pr.categoryId);
    inventory[cat] = (inventory[cat] || 0) + 1;
  }
  for (const c of categories) {
    if (inventory[c.id] === undefined) inventory[c.id] = c.is_active === false ? 0 : Number(c.total_inventory) || 0;
  }

  const now = new Date();
  const linkedWebIds = new Set(rows.filter((r) => r.kind === 'crm' && r.linked_booking_id).map((r) => r.linked_booking_id!));
  const physicalCategory = new Map(physicalRooms.map((p) => [p.id, normalizeCategoryId(p.categoryId)]));

  const occupied: Record<string, number[]> = {};
  const add = (cat: string, from: string, to: string) => {
    occupied[cat] = occupied[cat] || new Array(nights).fill(0);
    for (let i = 0; i < nights; i++) {
      const night = addCalendarDays(checkIn, i);
      if (night >= from && night < to) occupied[cat][i] += 1;
    }
  };

  for (const r of rows) {
    if (r.id === opts.excludeBookingId) continue;
    const from = asDateStr(r.check_in);
    const to = asDateStr(r.check_out);
    if (r.kind === 'web') {
      if (linkedWebIds.has(r.id) || !webBlocksInventory(r, now)) continue;
      for (const cat of r.category_ids) add(normalizeCategoryId(cat), from, to);
    } else {
      if (CRM_INACTIVE.includes(r.status)) continue;
      const cat = (r.physical_room_id && physicalCategory.get(r.physical_room_id)) || normalizeCategoryId(r.category_ids[0] || '');
      if (cat) add(cat, from, to);
    }
  }

  const result: Record<string, CategoryAvailability> = {};
  for (const cat of Object.keys(inventory)) {
    const booked = Math.max(0, ...(occupied[cat] || [0]));
    result[cat] = { inventory: inventory[cat], booked, available: Math.max(0, inventory[cat] - booked) };
  }
  return result;
}

// ------------------------------------------------------------------ references
async function nextBookingReference(tx: Tx, checkIn: string): Promise<string> {
  const year = Number(checkIn.slice(0, 4));
  const month = checkIn.slice(5, 7);
  const prefix = `SH-${formatYearCode(year)}${month}`;
  const [{ max }] = await tx<{ max: number | null }[]>`
    select max((substring(reference from ${prefix.length + 1}))::int) as max
    from pms.bookings where reference ~ ${'^' + prefix + '[0-9]+$'}`;
  const floor = (max || 0) + 1;
  const counterName = `ref:${prefix}`;
  const rows = await tx<{ value: string }[]>`
    insert into pms.counters as c (name, value) values (${counterName}, ${floor})
    on conflict (name) do update set value = greatest(c.value + 1, ${floor})
    returning value::text as value`;
  return `${prefix}${String(Number(rows[0].value)).padStart(3, '0')}`;
}

// ------------------------------------------------------------------ website bookings
export interface NewWebBooking {
  guest_name: string;
  email?: string;
  phone: string;
  room_name: string;
  check_in: string;
  check_out: string;
  rooms: { roomId: string; adults: number; children: number; childAges?: number[] }[];
  meal_plan: string;
  special_requests?: string;
  totals: {
    roomSubtotal: number;
    gstAmount: number;
    addonsTotal: number;
    extraChargesTotal: number;
    totalPrice: number;
    extraAdults: number;
    extraChildren: number;
  };
  idempotencyKey?: string;
}

export async function createWebBooking(input: NewWebBooking): Promise<{ booking: Booking; created: boolean }> {
  if (input.idempotencyKey) {
    const sql = getSql();
    const existing = await sql<BookingRow[]>`select * from pms.bookings where idempotency_key = ${input.idempotencyKey}`;
    if (existing[0]) return { booking: webFromRow(existing[0]), created: false };
  }

  return withTx(async (tx) => {
    await lockInventory(tx);
    const need: Record<string, number> = {};
    for (const r of input.rooms) {
      const cat = normalizeCategoryId(r.roomId);
      need[cat] = (need[cat] || 0) + 1;
    }
    const avail = await getAvailability(input.check_in, input.check_out, {}, tx);
    for (const [cat, count] of Object.entries(need)) {
      if (!avail[cat] || avail[cat].available < count) {
        throw new HttpError(409, 'Sorry, those rooms are no longer available for your dates. Please choose other dates or rooms.', 'SOLD_OUT');
      }
    }

    const id = `bk-${crypto.randomUUID()}`;
    const reference = await nextBookingReference(tx, input.check_in);
    const holdExpires = new Date(Date.now() + HOLD_HOURS * 3600 * 1000);
    const nights = nightsBetween(input.check_in, input.check_out) || 1;
    const booking: Booking = {
      id,
      booking_reference: reference,
      guest_name: input.guest_name,
      email: input.email || '',
      phone: input.phone,
      room_id: input.rooms.map((r) => normalizeCategoryId(r.roomId)).join(', '),
      room_name: input.room_name,
      check_in: input.check_in,
      check_out: input.check_out,
      nights,
      rooms_count: input.rooms.length,
      adults_count: input.rooms.reduce((s, r) => s + r.adults, 0),
      children_count: input.rooms.reduce((s, r) => s + r.children, 0),
      extra_adults_count: input.totals.extraAdults,
      extra_children_count: input.totals.extraChildren,
      extra_charges_total: input.totals.extraChargesTotal,
      total_price: input.totals.totalPrice,
      room_subtotal: input.totals.roomSubtotal,
      gst_amount: input.totals.gstAmount,
      addons_total: input.totals.addonsTotal,
      meal_plan: input.meal_plan,
      rooms_config: input.rooms.map((r) => ({ room_id: normalizeCategoryId(r.roomId), adults: r.adults, children: r.children, child_ages: r.childAges })),
      status: 'pending',
      payment_status: 'unpaid',
      special_requests: input.special_requests || '',
      created_at: new Date().toISOString(),
    };
    const inserted = await tx<BookingRow[]>`
      insert into pms.bookings (id, kind, reference, status, check_in, check_out, category_ids, guest_phone,
                                hold_expires_at, idempotency_key, data)
      values (${id}, 'web', ${reference}, 'pending', ${input.check_in}, ${input.check_out},
              ${input.rooms.map((r) => normalizeCategoryId(r.roomId))}, ${normalizePhone(input.phone)},
              ${holdExpires}, ${input.idempotencyKey || null}, ${tx.json(booking as never)})
      returning *`;
    return { booking: webFromRow(inserted[0]), created: true };
  });
}

const WEB_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'pending'],
  cancelled: ['pending', 'confirmed'],
  completed: ['confirmed'],
};

export async function updateWebBookingStatus(
  id: string,
  status: Booking['status'],
  paymentStatus?: Booking['payment_status']
): Promise<{ before: Booking; after: Booking }> {
  return withTx(async (tx) => {
    await lockInventory(tx);
    const row = await getBookingRow(id, tx);
    if (!row || row.kind !== 'web') throw new HttpError(404, 'Booking not found.');
    const before = webFromRow(row);
    if (status !== row.status && !(WEB_TRANSITIONS[row.status] || []).includes(status)) {
      throw new HttpError(409, `A ${row.status} booking cannot be changed to ${status}.`, 'INVALID_TRANSITION');
    }
    // Re-opening a booking must not overbook.
    const reactivating = !webBlocksInventory(row, new Date()) && (status === 'confirmed' || status === 'pending');
    if (reactivating) {
      const avail = await getAvailability(before.check_in, before.check_out, { excludeBookingId: id }, tx);
      const need: Record<string, number> = {};
      for (const c of row.category_ids) need[normalizeCategoryId(c)] = (need[normalizeCategoryId(c)] || 0) + 1;
      for (const [cat, n] of Object.entries(need)) {
        if (!avail[cat] || avail[cat].available < n) {
          throw new HttpError(409, 'The rooms for this booking have since been taken; it cannot be re-opened.', 'SOLD_OUT');
        }
      }
    }
    const after: Booking = { ...before, status, payment_status: paymentStatus || before.payment_status };
    const holdExpires = status === 'pending' ? new Date(Date.now() + HOLD_HOURS * 3600 * 1000) : null;
    await tx`
      update pms.bookings set status = ${status}, data = ${tx.json(after as never)}, updated_at = now(),
        hold_expires_at = ${holdExpires}
      where id = ${id}`;
    return { before, after };
  });
}

// ------------------------------------------------------------------ front-desk bookings
/** Moves inline ID-document images out of the booking record into private storage. */
async function persistGuestDocuments(guest: Guest, bookingId: string, actor: string): Promise<Guest> {
  const opts = { visibility: 'private' as const, ownerKind: 'booking', ownerId: bookingId, actor };
  return {
    ...guest,
    idDocumentUrl: await persistDataUrl(guest.idDocumentUrl, opts),
    idDocumentBackUrl: await persistDataUrl(guest.idDocumentBackUrl, opts),
  };
}

export async function upsertCrmBooking(input: CRMBooking, actor: string): Promise<{ before: CRMBooking | null; after: CRMBooking }> {
  if (!input?.id) throw new HttpError(400, 'Booking id is required.');
  const checkIn = (input.checkInDate || '').slice(0, 10);
  const checkOut = (input.checkOutDate || '').slice(0, 10);
  const nights = nightsBetween(checkIn, checkOut);
  if (nights === null || nights < 1) throw new HttpError(400, 'Check-out must be after check-in.');
  const guest = input.guest ? await persistGuestDocuments(input.guest, input.id, actor) : input.guest;

  return withTx(async (tx) => {
    await lockInventory(tx);
    const existingRow = await getBookingRow(input.id, tx);
    if (existingRow && existingRow.kind !== 'crm') throw new HttpError(409, 'Booking id conflict.');
    const before = existingRow ? crmFromRow(existingRow) : null;
    const status = input.bookingStatus || 'confirmed';

    // A physical room can only hold one active booking per night.
    if (input.roomId && !CRM_INACTIVE.includes(status)) {
      const clash = await tx<BookingRow[]>`
        select * from pms.bookings
        where kind = 'crm' and physical_room_id = ${input.roomId} and id <> ${input.id}
          and status not in ('cancelled', 'checked_out')
          and check_in < ${checkOut} and check_out > ${checkIn}
        limit 1`;
      if (clash[0]) {
        const other = crmFromRow(clash[0]);
        throw new HttpError(
          409,
          `Room ${input.roomNumber || ''} is already booked for ${other.guest?.fullName || 'another guest'} (${other.checkInDate} → ${other.checkOutDate}).`,
          'ROOM_CONFLICT'
        );
      }
    }

    let reference = (input.bookingReference || '').trim();
    if (!before) {
      const taken = reference
        ? await tx`select 1 from pms.bookings where upper(reference) = ${reference.toUpperCase()}`
        : [];
      if (!reference || taken.length > 0) reference = await nextBookingReference(tx, checkIn);
    } else {
      reference = before.bookingReference; // references never change
    }

    const physical = input.roomId ? await tx<{ category_id: string }[]>`select category_id from pms.physical_rooms where id = ${input.roomId}` : [];
    const categoryId = physical[0]?.category_id || normalizeCategoryId(input.roomId || '');
    const after: CRMBooking = { ...input, guest, bookingReference: reference, bookingStatus: status, checkInDate: checkIn, checkOutDate: checkOut };

    await tx`
      insert into pms.bookings (id, kind, reference, status, check_in, check_out, category_ids, physical_room_id,
                                linked_booking_id, guest_phone, data)
      values (${input.id}, 'crm', ${reference}, ${status}, ${checkIn}, ${checkOut}, ${categoryId ? [categoryId] : []},
              ${input.roomId || null}, ${input.sourceBookingId || null}, ${normalizePhone(guest?.phone)}, ${tx.json(after as never)})
      on conflict (id) do update set status = excluded.status, check_in = excluded.check_in, check_out = excluded.check_out,
        category_ids = excluded.category_ids, physical_room_id = excluded.physical_room_id,
        linked_booking_id = excluded.linked_booking_id, guest_phone = excluded.guest_phone,
        data = excluded.data, updated_at = now()`;
    return { before, after };
  });
}

export async function deleteBooking(id: string, db?: SqlOrTx): Promise<boolean> {
  const sql = db || getSql();
  const rows = await sql`delete from pms.bookings where id = ${id} returning id`;
  return rows.length > 0;
}

// ------------------------------------------------------------------ guest access
/**
 * Finds a booking for a guest sign-in. BOTH the booking reference and the phone
 * number on the booking must match exactly (no partial or name matching).
 */
export async function findBookingForGuest(reference: string, phone: string): Promise<BookingRow | null> {
  const ref = normalizeReference(reference);
  const ph = normalizePhone(phone);
  if (ref.length < 4 || ph.length < 10) return null;
  const sql = getSql();
  const rows = await sql<BookingRow[]>`
    select * from pms.bookings
    where regexp_replace(upper(reference), '[^A-Z0-9]', '', 'g') = ${ref}
      and guest_phone = ${ph}
      and status <> 'cancelled'
    order by kind = 'crm' desc, created_at desc
    limit 1`;
  return rows[0] || null;
}

/** The active front-desk booking for a physical room today (for the in-room QR page). */
export async function findActiveBookingForRoom(roomId: string): Promise<CRMBooking | null> {
  const sql = getSql();
  const today = todayInIST();
  const rows = await sql<BookingRow[]>`
    select * from pms.bookings
    where kind = 'crm' and physical_room_id = ${roomId} and status in ('checked_in', 'confirmed', 'hold')
      and check_in <= ${addCalendarDays(today, 1)} and check_out >= ${today}
    order by (status = 'checked_in') desc, check_in desc
    limit 1`;
  return rows[0] ? crmFromRow(rows[0]) : null;
}

/** Converts any booking row to the front-desk shape used by the guest portal. */
export function rowToGuestBooking(row: BookingRow): CRMBooking {
  if (row.kind === 'crm') return crmFromRow(row);
  const b = webFromRow(row);
  return {
    id: b.id,
    bookingReference: b.booking_reference,
    roomId: b.room_id || '',
    roomNumber: 0,
    roomName: b.room_name,
    guestId: `gst-${b.id}`,
    guest: {
      id: `gst-${b.id}`,
      fullName: b.guest_name,
      phone: b.phone,
      email: b.email,
      documentStatus: 'pending',
      totalLifetimeStays: 1,
    },
    checkInDate: b.check_in,
    checkOutDate: b.check_out,
    tapeStatus: b.status === 'confirmed' ? 'confirmed' : 'hold',
    bookingStatus: b.status === 'confirmed' ? 'confirmed' : 'hold',
    mealPlan: (b.meal_plan as CRMBooking['mealPlan']) || 'CP',
    adultsCount: b.adults_count || 2,
    childrenCount: b.children_count || 0,
    roomRatePerNight: b.nights > 0 ? Math.round((b.room_subtotal ?? b.total_price) / b.nights) : b.total_price,
    totalNights: b.nights,
    totalRoomAmount: b.room_subtotal ?? b.total_price,
    specialRequests: b.special_requests,
    documentStatus: 'pending',
    advancePaid: 0,
  };
}

export type { BookingRow };
export { crmFromRow, webFromRow };
