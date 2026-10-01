import { z } from 'zod';
import { handler, ok, readJson, HttpError, clientIp } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import {
  countActiveAdmins,
  deleteStaff,
  findStaffByEmail,
  findStaffById,
  setStaffPassword,
  toPublicStaff,
  updateStaff,
} from '@/lib/server/repos/staff';
import { passwordProblem } from '@/lib/server/auth/password';
import { audit } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

const Patch = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(200).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  role: z.enum(['admin', 'manager', 'kitchen_staff']).optional(),
  isActive: z.boolean().optional(),
  /** Admin password reset: the user must change it at next sign-in. */
  newPassword: z.string().min(1).max(200).optional(),
});

export const PATCH = handler('staff.update', async (request: Request, ctx: { params: { id: string } }) => {
  const admin = await requireStaff(request, ROLES.ADMIN);
  const id = ctx.params.id;
  const body = await readJson(request, Patch);
  const before = await findStaffById(id);
  if (!before) throw new HttpError(404, 'Staff account not found.');

  const demoting = (body.role && body.role !== 'admin') || body.isActive === false;
  if (before.role === 'admin' && demoting && (await countActiveAdmins(id)) === 0) {
    throw new HttpError(409, 'At least one active admin account is required.');
  }
  if (body.email && body.email.toLowerCase() !== before.email) {
    const other = await findStaffByEmail(body.email);
    if (other && other.id !== id) throw new HttpError(409, 'Another account already uses this email.');
  }
  if (body.newPassword) {
    const problem = passwordProblem(body.newPassword);
    if (problem) throw new HttpError(400, problem);
    await setStaffPassword(id, body.newPassword, id !== admin.id);
  }
  const after = await updateStaff(id, body);
  await audit({
    actor: `staff:${admin.id}`,
    action: body.newPassword ? 'update_with_password_reset' : 'update',
    entity: 'staff',
    entityId: id,
    before: toPublicStaff(before),
    after: after ? toPublicStaff(after) : null,
    ip: clientIp(request),
  });
  return ok({ staff: after ? toPublicStaff(after) : null });
});

export const DELETE = handler('staff.delete', async (request: Request, ctx: { params: { id: string } }) => {
  const admin = await requireStaff(request, ROLES.ADMIN);
  const id = ctx.params.id;
  if (id === admin.id) throw new HttpError(409, 'You cannot delete your own account.');
  const before = await findStaffById(id);
  if (!before) throw new HttpError(404, 'Staff account not found.');
  if (before.role === 'admin' && (await countActiveAdmins(id)) === 0) {
    throw new HttpError(409, 'At least one active admin account is required.');
  }
  await deleteStaff(id);
  await audit({ actor: `staff:${admin.id}`, action: 'delete', entity: 'staff', entityId: id, before: toPublicStaff(before), ip: clientIp(request) });
  return ok({ deleted: true });
});
