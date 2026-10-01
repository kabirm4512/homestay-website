import { z } from 'zod';
import { handler, ok, readJson, HttpError, clientIp } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { createStaff, findStaffByEmail, listStaff, toPublicStaff } from '@/lib/server/repos/staff';
import { passwordProblem } from '@/lib/server/auth/password';
import { audit } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

export const GET = handler('staff.list', async (request: Request) => {
  await requireStaff(request, ROLES.ADMIN);
  return ok({ staff: await listStaff() });
});

const Create = z.object({
  email: z.string().trim().email().max(200),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(['admin', 'manager', 'kitchen_staff']),
  password: z.string().min(1).max(200),
});

/** Admin creates a staff login. The new user must change the password at first sign-in. */
export const POST = handler('staff.create', async (request: Request) => {
  const admin = await requireStaff(request, ROLES.ADMIN);
  const body = await readJson(request, Create);
  const problem = passwordProblem(body.password);
  if (problem) throw new HttpError(400, problem);
  if (await findStaffByEmail(body.email)) throw new HttpError(409, 'An account with this email already exists.');
  const row = await createStaff({ ...body, mustChangePassword: true });
  await audit({ actor: `staff:${admin.id}`, action: 'create', entity: 'staff', entityId: row.id, after: toPublicStaff(row), ip: clientIp(request) });
  return ok({ staff: toPublicStaff(row) }, { status: 201 });
});
