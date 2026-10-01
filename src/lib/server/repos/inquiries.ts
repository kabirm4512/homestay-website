import crypto from 'crypto';
import { getSql } from '../db';
import type { Inquiry } from '@/types';
import { HttpError } from '../http';

export async function listInquiries(): Promise<Inquiry[]> {
  const sql = getSql();
  const rows = await sql<{ id: string; status: string; data: Inquiry; created_at: Date }[]>`
    select id, status, data, created_at from pms.inquiries order by created_at desc`;
  return rows.map((r) => ({ ...r.data, id: r.id, status: r.status as Inquiry['status'], created_at: r.data.created_at || new Date(r.created_at).toISOString() }));
}

export async function createInquiry(input: Omit<Inquiry, 'id' | 'status' | 'created_at'>): Promise<Inquiry> {
  const sql = getSql();
  const inquiry: Inquiry = { ...input, id: `inq-${crypto.randomUUID()}`, status: 'pending', created_at: new Date().toISOString() };
  await sql`insert into pms.inquiries (id, status, data) values (${inquiry.id}, 'pending', ${sql.json(inquiry as never)})`;
  return inquiry;
}

export async function updateInquiry(id: string, updates: { status?: Inquiry['status']; internal_notes?: string }): Promise<{ before: Inquiry; after: Inquiry }> {
  const sql = getSql();
  const rows = await sql<{ data: Inquiry; status: string }[]>`select data, status from pms.inquiries where id = ${id}`;
  if (!rows[0]) throw new HttpError(404, 'Inquiry not found.');
  const before = { ...rows[0].data, status: rows[0].status as Inquiry['status'] };
  const after: Inquiry = {
    ...before,
    status: updates.status || before.status,
    internal_notes: updates.internal_notes !== undefined ? updates.internal_notes : before.internal_notes,
  };
  await sql`update pms.inquiries set status = ${after.status}, data = ${sql.json(after as never)}, updated_at = now() where id = ${id}`;
  return { before, after };
}
