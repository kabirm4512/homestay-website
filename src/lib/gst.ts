import type { ChargeCategory } from '@/types/crm';
import type { DynamicTariffResult } from './tariff-calculator';

/**
 * GST rules used by the website quote, the booking API, the CRM and guest folios.
 *
 * Accommodation: GST is decided per room per night on the value charged for that
 * room-night (room rate + extra-person charges). As understood at the time of writing
 * (GST rate rationalisation effective 22 Sep 2025): up to ₹7,500 → 5% (without ITC);
 * above ₹7,500 → 18%. Other services use the rates below.
 *
 * Confirm these with your CA before going live; they are configuration, not code.
 */

export interface GstConfig {
  /** If true, saved tariffs already include GST (GST is shown, not added). */
  tariffsIncludeGst: boolean;
  accommodationThreshold: number; // ₹ per room per night
  accommodationLowRate: number; // % at or below the threshold
  accommodationHighRate: number; // % above the threshold
  foodRate: number; // % in-room dining
  transportRate: number; // % transfers / rentals
  otherRate: number; // % laundry / miscellaneous
}

export const DEFAULT_GST_CONFIG: GstConfig = {
  tariffsIncludeGst: false,
  accommodationThreshold: 7500,
  accommodationLowRate: 5,
  accommodationHighRate: 18,
  foodRate: 5,
  transportRate: 5,
  otherRate: 5,
};

export function sanitizeGstConfig(input: unknown): GstConfig {
  const src = (input && typeof input === 'object' ? input : {}) as Partial<GstConfig>;
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);
  return {
    tariffsIncludeGst: typeof src.tariffsIncludeGst === 'boolean' ? src.tariffsIncludeGst : DEFAULT_GST_CONFIG.tariffsIncludeGst,
    accommodationThreshold: num(src.accommodationThreshold, DEFAULT_GST_CONFIG.accommodationThreshold),
    accommodationLowRate: num(src.accommodationLowRate, DEFAULT_GST_CONFIG.accommodationLowRate),
    accommodationHighRate: num(src.accommodationHighRate, DEFAULT_GST_CONFIG.accommodationHighRate),
    foodRate: num(src.foodRate, DEFAULT_GST_CONFIG.foodRate),
    transportRate: num(src.transportRate, DEFAULT_GST_CONFIG.transportRate),
    otherRate: num(src.otherRate, DEFAULT_GST_CONFIG.otherRate),
  };
}

/** Rounds to paise. */
export function roundMoney(v: number): number {
  return Math.round(v * 100) / 100;
}

export function accommodationRateFor(nightValue: number, cfg: GstConfig = DEFAULT_GST_CONFIG): number {
  return nightValue <= cfg.accommodationThreshold ? cfg.accommodationLowRate : cfg.accommodationHighRate;
}

export interface StayGst {
  /** Room charges before GST (equals the tariff total unless tariffs include GST). */
  taxableAmount: number;
  gstAmount: number;
  /** What the guest pays for the room(s): taxable + GST. */
  totalWithGst: number;
  /** Per-rate split for the invoice, e.g. { 5: 412.5, 18: 0 }. */
  byRate: Record<number, { taxable: number; gst: number }>;
}

/**
 * GST for one priced room stay. Each night is taxed on its own value, so a stay that
 * crosses the ₹7,500 line (e.g. a suite in peak season) is taxed correctly night by night.
 */
