import { z } from 'zod';
import { handler, ok, readJson, clientIp } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { createRoomHold } from '@/lib/server/tape-actions';
import { listRecords } from '@/lib/server/repos/records';
import { MAX_HOLD_HOURS } from '@/lib/tape-rules';
import type { RoomBlock } from '@/types/crm';

export const dynamic = 'force-dynamic';

const Body = z.object({
  roomIds: z.array(z.string().min(1).max(100)).min(1).max(20),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(200).optional(),
  guestName: z.string().trim().max(120).optional(),
  guestPhone: z.string().trim().max(30).optional(),
  /** Hours until the hold releases itself; null = until released. */
  releaseAfterHours: z.number().min(0.5).max(MAX_HOLD_HOURS).nullable().optional(),
});

/** Staff: room holds (newest first). */
export const GET = handler('roomHolds.list', async (request: Request) => {
  await requireStaff(request, ROLES.MANAGERS);
  return ok({ holds: await listRecords<RoomBlock>('roomBlocks', { limit: 500 }) });
});

/** Manager / admin: hold one or more rooms for some nights (all or nothing). */
export const POST = handler('roomHolds.create', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.MANAGERS);
  const body = await readJson(request, Body);
  return ok({ holds: await createRoomHold(body, staff, clientIp(request)) });
});
