import { z } from 'zod';
import { handler, ok, readJson } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { groupRoomProblems } from '@/lib/server/tape-actions';

export const dynamic = 'force-dynamic';

const Body = z.object({
  roomIds: z.array(z.string().min(1).max(100)).min(1).max(20),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fromHoldIds: z.array(z.string().max(100)).max(20).optional(),
  checkInNow: z.boolean().optional(),
});

/** Manager / admin: can these rooms all be booked for these dates? (Checked before a group is saved.) */
export const POST = handler('bookings.groupCheck', async (request: Request) => {
  await requireStaff(request, ROLES.MANAGERS);
  const body = await readJson(request, Body);
  if (body.checkOutDate <= body.checkInDate) return ok({ problems: [{ roomId: '', message: 'Check-out must be after check-in.' }] });
  return ok({ problems: await groupRoomProblems(body) });
});
