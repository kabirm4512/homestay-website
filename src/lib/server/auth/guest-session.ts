import type { NextResponse } from 'next/server';
import { createToken, verifyToken, readCookie, cookieOptions } from './tokens';
import { getBookingRow, BookingRow } from '../repos/bookings';
import { addCalendarDays, todayInIST } from '@/lib/tariff-calculator';

/**
 * Guest session: proves the browser belongs to the guest of one booking. Issued after
 * booking reference + phone sign-in, or after scanning the in-room QR code (room token)
 * while that room has an active booking. Valid until two days after check-out.
 */
export const GUEST_COOKIE = 'savera_guest';
const MAX_SECONDS = 30 * 24 * 60 * 60;

interface GuestClaims extends Record<string, unknown> {
  t: 'guest';
  bid: string;
}

export function issueGuestSession(response: NextResponse, bookingId: string, checkOut: string): void {
  const until = new Date(`${addCalendarDays(checkOut, 2)}T23:59:59+05:30`).getTime();
  const seconds = Math.max(3600, Math.min(MAX_SECONDS, Math.floor((until - Date.now()) / 1000)));
  response.cookies.set(GUEST_COOKIE, createToken({ t: 'guest', bid: bookingId }, seconds), cookieOptions(seconds));
}

export function clearGuestSession(response: NextResponse): void {
  response.cookies.set(GUEST_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
}

/** The booking this browser is signed in to as a guest, if still valid. */
export async function getGuestBooking(request: Request): Promise<BookingRow | null> {
  const claims = verifyToken<GuestClaims>(readCookie(request, GUEST_COOKIE));
  if (!claims || claims.t !== 'guest' || typeof claims.bid !== 'string') return null;
  const row = await getBookingRow(claims.bid);
  if (!row || row.status === 'cancelled') return null;
  const checkOut = typeof row.check_out === 'string' ? row.check_out.slice(0, 10) : row.check_out.toISOString().slice(0, 10);
  if (addCalendarDays(checkOut, 2) < todayInIST()) return null;
  return row;
}
