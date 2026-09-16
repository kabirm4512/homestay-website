'use client';

import React, { useState, useMemo } from 'react';
import {
  Receipt,
  DollarSign,
  TrendingUp,
  CreditCard,
  PieChart,
  Plus,
  Trash2,
  Lock,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  FileText,
  Eye,
  X,
  Building,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import {
  ExpenseMasterCategory,
  PaymentMethod,
  GuestFolio,
  Expense,
} from '@/types/crm';

export default function FinancialLedger() {
  const {
    role,
    setRole,
    folios,
    expenses,
    addExpense,
    deleteExpense,
    addFolioPayment,
    settleFolio,
    showToast,
  } = useCRM();

  const [activeTab, setActiveTab] = useState<'analytics' | 'folios' | 'expenses'>('analytics');

  // Expense Form State
  const [expenseDate, setExpenseDate] = useState('2026-09-16');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseMethod, setExpenseMethod] = useState<PaymentMethod>('upi');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseMasterCategory>('groceries');
  const [expenseSubTag, setExpenseSubTag] = useState('');
  const [expenseVendor, setExpenseVendor] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  // Folio Detail Modal State
  const [selectedFolio, setSelectedFolio] = useState<GuestFolio | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // 1. RBAC Guard: If role is not admin, strictly block access!
  if (role !== 'admin') {
    return (
      <div className="bg-white rounded-3xl p-8 sm:p-12 border border-rose-200 shadow-sm text-center max-w-2xl mx-auto my-8 space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="font-serif font-bold text-2xl text-forest-950">
          Financial Ledger Restricted
        </h2>
        <div className="p-4 bg-rose-50/70 rounded-2xl border border-rose-100 text-xs text-rose-900 space-y-2">
          <p className="font-semibold flex items-center justify-center space-x-1">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Strict Role-Based Access Control (RBAC) Enforced</span>
          </p>
          <p>
            Your current active role is <strong>{role.toUpperCase().replace('_', ' ')}</strong>. Access to financial accounting, expense ledgers, staff payroll, and profitability analytics is strictly reserved for the <strong>Admin / Estate Owner</strong>.
          </p>
        </div>
        <div>
          <button
            onClick={() => setRole('admin')}
            className="min-h-[44px] px-6 py-2.5 bg-forest-900 hover:bg-forest-800 text-white font-bold text-xs rounded-xl shadow transition-all"
          >
            Switch to Admin Role to View Financials
          </button>
        </div>
      </div>
    );
  }

  // 2. Financial Analytics Aggregations
  // Net Revenue = Sum of all posted charges across all folios
  const totalRoomRevenue = folios.reduce((sum, f) => sum + f.totalRoomCharges, 0);
  const totalFbRevenue = folios.reduce((sum, f) => sum + f.totalFbCharges, 0);
  const totalAddonRevenue = folios.reduce((sum, f) => sum + f.totalAddonCharges, 0);
  const totalGrossRevenue = totalRoomRevenue + totalFbRevenue + totalAddonRevenue;

  // Payments Reconciliation: Cash vs Online
  const allPayments = folios.flatMap((f) => f.payments);
  const cashPayments = allPayments.filter((p) => p.paymentMethod === 'cash').reduce((sum, p) => sum + p.amount, 0);
  const onlinePayments = allPayments
    .filter((p) => ['upi', 'bank_transfer', 'card'].includes(p.paymentMethod))
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPaymentsCollected = cashPayments + onlinePayments;

  // Total Expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Net Profit
  const netProfit = totalPaymentsCollected - totalExpenses;
  const profitMargin = totalPaymentsCollected > 0 ? Math.round((netProfit / totalPaymentsCollected) * 100) : 0;

  // Handle Log Expense Submission
  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expenseAmount);
    if (!amountNum || amountNum <= 0) {
      showToast('Please enter a valid expense amount', 'error');
      return;
    }

    addExpense({
      expenseDate,
      amount: amountNum,
      paymentMethod: expenseMethod,
      masterCategory: expenseCategory,
      subTag: expenseSubTag || 'General',
      vendorPayee: expenseVendor || 'Estate Vendor',
      description: expenseDesc,
      billReceiptUrl: receiptUrl || undefined,
      loggedByName: 'Admin - Tenzing',
    });

    // Reset
    setExpenseAmount('');
    setExpenseSubTag('');
    setExpenseVendor('');
    setExpenseDesc('');
    setReceiptUrl('');
    setIsAddingExpense(false);
  };

  // Handle Record Payment to Folio
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolio) return;
    const amountNum = parseFloat(paymentAmount);
    if (!amountNum || amountNum <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }

    addFolioPayment(selectedFolio.id, {
      folioId: selectedFolio.id,
      amount: amountNum,
      paymentMethod,
      transactionReference: paymentRef || undefined,
      receiptNotes: paymentNotes || 'Counter Payment',
      collectedByName: 'Administrator',
    });

    setPaymentAmount('');
    setPaymentRef('');
    setPaymentNotes('');
    setSelectedFolio(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-sand-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-forest-900 text-sand-200 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-serif font-bold text-xl text-forest-950">
                  Financial Ledger & Profitability
                </h2>
                <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold uppercase px-2 py-0.5 rounded-full">
                  Admin Master View
                </span>
              </div>
              <p className="text-xs text-forest-700 mt-0.5">
                Unified guest folios, expense logging, daily cash reconciliation & net margin.
              </p>
            </div>
          </div>

          {/* Sub-Tab Navigation */}
          <div className="flex items-center space-x-1.5 bg-sand-100/80 p-1.5 rounded-2xl self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'analytics'
                  ? 'bg-forest-900 text-white shadow-xs'
                  : 'text-forest-700 hover:text-forest-950'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Profitability & Reconciliation</span>
            </button>
            <button
              onClick={() => setActiveTab('folios')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'folios'
                  ? 'bg-forest-900 text-white shadow-xs'
                  : 'text-forest-700 hover:text-forest-950'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Unified Folios ({folios.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'expenses'
                  ? 'bg-forest-900 text-white shadow-xs'
                  : 'text-forest-700 hover:text-forest-950'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Expense Logger ({expenses.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: ANALYTICS DASHBOARD */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Top KPI Cards: Income vs Logged Expenses vs Net Operating Profit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Payments Collected */}
            <div className="bg-white rounded-3xl p-5 border border-sand-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-forest-600 block">
                Total Revenue Collected
              </span>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-3xl font-serif font-bold text-forest-950">
                  ₹{totalPaymentsCollected.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center space-x-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Across Room, F&B & Transport</span>
              </p>
            </div>

            {/* Total Logged Expenses */}
            <div className="bg-white rounded-3xl p-5 border border-sand-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
                Total Logged Expenses
              </span>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-3xl font-serif font-bold text-rose-950">
                  ₹{totalExpenses.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[11px] text-rose-700 font-semibold mt-1 flex items-center space-x-1">
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>Groceries, Payroll, Utilities, Gas</span>
              </p>
            </div>

            {/* Net Operating Profit */}
            <div className="bg-white rounded-3xl p-5 border border-emerald-200 shadow-xs bg-emerald-50/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                Net Operating Profit
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-3xl font-serif font-bold text-emerald-950">
                  ₹{netProfit.toLocaleString('en-IN')}
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">
                  {profitMargin}% Margin
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 mt-1 font-medium">
                Income minus all logged operating expenses
              </p>
            </div>
          </div>

          {/* Two Key Widgets: Daily Cash vs Online Reconciliation + Revenue Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Widget 1: Daily Cash vs. Online Reconciliation */}
            <div className="bg-white rounded-3xl p-6 border border-sand-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-base text-forest-950">
                    Daily Cash vs. Online Reconciliation
                  </h3>
                  <p className="text-xs text-forest-700">
                    Audit of counter cash vs. digital payments (UPI & Bank Transfer).
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                  ₹
                </div>
              </div>

              {/* Visual Progress Bar */}
              <div className="space-y-2">
                <div className="h-4 w-full bg-sand-200 rounded-full overflow-hidden flex">
                  <div
                    style={{
                      width: `${totalPaymentsCollected > 0 ? (onlinePayments / totalPaymentsCollected) * 100 : 50}%`,
                    }}
                    className="bg-forest-800 transition-all"
                    title="Online (UPI/Bank)"
                  />
                  <div
                    style={{
                      width: `${totalPaymentsCollected > 0 ? (cashPayments / totalPaymentsCollected) * 100 : 50}%`,
                    }}
                    className="bg-amber-400 transition-all"
                    title="Cash in Hand"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-forest-700">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-forest-800" />
                    <span>
                      Digital / UPI ({totalPaymentsCollected > 0 ? Math.round((onlinePayments / totalPaymentsCollected) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span>
                      Cash in Counter ({totalPaymentsCollected > 0 ? Math.round((cashPayments / totalPaymentsCollected) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-sand-50 p-3.5 rounded-2xl border border-sand-200">
                  <span className="text-[10px] uppercase font-bold text-forest-600 block">
                    Online (UPI / NEFT)
                  </span>
                  <span className="text-lg font-serif font-bold text-forest-950 block mt-0.5">
                    ₹{onlinePayments.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-gray-500">Verified via UTR Reference</span>
                </div>

                <div className="bg-sand-50 p-3.5 rounded-2xl border border-sand-200">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">
                    Cash in Counter
                  </span>
                  <span className="text-lg font-serif font-bold text-amber-950 block mt-0.5">
                    ₹{cashPayments.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-gray-500">To be banked weekly</span>
                </div>
              </div>
            </div>

            {/* Widget 2: Revenue Split Distribution */}
            <div className="bg-white rounded-3xl p-6 border border-sand-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-base text-forest-950">
                    Revenue Stream Distribution
                  </h3>
                  <p className="text-xs text-forest-700">
                    Split across Room Tariffs, F&B Orders & Add-on Commissions.
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-forest-100 text-forest-900 flex items-center justify-center font-bold">
                  <PieChart className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-3 pt-1">
                {/* Room Tariff */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-forest-900">Room Tariffs (7 Physical Rooms)</span>
                    <span className="font-mono font-bold text-forest-950">
                      ₹{totalRoomRevenue.toLocaleString('en-IN')} (
                      {totalGrossRevenue > 0 ? Math.round((totalRoomRevenue / totalGrossRevenue) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-sand-200 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${totalGrossRevenue > 0 ? (totalRoomRevenue / totalGrossRevenue) * 100 : 0}%`,
                      }}
                      className="h-full bg-emerald-600 rounded-full"
                    />
                  </div>
                </div>

                {/* F&B Orders */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-forest-900">F&B Orders (In-Room QR Dining)</span>
                    <span className="font-mono font-bold text-forest-950">
                      ₹{totalFbRevenue.toLocaleString('en-IN')} (
                      {totalGrossRevenue > 0 ? Math.round((totalFbRevenue / totalGrossRevenue) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-sand-200 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${totalGrossRevenue > 0 ? (totalFbRevenue / totalGrossRevenue) * 100 : 0}%`,
                      }}
                      className="h-full bg-amber-500 rounded-full"
                    />
                  </div>
                </div>

                {/* Transport & Add-ons */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-forest-900">Transfers & Add-on Rentals</span>
                    <span className="font-mono font-bold text-forest-950">
                      ₹{totalAddonRevenue.toLocaleString('en-IN')} (
                      {totalGrossRevenue > 0 ? Math.round((totalAddonRevenue / totalGrossRevenue) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-sand-200 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${totalGrossRevenue > 0 ? (totalAddonRevenue / totalGrossRevenue) * 100 : 0}%`,
                      }}
                      className="h-full bg-blue-600 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: UNIFIED GUEST FOLIOS */}
      {activeTab === 'folios' && (
        <div className="bg-white rounded-3xl p-6 border border-sand-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-forest-950">
                Unified Guest Folios
              </h3>
              <p className="text-xs text-forest-700">
                Central billing ledger aggregating Room Charges + QR Food Orders + Transport Add-ons + Payments.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-sand-200 bg-sand-50/70 text-forest-700 uppercase font-bold text-[10px]">
                  <th className="py-3 px-3">Folio #</th>
                  <th className="py-3 px-3">Guest & Room</th>
                  <th className="py-3 px-3">Room Tariff</th>
                  <th className="py-3 px-3">F&B Orders</th>
                  <th className="py-3 px-3">Transfers</th>
                  <th className="py-3 px-3">Net Bill</th>
                  <th className="py-3 px-3">Total Paid</th>
                  <th className="py-3 px-3">Balance Due</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {folios.map((folio) => (
                  <tr key={folio.id} className="hover:bg-sand-50/60 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-forest-900">
                      {folio.folioNumber}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold block text-forest-950">{folio.guestName}</span>
                      <span className="text-[10px] text-gray-500">Room {folio.roomNumber}</span>
                    </td>
                    <td className="py-3 px-3 font-mono">₹{folio.totalRoomCharges}</td>
                    <td className="py-3 px-3 font-mono">₹{folio.totalFbCharges}</td>
                    <td className="py-3 px-3 font-mono">₹{folio.totalAddonCharges}</td>
                    <td className="py-3 px-3 font-mono font-bold text-forest-950">
                      ₹{folio.netPayable}
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-700 font-bold">
                      ₹{folio.totalPaid}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {folio.balanceDue > 0 ? (
                        <span className="text-rose-600 font-bold">₹{folio.balanceDue}</span>
                      ) : (
                        <span className="text-emerald-600 font-bold">Settled</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          folio.status === 'settled'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {folio.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setSelectedFolio(folio)}
                        className="min-h-[44px] px-3 py-1.5 bg-forest-900 hover:bg-forest-800 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Folio</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: EXPENSE LOGGER */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-sand-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-serif font-bold text-lg text-forest-950">
                  Estate Expense Logger
                </h3>
                <p className="text-xs text-forest-700">
                  Record daily operational outflows: Groceries, Utilities, Housekeeping, Staff Payroll & Gas.
                </p>
              </div>

              <button
                onClick={() => setIsAddingExpense(!isAddingExpense)}
                className="min-h-[44px] px-4 py-2 bg-forest-900 hover:bg-forest-800 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center space-x-1.5 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 text-amber-300" />
                <span>{isAddingExpense ? 'Hide Form' : 'Log New Expense'}</span>
              </button>
            </div>

            {/* Log New Expense Form */}
            {isAddingExpense && (
              <form
                onSubmit={handleCreateExpense}
                className="bg-sand-50 p-5 rounded-2xl border border-sand-300 mb-6 space-y-4 animate-in fade-in duration-200"
              >
                <h4 className="font-serif font-bold text-sm text-forest-900">
                  New Operational Expense Entry
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-forest-800 block mb-1">
                      Expense Date
                    </label>
                    <input
                      type="date"
                      required
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-forest-800 block mb-1">
                      Amount (₹ INR)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white"
                      placeholder="e.g., 3500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-forest-800 block mb-1">
                      Paid Via
                    </label>
                    <select
                      value={expenseMethod}
                      onChange={(e) => setExpenseMethod(e.target.value as PaymentMethod)}
                      className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white"
                    >
                      <option value="cash">Cash (Counter/Petty Cash)</option>
                      <option value="upi">UPI (GPay / PhonePe / QR)</option>
                      <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                      <option value="card">Company Debit Card</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-forest-800 block mb-1">
                      Master Category
                    </label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value as ExpenseMasterCategory)}
                      className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white font-semibold"
                    >
                      <option value="groceries">Groceries & Kitchen Produce</option>
                      <option value="utilities">Utilities & LPG Gas</option>
                      <option value="housekeeping">Housekeeping Supplies</option>
                      <option value="maintenance">Maintenance & Repairs</option>
                      <option value="staff_payroll">Staff Payroll & Stipends</option>
                      <option value="marketing">Marketing & Commissions</option>
                      <option value="transport_vendor">Transport Vendor Settlement</option>
                      <option value="miscellaneous">Miscellaneous Outflow</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-forest-800 block mb-1">
                      Sub-Tag / Department
                    </label>
                    <input
                      type="text"
                      value={expenseSubTag}
                      onChange={(e) => setExpenseSubTag(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white"
                      placeholder="e.g., Produce, Dairy, LPG, Electricity"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-forest-800 block mb-1">
                      Vendor / Payee Name
                    </label>
                    <input
                      type="text"
                      value={expenseVendor}
                      onChange={(e) => setExpenseVendor(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white"
                      placeholder="e.g., Local Farmers Market"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-forest-800 block mb-1">
                    Description / Purpose
                  </label>
                  <input
                    type="text"
                    required
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white"
                    placeholder="e.g., Fresh organic vegetables, farm milk and eggs for breakfast mandate"
                  />
                </div>

                {/* Receipt Upload / Image link */}
                <div>
                  <label className="text-[11px] font-bold text-forest-800 block mb-1">
                    Bill Receipt Photo Preview URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={receiptUrl}
                    onChange={(e) => setReceiptUrl(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-sand-300 bg-white"
                    placeholder="https://example.com/receipt.jpg"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingExpense(false)}
                    className="min-h-[44px] px-4 py-2 text-xs font-bold text-forest-700 hover:bg-sand-200 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="min-h-[44px] px-5 py-2 text-xs font-bold bg-forest-900 hover:bg-forest-800 text-white rounded-xl shadow transition-all"
                  >
                    Save Expense Record
                  </button>
                </div>
              </form>
            )}

            {/* Expenses List */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-sand-200 bg-sand-50/70 text-forest-700 uppercase font-bold text-[10px]">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Category & Sub-Tag</th>
                    <th className="py-3 px-3">Vendor / Payee</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3">Paid Via</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Receipt</th>
                    <th className="py-3 px-3 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-200">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-sand-50/60 transition-colors">
                      <td className="py-3 px-3 text-forest-800 font-mono whitespace-nowrap">
                        {exp.expenseDate}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold block text-forest-950 capitalize">
                          {exp.masterCategory.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-gray-500">{exp.subTag}</span>
                      </td>
                      <td className="py-3 px-3 text-forest-900 font-medium">
                        {exp.vendorPayee || '—'}
                      </td>
                      <td className="py-3 px-3 text-forest-700 max-w-xs truncate">
                        {exp.description}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-mono uppercase bg-sand-100 text-forest-900 px-2 py-0.5 rounded">
                          {exp.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-rose-800">
                        ₹{exp.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3">
                        {exp.billReceiptUrl ? (
                          <a
                            href={exp.billReceiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-forest-700 hover:text-forest-950 font-bold underline flex items-center space-x-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View</span>
                          </a>
                        ) : (
                          <span className="text-gray-400 text-[10px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => deleteExpense(exp.id)}
                          className="min-h-[44px] min-w-[44px] p-2 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors inline-flex items-center justify-center"
                          title="Delete expense entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Folio Detailed Inspection & Settle Modal */}
      {selectedFolio && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-sand-200 max-h-[90vh] overflow-y-auto text-forest-950 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-sand-200 pb-4 mb-4">
              <div>
                <span className="text-xs font-mono font-bold text-forest-600 uppercase">
                  Folio #{selectedFolio.folioNumber}
                </span>
                <h3 className="font-serif font-bold text-xl text-forest-950">
                  {selectedFolio.guestName} — Room {selectedFolio.roomNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedFolio(null)}
                className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-sand-100 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Line Item Charges */}
            <div className="space-y-4">
              <h4 className="font-serif font-bold text-xs uppercase text-forest-800 tracking-wider">
                Posted Line Charges
              </h4>

              <div className="divide-y divide-sand-200 bg-sand-50 rounded-2xl border border-sand-200 p-4 text-xs">
                {selectedFolio.charges.map((chg) => (
                  <div key={chg.id} className="py-2 flex items-start justify-between">
                    <div>
                      <span className="font-bold text-forest-950 block">{chg.title}</span>
                      <span className="text-[10px] text-gray-500 uppercase font-mono">
                        {chg.category.replace('_', ' ')} • Status: {chg.chargeStatus}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-forest-900">₹{chg.amount}</span>
                  </div>
                ))}

                <div className="pt-3 flex items-center justify-between font-bold border-t-2 border-sand-300">
                  <span>Net Payable (Incl. 5% GST)</span>
                  <span className="font-mono text-sm text-forest-950">₹{selectedFolio.netPayable}</span>
                </div>
              </div>

              {/* Payments History */}
              <h4 className="font-serif font-bold text-xs uppercase text-forest-800 tracking-wider pt-2">
                Payments Received
              </h4>

              <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200 p-4 text-xs space-y-2">
                {selectedFolio.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-emerald-950">
                        ₹{p.amount.toLocaleString('en-IN')} via {p.paymentMethod.toUpperCase()}
                      </span>
                      {p.transactionReference && (
                        <p className="text-[10px] text-emerald-800 font-mono">
                          Ref: {p.transactionReference}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-emerald-700">
                      {new Date(p.collectedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}

                <div className="pt-2 border-t border-emerald-200 flex items-center justify-between font-bold">
                  <span>Total Collected</span>
                  <span className="font-mono text-emerald-800">₹{selectedFolio.totalPaid}</span>
                </div>
                <div className="flex items-center justify-between font-bold">
                  <span>Balance Due</span>
                  <span className="font-mono text-rose-700 text-sm">₹{selectedFolio.balanceDue}</span>
                </div>
              </div>

              {/* Record Payment Form if Balance Due > 0 */}
              {selectedFolio.balanceDue > 0 && (
                <form
                  onSubmit={handleRecordPayment}
                  className="bg-sand-50 p-4 rounded-2xl border border-sand-300 space-y-3"
                >
                  <h5 className="font-bold text-xs text-forest-900">
                    Record Folio Payment
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-forest-700 block mb-1">
                        Amount (₹)
                      </label>
                      <input
                        type="number"
                        required
                        max={selectedFolio.balanceDue}
                        value={paymentAmount || selectedFolio.balanceDue}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-sand-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-forest-700 block mb-1">
                        Payment Mode
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="w-full text-xs p-2 rounded-lg border border-sand-300 bg-white"
                      >
                        <option value="cash">Cash (Counter)</option>
                        <option value="upi">UPI (GPay / PhonePe)</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="card">Card</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-forest-700 block mb-1">
                        Ref / UTR Number
                      </label>
                      <input
                        type="text"
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        placeholder="UPI-123456"
                        className="w-full text-xs p-2 rounded-lg border border-sand-300 bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="submit"
                      className="min-h-[44px] px-5 py-2 bg-forest-900 text-white font-bold text-xs rounded-xl shadow hover:bg-forest-800"
                    >
                      Record Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        settleFolio(selectedFolio.id, paymentMethod);
                        setSelectedFolio(null);
                      }}
                      className="min-h-[44px] px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow hover:bg-emerald-500"
                    >
                      Settle in Full & Close
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
