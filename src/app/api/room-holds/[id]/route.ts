import { z } from 'zod';
import { handler, ok, readJson, clientIp } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { extendRoomHold, releaseRoomHold } from '@/lib/server/tape-actions';
import { MAX_HOLD_HOURS } from '@/lib/tape-rules';

export const dynamic = 'force-dynamic';

const Patch = z
  .object({
    hours: z.number().min(0.5).max(MAX_HOLD_HOURS).optional(),
    untilReleased: z.boolean().optional(),
    /** Apply to every room held together with this one. */
    group: z.boolean().optional(),
  })
  .refine((b) => b.untilReleased || b.hours, 'Give the new hours, or keep it until released.');

/** Manager / admin: new release time for a hold (or keep it until released). */
export const PATCH = handler('roomHolds.extend', async (request: Request, ctx: { params: { id: string } }) => {
  const staff = await requireStaff(request, ROLES.MANAGERS);
  const body = await readJson(request, Patch);
  return ok({ holds: await extendRoomHold(ctx.params.id, body, staff, clientIp(request)) });
});

/** Manager / admin: release a hold (?group=1 for every room held with it). A started hold is ended today. */
export const DELETE = handler('roomHolds.release', async (request: Request, ctx: { params: { id: string } }) => {
  const staff = await requireStaff(request, ROLES.MANAGERS);
  const group = new URL(request.url).searchParams.get('group') === '1';
  return ok(await releaseRoomHold(ctx.params.id, staff, clientIp(request), { group }));
});
