import crypto from 'crypto';
import type { Booking } from '@/types';
import type { CRMBooking, FolioCharge, FolioPayment, GuestFolio } from '@/types/crm';
import { HttpError } from './http';
import { SqlOrTx, Tx, getSql, lockFolio, withTx } from './db';
import { getRecord, upsertRecord } from './repos/records';
import { getBookingRow, getCrmBooking } from './repos/bookings';
import { getGstConfig } from './repos/settings';
import { nextCounter } from './counters';
import { audit } from './audit';
import { recalculateFolioTotals } from '@/lib/folio';
import { roundMoney } from '@/lib/gst';
import type { StaffContext } from './auth/staff-session';
import { applyChargeRules, applyDiscountRules, applyPaymentRules } from './money-rules';

/**
 * Every write to a guest bill goes through here (desk devices, guest orders, transfers,
 * kitchen status changes). Each write takes a per-booking lock and reads the stored bill
 * inside the same transaction, so two writers can never overwrite each other's lines or
 * payments. Lines and payments are merged, never replaced.
 */

/** The folio of a booking (by booking id only). */
export async function findFolioByBookingId(bookingId: string, db?: SqlOrTx): Promise<GuestFolio | null> {
  const sql = db || getSql();
  const rows = await sql<{ data: GuestFolio }[]>`
    select data from pms.records
    where collection = 'folios' and data->>'bookingId' = ${bookingId}
    order by case when data->>'status' = 'void' then 1 else 0 end, seq asc
    limit 1`;
  return rows[0]?.data ?? null;
}

function emptyFolio(id: string, folioNumber: string, booking: Pick<CRMBooking, 'id' | 'guestId' | 'roomNumber' | 'roomName'> & { guestName: string }): GuestFolio {
  return {
    id,
    bookingId: booking.id,
    guestId: booking.guestId,
    guestName: booking.guestName,
    roomNumber: booking.roomNumber,
    roomName: booking.roomName,
    folioNumber,
    status: 'open',
    totalRoomCharges: 0,
    totalFbCharges: 0,
    totalAddonCharges: 0,
    totalTax: 0,
    discountAmount: 0,
    netPayable: 0,
    totalPaid: 0,
    balanceDue: 0,
    charges: [],
    payments: [],
  };
}

/** Runs `fn` with the booking's bill locked; `fn` receives the stored folio (or null). */
export async function withFolioLock<T>(bookingId: string, fn: (tx: Tx, folio: GuestFolio | null) => Promise<T>): Promise<T> {
  return withTx(async (tx) => {
    await lockFolio(tx, bookingId);
    return fn(tx, await findFolioByBookingId(bookingId, tx));
  });
}

/** The booking's folio, created (empty) if the desk hasn't opened one yet. Call inside withFolioLock. */
export async function ensureFolioTx(tx: Tx, existing: GuestFolio | null, booking: CRMBooking, actor: string): Promise<GuestFolio> {
  if (existing) return existing;
  const n = await nextCounter(tx, 'folio', 1001);
  const folio = emptyFolio(`fol-${crypto.randomUUID()}`, `FOL-${new Date().getFullYear()}-${n}`, {
    id: booking.id,
    guestId: booking.guestId,
    guestName: booking.guest?.fullName || 'Guest',
    roomNumber: booking.roomNumber,
    roomName: booking.roomName,
  });
  await upsertRecord('folios', folio, actor, tx);
  return folio;
}

/** Adds one charge line (server-priced) to the booking's bill. */
export async function postChargeLocked(
  booking: CRMBooking,
  charge: Omit<FolioCharge, 'id' | 'folioId' | 'postedAt'>,
  actor: string
): Promise<GuestFolio> {
  const gst = await getGstConfig();
  return withFolioLock(booking.id, async (tx, current) => {
    const folio = await ensureFolioTx(tx, current, booking, actor);
    const line: FolioCharge = { ...charge, id: `chg-${crypto.randomUUID()}`, folioId: folio.id, postedAt: new Date().toISOString() };
    const updated = recalculateFolioTotals(folio, [line, ...folio.charges], folio.payments, gst);
    await upsertRecord('folios', updated, actor, tx);
    return updated;
  });
}

/** Moves a linked charge (order / transfer) to posted or void, under the lock. */
export async function setLinkedChargeStatus(folioId: string, sourceId: string, target: 'posted' | 'void', actor: string, reason?: string) {
  const current = await getRecord<GuestFolio>('folios', folioId);
  if (!current) return;
  const gst = await getGstConfig();
  await withFolioLock(current.bookingId, async (tx) => {
    const folio = await getRecord<GuestFolio>('folios', folioId, tx);
    if (!folio || !folio.charges.some((c) => c.sourceReferenceId === sourceId && c.chargeStatus !== target && c.chargeStatus !== 'void')) return;
    const now = new Date().toISOString();
    const charges = folio.charges.map((c) =>
      c.sourceReferenceId === sourceId && c.chargeStatus !== 'void'
        ? target === 'void'
          ? { ...c, chargeStatus: 'void' as const, voidReason: reason || 'Order / request cancelled', voidedAt: now }
          : { ...c, chargeStatus: 'posted' as const }
        : c
    );
    await upsertRecord('folios', recalculateFolioTotals(folio, charges, folio.payments, gst), actor, tx);
  });
}

