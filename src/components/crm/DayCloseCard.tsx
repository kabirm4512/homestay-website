'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lock, RefreshCw } from 'lucide-react';
import { todayInIST } from '@/lib/tariff-calculator';
import { adminPostJson } from '@/lib/admin-api';

interface Summary {
  date: string;
  payments: { byMethod: Record<string, number>; total: number; count: number };
  charges: { byCategory: Record<string, number>; total: number; tax: number };
  expenses: { byMethod: Record<string, number>; total: number; count: number };
  netCash: number;
  openFolios: number;
  balanceDueOpen: number;
}
interface Closed extends Summary {
  closedAt: string;
  closedByName: string;
  notes?: string;
}

const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

/** End-of-day close: review the day's money, then lock it as an immutable snapshot. */
export default function DayCloseCard({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [date, setDate] = useState(() => todayInIST());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [closed, setClosed] = useState<Closed | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/day-close?date=${date}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setSummary(json.summary);
        setClosed(json.closed);
      }
    } catch {}
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const close = async () => {
    setBusy(true);
    const res = await adminPostJson<{ closed: Closed }>('/api/admin/day-close', { date, notes: notes.trim() || undefined });
    setBusy(false);
    if (!res.ok) {
      showToast(res.error || 'Could not close the day.', 'error');
      return;
    }
    setClosed(res.data?.closed || null);
    setNotes('');
    showToast(`${date} closed. Expenses for this day are now locked.`);
  };

  const view = closed || summary;
  const methods = (m: Record<string, number>) =>
    Object.entries(m)
      .map(([k, v]) => `${k.replace(/_/g, ' ')} ${inr(v)}`)
      .join(' · ') || '—';

  return (
    <div className="bg-white rounded-3xl p-5 border border-sand-200 shadow-xs space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-forest-700" />
          <h3 className="font-serif font-bold text-base text-forest-950">Day close</h3>
          {closed && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              Closed by {closed.closedByName} · {new Date(closed.closedAt).toLocaleString('en-IN')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            max={todayInIST()}
            onChange={(e) => setDate(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-sand-300"
          />
          <button onClick={() => void load()} className="p-2 rounded-xl border border-sand-300" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {view && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl bg-sand-50 border border-sand-200">
            <span className="text-forest-600 block">Collected ({view.payments.count})</span>
            <strong className="font-mono text-sm">{inr(view.payments.total)}</strong>
            <span className="block text-[10px] text-forest-600 mt-1 capitalize">{methods(view.payments.byMethod)}</span>
          </div>
          <div className="p-3 rounded-2xl bg-sand-50 border border-sand-200">
            <span className="text-forest-600 block">Charges posted</span>
            <strong className="font-mono text-sm">{inr(view.charges.total)}</strong>
            <span className="block text-[10px] text-forest-600 mt-1">GST {inr(view.charges.tax)}</span>
          </div>
          <div className="p-3 rounded-2xl bg-sand-50 border border-sand-200">
            <span className="text-forest-600 block">Expenses ({view.expenses.count})</span>
            <strong className="font-mono text-sm">{inr(view.expenses.total)}</strong>
            <span className="block text-[10px] text-forest-600 mt-1 capitalize">{methods(view.expenses.byMethod)}</span>
          </div>
          <div className="p-3 rounded-2xl bg-sand-50 border border-sand-200">
            <span className="text-forest-600 block">Net cash in drawer</span>
            <strong className="font-mono text-sm">{inr(view.netCash)}</strong>
            <span className="block text-[10px] text-forest-600 mt-1">
              {view.openFolios} open folios · {inr(view.balanceDueOpen)} due
            </span>
          </div>
        </div>
      )}
      {!closed && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (e.g. cash counted ₹12,400, handed to owner)"
            className="flex-1 min-w-[220px] px-3 py-2 rounded-xl border border-sand-300"
          />
          <button
            onClick={close}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-forest-900 text-white font-bold disabled:opacity-60"
          >
            {busy ? 'Closing…' : `Close ${date}`}
          </button>
        </div>
      )}
      {closed?.notes && <p className="text-forest-700">Notes: {closed.notes}</p>}
    </div>
  );
}
