import type { FolioCharge, FolioPayment, GuestFolio } from '@/types/crm';
import { DEFAULT_GST_CONFIG, GstConfig, accommodationRateFor, rateForChargeCategory, roundMoney } from './gst';

/**
 * Folio arithmetic shared by the CRM (browser) and the server (guest orders).
 *
 * GST per line: a charge's own `taxAmount` when set (room charges are taxed by the
 * per-night slab when posted), otherwise the category rate from the GST config.
 * Discounts reduce tax proportionally. Totals are rounded to paise.
 */
export function chargeTax(charge: FolioCharge, cfg: GstConfig = DEFAULT_GST_CONFIG): number {
  if (charge.chargeStatus === 'void') return 0;
  if (typeof charge.taxAmount === 'number' && Number.isFinite(charge.taxAmount)) return charge.taxAmount;
  return roundMoney((charge.amount * rateForChargeCategory(charge.category, cfg)) / 100);
}

export function recalculateFolioTotals(
  folio: GuestFolio,
  charges: FolioCharge[],
  payments: FolioPayment[] = folio.payments,
  cfg: GstConfig = DEFAULT_GST_CONFIG
): GuestFolio {
  const live = charges.filter((c) => c.chargeStatus !== 'void');
  const sum = (filter: (c: FolioCharge) => boolean) => roundMoney(live.filter(filter).reduce((s, c) => s + c.amount, 0));
  const roomCharges = sum((c) => c.category === 'room_tariff');
  const fbCharges = sum((c) => c.category === 'food_beverage');
  const addonCharges = sum((c) => ['transport_transfer', 'vehicle_rental', 'laundry', 'miscellaneous'].includes(c.category));

  const grossSubtotal = roomCharges + fbCharges + addonCharges;
  const discount = Math.min(Math.max(0, folio.discountAmount || 0), grossSubtotal);
  const grossTax = live.reduce((s, c) => s + chargeTax(c, cfg), 0);
  const tax = roundMoney(grossSubtotal > 0 ? grossTax * (1 - discount / grossSubtotal) : 0);
  const netPayable = roundMoney(grossSubtotal - discount + tax);
  const totalPaid = roundMoney(payments.reduce((s, p) => s + p.amount, 0));
  const balanceDue = roundMoney(Math.max(0, netPayable - totalPaid));
  const isSettled = balanceDue <= 0 && netPayable > 0;

  return {
    ...folio,
    charges,
    payments,
    totalRoomCharges: roomCharges,
    totalFbCharges: fbCharges,
    totalAddonCharges: addonCharges,
    totalTax: tax,
    netPayable,
    totalPaid,
    balanceDue,
    status: isSettled ? 'settled' : folio.status === 'settled' && balanceDue > 0 ? 'open' : folio.status,
    settledAt: isSettled ? folio.settledAt || new Date().toISOString() : folio.settledAt,
  };
}

/**
 * GST for room charges when only a stay total is known (manual rates): the average
 * night value decides the slab.
 */
export function accommodationGstForTotal(totalRoomAmount: number, nights: number, cfg: GstConfig = DEFAULT_GST_CONFIG): number {
  const n = Math.max(1, nights);
  if (cfg.tariffsIncludeGst) {
    // The amount already contains GST: pick the slab from the pre-tax night value.
    const lowBase = totalRoomAmount / n / (1 + cfg.accommodationLowRate / 100);
    const rate = lowBase <= cfg.accommodationThreshold ? cfg.accommodationLowRate : cfg.accommodationHighRate;
    return roundMoney(totalRoomAmount - totalRoomAmount / (1 + rate / 100));
  }
  const rate = accommodationRateFor(totalRoomAmount / n, cfg);
  return roundMoney((totalRoomAmount * rate) / 100);
}

/**
 * Splits a stay's GST across its room-charge lines in proportion to their amounts.
 * When tariffs include GST, each line's amount is reduced by its share so that
 * amount + tax still equals the quoted price (GST shown, not added).
 */
export function apportionTax(lines: FolioCharge[], totalTax: number, cfg: GstConfig = DEFAULT_GST_CONFIG): FolioCharge[] {
  const total = lines.reduce((s, l) => s + l.amount, 0);
  if (total <= 0) return lines;
  let assigned = 0;
  return lines.map((l, i) => {
    const share = i === lines.length - 1 ? roundMoney(totalTax - assigned) : roundMoney((totalTax * l.amount) / total);
    assigned = roundMoney(assigned + share);
    return cfg.tariffsIncludeGst
      ? { ...l, amount: roundMoney(l.amount - share), taxAmount: share }
      : { ...l, taxAmount: share };
  });
}
