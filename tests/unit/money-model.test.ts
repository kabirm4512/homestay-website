import { describe, expect, it } from 'vitest';
import { DEFAULT_GST_CONFIG } from '@/lib/gst';
import { recalculateFolioTotals, chargeTax } from '@/lib/folio';
import { applyChargeRules, applyDiscountRules, applyPaymentRules } from '@/lib/server/money-rules';
import { webBookingAddons } from '@/lib/server/folio-store';
import { summarizeMoney } from '@/lib/reports-core';
import { splitGuestBills } from '@/lib/guest-bills';
import type { Booking } from '@/types';
import type { CRMBooking, Expense, FolioCharge, FolioPayment, GuestFolio } from '@/types/crm';

const OFF = DEFAULT_GST_CONFIG;
const ON = { ...DEFAULT_GST_CONFIG, enabled: true };
const manager = { id: 'm1', email: 'm@x', fullName: 'Pema', role: 'manager' as const, mustChangePassword: false };
const admin = { id: 'a1', email: 'a@x', fullName: 'Owner', role: 'admin' as const, mustChangePassword: false };
const now = new Date('2026-10-09T08:00:00Z');
let n = 0;
const ch = (o: Partial<FolioCharge>): FolioCharge => ({ id: `c${n++}`, folioId: 'f', category: 'room_tariff', chargeStatus: 'posted', title: 't', amount: 1000, postedAt: '2026-10-09T07:50:00Z', ...o });
const pay = (o: Partial<FolioPayment>): FolioPayment => ({ id: `p${n++}`, folioId: 'f', amount: 100, paymentMethod: 'cash', collectedAt: '2026-10-09T05:00:00Z', ...o });
const folio = (o: Partial<GuestFolio> = {}): GuestFolio => ({
  id: 'f', bookingId: 'b1', guestId: 'g', guestName: 'G', roomNumber: 3, roomName: 'R3', folioNumber: 'F1', status: 'open',
  totalRoomCharges: 0, totalFbCharges: 0, totalAddonCharges: 0, totalTax: 0, discountAmount: 0, netPayable: 0, totalPaid: 0, balanceDue: 0,
  charges: [], payments: [], ...o,
});

describe('bill maths', () => {
  it('pending lines (unapproved orders) are shown but not billed', () => {
    const f = recalculateFolioTotals(folio(), [ch({ amount: 5000 }), ch({ category: 'food_beverage', chargeStatus: 'pending', amount: 800 })], [pay({ amount: 5000 })], OFF);
    expect(f.balanceDue).toBe(0);
    expect(f.pendingTotal).toBe(800);
  });
  it('an overpayment is a credit owed to the guest, and a refund clears it', () => {
    const f = recalculateFolioTotals(folio(), [ch({ amount: 10000 })], [pay({ amount: 12000 })], OFF);
    expect(f.creditOwed).toBe(2000);
    expect(f.status).toBe('open');
    const g = recalculateFolioTotals(f, f.charges, [...f.payments, pay({ amount: 2000, kind: 'refund' })], OFF);
    expect(g.creditOwed).toBe(0);
    expect(g.totalPaid).toBe(10000);
    expect(g.status).toBe('settled');
  });
  it('a manual room charge above ₹7,500 is taxed at the high slab when GST is on', () => {
    expect(chargeTax(ch({ amount: 9000 }), ON)).toBe(1620);
  });
  it('tax is frozen on each billed line, so a later GST change does not re-tax the bill', () => {
    const f = recalculateFolioTotals(folio(), [ch({ category: 'food_beverage', amount: 1000 })], [], ON);
    expect(f.charges[0].taxAmount).toBe(50);
    const g = recalculateFolioTotals(f, f.charges, [], { ...ON, foodRate: 18 });
    expect(g.totalTax).toBe(50);
  });
});

