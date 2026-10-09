import type { Expense } from '@/types/crm';
import { HttpError } from './http';
import type { StaffContext } from './auth/staff-session';
import { getRecord, listRecords, upsertRecord } from './repos/records';
import { persistDataUrl } from './repos/files';
import { audit } from './audit';
import { lastClosedDate } from './day-close';
import { applyExpenseReview, prepareNewExpense } from './money-rules';

/**
 * Expenses: logged by managers only (signed and server-timestamped), reviewed by admins.
 * Used by the CRM sync and by the Expense Logger app (/api/expenses), so both follow the
 * same rules.
 */

export async function createExpense(input: Partial<Expense> & { id: string }, staff: StaffContext, ip?: string): Promise<{ expense: Expense; duplicate: boolean }> {
  if (!input?.id || typeof input.id !== 'string') throw new HttpError(400, 'Expense id is required.');
  const existing = await getRecord<Expense>('expenses', input.id);
  if (existing) {
    // The same entry sent again (a retry after a timeout, or the offline queue): not a new expense.
    if (existing.loggedById === staff.id) return { expense: existing, duplicate: true };
    throw new HttpError(409, 'An expense with this id already exists.');
  }
  const expense = prepareNewExpense(input, staff);
  const closedUpTo = await lastClosedDate();
  if (closedUpTo && expense.expenseDate <= closedUpTo) {
    throw new HttpError(403, `Today's books (${expense.expenseDate}) are already closed. Ask the owner to reopen or record it tomorrow.`, 'DAY_CLOSED');
  }
  if (expense.billReceiptUrl?.startsWith('data:')) {
    expense.billReceiptUrl = await persistDataUrl(expense.billReceiptUrl, {
      visibility: 'private',
      ownerKind: 'expense',
      ownerId: expense.id,
      actor: `staff:${staff.id}`,
    });
  } else if (expense.billReceiptUrl && !expense.billReceiptUrl.startsWith('/api/files/')) {
    expense.billReceiptUrl = undefined;
  }
  await upsertRecord('expenses', expense, `staff:${staff.id}`);
  await audit({ actor: `staff:${staff.id}`, action: 'create', entity: 'expenses', entityId: expense.id, after: expense, ip });
  return { expense, duplicate: false };
}

export async function reviewExpense(id: string, change: Partial<Expense>, staff: StaffContext, ip?: string): Promise<Expense> {
  const before = await getRecord<Expense>('expenses', id);
  if (!before) throw new HttpError(404, 'Expense not found.');
  const after = applyExpenseReview(before, change, staff);
  if (after !== before) {
    await upsertRecord('expenses', after, `staff:${staff.id}`);
    await audit({ actor: `staff:${staff.id}`, action: after.status === 'void' ? 'void' : 'approve', entity: 'expenses', entityId: id, before, after, ip });
  }
  return after;
}

/** Admins see every expense; managers see only their own; kitchen sees none. */
export async function listExpensesFor(staff: StaffContext, opts: { from?: string; to?: string } = {}): Promise<Expense[]> {
  if (staff.role === 'kitchen_staff') throw new HttpError(403, 'Not available for kitchen accounts.', 'FORBIDDEN');
  const all = await listRecords<Expense>('expenses', { limit: 5000 });
  return all.filter(
    (e) =>
      (staff.role === 'admin' || e.loggedById === staff.id) &&
      (!opts.from || e.expenseDate >= opts.from) &&
      (!opts.to || e.expenseDate <= opts.to)
  );
}
