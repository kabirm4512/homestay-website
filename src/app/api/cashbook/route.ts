import { handler, ok, HttpError } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { buildCashbook } from '@/lib/server/cashbook';
import { isCalendarDate, todayInIST } from '@/lib/tariff-calculator';

export const dynamic = 'force-dynamic';

/**
 * Manager cash book. Admins: every manager (?staff=<id> for one). Managers: only themselves.
 * ?from=YYYY-MM-DD&to=YYYY-MM-DD (default: today).
 */
export const GET = handler('cashbook.get', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.MANAGERS);
  const params = new URL(request.url).searchParams;
  const today = todayInIST();
  const from = params.get('from') || today;
  const to = params.get('to') || today;
  if (!isCalendarDate(from) || !isCalendarDate(to) || from > to) throw new HttpError(400, 'Choose a valid date range.');
  const onlyStaffId = staff.role === 'admin' ? params.get('staff') || undefined : staff.id;
  return ok({ from, to, ...(await buildCashbook({ from, to, onlyStaffId })) });
});