describe('bill line rules (no lost or rewritten lines)', () => {
  it('a device with an older copy cannot drop lines or payments', () => {
    const stored = folio({ charges: [ch({ id: 'x' }), ch({ id: 'y', category: 'food_beverage' })], payments: [pay({ id: 'p' })] });
    const stale = folio({ charges: [ch({ id: 'x' })], payments: [] });
    expect(applyChargeRules(stored, stale, manager, now).map((c) => c.id).sort()).toEqual(['x', 'y']);
    expect(applyPaymentRules(stored, stale, manager, now).map((p) => p.id)).toEqual(['p']);
  });
  it('status only moves forward and amounts never change', () => {
    const stored = folio({ charges: [ch({ id: 'x', chargeStatus: 'void', voidReason: 'dup' })] });
    const back = applyChargeRules(stored, folio({ charges: [ch({ id: 'x', chargeStatus: 'posted', amount: 5 })] }), admin, now);
    expect(back[0]).toMatchObject({ chargeStatus: 'void', amount: 1000 });
  });
  it('voiding needs a reason; managers may void their own recent lines, admins any', () => {
    const own = ch({ id: 'o', postedById: 'm1', postedAt: '2026-10-09T07:50:00Z' });
    const old = ch({ id: 'old', postedById: 'm1', postedAt: '2026-10-08T07:50:00Z' });
    const stored = folio({ charges: [own, old] });
    expect(() => applyChargeRules(stored, folio({ charges: [{ ...own, chargeStatus: 'void' }, old] }), manager, now)).toThrow(/reason/);
    expect(applyChargeRules(stored, folio({ charges: [{ ...own, chargeStatus: 'void', voidReason: 'wrong room' }, old] }), manager, now)[0]).toMatchObject({ chargeStatus: 'void', voidedByName: 'Pema' });
    expect(() => applyChargeRules(stored, folio({ charges: [own, { ...old, chargeStatus: 'void', voidReason: 'wrong' }] }), manager, now)).toThrow(/admin/);
    expect(applyChargeRules(stored, folio({ charges: [own, { ...old, chargeStatus: 'void', voidReason: 'wrong' }] }), admin, now)[1].chargeStatus).toBe('void');
  });
  it('new lines are stamped with the server time and the signed-in person', () => {
    const out = applyChargeRules(null, folio({ charges: [ch({ id: 'n', postedAt: '2020-01-01T00:00:00Z', postedByName: 'Someone' })] }), manager, now);
    expect(out[0]).toMatchObject({ postedAt: now.toISOString(), postedById: 'm1', postedByName: 'Pema' });
  });
  it('discounts need a reason; managers are limited to 10% (max ₹1,000)', () => {
    const before = folio();
    expect(() => applyDiscountRules(before, folio({ discountAmount: 500 }), manager, 10000)).toThrow(/reason/);
    expect(applyDiscountRules(before, folio({ discountAmount: 500, discountReason: 'repeat guest' }), manager, 10000).discountAmount).toBe(500);
    expect(() => applyDiscountRules(before, folio({ discountAmount: 1500, discountReason: 'repeat guest' }), manager, 20000)).toThrow(/up to/);
    expect(applyDiscountRules(before, folio({ discountAmount: 1500, discountReason: 'owner approved' }), admin, 20000).discountAmount).toBe(1500);
  });
});

describe('website add-ons reach the bill', () => {
  it('reads structured add-ons, and older bookings from their notes', () => {
    expect(webBookingAddons({ addons: [{ code: 'airport_transfer', title: 'T', amount: 2800 }] } as Booking)).toHaveLength(1);
    const old = webBookingAddons({ nights: 3, special_requests: 'Late arrival [Add-on: Airport/Railway transfer ₹2800] [Add-on: Bike rental ₹800/night]' } as Booking);
    expect(old.map((a) => a.amount)).toEqual([2800, 2400]);
  });
});

