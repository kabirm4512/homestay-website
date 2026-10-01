import { handler, ok } from '@/lib/server/http';
import { getStaff } from '@/lib/server/auth/staff-session';
import { findStaffById, toPublicStaff } from '@/lib/server/repos/staff';

export const dynamic = 'force-dynamic';

/** The signed-in staff member (or user: null). */
export const GET = handler('auth.me', async (request: Request) => {
  const staff = await getStaff(request);
  if (!staff) return ok({ user: null });
  const row = await findStaffById(staff.id);
  return ok({ user: row ? toPublicStaff(row) : null });
});
