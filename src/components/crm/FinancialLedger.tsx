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
import DayCloseCard from './DayCloseCard';
import ManagerCashbook from './ManagerCashbook';
import MoneyDashboard from './MoneyDashboard';
import { todayInIST } from '@/lib/tariff-calculator';

export default function FinancialLedger() {
  const {
    role,
    setRole,
    currentUser,
    folios,
    bookings,
    expenses,
    approveExpense,
    voidExpense,
    voidFolioPayment,
    showToast,
  } = useCRM();
  // Inline "void with reason" editor: `${kind}:${id}`
  const [voiding, setVoiding] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const [activeTab, setActiveTab] = useState<'analytics' | 'cashbook' | 'folios' | 'expenses'>('analytics');

  // Folio detail modal
  const [selectedFolio, setSelectedFolio] = useState<GuestFolio | null>(null);

  // 1. RBAC Guard: If role is not admin, strictly block access!
  if (role !== 'admin' || currentUser?.role !== 'admin') {
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
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setRole('admin')}
              className="min-h-[44px] px-6 py-2.5 bg-forest-900 hover:bg-forest-800 text-white font-bold text-xs rounded-xl shadow transition-all"
            >
              Back to the Admin view
            </button>
          )}
        </div>
      </div>
    );
  }

  // All money figures come from the server summary (see MoneyDashboard / lib/reports-core.ts)

  const startVoid = (key: string) => {
    setVoiding(key);
    setVoidReason('');
  };
  const confirmVoid = async () => {
    if (!voiding) return;
    if (voidReason.trim().length < 3) {
      showToast('Please write a short reason (at least 3 characters).', 'error');
      return;
    }
    const [kind, a, b] = voiding.split(':');
    if (kind === 'exp') await voidExpense(a, voidReason.trim());
    else if (kind === 'pay') voidFolioPayment(a, b, voidReason.trim());
    setVoiding(null);
    setVoidReason('');
    if (kind === 'pay') setSelectedFolio(null);
  };
  const voidEditor = (key: string) =>
    voiding === key && (
      <div className="mt-2 flex flex-col sm:flex-row gap-2">
        <input
          autoFocus
          value={voidReason}
          onChange={(e) => setVoidReason(e.target.value)}
          placeholder="Reason for voiding (required)"
          className="flex-1 text-xs px-3 py-2 rounded-lg border border-rose-300 bg-white"
        />
        <button onClick={() => void confirmVoid()} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold">
          Void
        </button>
        <button onClick={() => setVoiding(null)} className="px-3 py-2 rounded-lg border border-sand-300 text-xs font-bold">
          Cancel
        </button>
      </div>
    );
  const signedLine = (name?: string, at?: string) =>
    name ? `Signed by ${name}${at ? ` · ${new Date(at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}` : 'Not signed (older entry)';

  return (
    <div className="space-y-6">
      <DayCloseCard showToast={showToast} />

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
              onClick={() => setActiveTab('cashbook')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'cashbook' ? 'bg-forest-900 text-white shadow-xs' : 'text-forest-700 hover:text-forest-950'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Manager cash book</span>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'analytics'
                  ? 'bg-forest-900 text-white shadow-xs'
                  : 'text-forest-700 hover:text-forest-950'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Dashboard</span>
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

      {activeTab === 'cashbook' && <ManagerCashbook />}

      {/* SUB-TAB 1: DASHBOARD (one set of numbers, by date range) */}
      {activeTab === 'analytics' && <MoneyDashboard />}
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
                      {(() => {
                        const stay = bookings.find((b) => b.id === folio.bookingId);
                        const leftWithDue = folio.status === 'open' && folio.balanceDue > 0 && stay?.bookingStatus === 'checked_out';
                        const label =
                          folio.status === 'settled'
                            ? 'Settled'
                            : folio.status === 'void'
                            ? 'Void'
                            : leftWithDue
                            ? 'Checked out · due'
                            : (folio.creditOwed || 0) > 0
                            ? 'Credit owed'
                            : stay?.bookingStatus === 'checked_in'
                            ? 'In-house'
                            : 'Open';
                        return (
                          <span
                            title={leftWithDue && stay?.checkoutNote ? `Note at checkout: ${stay.checkoutNote}` : undefined}
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap ${
                              folio.status === 'settled'
                                ? 'bg-emerald-100 text-emerald-800'
                                : leftWithDue
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {label}
                          </span>
                        );
                      })()}
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

              <a
                href="/expenses"
                className="min-h-[44px] px-4 py-2 bg-amber-50 border border-amber-200 text-amber-950 text-xs font-semibold rounded-xl self-start sm:self-auto max-w-xs"
              >
                Expenses are logged and signed by managers in the <strong>Expense Logger</strong> app. Here you approve or void them.
              </a>
            </div>

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
                    <th className="py-3 px-3">Signed</th>
                    <th className="py-3 px-3 text-right">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-200">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className={`hover:bg-sand-50/60 transition-colors ${exp.status === 'void' ? 'opacity-50 line-through' : ''}`}>
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
                      <td className="py-3 px-3 text-[10px] text-forest-700 min-w-[140px] no-underline">
                        {signedLine(exp.loggedByName, exp.signedOffAt || exp.createdAt)}
                        {exp.status === 'approved' && <span className="block text-emerald-700 font-bold">✓ Approved by {exp.approvedByName}</span>}
                        {exp.status === 'void' && <span className="block text-rose-700 font-bold">Void: {exp.voidReason}</span>}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {exp.status !== 'void' && (
                          <div className="inline-flex gap-1.5">
                            {exp.status !== 'approved' && (
                              <button
                                onClick={() => void approveExpense(exp.id)}
                                className="min-h-[36px] px-2.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold"
                              >
                                Approve
                              </button>
                            )}
                            <button
                              onClick={() => startVoid(`exp:${exp.id}`)}
                              className="min-h-[36px] px-2.5 rounded-lg border border-rose-300 text-rose-700 text-[11px] font-bold inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Void
                            </button>
                          </div>
                        )}
                        {voidEditor(`exp:${exp.id}`)}
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
                  <span>Net Payable{selectedFolio.totalTax > 0 ? ` (incl. GST ₹${selectedFolio.totalTax.toLocaleString('en-IN')})` : ''}</span>
                  <span className="font-mono text-sm text-forest-950">₹{selectedFolio.netPayable}</span>
                </div>
              </div>

              {/* Payments History */}
              <h4 className="font-serif font-bold text-xs uppercase text-forest-800 tracking-wider pt-2">
                Payments Received
              </h4>

              <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200 p-4 text-xs space-y-2">
                {selectedFolio.payments.map((p) => (
                  <div key={p.id} className={`py-1 ${p.voidedAt ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`font-bold text-emerald-950 ${p.voidedAt ? 'line-through' : ''}`}>
                          ₹{p.amount.toLocaleString('en-IN')} via {(p.paymentMethod || 'other').toUpperCase()}
                        </span>
                        {p.transactionReference && <p className="text-[10px] text-emerald-800 font-mono">Ref: {p.transactionReference}</p>}
                        <p className="text-[10px] text-emerald-700">{signedLine(p.signedOffByName || p.collectedByName, p.signedOffAt || p.collectedAt)}</p>
                        {p.voidedAt && <p className="text-[10px] text-rose-700 font-bold">Void by {p.voidedByName}: {p.voidReason}</p>}
                      </div>
                      {!p.voidedAt && (
                        <button
                          onClick={() => startVoid(`pay:${selectedFolio.id}:${p.id}`)}
                          className="shrink-0 px-2.5 py-1.5 rounded-lg border border-rose-300 text-rose-700 text-[11px] font-bold"
                        >
                          Void
                        </button>
                      )}
                    </div>
                    {voidEditor(`pay:${selectedFolio.id}:${p.id}`)}
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

              <p className="text-[11px] text-forest-600 bg-sand-50 rounded-xl p-3 border border-sand-200">
                Collections are recorded and signed by a manager at the desk (bookings list → folio). Admins can void a wrong entry with a reason.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
