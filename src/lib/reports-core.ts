import type { CRMBooking, Expense, ExpenseMasterCategory, FolioCharge, GuestFolio, PaymentMethod, RoomBlock } from '@/types/crm';
import { DEFAULT_GST_CONFIG, GstConfig, roundMoney } from './gst';
import { chargeTax, isLivePayment } from './folio';
import { addCalendarDays, nightsBetween, todayInIST } from './tariff-calculator';

/**
 * THE money numbers. Every screen (dashboard, ledger, day close, owner digest) uses this one
 * function, so the same date range always gives the same figures.
 *
 * Definitions (see docs/backend-product-review-2026-10.md §3.2):
 * - Revenue (net of GST): billed lines (posted, not pending/void) less any discount, by the date
 *   the service was given. Room charges count on each night of the stay, not the booking date.
 * - GST collected: tax on those same lines (₹0 while GST is switched off).
 * - Collections: money received (cash basis) by method on the day it was recorded; refunds shown
 *   separately and subtracted for net collections. Voided entries never count.
 * - Expenses: logged, non-void expenses by their date, by category.
 * - Net operating profit: revenue − expenses.
 * - Outstanding receivables: unpaid balances of stays that have started (in-house or departed).
 * - Advances held: money received for stays that have not started yet.
 * - Occupancy / ADR / RevPAR: from booked room-nights against rooms in service (blocks excluded).
 */

export type Stream = 'rooms' | 'dine_in' | 'transport' | 'rentals' | 'celebrations' | 'laundry' | 'other';
export const STREAM_LABELS: Record<Stream, string> = {
  rooms: 'Rooms',
  dine_in: 'Dine-in',
  transport: 'Transfers',
  rentals: 'Rentals',
  celebrations: 'Celebrations & requests',
  laundry: 'Laundry',
  other: 'Other',
};

export interface SummaryInput {
  folios: GuestFolio[];
  bookings: CRMBooking[];
  expenses: Expense[];
  roomIds: string[];
  blocks: RoomBlock[];
  gst?: GstConfig;
}

export interface MoneySummary {
  from: string;
  to: string;
  revenue: { total: number; byStream: Record<Stream, number> };
  gst: number;
  billed: number;
  collections: { total: number; byMethod: Record<PaymentMethod, number>; refunds: number; net: number; count: number };
  expenses: { total: number; byCategory: Partial<Record<ExpenseMasterCategory, number>>; count: number };
  profit: number;
  receivables: number;
  advancesHeld: number;
  creditOwed: number;
  occupancy: number;
  adr: number;
  revpar: number;
  roomNightsSold: number;
  roomNightsAvailable: number;
  daily: { date: string; revenue: number; collections: number; expenses: number }[];
  topOutstanding: { folioId: string; bookingId: string; guestName: string; roomNumber: number; balance: number; stayStarted: string; status: string }[];
}

const zeroStreams = (): Record<Stream, number> => ({ rooms: 0, dine_in: 0, transport: 0, rentals: 0, celebrations: 0, laundry: 0, other: 0 });
const zeroMethods = (): Record<PaymentMethod, number> => ({ cash: 0, upi: 0, bank_transfer: 0, card: 0 });

export function istDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : todayInIST(d);
}

export function streamOf(c: FolioCharge): Stream {
  switch (c.category) {
    case 'room_tariff':
      return 'rooms';
    case 'food_beverage':
      return 'dine_in';
    case 'transport_transfer':
      return 'transport';
    case 'vehicle_rental':
      return 'rentals';
    case 'laundry':
      return 'laundry';
    default:
      return (c.sourceReferenceId || '').startsWith('ord-cel-') || /celebration/i.test(c.title) ? 'celebrations' : 'other';
  }
}

/** Spreads a line over the dates it was served: room nights for stay charges, else the posting date. */
function serviceDates(c: FolioCharge, booking: CRMBooking | undefined): string[] {
  if (c.category === 'room_tariff' && booking && c.sourceReferenceType === 'booking') {
    const n = nightsBetween(booking.checkInDate, booking.checkOutDate) || 0;
    if (n > 0) return Array.from({ length: n }, (_, i) => addCalendarDays(booking.checkInDate, i));
  }
  return [istDate(c.postedAt)];
}

