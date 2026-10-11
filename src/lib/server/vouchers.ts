import type { CRMBooking, MealPlan } from '@/types/crm';
import type { SiteInfo } from '@/types';
import { createToken, verifyToken } from './auth/tokens';
import { getCrmBooking, listCrmBookings } from './repos/bookings';
import { findPhysicalRoom } from './repos/physical-rooms';
import { findFolioByBookingId } from './folio-store';
import { getSetting, SETTINGS } from './repos/settings';
import { CONTACT_DEFAULTS, formatPhone, toE164Digits } from '@/lib/contact-format';
import { MEAL_PLAN_NAMES } from '@/lib/guest-bills';
import { nightsBetween } from '@/lib/tariff-calculator';

/**
 * Booking vouchers: a read-only confirmation page the desk shares with the guest
 * (WhatsApp). The link carries a signed token for one booking; the voucher covers every
 * room booked with it (a group). Anyone holding the link can view it, so the guest's
 * phone number is shown masked and no ID details are included.
 */

const VOUCHER_TTL_SECONDS = 400 * 24 * 3600; // valid well past the stay

export function voucherToken(bookingId: string): string {
  return createToken({ v: bookingId }, VOUCHER_TTL_SECONDS);
}

export function voucherPath(bookingId: string): string {
  return `/voucher/${voucherToken(bookingId)}`;
}

export interface VoucherRoom {
  bookingReference: string;
  roomNumber: number;
  roomType: string;
  adults: number;
  children: number;
  nights: number;
  ratePerNight: number;
  amount: number;
  status: CRMBooking['bookingStatus'];
}

export interface VoucherData {
  references: string[];
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'hold';
  issuedAt: string;
  guestName: string;
  guestPhoneMasked: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  mealPlan: string;
  rooms: VoucherRoom[];
  total: number;
  paid: number;
  balance: number;
  specialRequests?: string;
  site: {
    name: string;
    address: string;
    phone: string;
    whatsapp: string;
    email: string;
    mapUrl?: string;
    checkInTime: string;
    checkOutTime: string;
    policies: { title: string; desc: string }[];
  };
}

function maskPhone(phone: string): string {
  const d = (phone || '').replace(/\D/g, '');
  if (d.length < 4) return '';
  return `${'•'.repeat(Math.max(0, Math.min(6, d.length - 4)))}${d.slice(-4)}`;
}

/** The voucher for a signed token, or null when the link is invalid or the booking is gone. */
export async function loadVoucher(token: string): Promise<VoucherData | null> {
  const claims = verifyToken<{ v: string }>(token);
  if (!claims?.v) return null;
  const main = await getCrmBooking(claims.v);
  if (!main) return null;

  // The whole group (rooms booked together), else just this booking
  let stays: CRMBooking[] = [main];
  if (main.groupId) {
    const all = await listCrmBookings();
    stays = all.filter((b) => b.groupId === main.groupId && (b.bookingStatus !== 'cancelled' || b.id === main.id));
  }
  stays.sort((a, b) => a.roomNumber - b.roomNumber);

  const [site, folios, roomTypes] = await Promise.all([
    getSetting<SiteInfo>(SETTINGS.CMS_SITE),
    Promise.all(stays.map((b) => findFolioByBookingId(b.id))),
    Promise.all(stays.map((b) => findPhysicalRoom({ id: b.roomId }))),
  ]);

  let total = 0;
  let paid = 0;
  let balance = 0;
  const rooms: VoucherRoom[] = stays.map((b, i) => {
    const folio = folios[i];
    const nights = nightsBetween(b.checkInDate, b.checkOutDate) || b.totalNights || 1;
    const amount = folio && folio.status !== 'void' ? folio.netPayable : b.totalRoomAmount || 0;
    if (b.bookingStatus !== 'cancelled') {
      total += amount;
      paid += folio ? folio.totalPaid : b.advancePaid || 0;
      balance += folio ? folio.balanceDue : Math.max(0, amount - (b.advancePaid || 0));
    }
    return {
      bookingReference: b.bookingReference,
      roomNumber: b.roomNumber,
      roomType: roomTypes[i]?.categoryName || '',
      adults: b.adultsCount || 0,
      children: b.childrenCount || 0,
      nights,
      ratePerNight: b.roomRatePerNight || 0,
      amount,
      status: b.bookingStatus,
    };
  });

  const active = stays.filter((b) => b.bookingStatus !== 'cancelled');
  const status: VoucherData['status'] =
    active.length === 0
      ? 'cancelled'
      : active.some((b) => b.bookingStatus === 'checked_in')
      ? 'checked_in'
      : active.every((b) => b.bookingStatus === 'checked_out')
      ? 'checked_out'
      : active.some((b) => b.bookingStatus === 'hold')
      ? 'hold'
      : 'confirmed';
  const checkIn = stays.map((b) => b.checkInDate).sort()[0];
  const checkOut = stays.map((b) => b.checkOutDate).sort().reverse()[0];
  const plan = main.mealPlan as MealPlan;

  return {
    references: Array.from(new Set(stays.map((b) => b.bookingReference))),
    status,
    issuedAt: new Date().toISOString(),
    guestName: main.guest?.fullName || 'Guest',
    guestPhoneMasked: maskPhone(main.guest?.phone || ''),
    checkInDate: checkIn,
    checkOutDate: checkOut,
    nights: nightsBetween(checkIn, checkOut) || 1,
    mealPlan: MEAL_PLAN_NAMES[plan] || plan || '',
    rooms,
    total: Math.round(total * 100) / 100,
    paid: Math.round(paid * 100) / 100,
    balance: Math.round(Math.max(0, balance) * 100) / 100,
    specialRequests: main.specialRequests || undefined,
    site: {
      name: site?.name || 'Savera Homestay',
      address: site?.address || '',
      phone: formatPhone(site?.phone || CONTACT_DEFAULTS.phone),
      whatsapp: toE164Digits(site?.whatsapp || '') || CONTACT_DEFAULTS.whatsapp,
      email: site?.email || '',
      mapUrl: site?.map_url || undefined,
      checkInTime: site?.check_in_time || '1:00 PM',
      checkOutTime: site?.check_out_time || '11:00 AM',
      policies: Array.isArray(site?.policies) ? site!.policies!.slice(0, 6) : [],
    },
  };
}
