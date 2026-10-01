import { describe, expect, it } from 'vitest';
import { DEFAULT_GST_CONFIG, calculateBookingTotals, calculateStayGst, sanitizeGstConfig } from '@/lib/gst';
import { accommodationGstForTotal, apportionTax, chargeTax, recalculateFolioTotals } from '@/lib/folio';
import type { DynamicTariffResult } from '@/lib/tariff-calculator';
import type { FolioCharge, GuestFolio } from '@/types/crm';

function stay(nightAmounts: number[], extrasTotal = 0): DynamicTariffResult {
  const base = nightAmounts.reduce((s, n) => s + n, 0);
  return {
    totalAmount: base + extrasTotal,
    baseAmount: base,
    extraAdultsCount: extrasTotal > 0 ? 1 : 0,
    extraAdultRate: extrasTotal / nightAmounts.length,
    extraAdultsCharge: extrasTotal,
    extraChildrenCount: 0,
    extraChildRate: 0,
    extraChildrenCharge: 0,
    nights: nightAmounts.length,
    avgRatePerNight: Math.round((base + extrasTotal) / nightAmounts.length),
    mealPlan: 'CP',
    breakdown: nightAmounts.map((amount, i) => ({ date: `2026-10-0${i + 1}`, rateName: 'x', seasonType: 'regular', amount })),
  };
}

describe('accommodation GST (per room-night slab)', () => {
  it('5% up to ₹7,500 a night', () => {
    expect(calculateStayGst(stay([7500, 7500])).gstAmount).toBe(750);
  });
  it('18% above ₹7,500 a night', () => {
    expect(calculateStayGst(stay([7501])).gstAmount).toBe(1350.18);
  });
  it('taxes each night on its own value (stay crossing the line)', () => {
    const g = calculateStayGst(stay([7000, 8000]));
    expect(g.gstAmount).toBe(350 + 1440);
    expect(g.byRate[5].taxable).toBe(7000);
    expect(g.byRate[18].taxable).toBe(8000);
  });
  it('extra-person charges count towards the night value', () => {
    // 7,000 room + 1,200 extra adult = 8,200 a night → 18%
    expect(calculateStayGst(stay([7000], 1200)).gstAmount).toBe(1476);
  });
  it('shows (does not add) GST when tariffs include it', () => {
    const cfg = { ...DEFAULT_GST_CONFIG, tariffsIncludeGst: true };
    const g = calculateStayGst(stay([5250]), cfg);
    expect(g.totalWithGst).toBe(5250);
    expect(g.gstAmount).toBe(250);
    expect(g.taxableAmount).toBe(5000);
  });
  it('sanitizes bad config back to defaults', () => {
    expect(sanitizeGstConfig({ accommodationLowRate: -1, foodRate: 'x' })).toEqual(DEFAULT_GST_CONFIG);
  });
  it('manual totals use the average night value', () => {
    expect(accommodationGstForTotal(10000, 2)).toBe(500);
    expect(accommodationGstForTotal(20000, 2)).toBe(3600);
    expect(accommodationGstForTotal(5250, 1, { ...DEFAULT_GST_CONFIG, tariffsIncludeGst: true })).toBe(250);
  });
});

describe('booking totals (website quote = booking API)', () => {
  it('adds transport GST on add-ons', () => {
    const t = calculateBookingTotals([stay([4500, 4500])], 2800);
    expect(t.roomGst).toBe(450);
    expect(t.addonsGst).toBe(140);
    expect(t.total).toBe(9000 + 450 + 2800 + 140);
    expect(t.total).toBe(t.roomSubtotal + t.addonsTotal + t.gstAmount);
  });
  it('keeps the quoted price when tariffs include GST', () => {
    const t = calculateBookingTotals([stay([5250])], 2940, { ...DEFAULT_GST_CONFIG, tariffsIncludeGst: true });
    expect(t.total).toBe(5250 + 2940);
    expect(t.addonsGst).toBe(140);
  });
});

const charge = (over: Partial<FolioCharge>): FolioCharge => ({
  id: Math.random().toString(36).slice(2),
  folioId: 'f1',
  category: 'room_tariff',
  description: 'x',
  amount: 1000,
  quantity: 1,
  unitPrice: 1000,
  chargeStatus: 'posted',
  postedAt: '2026-10-01T00:00:00Z',
  ...over,
} as FolioCharge);

const folio: GuestFolio = {
  id: 'f1', bookingId: 'b1', guestId: 'g1', guestName: 'A', roomNumber: 101, roomName: 'R', folioNumber: 'F', status: 'open',
  totalRoomCharges: 0, totalFbCharges: 0, totalAddonCharges: 0, totalTax: 0, discountAmount: 0, netPayable: 0, totalPaid: 0, balanceDue: 0,
  charges: [], payments: [],
} as GuestFolio;

describe('folio totals', () => {
  it('uses each charge’s own tax, category rates otherwise, and ignores void lines', () => {
    const charges = [
      charge({ category: 'room_tariff', amount: 8000, taxAmount: 1440 }),
      charge({ category: 'food_beverage', amount: 1000 }),
      charge({ category: 'food_beverage', amount: 500, chargeStatus: 'void' }),
    ];
    const f = recalculateFolioTotals(folio, charges, []);
    expect(chargeTax(charges[1])).toBe(50);
    expect(f.totalTax).toBe(1490);
    expect(f.netPayable).toBe(10490);
    expect(f.balanceDue).toBe(10490);
  });
  it('scales tax down with a discount and settles when paid', () => {
    const charges = [charge({ category: 'food_beverage', amount: 1000 })];
    const f = recalculateFolioTotals({ ...folio, discountAmount: 100 }, charges, [
      { id: 'p', folioId: 'f1', amount: 945, paymentMethod: 'cash', collectedAt: '2026-10-01T00:00:00Z', collectedByName: 'x' } as never,
    ]);
    expect(f.totalTax).toBe(45);
    expect(f.netPayable).toBe(945);
    expect(f.status).toBe('settled');
  });
  it('apportions a stay’s GST across lines exactly', () => {
    const lines = apportionTax([charge({ amount: 1000 }), charge({ amount: 1000 }), charge({ amount: 1000 })], 100);
    expect(lines.map((l) => l.taxAmount)).toEqual([33.33, 33.33, 33.34]);
    const incl = apportionTax([charge({ amount: 5250 })], 250, { ...DEFAULT_GST_CONFIG, tariffsIncludeGst: true });
    expect(incl[0].amount + (incl[0].taxAmount || 0)).toBe(5250);
  });
});