export function summarizeMoney(from: string, to: string, input: SummaryInput): MoneySummary {
  const gstCfg = input.gst ?? DEFAULT_GST_CONFIG;
  const inRange = (d: string) => d >= from && d <= to;
  const bookingById = new Map(input.bookings.map((b) => [b.id, b]));
  const days: string[] = [];
  for (let d = from; d <= to && days.length < 400; d = addCalendarDays(d, 1)) days.push(d);
  const daily = new Map(days.map((d) => [d, { date: d, revenue: 0, collections: 0, expenses: 0 }]));

  const byStream = zeroStreams();
  let gst = 0;
  const byMethod = zeroMethods();
  let refunds = 0;
  let paymentsCount = 0;
  let receivables = 0;
  let advancesHeld = 0;
  let creditOwed = 0;
  const outstanding: MoneySummary['topOutstanding'] = [];

  for (const f of input.folios) {
    if (f.status === 'void') continue;
    const booking = bookingById.get(f.bookingId);
    const billed = (f.charges || []).filter((c) => c.chargeStatus === 'posted');
    const gross = billed.reduce((s, c) => s + c.amount, 0);
    const keep = gross > 0 ? 1 - Math.min(Math.max(0, f.discountAmount || 0), gross) / gross : 1;
    for (const c of billed) {
      const dates = serviceDates(c, booking);
      const per = (c.amount * keep) / dates.length;
      const perTax = (chargeTax(c, gstCfg) * keep) / dates.length;
      for (const d of dates) {
        if (!inRange(d)) continue;
        byStream[streamOf(c)] += per;
        gst += perTax;
        const day = daily.get(d);
        if (day) day.revenue += per;
      }
    }
    for (const p of f.payments || []) {
      if (!isLivePayment(p)) continue;
      const d = istDate(p.signedOffAt || p.collectedAt);
      if (!inRange(d)) continue;
      if (p.kind === 'refund') {
        refunds += p.amount;
        const day = daily.get(d);
        if (day) day.collections -= p.amount;
      } else {
        byMethod[p.paymentMethod] = (byMethod[p.paymentMethod] || 0) + p.amount;
        paymentsCount += 1;
        const day = daily.get(d);
        if (day) day.collections += p.amount;
      }
    }
    // Balances as at the end of the range
    const stayStart = booking?.checkInDate || '';
    const cancelled = booking?.bookingStatus === 'cancelled';
    const started = Boolean(booking) && !cancelled && stayStart <= to;
    if (started && (f.balanceDue || 0) > 0) {
      receivables += f.balanceDue;
      outstanding.push({ folioId: f.id, bookingId: f.bookingId, guestName: f.guestName, roomNumber: f.roomNumber, balance: f.balanceDue, stayStarted: stayStart, status: booking?.bookingStatus || '' });
    }
    if (!started && !cancelled) advancesHeld += Math.max(0, f.totalPaid || 0);
    creditOwed += f.creditOwed || 0;
  }

  const byCategory: Partial<Record<ExpenseMasterCategory, number>> = {};
  let expensesTotal = 0;
  let expensesCount = 0;
  for (const e of input.expenses) {
    if (e.status === 'void' || !inRange(e.expenseDate)) continue;
    byCategory[e.masterCategory] = roundMoney((byCategory[e.masterCategory] || 0) + e.amount);
    expensesTotal += e.amount;
    expensesCount += 1;
    const day = daily.get(e.expenseDate);
    if (day) day.expenses += e.amount;
  }

  // Occupancy
  const roomSet = new Set(input.roomIds);
  let available = 0;
  let sold = 0;
  for (const d of days) {
    const blocked = new Set(input.blocks.filter((b) => roomSet.has(b.roomId) && b.fromDate <= d && b.toDate > d).map((b) => b.roomId));
    available += roomSet.size - blocked.size;
    const occupied = new Set(
      input.bookings
        .filter((b) => roomSet.has(b.roomId) && b.bookingStatus !== 'cancelled' && b.checkInDate <= d && b.checkOutDate > d)
        .map((b) => b.roomId)
    );
    sold += occupied.size;
  }

  const r = (n: number) => roundMoney(n);
  const revenueTotal = r(Object.values(byStream).reduce((s, v) => s + v, 0));
  const collectionsTotal = r(Object.values(byMethod).reduce((s, v) => s + v, 0));
  for (const k of Object.keys(byStream) as Stream[]) byStream[k] = r(byStream[k]);
  for (const k of Object.keys(byMethod) as PaymentMethod[]) byMethod[k] = r(byMethod[k]);
  return {
    from,
    to,
    revenue: { total: revenueTotal, byStream },
    gst: r(gst),
    billed: r(revenueTotal + gst),
    collections: { total: collectionsTotal, byMethod, refunds: r(refunds), net: r(collectionsTotal - refunds), count: paymentsCount },
    expenses: { total: r(expensesTotal), byCategory, count: expensesCount },
    profit: r(revenueTotal - expensesTotal),
    receivables: r(receivables),
    advancesHeld: r(advancesHeld),
    creditOwed: r(creditOwed),
    occupancy: available > 0 ? Math.round((sold / available) * 1000) / 10 : 0,
    adr: sold > 0 ? r(byStream.rooms / sold) : 0,
    revpar: available > 0 ? r(byStream.rooms / available) : 0,
    roomNightsSold: sold,
    roomNightsAvailable: available,
    daily: days.map((d) => {
      const x = daily.get(d)!;
      return { date: d, revenue: r(x.revenue), collections: r(x.collections), expenses: r(x.expenses) };
    }),
    topOutstanding: outstanding.sort((a, b) => b.balance - a.balance).slice(0, 10),
  };
}
