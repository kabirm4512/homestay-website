import type { ChargeCategory, Expense, FolioCharge, FolioPayment, GuestFolio, PaymentMethod } from '@/types/crm';
import { HttpError } from './http';
import type { StaffContext } from './auth/staff-session';
import { todayInIST } from '@/lib/tariff-calculator';
import { roundMoney } from '@/lib/gst';

/**
 * Who may record money, and how it is signed.
 *
 * - Every collection (folio payment) and every expense is recorded by a MANAGER account only.
 *   The manager must tick the sign-off ("I confirm…"); the server then stamps their account,
 *   name and the server time. Nothing the device sends about who/when is trusted.
 * - Admins review: they can void a collection or an expense (with a reason) and approve
 *   expenses. They cannot record new money and cannot change amounts.
 * - Recorded money is never deleted; a void keeps the record for the audit trail.
 */

const METHODS: PaymentMethod[] = ['cash', 'upi', 'bank_transfer', 'card'];
export const MAX_ENTRY_AMOUNT = 1_000_000;

export function assertCanRecordMoney(staff: StaffContext, what: 'collection' | 'expense') {
  if (staff.role !== 'manager') {
    throw new HttpError(
      403,
      what === 'collection'
        ? 'Only a manager account can record a collection. Ask the duty manager to record it.'
        : 'Only a manager account can log an expense. Ask the duty manager to log it.',
      'MANAGER_ONLY'
    );
  }
}

function assertAmount(amount: unknown): number {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_ENTRY_AMOUNT) throw new HttpError(400, 'Enter an amount above ₹0.');
  return roundMoney(n);
}

function assertMethod(m: unknown): PaymentMethod {
  if (!METHODS.includes(m as PaymentMethod)) throw new HttpError(400, 'Choose how the money was paid (cash, UPI, bank or card).');
  return m as PaymentMethod;
}

function assertReason(reason: unknown): string {
  const r = typeof reason === 'string' ? reason.trim() : '';
  if (r.length < 3) throw new HttpError(400, 'A reason is required to void an entry.');
  return r.slice(0, 300);
}

/**
 * The payments to store for a folio change. Existing payments are kept exactly as recorded
 * (admins may only void them); new payments must come from a manager who signed off.
 */
export function applyPaymentRules(before: GuestFolio | null, after: GuestFolio, staff: StaffContext, now = new Date()): FolioPayment[] {
  const iso = now.toISOString();
  const incoming = Array.isArray(after.payments) ? after.payments : [];
  const byId = new Map(incoming.map((p) => [p.id, p]));
  const out: FolioPayment[] = [];

  for (const old of before?.payments || []) {
    const next = byId.get(old.id);
    byId.delete(old.id);
    if (!next) {
      // A device with an older copy of the bill: keep the recorded collection (never lost)
      out.push(old);
      continue;
    }
    if (next.amount !== old.amount || next.paymentMethod !== old.paymentMethod) {
      throw new HttpError(403, 'Recorded collections cannot be changed. An admin can void one with a reason.', 'LEDGER_LOCKED');
    }
    const voidRequested = !old.voidedAt && (Boolean(next.voidedAt) || Boolean(next.voidReason));
    if (voidRequested) {
      if (staff.role !== 'admin') throw new HttpError(403, 'Only an admin can void a collection.', 'FORBIDDEN');
      out.push({ ...old, voidedAt: iso, voidedById: staff.id, voidedByName: staff.fullName, voidReason: assertReason(next.voidReason) });
    } else {
      out.push(old); // unchanged, whatever the device sent
    }
  }

  // Whatever is left is new
  for (const p of Array.from(byId.values())) {
    assertCanRecordMoney(staff, 'collection');
    if (p.signOffConfirmed !== true) {
      throw new HttpError(400, 'Please tick the confirmation to sign this collection.', 'SIGN_OFF_REQUIRED');
    }
    out.push({
      id: String(p.id).slice(0, 100),
      folioId: after.id,
      kind: p.kind === 'refund' ? 'refund' : 'payment',
      amount: assertAmount(p.amount),
      paymentMethod: assertMethod(p.paymentMethod),
      transactionReference: typeof p.transactionReference === 'string' ? p.transactionReference.slice(0, 120) : undefined,
      receiptNotes: typeof p.receiptNotes === 'string' ? p.receiptNotes.slice(0, 500) : undefined,
      collectedAt: iso,
      collectedById: staff.id,
      collectedByName: staff.fullName,
      signOffConfirmed: true,
      signedOffById: staff.id,
      signedOffByName: staff.fullName,
      signedOffAt: iso,
    });
  }
  // Newest first, as the screens expect
  return out.sort((a, b) => (b.collectedAt || '').localeCompare(a.collectedAt || ''));
}

