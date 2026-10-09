import type { Expense, GuestFolio, PaymentMethod } from '@/types/crm';
import { listRecords } from './repos/records';
import { listStaff } from './repos/staff';
import { todayInIST } from '@/lib/tariff-calculator';
import { roundMoney } from '@/lib/gst';

/**
 * Manager cash book: every signed collection and expense, per manager.
 * Cash in hand = everything the manager collected − everything they paid out as expenses
 * (all payment methods, all time, voided entries excluded). The period figures use the
 * IST date the money was recorded.
 */

export type MethodTotals = Record<PaymentMethod, number>;

export interface CashbookEntry {
  kind: 'collection' | 'expense';
  id: string;
  /** For collections: the folio the payment belongs to. */
  folioId?: string;
  amount: number;
  method: PaymentMethod;
  date: string; // IST calendar date
  signedAt: string;
  label: string;
  detail?: string;
  status: 'live' | 'void';
  voidReason?: string;
  receiptUrl?: string;
}

export interface ManagerCashbook {
  staffId: string;
  name: string;
  role: string;
  isActive: boolean;
  period: { collections: number; expenses: number; net: number; collectionsByMethod: MethodTotals; expensesByMethod: MethodTotals; count: number };
  allTime: { collections: number; expenses: number; cashInHand: number };
  lastEntryAt?: string;
  entries: CashbookEntry[];
}

const zero = (): MethodTotals => ({ cash: 0, upi: 0, bank_transfer: 0, card: 0 });
const ist = (iso?: string) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? todayInIST(d) : '';
};

export async function buildCashbook(opts: { from: string; to: string; onlyStaffId?: string }): Promise<{ managers: ManagerCashbook[]; totals: { collections: number; expenses: number; cashInHand: number } }> {
  const [folios, expenses, staff] = await Promise.all([
    listRecords<GuestFolio>('folios', { limit: 5000 }),
    listRecords<Expense>('expenses', { limit: 5000 }),
    listStaff(),
  ]);
  const books = new Map<string, ManagerCashbook>();
  const book = (id: string, fallbackName: string): ManagerCashbook => {
    let b = books.get(id);
    if (!b) {
      const s = staff.find((x) => x.id === id);
      b = {
        staffId: id,
        name: s?.fullName || fallbackName || 'Unknown',
        role: s?.role || 'unknown',
        isActive: s?.isActive ?? false,
        period: { collections: 0, expenses: 0, net: 0, collectionsByMethod: zero(), expensesByMethod: zero(), count: 0 },
        allTime: { collections: 0, expenses: 0, cashInHand: 0 },
        entries: [],
      };
      books.set(id, b);
    }
    return b;
  };
  const inRange = (d: string) => d >= opts.from && d <= opts.to;

  for (const f of folios) {
    for (const p of f.payments || []) {
      const who = p.signedOffById || p.collectedById;
      if (!who || (opts.onlyStaffId && who !== opts.onlyStaffId)) continue;
      const b = book(who, p.signedOffByName || p.collectedByName || '');
      const date = ist(p.signedOffAt || p.collectedAt);
      const live = !p.voidedAt;
      if (live) b.allTime.collections = roundMoney(b.allTime.collections + p.amount);
      if (inRange(date)) {
        if (live) {
          b.period.collections = roundMoney(b.period.collections + p.amount);
          b.period.collectionsByMethod[p.paymentMethod] = roundMoney((b.period.collectionsByMethod[p.paymentMethod] || 0) + p.amount);
          b.period.count += 1;
        }
        b.entries.push({
          kind: 'collection',
          id: p.id,
          folioId: f.id,
          amount: p.amount,
          method: p.paymentMethod,
          date,
          signedAt: p.signedOffAt || p.collectedAt,
          label: `${f.guestName || 'Guest'} · Room ${f.roomNumber || '—'}`,
          detail: [p.transactionReference, p.receiptNotes].filter(Boolean).join(' · ') || undefined,
          status: live ? 'live' : 'void',
          voidReason: p.voidReason,
        });
      }
    }
  }

  for (const e of expenses) {
    const who = e.loggedById;
    if (!who || (opts.onlyStaffId && who !== opts.onlyStaffId)) continue;
    const b = book(who, e.loggedByName);
    const live = e.status !== 'void';
    if (live) b.allTime.expenses = roundMoney(b.allTime.expenses + e.amount);
    if (inRange(e.expenseDate)) {
      if (live) {
        b.period.expenses = roundMoney(b.period.expenses + e.amount);
        b.period.expensesByMethod[e.paymentMethod] = roundMoney((b.period.expensesByMethod[e.paymentMethod] || 0) + e.amount);
        b.period.count += 1;
      }
      b.entries.push({
        kind: 'expense',
        id: e.id,
        amount: e.amount,
        method: e.paymentMethod,
        date: e.expenseDate,
        signedAt: e.signedOffAt || e.createdAt,
        label: e.subTag || e.description,
        detail: [e.vendorPayee, e.description !== e.subTag ? e.description : ''].filter(Boolean).join(' · ') || undefined,
        status: live ? 'live' : 'void',
        voidReason: e.voidReason,
        receiptUrl: e.billReceiptUrl,
      });
    }
  }

  const managers = Array.from(books.values()).map((b) => {
    b.period.net = roundMoney(b.period.collections - b.period.expenses);
    b.allTime.cashInHand = roundMoney(b.allTime.collections - b.allTime.expenses);
    b.entries.sort((x, y) => (y.signedAt || '').localeCompare(x.signedAt || ''));
    b.lastEntryAt = b.entries[0]?.signedAt;
    b.entries = b.entries.slice(0, 300);
    return b;
  });
  // Managers first, then by cash in hand
  managers.sort((a, b) => (a.role === 'manager' ? 0 : 1) - (b.role === 'manager' ? 0 : 1) || b.allTime.cashInHand - a.allTime.cashInHand);
  const totals = managers.reduce(
    (t, m) => ({
      collections: roundMoney(t.collections + m.period.collections),
      expenses: roundMoney(t.expenses + m.period.expenses),
      cashInHand: roundMoney(t.cashInHand + m.allTime.cashInHand),
    }),
    { collections: 0, expenses: 0, cashInHand: 0 }
  );
  return { managers, totals };
}
