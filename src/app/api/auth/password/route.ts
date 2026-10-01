import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handler, readJson, HttpError, NO_STORE, clientIp } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { requireStaff, issueStaffSession } from '@/lib/server/auth/staff-session';
import { findStaffById, setStaffPassword, toPublicStaff } from '@/lib/server/repos/staff';
import { passwordProblem, verifyPassword } from '@/lib/server/auth/password';
import { audit } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

const Body = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(200),
});

/** Changes the signed-in user's own password (required after first sign-in). */
export const POST = handler('auth.password', async (request: Request) => {
  const staff = await requireStaff(request, undefined, { allowPasswordChangePending: true });
  await rateLimit(request, 'password', 10, 15 * 60, staff.id);
  const { currentPassword, newPassword } = await readJson(request, Body);
  const row = await findStaffById(staff.id);
  if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
    throw new HttpError(401, 'Your current password is incorrect.', 'INVALID_CREDENTIALS');
  }
  const problem = passwordProblem(newPassword);
  if (problem) throw new HttpError(400, problem);
  if (newPassword === currentPassword) throw new HttpError(400, 'Choose a password different from the current one.');
  await setStaffPassword(staff.id, newPassword, false);
  await audit({ actor: `staff:${staff.id}`, action: 'password_changed', entity: 'staff', entityId: staff.id, ip: clientIp(request) });
  const updated = await findStaffById(staff.id);
  const response = NextResponse.json({ success: true, user: updated ? toPublicStaff(updated) : null }, { headers: NO_STORE });
  if (updated) issueStaffSession(response, updated); // password change ends other sessions; keep this one
  return response;
});
