'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Info, TrendingUp, TrendingDown } from 'lucide-react';
import { addCalendarDays, todayInIST } from '@/lib/tariff-calculator';
import type { MoneySummary, Stream } from '@/lib/reports-core';
import { STREAM_LABELS } from '@/lib/reports-core';
import { EXPENSE_CATEGORY_LABELS } from '@/lib/expense-client';
import type { ExpenseMasterCategory, PaymentMethod } from '@/types/crm';

/**
 * Collections & expenses dashboard. Every figure comes from the server's one summary
 * (GET /api/reports/summary), the same numbers day close uses. Each tile says which
 * definition it shows.
 */

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const METHOD: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank', card: 'Card' };
type Preset = 'today' | 'mtd' | 'last_month' | 'custom';

function rangeFor(p: Preset, today: string): [string, string] {
  if (p === 'today') return [today, today];
  if (p === 'mtd') return [`${today.slice(0, 8)}01`, today];
  const firstThis = `${today.slice(0, 8)}01`;
  const lastPrev = addCalendarDays(firstThis, -1);
  return [`${lastPrev.slice(0, 8)}01`, lastPrev];
}

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (rows.every((r) => !r.value)) return <p className="text-xs text-forest-500 py-3">Nothing in this period.</p>;
  return (
    <ul className="space-y-2">
      {rows.filter((r) => r.value).map((r) => (
        <li key={r.label} className="text-xs">
          <div className="flex justify-between mb-0.5">
            <span className="text-forest-800">{r.label}</span>
            <span className="font-mono text-forest-950">
              {inr(r.value)} <span className="text-forest-500">{total ? `${Math.round((r.value / total) * 100)}%` : ''}</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-sand-100">
            <div className="h-2 rounded-full bg-[#142820]" style={{ width: `${(Math.abs(r.value) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function MoneyDashboard() {
  const today = todayInIST();
  const [preset, setPreset] = useState<Preset>('mtd');
  const [[from, to], setRange] = useState<[string, string]>(() => rangeFor('mtd', today));
  const [data, setData] = useState<{ current: MoneySummary; previous?: MoneySummary } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/reports/summary?from=${from}&to=${to}&compare=1`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error();
      setData({ current: json.current, previous: json.previous });
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? 'ready' : 'error'));
    }
  }, [from, to]);

  useEffect(() => {
    void load();
    const t = setInterval(() => document.visibilityState === 'visible' && void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const choose = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') setRange(rangeFor(p, today));
  };

  const c = data?.current;
  const prev = data?.previous;
  const delta = (now: number, before?: number) => {
    if (before === undefined || before === 0) return null;
    const pct = Math.round(((now - before) / Math.abs(before)) * 100);
    return pct;
  };

  const tiles: { label: string; value: string; info: string; now?: number; before?: number }[] = c
    ? [
        { label: 'Collections', value: inr(c.collections.net), info: 'Money received (cash basis) by the day it was recorded, net of refunds. Includes advances.', now: c.collections.net, before: prev?.collections.net },
        { label: 'Revenue', value: inr(c.revenue.total), info: 'Billed services by the night/day they were given, net of discount, excluding GST. Pending orders are not counted.', now: c.revenue.total, before: prev?.revenue.total },
        { label: 'GST collected', value: inr(c.gst), info: 'GST on the billed lines in this period (₹0 while GST is switched off). Owed to the government.' },
        { label: 'Expenses', value: inr(c.expenses.total), info: 'Signed expenses dated in this period, voids excluded.', now: c.expenses.total, before: prev?.expenses.total },
        { label: 'Net operating profit', value: inr(c.profit), info: 'Revenue − expenses.', now: c.profit, before: prev?.profit },
        { label: 'Occupancy', value: `${c.occupancy}%`, info: `Room-nights booked (${c.roomNightsSold}) ÷ rooms in service (${c.roomNightsAvailable}); blocked rooms excluded.` },
        { label: 'ADR', value: inr(c.adr), info: 'Room revenue ÷ room-nights booked.' },
        { label: 'RevPAR', value: inr(c.revpar), info: 'Room revenue ÷ room-nights available.' },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-sand-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {([['today', 'Today'], ['mtd', 'This month'], ['last_month', 'Last month'], ['custom', 'Custom']] as [Preset, string][]).map(([k, l]) => (
            <button key={k} onClick={() => choose(k)} className={`min-h-[36px] px-3 rounded-full text-xs font-bold border ${preset === k ? 'bg-forest-900 text-white border-forest-900' : 'bg-sand-50 text-forest-800 border-sand-200'}`}>
              {l}
            </button>
          ))}
          {preset === 'custom' && (
            <span className="flex items-center gap-1.5 text-xs">
              <input type="date" value={from} max={to} onChange={(e) => setRange([e.target.value, to])} className="px-2 py-1.5 rounded-lg border border-sand-300" />
              <span>to</span>
              <input type="date" value={to} min={from} onChange={(e) => setRange([from, e.target.value])} className="px-2 py-1.5 rounded-lg border border-sand-300" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-forest-600">
          <span>{from} → {to} · vs previous period</span>
          <button onClick={() => void load()} className="p-2 rounded-lg border border-sand-300" aria-label="Refresh"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {status === 'loading' && <div className="bg-white rounded-3xl p-8 border border-sand-200 text-center text-xs text-forest-600">Loading the numbers…</div>}
      {status === 'error' && <div className="bg-rose-50 rounded-3xl p-5 border border-rose-200 text-xs text-rose-900">Could not load the dashboard. <button onClick={() => void load()} className="underline font-bold">Try again</button></div>}

      {c && status !== 'loading' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiles.map((t) => {
              const d = t.now !== undefined ? delta(t.now, t.before) : null;
              return (
                <div key={t.label} className="bg-white rounded-2xl p-4 border border-sand-200" title={t.info}>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-forest-600">
                    <span>{t.label}</span>
                    <Info className="w-3.5 h-3.5 text-forest-400" aria-label={t.info} />
                  </div>
                  <div className="text-xl sm:text-2xl font-serif font-bold text-forest-950 mt-1">{t.value}</div>
                  {d !== null && (
                    <div className={`text-[11px] font-semibold inline-flex items-center gap-1 ${d >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {d >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {d >= 0 ? '+' : ''}{d}% vs previous
                    </div>
                  )}
                  <p className="text-[10px] text-forest-500 mt-1 leading-snug sm:hidden">{t.info}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-2xl border border-sand-200 p-4 text-xs flex flex-wrap gap-x-6 gap-y-2">
            <span>Owed to us (stays started): <strong className="text-rose-700">{inr(c.receivables)}</strong></span>
            <span>Advances held (future stays): <strong>{inr(c.advancesHeld)}</strong></span>
            {c.creditOwed > 0 && <span>Credit owed to guests: <strong className="text-sky-800">{inr(c.creditOwed)}</strong></span>}
            {c.collections.refunds > 0 && <span>Refunds paid: <strong>{inr(c.collections.refunds)}</strong></span>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <section className="bg-white rounded-2xl border border-sand-200 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-forest-700 mb-3">Revenue by stream</h4>
              <Bars rows={(Object.keys(c.revenue.byStream) as Stream[]).map((k) => ({ label: STREAM_LABELS[k], value: c.revenue.byStream[k] }))} />
            </section>
            <section className="bg-white rounded-2xl border border-sand-200 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-forest-700 mb-3">Collections by method</h4>
              <Bars rows={(Object.keys(c.collections.byMethod) as PaymentMethod[]).map((k) => ({ label: METHOD[k], value: c.collections.byMethod[k] }))} />
            </section>
            <section className="bg-white rounded-2xl border border-sand-200 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-forest-700 mb-3">Expenses by category</h4>
              <Bars rows={(Object.keys(c.expenses.byCategory) as ExpenseMasterCategory[]).map((k) => ({ label: EXPENSE_CATEGORY_LABELS[k] || k, value: c.expenses.byCategory[k] || 0 }))} />
            </section>
          </div>

          {c.daily.length > 1 && (
            <section className="bg-white rounded-2xl border border-sand-200 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-forest-700 mb-3">Day by day</h4>
              <div className="overflow-x-auto">
                <div className="flex items-end gap-1 h-32 min-w-[480px]">
                  {(() => {
                    const max = Math.max(1, ...c.daily.map((d) => Math.max(d.revenue, d.collections, d.expenses)));
                    return c.daily.map((d) => (
                      <div key={d.date} className="flex-1 flex items-end gap-px h-full" title={`${d.date}: revenue ${inr(d.revenue)}, collected ${inr(d.collections)}, spent ${inr(d.expenses)}`}>
                        <div className="flex-1 bg-[#142820] rounded-t" style={{ height: `${(d.revenue / max) * 100}%` }} />
                        <div className="flex-1 bg-emerald-500 rounded-t" style={{ height: `${(Math.max(0, d.collections) / max) * 100}%` }} />
                        <div className="flex-1 bg-rose-400 rounded-t" style={{ height: `${(d.expenses / max) * 100}%` }} />
                      </div>
                    ));
                  })()}
                </div>
              </div>
              <div className="mt-2 flex gap-4 text-[10px] text-forest-600">
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#142820] rounded-sm" /> Revenue</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" /> Collected</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-400 rounded-sm" /> Expenses</span>
              </div>
            </section>
          )}

          <section className="bg-white rounded-2xl border border-sand-200 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-forest-700 mb-3">Top outstanding bills</h4>
            {c.topOutstanding.length === 0 ? (
              <p className="text-xs text-forest-500">Nobody owes anything. ✓</p>
            ) : (
              <ul className="divide-y divide-sand-100 text-xs">
                {c.topOutstanding.map((o) => (
                  <li key={o.folioId} className="py-2 flex justify-between gap-3">
                    <span>{o.guestName} · Room {o.roomNumber} · {o.status.replace('_', ' ')} (from {o.stayStarted})</span>
                    <span className="font-mono font-bold text-rose-700">{inr(o.balance)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
