import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handler, readJson, HttpError, NO_STORE, clientIp, ok } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { findBookingForGuest, rowToGuestBooking } from '@/lib/server/repos/bookings';
import { getGuestBooking, issueGuestSession, clearGuestSession } from '@/lib/server/auth/guest-session';
import { bookingForGuest, folioForGuest } from '@/lib/server/guest-services';
import { audit } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

function checkOutOf(row: { check_out: string | Date }): string {
  return typeof row.check_out === 'string' ? row.check_out.slice(0, 10) : row.check_out.toISOString().slice(0, 10);
}

/** The booking this browser is signed in to (guest portal / digital check-in). */
export const GET = handler('guest.session.get', async (request: Request) => {
  const row = await getGuestBooking(request);
  if (!row) return ok({ booking: null });
  const booking = rowToGuestBooking(row);
  return ok({ booking: bookingForGuest(booking), folio: await folioForGuest(booking) });
});

const Body = z.object({
  reference: z.string().trim().min(4).max(40),
  phone: z.string().trim().min(10).max(20),
});

/** Guest sign-in: booking reference AND the mobile number on the booking must both match. */
export const POST = handler('guest.session.create', async (request: Request) => {
  const { reference, phone } = await readJson(request, Body);
  await rateLimit(request, 'guest-login', 10, 15 * 60);
  const row = await findBookingForGuest(reference, phone);
  if (!row) {
    await audit({ actor: 'guest', action: 'guest_login_failed', entity: 'booking', ip: clientIp(request) });
    throw new HttpError(
      404,
      'We could not find a reservation with that Booking ID and mobile number. Please check both, or call reception.',
      'NOT_FOUND'
    );
  }
  const booking = rowToGuestBooking(row);
  const response = NextResponse.json(
    { success: true, booking: bookingForGuest(booking), folio: await folioForGuest(booking) },
    { headers: NO_STORE }
  );
  issueGuestSession(response, row.id, checkOutOf(row));
  return response;
});

export async function DELETE() {
  const response = NextResponse.json({ success: true }, { headers: NO_STORE });
  clearGuestSession(response);
  return response;
}
