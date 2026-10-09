'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ShoppingBasket, Flame, Sparkles, Wrench, Users, Car, Megaphone, MoreHorizontal,
  Camera, X, Check, Banknote, Smartphone, CreditCard, Building, PenLine, Store,
} from 'lucide-react';
import type { Expense, ExpenseMasterCategory, PaymentMethod } from '@/types/crm';
import { enqueueExpense } from '@/lib/expense-outbox';
import { compressImageFile } from '@/lib/image-upload';

/**
 * The expense form shared by the Expense Logger app and the desk's quick logger.
 * Fast path (repeat purchase): tap a "Recent" chip → check the amount → tick sign-off → Save.
 * Saving writes to the device first (works offline) and syncs in the background.
 */

const CATEGORIES: { key: ExpenseMasterCategory; label: string; icon: typeof Flame; tags: string[] }[] = [
  { key: 'groceries', label: 'Kitchen', icon: ShoppingBasket, tags: ['Vegetables', 'Milk & dairy', 'Groceries', 'Meat & fish', 'Bakery', 'Drinking water'] },
  { key: 'utilities', label: 'Utilities', icon: Flame, tags: ['LPG cylinder', 'Electricity', 'Diesel / fuel', 'Water', 'Internet', 'Mobile recharge'] },
  { key: 'housekeeping', label: 'Housekeeping', icon: Sparkles, tags: ['Toiletries', 'Cleaning supplies', 'Laundry', 'Linen'] },
  { key: 'maintenance', label: 'Repairs', icon: Wrench, tags: ['Plumbing', 'Electrical', 'Carpentry', 'Repairs', 'Hardware'] },
  { key: 'staff_payroll', label: 'Staff', icon: Users, tags: ['Staff advance', 'Salary', 'Staff welfare', 'Staff food'] },
  { key: 'transport_vendor', label: 'Transport', icon: Car, tags: ['Driver / taxi fare', 'Vehicle fuel', 'Courier'] },
  { key: 'marketing', label: 'Marketing', icon: Megaphone, tags: ['Ads', 'Printing', 'Photography'] },
  { key: 'miscellaneous', label: 'Other', icon: MoreHorizontal, tags: ['Puja / donation', 'Stationery', 'Other'] },
];

const METHODS: { key: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { key: 'cash', label: 'Cash', icon: Banknote },
  { key: 'upi', label: 'UPI', icon: Smartphone },
  { key: 'card', label: 'Card', icon: CreditCard },
  { key: 'bank_transfer', label: 'Bank', icon: Building },
];

const LAST_METHOD_KEY = 'savera_exp_last_method';
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export interface ExpenseLogFormProps {
  signerName: string;
  /** The signer's own recent expenses (for the one-tap "Recent" chips and vendor suggestions). */
  recent: Expense[];
  onSaved?: (queuedId: string) => void;
  compact?: boolean;
}