// ----------------------------------------------------------------------------- web money
/** Add-ons booked on the website, structured (new bookings) or read from the request notes (older ones). */
export function webBookingAddons(b: Booking): { code: string; title: string; amount: number }[] {
  if (Array.isArray(b.addons) && b.addons.length) return b.addons;
  const out: { code: string; title: string; amount: number }[] = [];
  const notes = b.special_requests || '';
  const transfer = notes.match(/\[Add-on: Airport\/Railway transfer ₹([\d,]+)\]/);
  if (transfer) out.push({ code: 'airport_transfer', title: 'Airport / station transfer (booked online)', amount: Number(transfer[1].replace(/,/g, '')) });
  const bike = notes.match(/\[Add-on: Bike rental ₹([\d,]+)\/night\]/);
  if (bike) {
    const nights = Math.max(1, b.nights || 1);
    out.push({ code: 'bike_rental', title: `Scooty / bike rental, ${nights} day${nights === 1 ? '' : 's'} (booked online)`, amount: Number(bike[1].replace(/,/g, '')) * nights });
  }
  return out.filter((a) => a.amount > 0);
}

/**
 * When the desk assigns a room to a website request, the new bill takes over everything
 * that belongs to the guest: deposits and anything ordered before arrival (celebrations,
 * transfers) from the request's own bill, and the add-ons they booked online.
 */
async function carryOverWebMoney(tx: Tx, folio: GuestFolio, crm: CRMBooking, actor: string): Promise<{ charges: FolioCharge[]; payments: FolioPayment[]; notes: string[] }> {
  const charges: FolioCharge[] = [];
  const payments: FolioPayment[] = [];
  const notes: string[] = [];
  const webId = crm.sourceBookingId;
  if (!webId) return { charges, payments, notes };

  await lockFolio(tx, webId);
  const webFolio = await findFolioByBookingId(webId, tx);
  if (webFolio && webFolio.status !== 'void' && (webFolio.charges.length || webFolio.payments.length)) {
    for (const c of webFolio.charges) charges.push({ ...c, folioId: folio.id });
    for (const p of webFolio.payments) payments.push({ ...p, folioId: folio.id, receiptNotes: [p.receiptNotes, `moved from website request ${webId}`].filter(Boolean).join(' · ') });
    const emptied = { ...webFolio, status: 'void' as const, charges: [], payments: [], movedToFolioId: folio.id } as GuestFolio;
    await upsertRecord('folios', emptied, actor, tx);
    await audit({ actor, action: 'move_to_room_folio', entity: 'folios', entityId: webFolio.id, before: webFolio, after: emptied }, tx);
    notes.push(`moved ${webFolio.charges.length} line(s) and ${webFolio.payments.length} payment(s) from the website request`);
  }

  const row = await getBookingRow(webId, tx);
  if (row && row.kind === 'web') {
    const already = new Set([...(folio.charges || []), ...charges].map((c) => c.sourceReferenceId));
    for (const a of webBookingAddons(row.data as Booking)) {
      const sourceId = `${webId}:addon:${a.code}`;
      if (already.has(sourceId)) continue;
      charges.push({
        id: `chg-${crypto.randomUUID()}`,
        folioId: folio.id,
        category: a.code === 'bike_rental' ? 'vehicle_rental' : 'transport_transfer',
        chargeStatus: 'posted',
        title: a.title,
        amount: roundMoney(a.amount),
        sourceReferenceType: 'booking',
        sourceReferenceId: sourceId,
        postedAt: new Date().toISOString(),
        postedByName: 'Website booking',
      });
    }
  }
  return { charges, payments, notes };
}

// ------------------------------------------------------------------------- desk writes
/**
 * A bill change sent by a staff device (the CRM). Applies the money rules against the
 * STORED bill (read under the lock), so an out-of-date device can never remove or rewrite
 * someone else's lines or payments.
 */
