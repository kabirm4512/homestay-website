import type { Expense, ExpenseMasterCategory, PaymentMethod } from '@/types/crm';

/** What a manager enters; the server adds the date, their signature (account) and the time. */
export interface NewExpenseInput {
  amount: number;
  paymentMethod: PaymentMethod;
  masterCategory: ExpenseMasterCategory;
  subTag: string;
  vendorPayee?: string;
  description?: string;
  /** A compressed photo as a data URL; stored privately on the server. */
  billReceiptUrl?: string;
  /** The manager ticked "I confirm I paid this amount". */
  signOffConfirmed: boolean;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export type PostExpenseResult = { ok: true; expense: Expense; duplicate: boolean } | { ok: false; error: string; status: number; retryable: boolean };

/** Sends one expense. Safe to retry with the same id: the server never records it twice. */
export async function postExpense(input: NewExpenseInput & { id: string }): Promise<PostExpenseResult> {
  try {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(30_000),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success && json.expense) return { ok: true, expense: json.expense as Expense, duplicate: Boolean(json.duplicate) };
    return {
      ok: false,
      status: res.status,
      error: json?.error || `Could not save (error ${res.status}).`,
      // Server busy / timeouts are retried; rule violations (4xx) are not
      retryable: res.status >= 500 || res.status === 408 || res.status === 429,
    };
  } catch {
    return { ok: false, status: 0, error: 'No connection. It will be sent when you are back online.', retryable: true };
  }
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseMasterCategory, string> = {
  groceries: 'Groceries',
  utilities: 'Utilities & fuel',
  housekeeping: 'Housekeeping',
  maintenance: 'Maintenance',
  staff_payroll: 'Staff',
  marketing: 'Marketing',
  transport_vendor: 'Transport vendor',
  miscellaneous: 'Other',
};