/** A new expense from a manager: server date, signer and time; the device's values are ignored. */
export function prepareNewExpense(input: Partial<Expense> & { id: string }, staff: StaffContext, now = new Date()): Expense {
  assertCanRecordMoney(staff, 'expense');
  if (input.signOffConfirmed !== true) throw new HttpError(400, 'Please tick the confirmation to sign this expense.', 'SIGN_OFF_REQUIRED');
  const iso = now.toISOString();
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const category = text(input.masterCategory, 40) || 'miscellaneous';
  return {
    id: String(input.id).slice(0, 100),
    expenseDate: todayInIST(now),
    amount: assertAmount(input.amount),
    paymentMethod: assertMethod(input.paymentMethod),
    masterCategory: category as Expense['masterCategory'],
    subTag: text(input.subTag, 80) || 'General',
    vendorPayee: text(input.vendorPayee, 120) || undefined,
    description: text(input.description, 500) || text(input.subTag, 80) || 'Expense',
    billReceiptUrl: typeof input.billReceiptUrl === 'string' ? input.billReceiptUrl : undefined,
    loggedById: staff.id,
    loggedByName: staff.fullName,
    createdAt: iso,
    signOffConfirmed: true,
    signedOffAt: iso,
    status: 'submitted',
  };
}

/** Admin review of an existing expense: approve, or void with a reason. Nothing else changes. */
export function applyExpenseReview(before: Expense, after: Partial<Expense>, staff: StaffContext, now = new Date()): Expense {
  if (staff.role !== 'admin') throw new HttpError(403, 'Recorded expenses cannot be edited. An admin can void one with a reason.', 'LEDGER_LOCKED');
  if (before.status === 'void') throw new HttpError(409, 'This expense is already void.');
  const iso = now.toISOString();
  if (after.status === 'void') {
    return { ...before, status: 'void', voidedAt: iso, voidedById: staff.id, voidedByName: staff.fullName, voidReason: assertReason(after.voidReason) };
  }
  if (after.status === 'approved' && before.status !== 'approved') {
    return { ...before, status: 'approved', approvedAt: iso, approvedById: staff.id, approvedByName: staff.fullName };
  }
  return before;
}

export function isLiveExpense(e: Expense): boolean {
  return e.status !== 'void';
}


// ------------------------------------------------------------------------------ charges
const CATEGORIES: ChargeCategory[] = ['room_tariff', 'food_beverage', 'transport_transfer', 'vehicle_rental', 'laundry', 'miscellaneous'];
/** Managers may void a line they posted within this window (older lines: admin). */
export const MANAGER_VOID_WINDOW_MS = 30 * 60 * 1000;
/** Managers may give a discount up to this share of the bill, and at most this amount. */
export const MANAGER_DISCOUNT_SHARE = 0.1;
export const MANAGER_DISCOUNT_MAX = 1000;

const STATUS_RANK: Record<string, number> = { pending: 0, posted: 1, void: 2 };

/**
 * The charge lines to store for a folio change. Lines are never deleted (a device with an
 * older copy cannot drop a line someone else added), amounts and categories never change,
 * and a status only moves forward: pending → posted → void. A void needs a reason; managers
 * may void pending lines and lines they posted in the last 30 minutes, admins any line.
 */
