import { describe, expect, it } from 'vitest';
import { DEFAULT_GST_CONFIG, calculateBookingTotals, calculateStayGst, gstPriceNote, sanitizeGstConfig } from '@/lib/gst';
import { apportionTax, recalculateFolioTotals } from '@/lib/folio';
import { splitGuestBills } from '@/lib/guest-bills';
import { applyPaymentRules, prepareNewExpense, applyExpenseReview } from '@/lib/server/money-rules';
import { folioForBooking } from '@/lib/folio-links';
import type { DynamicTariffResult } from '@/lib/tariff-calculator';
import type { CRMBooking, Expense, FolioCharge, FolioPayment, GuestFolio } from '@/types/crm';

const OFF = DEFAULT_GST_CONFIG;
const ON = { ...DEFAULT_GST_CONFIG, enabled: true };
const manager = { id: 'm1', email: 'm@x', fullName: 'Pema', role: 'manager' as const, mustChangePassword: false };
const admin = { id: 'a1', email: 'a@x', fullName: 'Owner', role: 'admin' as const, mustChangePassword: false };

const stay = (nights: number[]): DynamicTariffResult => ({
  totalAmount: nights.reduce((s, n) => s + n, 0), baseAmount: nights.reduce((s, n) => s + n, 0),
  extraAdultsCount: 0, extraAdultRate: 0, extraAdultsCharge: 0, extraChildrenCount: 0, extraChildRate: 0, extraChildrenCharge: 0,
  nights: nights.length, avgRatePerNight: nights[0], mealPlan: 'CP',
  breakdown: nights.map((amount, i) => ({ date: `2026-10-0${i + 1}`, rateName: 'x', seasonType: 'regular', amount })),
} as DynamicTariffResult);
const ch = (o: Partial<FolioCharge>): FolioCharge => ({ id: Math.random().toString(36).slice(2), folioId: 'f', category: 'room_tariff', chargeStatus: 'posted', title: 't', amount: 1000, postedAt: '2026-10-09T05:00:00Z', ...o });
const pay = (o: Partial<FolioPayment>): FolioPayment => ({ id: 'p' + Math.random(), folioId: 'f', amount: 100, paymentMethod: 'cash', collectedAt: '2026-10-09T05:00:00Z', ...o });
const folio = (o: Partial<GuestFolio> = {}): GuestFolio => ({
  id: 'f', bookingId: 'b1', guestId: 'g', guestName: 'G', roomNumber: 3, roomName: 'R3', folioNumber: 'F1', status: 'open',
  totalRoomCharges: 0, totalFbCharges: 0, totalAddonCharges: 0, totalTax: 0, discountAmount: 0, netPayable: 0, totalPaid: 0, balanceDue: 0,
  charges: [], payments: [], ...o,
});

describe('GST switched off (the shipped default)', () => {
  it('is off by default, and older saved settings without the switch are read as off', () => {
    expect(DEFAULT_GST_CONFIG.enabled).toBe(false);
    expect(sanitizeGstConfig({ foodRate: 5 }).enabled).toBe(false);
    expect(sanitizeGstConfig({ enabled: true }).enabled).toBe(true);
  });
  it('website quotes carry no GST, including suites above ₹7,500 and add-ons', () => {
    expect(calculateStayGst(stay([9000, 9000]), OFF).gstAmount).toBe(0);
    const t = calculateBookingTotals([stay([9000])], 2800, OFF);
    expect(t.gstAmount).toBe(0);
    expect(t.total).toBe(11800);
    expect(gstPriceNote(OFF)).toBe('');
    expect(gstPriceNote(ON)).toBe('+ GST');
  });
  it('open folios lose their GST; lines store ₹0 tax', () => {
    const charges = [ch({ amount: 8000, taxAmount: 1440 }), ch({ category: 'food_beverage', amount: 1000 })];
    const f = recalculateFolioTotals(folio(), charges, [], OFF);
    expect(f.totalTax).toBe(0);
    expect(f.netPayable).toBe(9000);
    expect(f.charges.every((c) => c.taxAmount === 0)).toBe(true);
  });
  it('settled folios keep the GST they were issued with (missing line tax frozen at the issued rate)', () => {
    const charges = [ch({ amount: 8000, taxAmount: 1440 }), ch({ category: 'food_beverage', amount: 1000 })];
    const issued = recalculateFolioTotals(folio(), charges, [pay({ amount: 10490 })], ON);
    expect(issued.status).toBe('settled');
    const after = recalculateFolioTotals(issued, issued.charges, issued.payments, OFF);
    expect(after.totalTax).toBe(1490);
    expect(after.netPayable).toBe(10490);
  });
  it('apportioning a stay’s GST gives ₹0 lines when off', () => {
    expect(apportionTax([ch({}), ch({})], 100, OFF).map((l) => l.taxAmount)).toEqual([0, 0]);
  });
});

