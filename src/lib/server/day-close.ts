import { getSql } from './db';
import { HttpError } from './http';
import { listRecords } from './repos/records';
import { addCalendarDays, todayInIST } from '@/lib/tariff-calculator';
import { moneySummary } from './reports';
import { roundMoney } from '@/lib/gst';
import type { Expense } from '@/types/crm';

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

export async function summarizeDay(date: string): Promise<DayCloseSummary> {
  // The same definitions as the dashboard (lib/reports-core.ts): revenue by the night/day the
  // service was given, GST on every billed line, collections recorded that day, voids excluded.
  const [{ current }, expenses] = await Promise.all([moneySummary(date, date), listRecords<Expense>('expenses', { limit: 20000 })]);
  const add = (m: Record<string, number>, k: string, v: number) => (m[k] = roundMoney((m[k] || 0) + v));
  const payments = {
    byMethod: Object.fromEntries(Object.entries(current.collections.byMethod).filter(([, v]) => v > 0)) as Record<string, number>,
    total: current.collections.net,
    count: current.collections.count,
  };
  if (current.collections.refunds > 0) payments.byMethod.refunds = -current.collections.refunds;
  const charges = {
    byCategory: Object.fromEntries(Object.entries(current.revenue.byStream).filter(([, v]) => v > 0)) as Record<string, number>,
    total: current.revenue.total,
    tax: current.gst,
  };
  const exp = { byMethod: {} as Record<string, number>, total: 0, count: 0 };
  for (const e of expenses) {
    if (e.status === 'void' || e.expenseDate !== date) continue;
    add(exp.byMethod, e.paymentMethod || 'other', e.amount);
    exp.total = roundMoney(exp.total + e.amount);
    exp.count += 1;
  }
  const netCash = roundMoney((current.collections.byMethod.cash || 0) - (exp.byMethod.cash || 0));
  return {
    date,
    payments,
    charges,
    expenses: exp,
    netCash,
    openFolios: current.topOutstanding.length,
    balanceDueOpen: current.receivables,
  };
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
  // Days are closed in order, so no day is locked without its own snapshot
  const last = await lastClosedDate();
  if (last && date > last && addCalendarDays(last, 1) !== date) {
    throw new HttpError(409, `Close ${addCalendarDays(last, 1)} first (days are closed in order).`, 'CLOSE_IN_ORDER');
  }
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
