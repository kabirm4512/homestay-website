import crypto from 'crypto';
import { getSql } from '../db';
import { hashPassword } from '../auth/password';
import type { StaffRole } from '@/types/crm';

export interface StaffRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: StaffRole;
  password_hash: string;
  is_active: boolean;
  must_change_password: boolean;
  session_version: number;
  created_at: Date;
  last_login_at: Date | null;
}

/** What the client sees about a staff account (never the password hash). */
export interface PublicStaff {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: StaffRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export function toPublicStaff(row: StaffRow): PublicStaff {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone || undefined,
    role: row.role,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    createdAt: new Date(row.created_at).toISOString(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : undefined,
  };
}

export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

export async function countStaff(): Promise<number> {
  const sql = getSql();
  const [{ count }] = await sql<{ count: string }[]>`select count(*)::text as count from pms.staff_users`;
  return Number(count);
}

export async function findStaffByEmail(email: string): Promise<StaffRow | null> {
  const sql = getSql();
  const rows = await sql<StaffRow[]>`select * from pms.staff_users where email = ${normalizeEmail(email)}`;
  return rows[0] || null;
}

export async function findStaffById(id: string): Promise<StaffRow | null> {
  const sql = getSql();
  const rows = await sql<StaffRow[]>`select * from pms.staff_users where id = ${id}`;
  return rows[0] || null;
}

export async function listStaff(): Promise<PublicStaff[]> {
  const sql = getSql();
  const rows = await sql<StaffRow[]>`select * from pms.staff_users order by created_at asc`;
  return rows.map(toPublicStaff);
}

export async function createStaff(input: {
  email: string;
  fullName: string;
  phone?: string;
  role: StaffRole;
  password: string;
  mustChangePassword?: boolean;
}): Promise<StaffRow> {
  const sql = getSql();
  const id = `staff-${crypto.randomUUID()}`;
  const passwordHash = await hashPassword(input.password);
  const rows = await sql<StaffRow[]>`
    insert into pms.staff_users (id, email, full_name, phone, role, password_hash, must_change_password)
    values (${id}, ${normalizeEmail(input.email)}, ${input.fullName.trim()}, ${input.phone || null}, ${input.role},
            ${passwordHash}, ${input.mustChangePassword ?? true})
    returning *`;
  return rows[0];
}

export async function updateStaff(
  id: string,
  updates: { fullName?: string; phone?: string | null; role?: StaffRole; isActive?: boolean; email?: string }
): Promise<StaffRow | null> {
  const sql = getSql();
  const current = await findStaffById(id);
  if (!current) return null;
  // Changing role or deactivating ends existing sessions.
  const bump = (updates.role && updates.role !== current.role) || updates.isActive === false ? 1 : 0;
  const rows = await sql<StaffRow[]>`
    update pms.staff_users set
      full_name = ${updates.fullName?.trim() || current.full_name},
      phone = ${updates.phone === undefined ? current.phone : updates.phone},
      role = ${updates.role || current.role},
      is_active = ${updates.isActive ?? current.is_active},
      email = ${updates.email ? normalizeEmail(updates.email) : current.email},
      session_version = session_version + ${bump},
      updated_at = now()
    where id = ${id}
    returning *`;
  return rows[0] || null;
}

export async function setStaffPassword(id: string, password: string, mustChange: boolean): Promise<void> {
  const sql = getSql();
  const passwordHash = await hashPassword(password);
  await sql`
    update pms.staff_users set password_hash = ${passwordHash}, must_change_password = ${mustChange},
      session_version = session_version + 1, updated_at = now()
    where id = ${id}`;
}

export async function deleteStaff(id: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`delete from pms.staff_users where id = ${id} returning id`;
  return rows.length > 0;
}

export async function countActiveAdmins(excludeId?: string): Promise<number> {
  const sql = getSql();
  const [{ count }] = await sql<{ count: string }[]>`
    select count(*)::text as count from pms.staff_users
    where role = 'admin' and is_active and (${excludeId || null}::text is null or id <> ${excludeId || null})`;
  return Number(count);
}

export async function touchLogin(id: string): Promise<void> {
  const sql = getSql();
  await sql`update pms.staff_users set last_login_at = now() where id = ${id}`;
}

/**
 * First-run bootstrap: when no staff exist, create the default admin from
 * DEFAULT_ADMIN_EMAIL / DEFAULT_ADMIN_PASSWORD (must change password on first sign-in).
 * Returns true if an admin now exists.
 */
export async function ensureDefaultAdmin(): Promise<boolean> {
  if ((await countStaff()) > 0) return true;
  const email = process.env.DEFAULT_ADMIN_EMAIL;
  const password = process.env.DEFAULT_ADMIN_PASSWORD;
  if (!email || !password || password.length < 8) return false;
  try {
    await createStaff({
      email,
      fullName: process.env.DEFAULT_ADMIN_NAME || 'Savera Admin (Owner)',
      role: 'admin',
      password,
      mustChangePassword: true,
    });
  } catch {
    // Another instance created it at the same moment: fine.
  }
  return (await countStaff()) > 0;
}
