import { z } from 'zod';
import { handler, ok, readJson, HttpError, clientIp } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { getStaff } from '@/lib/server/auth/staff-session';
import { getGuestBooking } from '@/lib/server/auth/guest-session';
import { getCrmBooking, rowToGuestBooking } from '@/lib/server/repos/bookings';
import { requestTransport } from '@/lib/server/guest-services';

export const dynamic = 'force-dynamic';

const Body = z.object({
  bookingId: z.string().max(100).optional(),
  serviceType: z.enum(['point_to_point', 'vehicle_rental']),
  routeId: z.string().max(100).optional(),
  vehicleTier: z.enum(['wagonr', 'sedan', 'suv']).optional(),
  modifiers: z.array(z.string().max(120)).max(10).optional(),
  rentalVehicleId: z.string().max(100).optional(),
  pickupDatetime: z.string().min(10).max(30),
  returnDatetime: z.string().max(30).optional(),
  pickupLocation: z.string().max(200).optional(),
  destinationNotes: z.string().max(500).optional(),
  guestContactPhone: z.string().max(20).optional(),
});

/** Transfer / rental request from the in-room concierge or guest portal (priced on the server). */
export const POST = handler('guest.transport', async (request: Request) => {
  await rateLimit(request, 'transport', 10, 10 * 60);
  const body = await readJson(request, Body);
  const staff = await getStaff(request);
  let booking;
  let actor: string;
  if (staff) {
    booking = body.bookingId ? await getCrmBooking(body.bookingId) : null;
    if (!booking) throw new HttpError(404, 'Booking not found.');
    actor = `staff:${staff.id}`;
  } else {
    const row = await getGuestBooking(request);
    if (!row || (body.bookingId && row.id !== body.bookingId)) {
      throw new HttpError(401, 'Please scan the QR code in your room or sign in with your Booking ID and mobile number.', 'GUEST_AUTH_REQUIRED');
    }
    booking = rowToGuestBooking(row);
    actor = `guest:${row.id}`;
  }
  const result = await requestTransport({ ...body, booking, actor, ip: clientIp(request) });
  return ok(result, { status: 201 });
});
