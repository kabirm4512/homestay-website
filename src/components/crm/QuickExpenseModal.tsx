'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  IndianRupee,
  Receipt,
  User,
  Clock,
  CheckCircle2,
  CreditCard,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { ExpenseMasterCategory, PaymentMethod } from '@/types/crm';

interface QuickExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultManagerName?: string;
}

interface ExpenseTagOption {
  label: string;
  category: ExpenseMasterCategory;
  color: string;
}

const SUGGESTED_TAGS: ExpenseTagOption[] = [
  { label: 'Groceries & Provisions', category: 'groceries', color: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
  { label: 'Milk & Dairy', category: 'groceries', color: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
  { label: 'Fresh Vegetables & Fruits', category: 'groceries', color: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
  { label: 'LPG Gas Cylinder', category: 'utilities', color: 'bg-orange-50 text-orange-900 border-orange-300' },
  { label: 'Diesel / Fuel', category: 'utilities', color: 'bg-orange-50 text-orange-900 border-orange-300' },
  { label: 'Housekeeping & Toiletries', category: 'housekeeping', color: 'bg-blue-50 text-blue-900 border-blue-300' },
  { label: 'Laundry Services', category: 'housekeeping', color: 'bg-blue-50 text-blue-900 border-blue-300' },
  { label: 'Property Maintenance', category: 'maintenance', color: 'bg-amber-50 text-amber-900 border-amber-300' },
  { label: 'Staff Welfare', category: 'staff_payroll', color: 'bg-purple-50 text-purple-900 border-purple-300' },
  { label: 'Miscellaneous', category: 'miscellaneous', color: 'bg-stone-50 text-stone-900 border-stone-300' },
];

export default function QuickExpenseModal({
  isOpen,
  onClose,
  defaultManagerName,
}: QuickExpenseModalProps) {
  const { addExpense, currentUser, showToast } = useCRM();

  const [selectedTag, setSelectedTag] = useState<ExpenseTagOption>(SUGGESTED_TAGS[0]);
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [managerName, setManagerName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [timestamp, setTimestamp] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setSelectedTag(SUGGESTED_TAGS[0]);
      setPaymentMethod('upi');
      const dutyManager = currentUser?.fullName || defaultManagerName || 'Duty Manager';
      setManagerName(dutyManager);

      const now = new Date();
      setTimestamp(
        now.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    }
  }, [isOpen, currentUser, defaultManagerName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || Number(amount) <= 0) {
      showToast('Please enter a valid expense amount in ₹', 'error');
      return;
    }

    if (!managerName.trim()) {
      showToast('Manager / Staff name is required', 'error');
      return;
    }

    setIsSubmitting(true);
    const expenseData = {
      expenseDate: new Date().toISOString().split('T')[0],
      amount: Number(amount),
      paymentMethod,
      masterCategory: selectedTag.category,
      subTag: selectedTag.label,
      description: `${selectedTag.label} expense`,
      loggedByName: managerName.trim(),
    };

    try {
      // 1. Add to local CRM state
      addExpense(expenseData);

      // 2. Persist to API store asynchronously
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExpense: true, expense: expenseData }),
      }).catch(() => null);

      showToast(`Expense of ₹${Number(amount).toLocaleString('en-IN')} recorded under ${selectedTag.label}!`);
      onClose();
    } catch {
      showToast('Failed to record expense', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-forest-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-sand-300 w-full max-w-lg overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-forest-900 via-forest-950 to-forest-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-forest-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-300 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base sm:text-lg text-white">
                Quick Property Expense Logger
              </h3>
              <p className="text-[11px] text-sand-300">
                1-tap category selection with auto-timestamp &amp; manager attribution
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center cursor-pointer transition-all border border-white/20 shrink-0 shadow-xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-forest-950 overflow-y-auto flex-1">
          {/* 1. Fast 1-Tap Category Pills */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-forest-800 block mb-2">
              1. Tap to Select Category Tag *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTED_TAGS.map((tag) => {
                const isSelected = selectedTag.label === tag.label;
                return (
                  <button
                    key={tag.label}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-forest-900 text-white border-forest-900 shadow-sm ring-2 ring-amber-400'
                        : 'bg-sand-50/80 hover:bg-white text-forest-900 border-sand-300'
                    }`}
                  >
                    <span className="truncate">{tag.label}</span>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Amount Input & Payment Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-amber-50/60 p-4 rounded-2xl border border-amber-200">
            <div>
              <label className="text-xs font-bold text-amber-950 block mb-1">
                Amount Paid (₹) *
              </label>
              <div className="relative">
                <IndianRupee className="w-4 h-4 text-amber-700 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                  placeholder="e.g. 850"
                  className="w-full pl-9 pr-3 py-2 text-base font-bold font-mono rounded-xl border border-amber-300 bg-white text-forest-950 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-amber-950 block mb-1 flex items-center space-x-1">
                <CreditCard className="w-3.5 h-3.5 text-amber-700" />
                <span>Payment Mode</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full text-xs p-2.5 rounded-xl border border-amber-300 bg-white font-medium text-forest-900"
              >
                <option value="upi">UPI / GPay / PhonePe</option>
                <option value="cash">Petty Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Debit / Credit Card</option>
              </select>
            </div>
          </div>

          {/* 3. Auto-Timestamp & Manager Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-forest-800 block mb-1 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-forest-600" />
                <span>Auto-Timestamp</span>
              </label>
              <input
                type="text"
                disabled
                value={timestamp}
                className="w-full text-xs p-2.5 rounded-xl border border-sand-200 bg-sand-100/70 font-mono text-forest-700 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-forest-800 block mb-1 flex items-center space-x-1">
                <User className="w-3.5 h-3.5 text-forest-600" />
                <span>Manager / Paid By *</span>
              </label>
              <input
                type="text"
                required
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="Manager Name"
                className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white font-medium text-forest-900"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-sand-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-forest-600 hover:bg-sand-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Logging...' : 'Save & Log Expense'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
