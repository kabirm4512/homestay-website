import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handler, readJson, HttpError, NO_STORE, clientIp } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { ensureDefaultAdmin, findStaffByEmail, toPublicStaff, touchLogin } from '@/lib/server/repos/staff';
import { verifyPassword } from '@/lib/server/auth/password';
import { issueStaffSession } from '@/lib/server/auth/staff-session';
import { audit } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

const Body = z.object({
  email: z.string().trim().min(3).max(200),
  password: z.string().min(1).max(200),
});

export const POST = handler('auth.login', async (request: Request) => {
  const { email, password } = await readJson(request, Body);
  await rateLimit(request, 'login', 10, 15 * 60, email.toLowerCase());

  if (!(await ensureDefaultAdmin())) {
    throw new HttpError(
      503,
      'No staff accounts exist yet. Set DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD on the server to create the first admin.',
      'NO_ADMIN'
    );
  }

  const staff = await findStaffByEmail(email);
  const valid = staff ? await verifyPassword(password, staff.password_hash) : false;
  if (!staff || !valid) {
    await audit({ actor: `login:${email.toLowerCase()}`, action: 'login_failed', entity: 'staff', ip: clientIp(request) });
    throw new HttpError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }
  if (!staff.is_active) throw new HttpError(403, 'This account has been deactivated. Please contact the administrator.', 'INACTIVE');

  await touchLogin(staff.id);
  await audit({ actor: `staff:${staff.id}`, action: 'login', entity: 'staff', entityId: staff.id, ip: clientIp(request) });
  const response = NextResponse.json({ success: true, user: toPublicStaff(staff) }, { headers: NO_STORE });
  issueStaffSession(response, staff);
  return response;
});
