'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, ListChecks, Wallet, LogOut, Cloud, CloudOff, RefreshCw, AlertTriangle, Check, Clock, Receipt, ShieldCheck, Send } from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import AdminAuth from '@/components/admin/AdminAuth';
import { ExpenseInstallCard, ExpenseInstallSheet } from '@/components/expenses/ExpenseAppInstall';
import ExpenseLogForm from '@/components/expenses/ExpenseLogForm';
import ManagerCashbook from '@/components/crm/ManagerCashbook';
import { OutboxItem, discardOutboxItem, flushOutbox, retryOutboxItem, subscribeOutbox } from '@/lib/expense-outbox';
import { EXPENSE_CATEGORY_LABELS } from '@/lib/expense-client';
import { todayInIST } from '@/lib/tariff-calculator';
import type { Expense } from '@/types/crm';

/**
 * Savera Expense Logger: an installable phone app for managers to log signed expenses in
 * seconds, offline or online, and see their own cash in hand. Admins use it to review.
 */

type Tab = 'log' | 'today' | 'cash';
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');

export default function ExpensesApp() {
  const { authStatus, currentUser, expenses, signOut } = useCRM();
  const isManager = currentUser?.role === 'manager';
  const [tab, setTab] = useState<Tab>('log');
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [online, setOnline] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const today = todayInIST();

  useEffect(() => subscribeOutbox(setOutbox), []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useEffect(() => {
    if (!isManager && currentUser) setTab('cash');
  }, [isManager, currentUser]);

  const mine = useMemo(() => expenses.filter((e) => e.loggedById === currentUser?.id), [expenses, currentUser]);
  const todays = useMemo(
    () => mine.filter((e) => e.expenseDate === today).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [mine, today]
  );
  const queued = outbox.filter((o) => o.status !== 'failed');
  const failed = outbox.filter((o) => o.status === 'failed');
  const todayTotal =
    todays.filter((e) => e.status !== 'void').reduce((s, e) => s + e.amount, 0) + queued.reduce((s, o) => s + o.payload.amount, 0);

  if (authStatus === 'checking') {
    return (
      <div className="min-h-[100dvh] bg-[#142820] flex flex-col items-center justify-center gap-3 text-[#A3B899]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/expenses-192.png" alt="" className="w-16 h-16 rounded-[20px] shadow-lg animate-pulse" />
        <span className="text-xs">Opening Expense Logger…</span>
      </div>
    );
  }
  if (authStatus !== 'signed_in' || !currentUser || currentUser.mustChangePassword) {
    return (
      <>
        <AdminAuth
          brand={{
            eyebrow: 'Savera · for managers',
            title: 'Expense Logger',
            subtitle: 'Sign in with your manager account. Every expense you log is signed with your name and the time.',
            iconSrc: '/icons/expenses-192.png',
          }}
        />
        {/* Install first, then sign in inside the app */}
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <ExpenseInstallCard />
          </div>
        </div>
      </>
    );
  }

  const sync =
    !online
      ? { icon: CloudOff, text: queued.length ? `Offline · ${queued.length} waiting` : 'Offline', tone: 'bg-amber-400/15 text-amber-200' }
      : failed.length
      ? { icon: AlertTriangle, text: `${failed.length} need attention`, tone: 'bg-rose-400/20 text-rose-200' }
      : queued.length
      ? { icon: RefreshCw, text: `Sending ${queued.length}…`, tone: 'bg-sky-400/15 text-sky-200' }
      : { icon: Cloud, text: 'All synced', tone: 'bg-emerald-400/15 text-emerald-200' };

  return (
    <div className="min-h-[100dvh] bg-sand-50 text-forest-950">
      <header className="bg-[#142820] text-white px-4 pt-[max(env(safe-area-inset-top),12px)] pb-4 sticky top-0 z-30">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/expenses-96.png" alt="" className="w-10 h-10 rounded-[13px] shrink-0 ring-1 ring-white/10" />
              <div className="min-w-0">
                <h1 className="font-serif font-bold text-[17px] leading-tight">Expenses</h1>
                <p className="text-[11px] text-[#A3B899] truncate">
                  {currentUser.fullName} · {currentUser.role === 'kitchen_staff' ? 'kitchen' : currentUser.role}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => void signOut()}
                className="w-10 h-10 rounded-xl text-rose-200 border border-white/10 flex items-center justify-center"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
          {isManager && (
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#A3B899] font-bold">Spent today</p>
                <p className="text-3xl font-serif font-bold">{inr(Math.round(todayTotal * 100) / 100)}</p>
              </div>
              <button
                onClick={() => void flushOutbox()}
                className={`min-h-[34px] px-3 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 ${sync.tone}`}
                aria-live="polite"
              >
                <sync.icon className={`w-3.5 h-3.5 ${sync.text.startsWith('Sending') ? 'animate-spin' : ''}`} />
                {sync.text}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 pb-32">
        {flash && (
          <div role="status" className="mb-4 flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600 text-white text-[14px] font-semibold shadow-lg">
            <Check className="w-5 h-5" /> {flash}
          </div>
        )}

        <ExpenseInstallCard className="mb-4" />

        {!isManager && (
          <div className="mb-4 rounded-3xl bg-[#142820] text-white p-4 flex items-start gap-3 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-[#C5A059]/20 blur-2xl pointer-events-none" />
            <ShieldCheck className="w-5 h-5 text-[#E8D3A2] shrink-0 mt-0.5" />
            <div className="relative flex-1">
              <p className="text-[14px] font-bold">Managers log, you review</p>
              <p className="text-[12.5px] text-[#B9C9B1] leading-snug mt-0.5">
                Expenses are logged and signed from managers&apos; phones. Here you see every entry and each manager&apos;s cash in hand.
              </p>
              <button
                onClick={() => setShareOpen(true)}
                className="mt-3 min-h-[40px] px-3.5 rounded-xl bg-[#C85A32] text-white text-[12.5px] font-bold inline-flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" /> Send the app to managers
              </button>
            </div>
          </div>
        )}
        <ExpenseInstallSheet open={shareOpen} onClose={() => setShareOpen(false)} mode="share" />

        {tab === 'log' && isManager && (
          <ExpenseLogForm
            signerName={currentUser.fullName}
            recent={mine}
            onSaved={() => {
              setFlash(online ? 'Saved and signed' : 'Saved on this phone · will send when online');
              setTimeout(() => setFlash(null), 2600);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {tab === 'today' && isManager && (
          <TodayList todays={todays} queued={queued} failed={failed} />
        )}

        {tab === 'cash' && <ManagerCashbook />}
      </main>

      {/* Bottom tab bar (thumb zone) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur border-t border-sand-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-lg mx-auto grid grid-cols-3">
          {(
            [
              ...(isManager ? ([['log', 'Log', Plus], ['today', 'Today', ListChecks]] as const) : []),
              ['cash', isManager ? 'My cash' : 'Review', Wallet],
            ] as readonly (readonly [Tab, string, typeof Plus])[]
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={tab === key ? 'page' : undefined}
              className={`relative min-h-[60px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${
                tab === key ? 'text-[#C85A32]' : 'text-forest-500'
              } ${!isManager ? 'col-span-3' : ''}`}
            >
              {key === 'log' ? (
                <span className={`w-11 h-8 rounded-full flex items-center justify-center ${tab === key ? 'bg-[#C85A32] text-white' : 'bg-sand-100'}`}>
                  <Icon className="w-5 h-5" />
                </span>
              ) : (
                <Icon className="w-5 h-5" />
              )}
              {label}
              {key === 'today' && outbox.length > 0 && (
                <span className="absolute translate-x-5 -translate-y-4 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] leading-[18px]">
                  {outbox.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function TodayList({ todays, queued, failed }: { todays: Expense[]; queued: OutboxItem[]; failed: OutboxItem[] }) {
  if (!todays.length && !queued.length && !failed.length) {
    return (
      <div className="text-center py-16 text-forest-600">
        <div className="w-14 h-14 mx-auto rounded-3xl bg-white border border-sand-200 flex items-center justify-center mb-3">
          <ListChecks className="w-6 h-6" />
        </div>
        <p className="text-[15px] font-semibold text-forest-900">Nothing logged today</p>
        <p className="text-[13px]">Tap Log to add your first expense.</p>
      </div>
    );
  }
  const row = (key: string, title: string, sub: string, amount: number, badge: JSX.Element, extra?: JSX.Element, muted?: boolean) => (
    <li key={key} className={`p-4 ${muted ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[15px] font-semibold truncate ${muted ? 'line-through' : ''}`}>{title}</p>
          <p className="text-[12px] text-forest-600 truncate">{sub}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[15px] font-bold">{inr(amount)}</p>
          {badge}
        </div>
      </div>
      {extra}
    </li>
  );
  return (
    <div className="space-y-4">
      {failed.length > 0 && (
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-rose-700 mb-2">Could not be saved</h2>
          <ul className="bg-white rounded-3xl border border-rose-200 divide-y divide-sand-100">
            {failed.map((o) =>
              row(
                o.id,
                o.payload.subTag,
                o.payload.vendorPayee || EXPENSE_CATEGORY_LABELS[o.payload.masterCategory],
                o.payload.amount,
                <span className="text-[11px] font-bold text-rose-700 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Not saved</span>,
                <div className="mt-2 text-[12px] text-rose-800 bg-rose-50 rounded-xl p-2.5">
                  {o.lastError}
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => void retryOutboxItem(o.id)} className="min-h-[36px] px-3 rounded-lg bg-forest-900 text-white font-bold">Try again</button>
                    <button onClick={() => void discardOutboxItem(o.id)} className="min-h-[36px] px-3 rounded-lg border border-rose-300 font-bold">Discard</button>
                  </div>
                </div>
              )
            )}
          </ul>
        </section>
      )}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-forest-600 mb-2">Today</h2>
        <ul className="bg-white rounded-3xl border border-sand-200 divide-y divide-sand-100">
          {queued.map((o) =>
            row(
              o.id,
              o.payload.subTag,
              `${o.payload.vendorPayee ? `${o.payload.vendorPayee} · ` : ''}${o.payload.paymentMethod.toUpperCase()} · ${time(o.createdAt)}`,
              o.payload.amount,
              <span className="text-[11px] font-bold text-amber-700 inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Waiting to send</span>
            )
          )}
          {todays.map((e) =>
            row(
              e.id,
              e.subTag,
              `${e.vendorPayee ? `${e.vendorPayee} · ` : ''}${e.paymentMethod.toUpperCase()} · signed ${time(e.signedOffAt || e.createdAt)}`,
              e.amount,
              e.status === 'void' ? (
                <span className="text-[11px] font-bold text-rose-700">Voided</span>
              ) : e.status === 'approved' ? (
                <span className="text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1"><Check className="w-3 h-3" /> Approved</span>
              ) : (
                <span className="text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1"><Check className="w-3 h-3" /> Saved{e.billReceiptUrl ? ' · bill' : ''}</span>
              ),
              e.status === 'void' && e.voidReason ? <p className="mt-1 text-[12px] text-rose-700">Reason: {e.voidReason}</p> : undefined,
              e.status === 'void'
            )
          )}
        </ul>
      </section>
    </div>
  );
}
