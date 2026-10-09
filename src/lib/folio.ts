import type { FolioCharge, FolioPayment, GuestFolio } from '@/types/crm';
import { DEFAULT_GST_CONFIG, GstConfig, accommodationRateFor, activeGst, rateForChargeCategory, roundMoney } from './gst';

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
  // A room line without its own tax (e.g. a manual late check-out charge) uses the slab for its value
  const rate = charge.category === 'room_tariff' ? accommodationRateFor(charge.amount, cfg) : rateForChargeCategory(charge.category, cfg);
  return roundMoney((charge.amount * rate) / 100);
}

/** A payment that an admin voided (with a reason) no longer counts towards what was paid. */
export function isLivePayment(p: FolioPayment): boolean {
  return !p.voidedAt;
}

/** Signed effect of a payment on what was paid: refunds count negative. */
export function paymentEffect(p: FolioPayment): number {
  if (!isLivePayment(p)) return 0;
  return p.kind === 'refund' ? -p.amount : p.amount;
}

/** Only POSTED lines are billed; pending lines (awaiting approval/dispatch) are shown, not charged. */
export function isBilled(c: FolioCharge): boolean {
  return c.chargeStatus === 'posted';
}

/** True when the bill is closed and must keep the tax it was issued with. */
function isIssued(folio: GuestFolio): boolean {
  return folio.status === 'settled' || folio.status === 'void';
}

/**
 * Applies the GST switch to a folio's lines.
 * - GST on: lines keep their tax (or get the category rate).
 * - GST off, open folio: every line is set to ₹0 tax (stored on the line).
 * - GST off, settled/void folio: lines keep the tax they were issued with; a line that never
 *   stored its tax is frozen at the configured rate so the issued bill does not change.
 */
export function applyGstMode(folio: GuestFolio, charges: FolioCharge[], cfg: GstConfig = DEFAULT_GST_CONFIG): FolioCharge[] {
  if (cfg.enabled) {
    // Freeze each line's tax when it is first billed, so a later change to the GST rules
    // never re-taxes a bill already in progress or handed to a guest.
    return charges.map((c) =>
      c.chargeStatus === 'posted' && !(typeof c.taxAmount === 'number' && Number.isFinite(c.taxAmount)) ? { ...c, taxAmount: chargeTax(c, cfg) } : c
    );
  }
  if (isIssued(folio)) {
    const asIssued = { ...cfg, enabled: true };
    return charges.map((c) =>
      c.chargeStatus === 'void' || (typeof c.taxAmount === 'number' && Number.isFinite(c.taxAmount))
        ? c
        : { ...c, taxAmount: chargeTax(c, asIssued) }
    );
  }
  return charges.map((c) => (c.chargeStatus === 'void' || c.taxAmount === 0 ? c : { ...c, taxAmount: 0 }));
}

export function recalculateFolioTotals(
  folio: GuestFolio,
  chargesIn: FolioCharge[],
  payments: FolioPayment[] = folio.payments,
  cfg: GstConfig = DEFAULT_GST_CONFIG
): GuestFolio {
  const charges = applyGstMode(folio, chargesIn, cfg);
  const live = charges.filter(isBilled);
  const pendingTotal = roundMoney(charges.filter((c) => c.chargeStatus === 'pending').reduce((s, c) => s + c.amount, 0));
  const sum = (filter: (c: FolioCharge) => boolean) => roundMoney(live.filter(filter).reduce((s, c) => s + c.amount, 0));
  const roomCharges = sum((c) => c.category === 'room_tariff');
  const fbCharges = sum((c) => c.category === 'food_beverage');
  const addonCharges = sum((c) => ['transport_transfer', 'vehicle_rental', 'laundry', 'miscellaneous'].includes(c.category));

  const grossSubtotal = roomCharges + fbCharges + addonCharges;
  const discount = Math.min(Math.max(0, folio.discountAmount || 0), grossSubtotal);
  const grossTax = live.reduce((s, c) => s + chargeTax(c, cfg), 0);
  const tax = roundMoney(grossSubtotal > 0 ? grossTax * (1 - discount / grossSubtotal) : 0);
  const netPayable = roundMoney(grossSubtotal - discount + tax);
  const totalPaid = roundMoney(payments.reduce((s, p) => s + paymentEffect(p), 0));
  const balanceDue = roundMoney(Math.max(0, netPayable - totalPaid));
  // Overpaid: the difference is owed back to the guest (shown, and refunded with a 'refund' entry)
  const creditOwed = roundMoney(Math.max(0, totalPaid - netPayable));
  const isSettled = folio.status !== 'void' && balanceDue <= 0 && creditOwed <= 0 && netPayable > 0;

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
    creditOwed,
    pendingTotal,
    status: folio.status === 'void' ? 'void' : isSettled ? 'settled' : folio.status === 'settled' && (balanceDue > 0 || creditOwed > 0) ? 'open' : folio.status,
    settledAt: isSettled ? folio.settledAt || new Date().toISOString() : folio.settledAt,
  };
}

/**
 * GST for room charges when only a stay total is known (manual rates): the average
 * night value decides the slab.
 */
export function accommodationGstForTotal(totalRoomAmount: number, nights: number, cfg: GstConfig = DEFAULT_GST_CONFIG): number {
  cfg = activeGst(cfg);
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
  cfg = activeGst(cfg);
  if (!cfg.enabled) totalTax = 0;
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
