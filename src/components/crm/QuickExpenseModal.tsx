'use client';

import { X, Receipt, ShieldCheck } from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import ExpenseLogForm from '@/components/expenses/ExpenseLogForm';

interface QuickExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Kept for compatibility; the signer is always the signed-in manager. */
  defaultManagerName?: string;
}

/** Desk version of the Expense Logger: managers log signed expenses (saved offline-first). */
export default function QuickExpenseModal({ isOpen, onClose }: QuickExpenseModalProps) {
  const { currentUser, expenses, showToast } = useCRM();
  if (!isOpen) return null;
  const isManager = currentUser?.role === 'manager';

  return (
    <div className="fixed inset-0 z-50 bg-forest-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        className="bg-sand-50 w-full sm:max-w-lg max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-expense-title"
      >
        <div className="sticky top-0 z-10 bg-[#142820] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-[#C5A059]" />
            <div>
              <h3 id="quick-expense-title" className="font-serif font-bold text-base">Log an expense</h3>
              <p className="text-[11px] text-[#A3B899]">Signed by {currentUser?.fullName || '—'} · server-timestamped</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-5">
          {isManager ? (
            <ExpenseLogForm
              compact
              signerName={currentUser!.fullName}
              recent={expenses.filter((e) => e.loggedById === currentUser!.id)}
              onSaved={() => {
                showToast('Expense saved and signed. It syncs automatically, even offline.');
                onClose();
              }}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-sand-200 p-5 text-sm text-forest-800 flex gap-3">
              <ShieldCheck className="w-5 h-5 text-forest-700 shrink-0" />
              <p>Expenses are logged and signed only by manager accounts. As an admin you can review, approve or void them in Ledger → Expenses or the Manager cash book.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