describe('voided collections', () => {
  it('stop counting towards what was paid; a void folio stays void', () => {
    const f = recalculateFolioTotals(folio(), [ch({ amount: 1000 })], [pay({ amount: 1000, voidedAt: '2026-10-09T06:00:00Z' })], OFF);
    expect(f.totalPaid).toBe(0);
    expect(f.balanceDue).toBe(1000);
    const v = recalculateFolioTotals(folio({ status: 'void' }), [ch({ amount: 1000 })], [pay({ amount: 1000 })], OFF);
    expect(v.status).toBe('void');
  });
});

describe('collections: managers only, signed, server-stamped', () => {
  const now = new Date('2026-10-09T08:00:00Z');
  it('a manager’s signed collection is stamped with their account and the server time', () => {
    const out = applyPaymentRules(null, folio({ payments: [pay({ id: 'n1', amount: 500, signOffConfirmed: true, collectedById: 'someone-else', collectedAt: '2020-01-01T00:00:00Z' })] }), manager, now);
    expect(out[0]).toMatchObject({ collectedById: 'm1', signedOffById: 'm1', signedOffByName: 'Pema', collectedAt: now.toISOString(), signedOffAt: now.toISOString() });
  });
  it('refuses admins, unsigned entries and zero amounts', () => {
    expect(() => applyPaymentRules(null, folio({ payments: [pay({ signOffConfirmed: true })] }), admin, now)).toThrow(/manager/);
    expect(() => applyPaymentRules(null, folio({ payments: [pay({})] }), manager, now)).toThrow(/confirmation/);
    expect(() => applyPaymentRules(null, folio({ payments: [pay({ amount: 0, signOffConfirmed: true })] }), manager, now)).toThrow(/amount/);
  });
  it('recorded collections cannot be changed or removed (missing ones are kept); only an admin can void with a reason', () => {
    const before = folio({ payments: [pay({ id: 'x', amount: 500 })] });
    // A stale device copy that is missing a recorded collection keeps it rather than deleting it.
    expect(applyPaymentRules(before, folio({ payments: [] }), admin, now).map((p) => p.id)).toEqual(['x']);
    expect(() => applyPaymentRules(before, folio({ payments: [pay({ id: 'x', amount: 400 })] }), admin, now)).toThrow(/changed/);
    expect(() => applyPaymentRules(before, folio({ payments: [pay({ id: 'x', amount: 500, voidReason: 'dup' + 'licate' })] }), manager, now)).toThrow(/admin/);
    const voided = applyPaymentRules(before, folio({ payments: [pay({ id: 'x', amount: 500, voidReason: 'duplicate entry' })] }), admin, now);
    expect(voided[0]).toMatchObject({ voidedById: 'a1', voidReason: 'duplicate entry', amount: 500 });
  });
});