export async function saveFolioFromDevice(incoming: GuestFolio, staff: StaffContext, ip?: string): Promise<GuestFolio> {
  if (!incoming?.id || !incoming.bookingId) throw new HttpError(400, 'A bill needs an id and a booking.');
  const gst = await getGstConfig();
  const actor = `staff:${staff.id}`;
  return withFolioLock(incoming.bookingId, async (tx) => {
    const before = await getRecord<GuestFolio>('folios', incoming.id, tx);
    if (before && before.bookingId !== incoming.bookingId) throw new HttpError(409, 'This bill belongs to another booking.');
    if (!before) {
      const other = await findFolioByBookingId(incoming.bookingId, tx);
      if (other && other.id !== incoming.id && other.status !== 'void') {
        throw new HttpError(409, 'This booking already has a bill. Refresh to see it.', 'FOLIO_EXISTS');
      }
    }

    let charges = applyChargeRules(before, incoming, staff);
    let payments = applyPaymentRules(before, incoming, staff);
    const newRefunds = payments.filter((p) => p.kind === 'refund' && !(before?.payments || []).some((b) => b.id === p.id));

    if (!before) {
      const crm = await getCrmBooking(incoming.bookingId, tx);
      if (crm?.sourceBookingId) {
        const carried = await carryOverWebMoney(tx, incoming, crm, actor);
        charges = [...charges, ...carried.charges];
        payments = [...payments, ...carried.payments];
      }
    }

    const billedSubtotal = roundMoney(charges.filter((c) => c.chargeStatus === 'posted').reduce((s, c) => s + c.amount, 0));
    const discount = applyDiscountRules(before, incoming, staff, billedSubtotal);
    const wantsVoid = incoming.status === 'void' && before?.status !== 'void';
    if (wantsVoid && staff.role !== 'admin') throw new HttpError(403, 'Only an admin can void a whole bill.', 'FORBIDDEN');

    const baseRecord: GuestFolio = before
      ? { ...before, guestName: incoming.guestName || before.guestName, settledAt: incoming.settledAt ?? before.settledAt, settledByName: incoming.settledByName ?? before.settledByName, status: wantsVoid ? 'void' : before.status === 'void' ? 'void' : incoming.status === 'settled' ? 'settled' : before.status }
      : { ...incoming, status: 'open' };
    const saved = recalculateFolioTotals({ ...baseRecord, ...discount }, charges, payments, gst);

    if (newRefunds.length) {
      const refunded = newRefunds.reduce((s, p) => s + p.amount, 0);
      const withoutNew = recalculateFolioTotals({ ...baseRecord, ...discount }, charges, payments.filter((p) => !newRefunds.includes(p)), gst);
      if (refunded > (withoutNew.creditOwed || 0) + 0.001) {
        throw new HttpError(400, `A refund can be at most the credit owed to the guest (₹${(withoutNew.creditOwed || 0).toLocaleString('en-IN')}).`, 'REFUND_TOO_LARGE');
      }
    }

    await upsertRecord('folios', saved, actor, tx);
    await audit({ actor, action: before ? 'update' : 'create', entity: 'folios', entityId: saved.id, before, after: saved, ip }, tx);
    return saved;
  });
}

/**
 * A deposit / advance received for a website request before a room is assigned. Kept on
 * the request's own bill and carried to the room bill when the desk assigns the room.
 */
export async function recordWebAdvance(webBookingId: string, payment: Partial<FolioPayment>, staff: StaffContext, ip?: string): Promise<GuestFolio> {
  const row = await getBookingRow(webBookingId);
  if (!row || row.kind !== 'web') throw new HttpError(404, 'Website booking not found.');
  const web = row.data as Booking;
  if (row.status === 'cancelled') throw new HttpError(409, 'This request is cancelled.');
  const linked = await getSql()<{ id: string }[]>`
    select id from pms.bookings where kind = 'crm' and linked_booking_id = ${webBookingId} and status not in ('cancelled') limit 1`;
  if (linked[0]) throw new HttpError(409, 'A room is already assigned: record the payment on the guest’s room bill instead.', 'ALREADY_ASSIGNED');
  const gst = await getGstConfig();
  const actor = `staff:${staff.id}`;
  return withFolioLock(webBookingId, async (tx, current) => {
    const folio =
      current ||
      emptyFolio(`fol-${crypto.randomUUID()}`, `ADV-${row.reference}`, {
        id: webBookingId,
        guestId: `gst-${webBookingId}`,
        guestName: web.guest_name || 'Guest',
        roomNumber: 0,
        roomName: `Website request ${row.reference}`,
      });
    const payments = applyPaymentRules(current, { ...folio, payments: [...folio.payments, { ...payment, id: `pay-${crypto.randomUUID()}`, folioId: folio.id } as FolioPayment] }, staff);
    const saved = recalculateFolioTotals(folio, folio.charges, payments, gst);
    await upsertRecord('folios', saved, actor, tx);
    await audit({ actor, action: 'web_advance', entity: 'folios', entityId: saved.id, before: current, after: saved, ip }, tx);
    if (web.payment_status === 'unpaid') {
      await tx`update pms.bookings set data = jsonb_set(data, '{payment_status}', '"deposit_paid"'), updated_at = now() where id = ${webBookingId}`;
    }
    return saved;
  });
}