export function calculateStayGst(result: DynamicTariffResult, cfg: GstConfig = DEFAULT_GST_CONFIG): StayGst {
  const extrasPerNight = (result.extraAdultsCharge + result.extraChildrenCharge) / Math.max(1, result.nights);
  const byRate: Record<number, { taxable: number; gst: number }> = {};
  let taxable = 0;
  let gst = 0;
  for (const night of result.breakdown) {
    const charged = night.amount + extrasPerNight;
    let nightTaxable: number;
    let rate: number;
    if (cfg.tariffsIncludeGst) {
      // Tariff already contains GST: find the rate whose base falls in the right slab.
      const lowBase = charged / (1 + cfg.accommodationLowRate / 100);
      rate = lowBase <= cfg.accommodationThreshold ? cfg.accommodationLowRate : cfg.accommodationHighRate;
      nightTaxable = charged / (1 + rate / 100);
    } else {
      rate = accommodationRateFor(charged, cfg);
      nightTaxable = charged;
    }
    const nightGst = (nightTaxable * rate) / 100;
    taxable += nightTaxable;
    gst += nightGst;
    byRate[rate] = byRate[rate] || { taxable: 0, gst: 0 };
    byRate[rate].taxable += nightTaxable;
    byRate[rate].gst += nightGst;
  }
  for (const k of Object.keys(byRate)) {
    byRate[Number(k)] = { taxable: roundMoney(byRate[Number(k)].taxable), gst: roundMoney(byRate[Number(k)].gst) };
  }
  const gstAmount = roundMoney(gst);
  const taxableAmount = roundMoney(taxable);
  return {
    taxableAmount,
    gstAmount,
    totalWithGst: roundMoney(cfg.tariffsIncludeGst ? result.totalAmount : taxableAmount + gstAmount),
    byRate,
  };
}

/** GST for several rooms. */
export function calculateMultiRoomGst(results: DynamicTariffResult[], cfg: GstConfig = DEFAULT_GST_CONFIG): StayGst {
  const parts = results.map((r) => calculateStayGst(r, cfg));
  const byRate: Record<number, { taxable: number; gst: number }> = {};
  for (const p of parts) {
    for (const [rate, v] of Object.entries(p.byRate)) {
      const k = Number(rate);
      byRate[k] = byRate[k] || { taxable: 0, gst: 0 };
      byRate[k].taxable = roundMoney(byRate[k].taxable + v.taxable);
      byRate[k].gst = roundMoney(byRate[k].gst + v.gst);
    }
  }
  return {
    taxableAmount: roundMoney(parts.reduce((s, p) => s + p.taxableAmount, 0)),
    gstAmount: roundMoney(parts.reduce((s, p) => s + p.gstAmount, 0)),
    totalWithGst: roundMoney(parts.reduce((s, p) => s + p.totalWithGst, 0)),
    byRate,
  };
}

export interface BookingTotals {
  /** Rooms before GST. */
  roomSubtotal: number;
  roomGst: number;
  /** Add-ons (transfer, bike) before GST. */
  addonsTotal: number;
  addonsGst: number;
  gstAmount: number;
  total: number;
  byRate: Record<number, { taxable: number; gst: number }>;
}

/**
 * Everything a website booking costs: rooms (GST per room-night slab) plus add-ons
 * (transport GST rate). Used by the booking form AND the booking API, so the quote and
 * the stored total always match.
 */
export function calculateBookingTotals(results: DynamicTariffResult[], addonsGross: number, cfg: GstConfig = DEFAULT_GST_CONFIG): BookingTotals {
  const rooms = calculateMultiRoomGst(results, cfg);
  let addonsTotal = roundMoney(Math.max(0, addonsGross));
  let addonsGst = 0;
  if (addonsTotal > 0 && cfg.transportRate > 0) {
    if (cfg.tariffsIncludeGst) {
      const taxable = roundMoney(addonsTotal / (1 + cfg.transportRate / 100));
      addonsGst = roundMoney(addonsTotal - taxable);
      addonsTotal = taxable;
    } else {
      addonsGst = roundMoney((addonsTotal * cfg.transportRate) / 100);
    }
  }
  const total = cfg.tariffsIncludeGst
    ? roundMoney(rooms.totalWithGst + Math.max(0, addonsGross))
    : roundMoney(rooms.taxableAmount + rooms.gstAmount + addonsTotal + addonsGst);
  return {
    roomSubtotal: rooms.taxableAmount,
    roomGst: rooms.gstAmount,
    addonsTotal,
    addonsGst,
    gstAmount: roundMoney(rooms.gstAmount + addonsGst),
    total,
    byRate: rooms.byRate,
  };
}

/** GST rate for a non-accommodation folio charge category. */
export function rateForChargeCategory(category: ChargeCategory, cfg: GstConfig = DEFAULT_GST_CONFIG): number {
  switch (category) {
    case 'food_beverage':
      return cfg.foodRate;
    case 'transport_transfer':
    case 'vehicle_rental':
      return cfg.transportRate;
    case 'room_tariff':
      return cfg.accommodationLowRate;
    default:
      return cfg.otherRate;
  }
}
