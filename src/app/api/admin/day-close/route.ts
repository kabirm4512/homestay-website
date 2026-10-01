import { z } from 'zod';
import { handler, ok, readJson, HttpError, clientIp } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { closeDay, getDayClose, summarizeDay } from '@/lib/server/day-close';
import { audit } from '@/lib/server/audit';
import { isCalendarDate, todayInIST } from '@/lib/tariff-calculator';

export const dynamic = 'force-dynamic';

/** Admin / manager: the day's money summary, and whether the day is closed. */
export const GET = handler('day_close.get', async (request: Request) => {
  await requireStaff(request, ROLES.MANAGERS);
  const date = new URL(request.url).searchParams.get('date') || todayInIST();
  if (!isCalendarDate(date)) throw new HttpError(400, 'date must be YYYY-MM-DD.');
  const [closed, summary] = await Promise.all([getDayClose(date), summarizeDay(date)]);
  return ok({ summary, closed });
});

const Body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), notes: z.string().max(1000).optional() });

/** Admin / manager: close a day (immutable snapshot). */
export const POST = handler('day_close.create', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.MANAGERS);
  const body = await readJson(request, Body);
  const record = await closeDay(body.date, staff, body.notes);
  await audit({ actor: `staff:${staff.id}`, action: 'day_close', entity: 'day_close', entityId: body.date, after: record, ip: clientIp(request) });
  return ok({ closed: record }, { status: 201 });
});
