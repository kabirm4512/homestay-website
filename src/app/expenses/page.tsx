'use client';

import { useMemo, useState } from 'react';
import { Plus, Receipt, LogOut, IndianRupee } from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import AdminAuth from '@/components/admin/AdminAuth';
import QuickExpenseModal from '@/components/crm/QuickExpenseModal';
import PWAInstaller from '@/components/pwa/PWAInstaller';
import { todayInIST } from '@/lib/tariff-calculator';

/**
 * Savera Expense Logger: a small installable app for staff to record property expenses
 * from their phone. Same sign-in and the same expense records as the admin portal.
 */
export default function ExpensesApp() {
  const { authStatus, currentUser, expenses, signOut } = useCRM();
  const [open, setOpen] = useState(false);
  const today = todayInIST();

  const todays = useMemo(
    () => expenses.filter((e) => e.expenseDate === today).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [expenses, today]
  );
  const total = todays.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen bg-sand-50 flex items-center justify-center text-xs text-forest-800">Loading…</div>
    );
  }
  if (authStatus !== 'signed_in' || !currentUser || currentUser.mustChangePassword) {
    return <AdminAuth />;
  }

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="bg-[#142820] text-white px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#1E3A2F] border border-[#C5A059]/40 text-[#C5A059] flex items-center justify-center shrink-0">
              <Receipt className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-serif font-bold text-base leading-tight">Expense Logger</h1>
              <p className="text-[11px] text-[#A3B899] truncate">{currentUser.fullName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstaller variant="button" app="expenses" appName="Savera Expense Logger" label="Install" />
            <button
              onClick={() => void signOut()}
              className="min-h-[38px] px-2.5 rounded-xl text-rose-300 border border-rose-800/60 hover:bg-rose-950/50"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4 pb-28">
        <div className="bg-white rounded-2xl border border-sand-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-forest-700">Today</p>
            <p className="text-2xl font-bold text-forest-950 flex items-center">
              <IndianRupee className="w-5 h-5" />
              {total.toLocaleString('en-IN')}
            </p>
          </div>
          <p className="text-xs text-gray-500">
            {todays.length} {todays.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-sand-200 divide-y divide-sand-100">
          {todays.length === 0 ? (
            <p className="p-5 text-sm text-gray-500 text-center">No expenses logged today yet.</p>
          ) : (
            todays.map((e) => (
              <div key={e.id} className="p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-forest-950 truncate">{e.subTag || e.description}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {e.paymentMethod?.toUpperCase()} · {e.loggedByName}
                  </p>
                </div>
                <p className="text-sm font-bold text-forest-950 shrink-0">₹{Number(e.amount).toLocaleString('en-IN')}</p>
              </div>
            ))
          )}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 p-4 pb-[max(env(safe-area-inset-bottom),16px)] bg-gradient-to-t from-sand-50 via-sand-50/95 to-transparent">
        <button
          onClick={() => setOpen(true)}
          className="max-w-lg mx-auto w-full min-h-[56px] rounded-2xl bg-[#C85A32] hover:bg-[#B34D28] active:scale-[0.98] text-white text-base font-bold shadow-lg flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Log an expense
        </button>
      </div>

      {open && <QuickExpenseModal isOpen={open} onClose={() => setOpen(false)} defaultManagerName={currentUser.fullName} />}
    </div>
  );
}
