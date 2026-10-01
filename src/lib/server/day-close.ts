import { getSql } from './db';
import { HttpError } from './http';
import { listRecords } from './repos/records';
import { todayInIST } from '@/lib/tariff-calculator';
import { roundMoney } from '@/lib/gst';
import type { Expense, GuestFolio } from '@/types/crm';

/**
 * Day close: an immutable end-of-day snapshot of money in and out (by payment method),
 * charges posted and expenses. After a day is closed, non-admin staff can no longer
 * record expenses dated on or before it.
 */

export interface DayCloseSummary {
  date: string;
  payments: { byMethod: Record<string, number>; total: number; count: number };
  charges: { byCategory: Record<string, number>; total: number; tax: number };
  expenses: { byMethod: Record<string, number>; total: number; count: number };
  netCash: number;
  openFolios: number;
  balanceDueOpen: number;
}

export interface DayCloseRecord extends DayCloseSummary {
  id: string;
  closedAt: string;
  closedById: string;
  closedByName: string;
  notes?: string;
}

/** IST calendar date of an ISO timestamp. */
function istDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : todayInIST(d);
}

export async function summarizeDay(date: string): Promise<DayCloseSummary> {
  const [folios, expenses] = await Promise.all([
    listRecords<GuestFolio>('folios', { limit: 5000 }),
    listRecords<Expense>('expenses', { limit: 5000 }),
  ]);
  const add = (m: Record<string, number>, k: string, v: number) => (m[k] = roundMoney((m[k] || 0) + v));

  const payments = { byMethod: {} as Record<string, number>, total: 0, count: 0 };
  const charges = { byCategory: {} as Record<string, number>, total: 0, tax: 0 };
  let openFolios = 0;
  let balanceDueOpen = 0;
  for (const f of folios) {
    for (const p of f.payments || []) {
      if (istDate(p.collectedAt) !== date) continue;
      add(payments.byMethod, p.paymentMethod || 'other', p.amount);
      payments.total = roundMoney(payments.total + p.amount);
      payments.count += 1;
    }
    for (const c of f.charges || []) {
      if (c.chargeStatus === 'void' || istDate(c.postedAt) !== date) continue;
      add(charges.byCategory, c.category, c.amount);
      charges.total = roundMoney(charges.total + c.amount);
      charges.tax = roundMoney(charges.tax + (c.taxAmount || 0));
    }
    if (f.status !== 'settled' && (f.balanceDue || 0) > 0) {
      openFolios += 1;
      balanceDueOpen = roundMoney(balanceDueOpen + f.balanceDue);
    }
  }
  const exp = { byMethod: {} as Record<string, number>, total: 0, count: 0 };
  for (const e of expenses) {
    if (e.expenseDate !== date) continue;
    add(exp.byMethod, e.paymentMethod || 'other', e.amount);
    exp.total = roundMoney(exp.total + e.amount);
    exp.count += 1;
  }
  const netCash = roundMoney((payments.byMethod.cash || 0) - (exp.byMethod.cash || 0));
  return { date, payments, charges, expenses: exp, netCash, openFolios, balanceDueOpen };
}

export async function getDayClose(date: string): Promise<DayCloseRecord | null> {
  const sql = getSql();
  const rows = await sql<{ data: DayCloseRecord }[]>`select data from pms.records where collection = 'dayCloses' and id = ${date}`;
  return rows[0]?.data || null;
}

export async function lastClosedDate(): Promise<string | null> {
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`select id from pms.records where collection = 'dayCloses' order by id desc limit 1`;
  return rows[0]?.id || null;
}

export async function closeDay(date: string, staff: { id: string; fullName: string }, notes?: string): Promise<DayCloseRecord> {
  if (date > todayInIST()) throw new HttpError(400, 'You cannot close a day in the future.');
  const existing = await getDayClose(date);
  if (existing) throw new HttpError(409, `${date} was already closed by ${existing.closedByName}.`, 'ALREADY_CLOSED');
  const summary = await summarizeDay(date);
  const record: DayCloseRecord = {
    ...summary,
    id: date,
    closedAt: new Date().toISOString(),
    closedById: staff.id,
    closedByName: staff.fullName,
    notes: notes?.slice(0, 1000),
  };
  const sql = getSql();
  await sql`insert into pms.records (collection, id, data, updated_by)
            values ('dayCloses', ${date}, ${sql.json(record as never)}, ${`staff:${staff.id}`})`;
  return record;
}
