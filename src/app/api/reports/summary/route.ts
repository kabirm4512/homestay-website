import { handler, ok, HttpError } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { moneySummary } from '@/lib/server/reports';
import { isCalendarDate, nightsBetween, todayInIST } from '@/lib/tariff-calculator';

export const dynamic = 'force-dynamic';

/** Admin: the one set of money numbers for a date range (?from&to&compare=1). */
export const GET = handler('reports.summary', async (request: Request) => {
  await requireStaff(request, ROLES.ADMIN);
  const p = new URL(request.url).searchParams;
  const today = todayInIST();
  const from = p.get('from') || `${today.slice(0, 8)}01`;
  const to = p.get('to') || today;
  if (!isCalendarDate(from) || !isCalendarDate(to) || from > to) throw new HttpError(400, 'Choose a valid date range.');
  if ((nightsBetween(from, to) ?? 0) > 400) throw new HttpError(400, 'Choose a range of at most a year.');
  return ok(await moneySummary(from, to, { compare: p.get('compare') === '1' }));
}, { timeoutMs: 25_000 });