describe('expenses: managers only, signed, admin review', () => {
  const now = new Date('2026-10-09T08:00:00Z');
  it('ignores the device’s date, name and time', () => {
    const e = prepareNewExpense({ id: 'exp-1', amount: 1850, paymentMethod: 'cash', masterCategory: 'utilities', subTag: 'LPG cylinder', signOffConfirmed: true, loggedByName: 'Someone', expenseDate: '2020-01-01', createdAt: '2020-01-01' } as Expense, manager, now);
    expect(e).toMatchObject({ expenseDate: '2026-10-09', loggedById: 'm1', loggedByName: 'Pema', createdAt: now.toISOString(), signedOffAt: now.toISOString(), status: 'submitted' });
  });
  it('refuses admins and unsigned entries', () => {
    expect(() => prepareNewExpense({ id: 'e', amount: 10, paymentMethod: 'cash', masterCategory: 'groceries', subTag: 'Milk', signOffConfirmed: true }, admin, now)).toThrow(/manager/);
    expect(() => prepareNewExpense({ id: 'e', amount: 10, paymentMethod: 'cash', masterCategory: 'groceries', subTag: 'Milk' }, manager, now)).toThrow(/confirmation/);
  });
  it('admins approve or void with a reason; managers cannot edit', () => {
    const e = prepareNewExpense({ id: 'e', amount: 10, paymentMethod: 'cash', masterCategory: 'groceries', subTag: 'Milk', signOffConfirmed: true }, manager, now);
    expect(() => applyExpenseReview(e, { amount: 5 }, manager, now)).toThrow(/void/);
    expect(applyExpenseReview(e, { status: 'approved' }, admin, now)).toMatchObject({ status: 'approved', approvedById: 'a1' });
    expect(() => applyExpenseReview(e, { status: 'void' }, admin, now)).toThrow(/reason/);
    expect(applyExpenseReview(e, { status: 'void', voidReason: 'entered twice' }, admin, now)).toMatchObject({ status: 'void', amount: 10 });
  });
});

describe('guest bills: room and services, separately', () => {
  const booking = { id: 'b1', roomName: 'Deluxe 3', totalNights: 2, mealPlan: 'CP', checkInDate: '2026-10-08', checkOutDate: '2026-10-10', totalRoomAmount: 9000, advancePaid: 0 } as CRMBooking;
  it('splits lines by kind and the two bills add up to the folio', () => {
    const charges = [
      ch({ amount: 9000, title: 'Stay Tariff' }),
      ch({ category: 'food_beverage', amount: 700, title: 'Food Order #ORD-1' }),
      ch({ category: 'transport_transfer', amount: 2100, title: 'Transfer: NJP' }),
      ch({ category: 'vehicle_rental', amount: 800, title: 'Rental: Scooty' }),
      ch({ category: 'miscellaneous', amount: 1000, title: 'Celebration Add-on: Cake', sourceReferenceId: 'ord-cel-1' }),
      ch({ category: 'food_beverage', amount: 300, chargeStatus: 'void' }),
    ];
    const f = recalculateFolioTotals(folio(), charges, [pay({ amount: 10000 })], OFF);
    const { room, services, totalDue } = splitGuestBills(f, booking, OFF);
    expect(room.total).toBe(9000);
    expect(services.lines.map((l) => l.group)).toEqual(['food', 'transfers', 'rentals', 'special']);
    expect(services.total).toBe(4600);
    expect(room.total + services.total).toBe(f.netPayable);
    // payments go to the room bill first
    expect(room.balance).toBe(0);
    expect(services.paid).toBe(1000);
    expect(totalDue).toBe(f.balanceDue);
  });
});

describe('money is linked to a booking by id only', () => {
  it('never picks another guest’s folio in the same room', () => {
    const folios = [folio({ id: 'future', bookingId: 'B' }), folio({ id: 'other', bookingId: 'C' })];
    expect(folioForBooking(folios, { id: 'A' })).toBeNull();
    expect(folioForBooking([...folios, folio({ id: 'mine', bookingId: 'A' })], { id: 'A' })?.id).toBe('mine');
  });
});