describe('one set of money numbers', () => {
  const booking = { id: 'b1', roomId: 'r1', checkInDate: '2026-10-08', checkOutDate: '2026-10-10', bookingStatus: 'checked_in' } as CRMBooking;
  const future = { id: 'b2', roomId: 'r2', checkInDate: '2026-12-20', checkOutDate: '2026-12-22', bookingStatus: 'confirmed' } as CRMBooking;
  const folios = [
    folio({
      id: 'f1', bookingId: 'b1',
      charges: [
        ch({ amount: 9000, sourceReferenceType: 'booking', postedAt: '2026-09-30T05:00:00Z' }),
        ch({ category: 'food_beverage', amount: 600, postedAt: '2026-10-09T05:00:00Z' }),
        ch({ category: 'miscellaneous', amount: 1000, title: 'Celebration Add-on: Cake', sourceReferenceId: 'ord-cel-1', postedAt: '2026-10-09T05:00:00Z' }),
        ch({ category: 'food_beverage', amount: 300, chargeStatus: 'pending', postedAt: '2026-10-09T05:00:00Z' }),
      ],
      payments: [pay({ amount: 3000, paymentMethod: 'upi', collectedAt: '2026-10-08T05:00:00Z' }), pay({ amount: 500, voidedAt: 'x' })],
      balanceDue: 7600,
    }),
    folio({ id: 'f2', bookingId: 'b2', charges: [ch({ amount: 8000, sourceReferenceType: 'booking', postedAt: '2026-10-01T05:00:00Z' })], payments: [pay({ amount: 2000, collectedAt: '2026-10-01T05:00:00Z' })], totalPaid: 2000, balanceDue: 6000 }),
  ];
  const expenses = [
    { id: 'e1', expenseDate: '2026-10-09', amount: 1850, paymentMethod: 'cash', masterCategory: 'utilities', status: 'submitted' },
    { id: 'e2', expenseDate: '2026-10-09', amount: 500, paymentMethod: 'cash', masterCategory: 'groceries', status: 'void' },
  ] as Expense[];
  const s = summarizeMoney('2026-10-08', '2026-10-09', { folios, bookings: [booking, future], expenses, roomIds: ['r1', 'r2'], blocks: [], gst: OFF });

  it('room revenue counts on the nights stayed, not the booking date', () => {
    expect(s.revenue.byStream.rooms).toBe(9000); // both nights (8th, 9th) of the stay
    expect(summarizeMoney('2026-10-01', '2026-10-01', { folios, bookings: [booking, future], expenses, roomIds: ['r1', 'r2'], blocks: [], gst: OFF }).revenue.byStream.rooms).toBe(0);
  });
  it('celebrations have their own stream; pending lines and voids are excluded', () => {
    expect(s.revenue.byStream.celebrations).toBe(1000);
    expect(s.revenue.byStream.dine_in).toBe(600);
    expect(s.collections.total).toBe(3000);
    expect(s.expenses.total).toBe(1850);
    expect(s.profit).toBe(s.revenue.total - 1850);
  });
  it('receivables are started stays only; future stays are advances held', () => {
    expect(s.receivables).toBe(7600);
    expect(s.advancesHeld).toBe(2000);
    expect(s.occupancy).toBe(50); // 1 of 2 rooms on each night
  });
});

describe('guest bills with pending items', () => {
  it('pending services are listed but not in the bill total', () => {
    const f = recalculateFolioTotals(folio(), [ch({ amount: 9000 }), ch({ category: 'food_beverage', amount: 300, chargeStatus: 'pending' })], [], OFF);
    const { services, room } = splitGuestBills(f, { id: 'b1', roomName: 'R', totalNights: 2, mealPlan: 'CP', checkInDate: '2026-10-08', checkOutDate: '2026-10-10' } as CRMBooking, OFF);
    expect(services.lines).toHaveLength(1);
    expect(services.total).toBe(0);
    expect(room.total + services.total).toBe(f.netPayable);
  });
});
