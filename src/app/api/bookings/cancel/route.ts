import { z } from 'zod';
import { handler, ok, readJson, clientIp } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { cancelBooking } from '@/lib/server/booking-actions';

export const dynamic = 'force-dynamic';

const Body = z.object({
  bookingId: z.string().min(1).max(100),
  reason: z.string().trim().min(3, 'Please give a reason.').max(300),
  noShow: z.boolean().optional(),
});

/** Manager / admin: cancel a front-desk booking or mark a no-show (room charges voided; advances become a credit). */
export const POST = handler('bookings.cancel', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.MANAGERS);
  const body = await readJson(request, Body);
  return ok(await cancelBooking(body.bookingId, body, staff, clientIp(request)));
});
