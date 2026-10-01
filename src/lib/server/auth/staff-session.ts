import type { NextResponse } from 'next/server';
import type { StaffRole } from '@/types/crm';
import { createToken, verifyToken, readCookie, cookieOptions } from './tokens';
import { findStaffById, StaffRow } from '../repos/staff';
import { HttpError } from '../http';

export const STAFF_COOKIE = 'savera_staff';
export const STAFF_SESSION_SECONDS = 7 * 24 * 60 * 60;

export interface StaffContext {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  mustChangePassword: boolean;
}

interface StaffClaims extends Record<string, unknown> {
  t: 'staff';
  uid: string;
  sv: number;
}

export function issueStaffSession(response: NextResponse, staff: StaffRow): void {
  const token = createToken({ t: 'staff', uid: staff.id, sv: staff.session_version }, STAFF_SESSION_SECONDS);
  response.cookies.set(STAFF_COOKIE, token, cookieOptions(STAFF_SESSION_SECONDS));
}

export function clearStaffSession(response: NextResponse): void {
  response.cookies.set(STAFF_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
}

/** Returns the signed-in staff member, or null. Checks the account is still active. */
export async function getStaff(request: Request): Promise<StaffContext | null> {
  const claims = verifyToken<StaffClaims>(readCookie(request, STAFF_COOKIE));
  if (!claims || claims.t !== 'staff' || typeof claims.uid !== 'string') return null;
  const row = await findStaffById(claims.uid);
  if (!row || !row.is_active || row.session_version !== claims.sv) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    mustChangePassword: row.must_change_password,
  };
}

/**
 * Requires a signed-in staff member with one of the given roles (any role if omitted).
 * Staff who must change their password can only reach the change-password endpoint.
 */
export async function requireStaff(
  request: Request,
  roles?: StaffRole[],
  options: { allowPasswordChangePending?: boolean } = {}
): Promise<StaffContext> {
  const staff = await getStaff(request);
  if (!staff) throw new HttpError(401, 'Please sign in to continue.', 'AUTH_REQUIRED');
  if (staff.mustChangePassword && !options.allowPasswordChangePending) {
    throw new HttpError(403, 'Please set a new password before continuing.', 'PASSWORD_CHANGE_REQUIRED');
  }
  if (roles && !roles.includes(staff.role)) {
    throw new HttpError(403, 'Your account does not have permission for this action.', 'FORBIDDEN');
  }
  return staff;
}

export const ROLES = {
  ADMIN: ['admin'] as StaffRole[],
  MANAGERS: ['admin', 'manager'] as StaffRole[],
  ALL: ['admin', 'manager', 'kitchen_staff'] as StaffRole[],
};