export default function ExpenseLogForm({ signerName, recent, onSaved, compact }: ExpenseLogFormProps) {
  const [category, setCategory] = useState<ExpenseMasterCategory>('groceries');
  const [tag, setTag] = useState('Vegetables');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [vendor, setVendor] = useState('');
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [signOff, setSignOff] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const m = localStorage.getItem(LAST_METHOD_KEY) as PaymentMethod | null;
      if (m && METHODS.some((x) => x.key === m)) setMethod(m);
    } catch {}
  }, []);

  const value = Number(amount.replace(/,/g, ''));
  const valid = Number.isFinite(value) && value > 0 && value <= 1_000_000;

  // One-tap repeats: the last distinct purchases this person logged
  const chips = useMemo(() => {
    const seen = new Set<string>();
    const out: { category: ExpenseMasterCategory; tag: string; vendor?: string; amount: number; method: PaymentMethod }[] = [];
    for (const e of [...recent].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))) {
      if (e.status === 'void') continue;
      const key = `${e.subTag}|${e.vendorPayee || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ category: e.masterCategory, tag: e.subTag, vendor: e.vendorPayee, amount: e.amount, method: e.paymentMethod });
      if (out.length >= 6) break;
    }
    return out;
  }, [recent]);

  const vendors = useMemo(
    () => Array.from(new Set(recent.map((e) => e.vendorPayee).filter((v): v is string => Boolean(v)))).slice(0, 20),
    [recent]
  );

  const cat = CATEGORIES.find((c) => c.key === category)!;

  const pickCategory = (key: ExpenseMasterCategory) => {
    setCategory(key);
    setTag(CATEGORIES.find((c) => c.key === key)!.tags[0]);
  };

  const applyChip = (c: (typeof chips)[number]) => {
    setCategory(c.category);
    setTag(c.tag);
    setVendor(c.vendor || '');
    setAmount(String(c.amount));
    setMethod(c.method);
    setSignOff(false);
    setTimeout(() => amountRef.current?.select(), 0);
  };

  const onPhoto = async (file?: File) => {
    if (!file) return;
    setReceiptBusy(true);
    setError('');
    try {
      setReceipt(await compressImageFile(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this photo.');
    } finally {
      setReceiptBusy(false);
    }
  };

  const save = async () => {
    setError('');
    if (!valid) {
      setError('Enter the amount you paid.');
      amountRef.current?.focus();
      return;
    }
    if (!signOff) {
      setError('Tick the confirmation to sign this expense.');
      return;
    }
    setSaving(true);
    try {
      const id = await enqueueExpense({
        amount: Math.round(value * 100) / 100,
        paymentMethod: method,
        masterCategory: category,
        subTag: tag,
        vendorPayee: vendor.trim() || undefined,
        description: note.trim() || tag,
        billReceiptUrl: receipt || undefined,
        signOffConfirmed: true,
      });
      try {
        localStorage.setItem(LAST_METHOD_KEY, method);
      } catch {}
      try {
        navigator.vibrate?.(30);
      } catch {}
      setAmount('');
      setVendor('');
      setNote('');
      setShowNote(false);
      setReceipt(null);
      setSignOff(false);
      onSaved?.(id);
    } catch {
      setError('Could not save on this device. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`space-y-5 ${compact ? '' : 'pb-4'}`}>
      {chips.length > 0 && (
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-forest-600 mb-2">Recent · tap to repeat</h3>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
            {chips.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applyChip(c)}
                className="shrink-0 min-h-[44px] px-3.5 py-2 rounded-2xl bg-white border border-sand-300 text-left active:scale-[0.97] transition-transform shadow-[0_1px_0_rgba(20,40,32,0.04)]"
              >
                <span className="block text-[13px] font-semibold text-forest-950 leading-tight">{c.tag}</span>
                <span className="block text-[11px] text-forest-600">{c.vendor ? `${c.vendor} · ` : ''}{inr(c.amount)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Amount */}
      <section className="bg-white rounded-3xl border border-sand-200 px-5 pt-4 pb-5 text-center shadow-[0_1px_2px_rgba(20,40,32,0.06)]">
        <label htmlFor="exp-amount" className="text-[11px] font-bold uppercase tracking-wider text-forest-600">
          Amount paid
        </label>
        <div className="mt-1 flex items-center justify-center gap-1">
          <span className={`text-4xl font-serif font-bold ${valid ? 'text-forest-950' : 'text-sand-400'}`}>₹</span>
          <input
            id="exp-amount"
            ref={amountRef}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
            className="w-full max-w-[220px] bg-transparent text-5xl font-serif font-bold text-forest-950 text-center outline-none placeholder:text-sand-300"
          />
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Paid by">
          {METHODS.map((m) => (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={method === m.key}
              onClick={() => setMethod(m.key)}
              className={`min-h-[48px] rounded-2xl border text-[12px] font-bold flex flex-col items-center justify-center gap-0.5 transition-colors ${
                method === m.key ? 'bg-forest-900 text-white border-forest-900' : 'bg-sand-50 text-forest-800 border-sand-200'
              }`}
            >
              <m.icon className="w-4 h-4" />
              {m.label}
            </button>
          ))}
        </div>
      </section>

      {/* What for */}
      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-forest-600 mb-2">What for</h3>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => pickCategory(c.key)}
              aria-pressed={category === c.key}
              className={`min-h-[64px] rounded-2xl border flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                category === c.key ? 'bg-[#C85A32] text-white border-[#C85A32]' : 'bg-white text-forest-800 border-sand-200'
              }`}
            >
              <c.icon className="w-5 h-5" />
              {c.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {cat.tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(t)}
              aria-pressed={tag === t}
              className={`min-h-[38px] px-3.5 rounded-full border text-[12px] font-semibold ${
                tag === t ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-forest-800 border-sand-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* Vendor, bill photo, note */}
      <section className="bg-white rounded-3xl border border-sand-200 divide-y divide-sand-100">
        <label className="flex items-center gap-3 px-4 min-h-[56px]">
          <Store className="w-5 h-5 text-forest-500 shrink-0" />
          <input
            list="exp-vendors"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Shop / paid to (optional)"
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-forest-400"
          />
          <datalist id="exp-vendors">
            {vendors.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </label>
        <div className="flex items-center gap-3 px-4 min-h-[56px]">
          <Camera className="w-5 h-5 text-forest-500 shrink-0" />
          {receipt ? (
            <div className="flex-1 flex items-center gap-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={receipt} alt="Bill photo" className="w-12 h-12 rounded-xl object-cover border border-sand-200" />
              <span className="text-[13px] text-forest-800 flex-1">Bill photo added</span>
              <button type="button" onClick={() => setReceipt(null)} className="p-2 rounded-full text-forest-500" aria-label="Remove bill photo">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex-1 text-left text-[15px] text-forest-500 min-h-[56px]">
              {receiptBusy ? 'Preparing photo…' : 'Add bill photo (optional)'}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void onPhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        {showNote ? (
          <label className="flex items-start gap-3 px-4 py-3">
            <PenLine className="w-5 h-5 text-forest-500 shrink-0 mt-0.5" />
            <textarea
              autoFocus
              rows={2}
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
              className="flex-1 bg-transparent text-[15px] outline-none resize-none placeholder:text-forest-400"
            />
          </label>
        ) : (
          <button type="button" onClick={() => setShowNote(true)} className="w-full flex items-center gap-3 px-4 min-h-[56px] text-[15px] text-forest-500">
            <PenLine className="w-5 h-5 shrink-0" /> Add a note (optional)
          </button>
        )}
      </section>

      {/* Sign-off */}
      <label
        className={`flex items-start gap-3 p-4 rounded-3xl border cursor-pointer transition-colors ${
          signOff ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-200'
        }`}
      >
        <span
          className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${
            signOff ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-amber-400'
          }`}
        >
          {signOff && <Check className="w-4 h-4 text-white" />}
        </span>
        <input type="checkbox" className="sr-only" checked={signOff} onChange={(e) => setSignOff(e.target.checked)} />
        <span className="text-[13px] leading-snug text-forest-900">
          I, <strong>{signerName}</strong>, confirm I paid{' '}
          <strong>{valid ? inr(Math.round(value * 100) / 100) : 'this amount'}</strong> by {METHODS.find((m) => m.key === method)?.label} for{' '}
          <strong>{tag}</strong>. Signed with my account and the server time.
        </span>
      </label>

      {error && (
        <p role="alert" className="text-[13px] font-semibold text-rose-700 px-1">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className={`w-full min-h-[58px] rounded-2xl text-[17px] font-bold active:scale-[0.99] transition-transform ${
          valid && signOff ? 'bg-[#C85A32] text-white shadow-[0_8px_20px_rgba(200,90,50,0.35)]' : 'bg-sand-200 text-forest-500 shadow-none'
        }`}
      >
        {saving ? 'Saving…' : valid ? `Save ${inr(Math.round(value * 100) / 100)}` : 'Save expense'}
      </button>
    </div>
  );
}
