import { z } from 'zod';
import { handler, ok, readJson, clientIp } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { checkInBooking } from '@/lib/server/tape-actions';

export const dynamic = 'force-dynamic';

const Body = z.object({
  idType: z.string().trim().max(60).optional(),
  idNumber: z.string().trim().max(60).optional(),
  /** Photo of the ID (data URL); moved to private storage on save. */
  idDocumentUrl: z.string().max(8_000_000).optional(),
  idDocumentBackUrl: z.string().max(8_000_000).optional(),
  adultsCount: z.number().int().min(1).max(20).optional(),
  childrenCount: z.number().int().min(0).max(20).optional(),
});

/** Manager / admin: check an arriving pre-booking or hold in (date, room, ID and in-house rules apply). */
export const POST = handler('bookings.checkin', async (request: Request, ctx: { params: { id: string } }) => {
  const staff = await requireStaff(request, ROLES.MANAGERS);
  const body = await readJson(request, Body);
  return ok(await checkInBooking(ctx.params.id, body, staff, clientIp(request)));
});
