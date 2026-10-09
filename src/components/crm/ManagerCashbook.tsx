'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, ArrowDownLeft, ArrowUpRight, Download, RefreshCw, ChevronDown, ChevronUp, Receipt, ShieldCheck } from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { addCalendarDays, todayInIST } from '@/lib/tariff-calculator';
import type { PaymentMethod } from '@/types/crm';

/**
 * Manager cash book. Every collection and expense is signed by the manager who recorded it
 * (account + server time). Cash in hand = collected − paid out (all methods, all time,
 * voided entries excluded). Admins see every manager; a manager sees only themselves.
 */

interface Entry {
  kind: 'collection' | 'expense';
  id: string;
  folioId?: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  signedAt: string;
  label: string;
  detail?: string;
  status: 'live' | 'void';
  voidReason?: string;
  receiptUrl?: string;
}
interface Book {
  staffId: string;
  name: string;
  role: string;
  isActive: boolean;
  period: { collections: number; expenses: number; net: number; collectionsByMethod: Record<PaymentMethod, number>; expensesByMethod: Record<PaymentMethod, number>; count: number };
  allTime: { collections: number; expenses: number; cashInHand: number };
  lastEntryAt?: string;
  entries: Entry[];
}

const inr = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN')}`;
const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank', card: 'Card' };
const when = (iso: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

type Preset = 'today' | 'yesterday' | '7d' | 'month' | 'custom';

export default function ManagerCashbook() {
  const { currentUser, voidFolioPayment, voidExpense, showToast } = useCRM();
  const isAdmin = currentUser?.role === 'admin';
  const today = todayInIST();
  const [preset, setPreset] = useState<Preset>('today');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<{ managers: Book[]; totals: { collections: number; expenses: number; cashInHand: number } } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [open, setOpen] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<Entry | null>(null);
  const [reason, setReason] = useState('');

  const choose = (p: Preset) => {
    setPreset(p);
    if (p === 'today') { setFrom(today); setTo(today); }
    if (p === 'yesterday') { const y = addCalendarDays(today, -1); setFrom(y); setTo(y); }
    if (p === '7d') { setFrom(addCalendarDays(today, -6)); setTo(today); }
    if (p === 'month') { setFrom(`${today.slice(0, 8)}01`); setTo(today); }
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/cashbook?from=${from}&to=${to}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not load');
      setData({ managers: json.managers, totals: json.totals });
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? 'ready' : 'error'));
    }
  }, [from, to]);

  useEffect(() => {
    setStatus((s) => (s === 'ready' ? 'ready' : 'loading'));
    void load();
    const t = setInterval(() => document.visibilityState === 'visible' && void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!isAdmin && data?.managers[0]) setOpen(data.managers[0].staffId);
  }, [isAdmin, data]);

  const maxFlow = useMemo(
    () => Math.max(1, ...(data?.managers || []).map((m) => Math.max(m.period.collections, m.period.expenses))),
    [data]
  );

  const exportCsv = () => {
    if (!data) return;
    const rows = [['Manager', 'Type', 'Date', 'Signed at', 'Description', 'Method', 'Amount', 'Status', 'Void reason']];
    for (const m of data.managers)
      for (const e of m.entries)
        rows.push([m.name, e.kind, e.date, e.signedAt, `${e.label}${e.detail ? ` (${e.detail})` : ''}`, METHOD_LABEL[e.method], String(e.amount), e.status, e.voidReason || '']);
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `savera-cashbook-${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmVoid = async () => {
    if (!voiding) return;
    if (reason.trim().length < 3) {
      showToast('Please write a short reason (at least 3 characters).', 'error');
      return;
    }
    if (voiding.kind === 'expense') await voidExpense(voiding.id, reason.trim());
    else if (voiding.folioId) voidFolioPayment(voiding.folioId, voiding.id, reason.trim());
    setVoiding(null);
    setReason('');
    setTimeout(() => void load(), 1500);
  };

  const presets: [Preset, string][] = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', 'Last 7 days'], ['month', 'This month'], ['custom', 'Custom']];

  return (
    <div className="space-y-4">
      {/* Header + range */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-sand-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-forest-900 text-[#C5A059] flex items-center justify-center"><Wallet className="w-5 h-5" /></div>
            <div>
              <h3 className="font-serif font-bold text-lg text-forest-950">{isAdmin ? 'Manager cash book' : 'My cash book'}</h3>
              <p className="text-[11px] text-forest-600">Signed collections and expenses · cash in hand = collected − paid out (all methods)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void load()} className="min-h-[40px] px-3 rounded-xl border border-sand-300 text-xs font-bold text-forest-800 inline-flex items-center gap-1.5" aria-label="Refresh">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button onClick={exportCsv} disabled={!data} className="min-h-[40px] px-3 rounded-xl bg-forest-900 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {presets.map(([k, label]) => (
            <button
              key={k}
              onClick={() => choose(k)}
              className={`min-h-[36px] px-3 rounded-full text-xs font-bold border ${preset === k ? 'bg-forest-900 text-white border-forest-900' : 'bg-sand-50 text-forest-800 border-sand-200'}`}
            >
              {label}
            </button>
          ))}
          {preset === 'custom' && (
            <span className="flex items-center gap-1.5 text-xs">
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 rounded-lg border border-sand-300" />
              <span>to</span>
              <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 rounded-lg border border-sand-300" />
            </span>
          )}
        </div>
      </div>

      {status === 'loading' && <div className="bg-white rounded-3xl p-8 border border-sand-200 text-center text-xs text-forest-600">Loading the cash book…</div>}
      {status === 'error' && (
        <div className="bg-rose-50 rounded-3xl p-5 border border-rose-200 text-xs text-rose-900 flex items-center justify-between">
          Could not load the cash book. <button onClick={() => void load()} className="font-bold underline">Try again</button>
        </div>
      )}

      {data && status !== 'loading' && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Collected', value: data.totals.collections, tone: 'text-emerald-700', icon: ArrowDownLeft, note: 'in this period' },
              { label: 'Paid out (expenses)', value: data.totals.expenses, tone: 'text-rose-700', icon: ArrowUpRight, note: 'in this period' },
              { label: 'Net for period', value: data.totals.collections - data.totals.expenses, tone: 'text-forest-950', icon: ShieldCheck, note: 'collected − paid out' },
              { label: isAdmin ? 'Cash in hand (all managers)' : 'My cash in hand', value: data.totals.cashInHand, tone: 'text-[#8C6B1F]', icon: Wallet, note: 'all time' },
            ].map((t) => (
              <div key={t.label} className="bg-white rounded-2xl p-4 border border-sand-200">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-forest-600">
                  <t.icon className="w-3.5 h-3.5" /> {t.label}
                </div>
                <div className={`text-xl sm:text-2xl font-serif font-bold mt-1 ${t.tone}`}>{inr(t.value)}</div>
                <div className="text-[10px] text-forest-500">{t.note}</div>
              </div>
            ))}
          </div>

          {data.managers.length === 0 && (
            <div className="bg-white rounded-3xl p-8 border border-sand-200 text-center text-xs text-forest-600">
              No signed collections or expenses yet.
            </div>
          )}

          {/* Per manager */}
          <div className="space-y-3">
            {data.managers.map((m) => {
              const isOpen = open === m.staffId;
              return (
                <div key={m.staffId} className="bg-white rounded-3xl border border-sand-200 overflow-hidden">
                  <button onClick={() => setOpen(isOpen ? null : m.staffId)} className="w-full text-left p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-sand-100 text-forest-900 font-bold flex items-center justify-center shrink-0">
                        {m.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-forest-950 truncate">
                          {m.name} {m.role !== 'manager' && <span className="text-[10px] font-semibold text-forest-500">({m.role})</span>}
                        </div>
                        <div className="text-[11px] text-forest-600">
                          {m.period.count} entr{m.period.count === 1 ? 'y' : 'ies'} · last {when(m.lastEntryAt || '')}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="w-16 text-emerald-700 font-semibold">In</span>
                        <div className="flex-1 h-2 rounded-full bg-sand-100"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(m.period.collections / maxFlow) * 100}%` }} /></div>
                        <span className="w-24 text-right font-mono">{inr(m.period.collections)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="w-16 text-rose-700 font-semibold">Out</span>
                        <div className="flex-1 h-2 rounded-full bg-sand-100"><div className="h-2 rounded-full bg-rose-400" style={{ width: `${(m.period.expenses / maxFlow) * 100}%` }} /></div>
                        <span className="w-24 text-right font-mono">{inr(m.period.expenses)}</span>
                      </div>
                    </div>
                    <div className="sm:w-44 sm:text-right flex sm:block items-center justify-between">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-forest-600">Cash in hand</div>
                      <div className={`text-xl font-serif font-bold ${m.allTime.cashInHand < 0 ? 'text-rose-700' : 'text-[#8C6B1F]'}`}>{inr(m.allTime.cashInHand)}</div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-forest-500 sm:ml-auto" /> : <ChevronDown className="w-4 h-4 text-forest-500 sm:ml-auto" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-sand-200 p-4 sm:p-5 space-y-3 bg-sand-50/40">
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((k) =>
                          m.period.collectionsByMethod[k] || m.period.expensesByMethod[k] ? (
                            <span key={k} className="px-2.5 py-1 rounded-full bg-white border border-sand-200">
                              {METHOD_LABEL[k]}: <span className="text-emerald-700">+{inr(m.period.collectionsByMethod[k] || 0)}</span>{' '}
                              <span className="text-rose-700">−{inr(m.period.expensesByMethod[k] || 0)}</span>
                            </span>
                          ) : null
                        )}
                      </div>
                      {m.entries.length === 0 ? (
                        <p className="text-xs text-forest-600">Nothing recorded in this period.</p>
                      ) : (
                        <ul className="divide-y divide-sand-200 bg-white rounded-2xl border border-sand-200">
                          {m.entries.map((e) => (
                            <li key={`${e.kind}-${e.id}`} className={`p-3 text-xs ${e.status === 'void' ? 'opacity-60' : ''}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className={`font-semibold text-forest-950 truncate ${e.status === 'void' ? 'line-through' : ''}`}>
                                    {e.kind === 'collection' ? 'Collected' : 'Paid'} · {e.label}
                                  </div>
                                  <div className="text-[10px] text-forest-600">
                                    {METHOD_LABEL[e.method]} · signed {when(e.signedAt)}
                                    {e.detail ? ` · ${e.detail}` : ''}
                                  </div>
                                  {e.status === 'void' && <div className="text-[10px] text-rose-700 font-bold">Void: {e.voidReason}</div>}
                                  {e.receiptUrl && (
                                    <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-forest-700 underline inline-flex items-center gap-1">
                                      <Receipt className="w-3 h-3" /> Bill photo
                                    </a>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  <div className={`font-mono font-bold ${e.kind === 'collection' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {e.kind === 'collection' ? '+' : '−'}
                                    {inr(e.amount)}
                                  </div>
                                  {isAdmin && e.status === 'live' && (
                                    <button onClick={() => { setVoiding(e); setReason(''); }} className="mt-1 text-[10px] font-bold text-rose-700 underline">
                                      Void
                                    </button>
                                  )}
                                </div>
                              </div>
                              {voiding?.id === e.id && (
                                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                                  <input autoFocus value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Reason for voiding (required)" className="flex-1 px-3 py-2 rounded-lg border border-rose-300" />
                                  <button onClick={() => void confirmVoid()} className="px-3 py-2 rounded-lg bg-rose-600 text-white font-bold">Void</button>
                                  <button onClick={() => setVoiding(null)} className="px-3 py-2 rounded-lg border border-sand-300 font-bold">Cancel</button>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