export function applyChargeRules(before: GuestFolio | null, after: GuestFolio, staff: StaffContext, now = new Date()): FolioCharge[] {
  const iso = now.toISOString();
  const incoming = Array.isArray(after.charges) ? after.charges : [];
  const byId = new Map(incoming.map((c) => [c.id, c]));
  const out: FolioCharge[] = [];

  for (const old of before?.charges || []) {
    const next = byId.get(old.id);
    byId.delete(old.id);
    if (!next || (STATUS_RANK[next.chargeStatus] ?? 0) <= (STATUS_RANK[old.chargeStatus] ?? 0)) {
      out.push(old); // unchanged, stale copy, or an attempt to move a status backwards
      continue;
    }
    if (next.chargeStatus === 'posted') {
      out.push({ ...old, chargeStatus: 'posted' });
      continue;
    }
    // → void
    if (staff.role === 'kitchen_staff') throw new HttpError(403, 'Kitchen accounts cannot void bill lines.', 'FORBIDDEN');
    if (staff.role === 'manager' && old.chargeStatus === 'posted') {
      const mine = old.postedById === staff.id || (!old.postedById && old.postedByName === staff.fullName);
      const recent = now.getTime() - new Date(old.postedAt).getTime() <= MANAGER_VOID_WINDOW_MS;
      const fromCancelledSource = old.sourceReferenceType === 'food_order' || old.sourceReferenceType === 'transport_request';
      if (!fromCancelledSource && !(mine && recent)) {
        throw new HttpError(403, 'Only an admin can void this line (managers can void their own lines within 30 minutes).', 'FORBIDDEN');
      }
    }
    out.push({ ...old, chargeStatus: 'void', voidReason: assertReason(next.voidReason), voidedAt: iso, voidedByName: staff.fullName });
  }

  for (const c of Array.from(byId.values())) {
    if (staff.role === 'kitchen_staff') throw new HttpError(403, 'Kitchen accounts cannot add bill lines.', 'FORBIDDEN');
    if (!CATEGORIES.includes(c.category)) throw new HttpError(400, 'Unknown charge category.');
    const title = typeof c.title === 'string' ? c.title.trim().slice(0, 200) : '';
    if (!title) throw new HttpError(400, 'Every bill line needs a description.');
    out.push({
      ...c,
      id: String(c.id).slice(0, 100),
      folioId: after.id,
      title,
      amount: assertAmount(c.amount),
      chargeStatus: c.chargeStatus === 'pending' ? 'pending' : c.chargeStatus === 'void' ? 'void' : 'posted',
      postedAt: iso,
      postedById: staff.id,
      postedByName: staff.fullName,
    });
  }
  return out;
}

/** Discount rules: a reason is required; managers are limited; admins up to the bill. */
export function applyDiscountRules(before: GuestFolio | null, after: GuestFolio, staff: StaffContext, billedSubtotal: number): Pick<GuestFolio, 'discountAmount' | 'discountReason' | 'discountByName'> {
  const prev = { discountAmount: before?.discountAmount || 0, discountReason: before?.discountReason, discountByName: before?.discountByName };
  const wanted = Number(after.discountAmount || 0);
  if (!Number.isFinite(wanted) || wanted === prev.discountAmount) return prev;
  if (wanted < 0) throw new HttpError(400, 'A discount cannot be negative.');
  if (staff.role === 'kitchen_staff') throw new HttpError(403, 'Kitchen accounts cannot give discounts.', 'FORBIDDEN');
  if (wanted > 0) {
    const reason = typeof after.discountReason === 'string' ? after.discountReason.trim() : '';
    if (reason.length < 3) throw new HttpError(400, 'Please give a reason for the discount.');
    if (staff.role === 'manager') {
      const limit = Math.min(MANAGER_DISCOUNT_MAX, roundMoney(billedSubtotal * MANAGER_DISCOUNT_SHARE));
      if (wanted > limit) {
        throw new HttpError(403, `Managers can give up to ₹${limit.toLocaleString('en-IN')} on this bill (10%, max ₹1,000). Ask the owner for more.`, 'DISCOUNT_LIMIT');
      }
    }
    return { discountAmount: roundMoney(Math.min(wanted, billedSubtotal)), discountReason: reason.slice(0, 300), discountByName: staff.fullName };
  }
  return { discountAmount: 0, discountReason: undefined, discountByName: staff.fullName };
}
