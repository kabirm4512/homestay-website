import type { CRMBooking, FolioCharge, GuestFolio, MealPlan } from '@/types/crm';
import { DEFAULT_GST_CONFIG, GstConfig, roundMoney } from './gst';
import { chargeTax } from './folio';

/**
 * Splits a stay's folio into the two bills a guest sees:
 *  1. ROOM BILL: room tariff for the nights stayed on the booked meal plan (incl. extra persons).
 *  2. SERVICES BILL: food orders, transfers, rentals, special requests (celebrations) and other extras.
 * Payments are applied to the room bill first, then to services, so each bill shows its own balance.
 * The two bills always add up to the folio exactly.
 */

export const MEAL_PLAN_NAMES: Record<MealPlan, string> = {
  EP: 'EP · Room only',
  CP: 'CP · Room with breakfast',
  MAP: 'MAP · Breakfast + one main meal',
  AP: 'AP · All meals',
};

export type ServiceGroup = 'food' | 'transfers' | 'rentals' | 'special' | 'other';

export const SERVICE_GROUP_NAMES: Record<ServiceGroup, string> = {
  food: 'Food orders',
  transfers: 'Transfers',
  rentals: 'Vehicle rentals',
  special: 'Special requests & celebrations',
  other: 'Other services',
};

export interface BillLine {
  id: string;
  title: string;
  amount: number;
  tax: number;
  date: string;
  pending: boolean;
  group?: ServiceGroup;
}

export interface GuestBill {
  kind: 'room' | 'services';
  lines: BillLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
}

function isCelebration(c: FolioCharge): boolean {
  return (c.sourceReferenceId || '').startsWith('ord-cel-') || /celebration/i.test(c.title) || c.title.includes('🎉');
}

export function serviceGroup(c: FolioCharge): ServiceGroup {
  if (c.category === 'food_beverage') return 'food';
  if (c.category === 'transport_transfer') return 'transfers';
  if (c.category === 'vehicle_rental') return 'rentals';
  if (c.category === 'miscellaneous' && isCelebration(c)) return 'special';
  return 'other';
}

export function splitGuestBills(folio: GuestFolio | null, booking: CRMBooking, cfg: GstConfig = DEFAULT_GST_CONFIG): { room: GuestBill; services: GuestBill; totalDue: number } {
  const empty = (kind: GuestBill['kind']): GuestBill => ({ kind, lines: [], subtotal: 0, discount: 0, tax: 0, total: 0, paid: 0, balance: 0 });

  if (!folio) {
    // No bill opened yet: show the room bill from the booking
    const room = empty('room');
    const amount = roundMoney(booking.totalRoomAmount || 0);
    room.lines = [{ id: 'stay', title: `${booking.roomName} · ${booking.totalNights} night${booking.totalNights === 1 ? '' : 's'}`, amount, tax: roundMoney(booking.gstAmount || 0), date: booking.checkInDate, pending: false }];
    room.subtotal = amount;
    room.tax = roundMoney(booking.gstAmount || 0);
    room.total = roundMoney(amount + room.tax);
    room.paid = Math.min(room.total, roundMoney(booking.advancePaid || 0));
    room.balance = roundMoney(room.total - room.paid);
    return { room, services: empty('services'), totalDue: room.balance };
  }

  const live = (folio.charges || []).filter((c) => c.chargeStatus !== 'void');
  const toLine = (c: FolioCharge): BillLine => ({
    id: c.id,
    title: c.title,
    amount: roundMoney(c.amount),
    tax: roundMoney(chargeTax(c, cfg)),
    date: (c.postedAt || '').slice(0, 10),
    pending: c.chargeStatus === 'pending',
    group: c.category === 'room_tariff' ? undefined : serviceGroup(c),
  });
  const roomLines = live.filter((c) => c.category === 'room_tariff').map(toLine);
  const serviceLines = live.filter((c) => c.category !== 'room_tariff').map(toLine).sort((a, b) => a.date.localeCompare(b.date));

  // Lines awaiting confirmation are listed but not billed yet
  const billedSum = (lines: BillLine[]) => roundMoney(lines.filter((l) => !l.pending).reduce((s, l) => s + l.amount, 0));
  const roomSub = billedSum(roomLines);
  const servSub = billedSum(serviceLines);
  const gross = roomSub + servSub;
  // Discount and tax shared out so the two bills add up to the folio exactly
  const discount = roundMoney(Math.min(Math.max(0, folio.discountAmount || 0), gross));
  const roomDiscount = gross > 0 ? roundMoney((discount * roomSub) / gross) : 0;
  const rawRoomTax = roomLines.filter((l) => !l.pending).reduce((s, l) => s + l.tax, 0);
  const rawServTax = serviceLines.filter((l) => !l.pending).reduce((s, l) => s + l.tax, 0);
  const rawTax = rawRoomTax + rawServTax;
  const totalTax = roundMoney(folio.totalTax || 0);
  const roomTax = rawTax > 0 ? roundMoney((totalTax * rawRoomTax) / rawTax) : 0;

  const room: GuestBill = { kind: 'room', lines: roomLines, subtotal: roomSub, discount: roomDiscount, tax: roomTax, total: 0, paid: 0, balance: 0 };
  const services: GuestBill = {
    kind: 'services',
    lines: serviceLines,
    subtotal: servSub,
    discount: roundMoney(discount - roomDiscount),
    tax: roundMoney(totalTax - roomTax),
    total: 0,
    paid: 0,
    balance: 0,
  };
  room.total = roundMoney(room.subtotal - room.discount + room.tax);
  services.total = roundMoney(roundMoney(folio.netPayable || 0) - room.total);

  const paid = roundMoney(folio.totalPaid || 0);
  room.paid = roundMoney(Math.min(room.total, paid));
  services.paid = roundMoney(Math.min(services.total, Math.max(0, paid - room.paid)));
  room.balance = roundMoney(room.total - room.paid);
  services.balance = roundMoney(services.total - services.paid);
  return { room, services, totalDue: roundMoney(room.balance + services.balance) };
}
