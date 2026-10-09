'use client';

import { useState } from 'react';
import { BedDouble, UtensilsCrossed, Car, Bike, Sparkles, Package, Clock, Plus, Percent, Undo2, Ban } from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import type { ChargeCategory, CRMBooking, FolioCharge, GuestFolio, PaymentMethod } from '@/types/crm';
import { serviceGroup, SERVICE_GROUP_NAMES } from '@/lib/guest-bills';

/**
 * The guest's bill exactly as stored: every line (billed, awaiting confirmation, voided),
 * payments and refunds, with the desk actions: add a charge, void a line (with a reason),
 * give a discount (with a reason, managers up to 10% / ₹1,000) and refund a credit.
 */

const inr = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const ICON: Record<string, typeof Car> = { room: BedDouble, food: UtensilsCrossed, transfers: Car, rentals: Bike, special: Sparkles, other: Package };
const ADD_CATEGORIES: { key: ChargeCategory; label: string }[] = [
  { key: 'miscellaneous', label: 'Other service / extra' },
  { key: 'laundry', label: 'Laundry' },
  { key: 'food_beverage', label: 'Food & drinks (not ordered by QR)' },
  { key: 'room_tariff', label: 'Room (late check-out, extra bed…)' },
  { key: 'transport_transfer', label: 'Transfer' },
  { key: 'vehicle_rental', label: 'Vehicle rental' },
];

export default function FolioLinesPanel({ folio, booking }: { folio: GuestFolio | null; booking: CRMBooking }) {
  const { currentUser, addFolioCharge, voidFolioCharge, setFolioDiscount, recordFolioRefund, showToast } = useCRM();
  const isManager = currentUser?.role === 'manager';
  const canEdit = currentUser?.role === 'manager' || currentUser?.role === 'admin';
  const [voiding, setVoiding] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [panel, setPanel] = useState<'none' | 'charge' | 'discount' | 'refund'>('none');
  const [cCat, setCCat] = useState<ChargeCategory>('miscellaneous');
  const [cTitle, setCTitle] = useState('');
  const [cAmount, setCAmount] = useState('');
  const [dAmount, setDAmount] = useState('');
  const [dReason, setDReason] = useState('');
  const [rAmount, setRAmount] = useState('');
  const [rMethod, setRMethod] = useState<PaymentMethod>('upi');
  const [rSign, setRSign] = useState(false);

  if (!folio) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
        No bill is open for this booking yet. It is created with the booking; if it is missing, refresh the page.
      </div>
    );
  }

  const lines = [...folio.charges].sort((a, b) => (a.category === 'room_tariff' ? 0 : 1) - (b.category === 'room_tariff' ? 0 : 1) || (a.postedAt || '').localeCompare(b.postedAt || ''));
  const groupOf = (c: FolioCharge) => (c.category === 'room_tariff' ? 'room' : serviceGroup(c));
  const label = (c: FolioCharge) => (c.category === 'room_tariff' ? 'Room' : SERVICE_GROUP_NAMES[serviceGroup(c)]);
  const credit = folio.creditOwed || 0;
  const pending = folio.pendingTotal || 0;

  const submitCharge = () => {
    const amount = Number(cAmount);
    if (!cTitle.trim() || !(amount > 0)) {
      showToast('Enter a description and an amount.', 'error');
      return;
    }
    addFolioCharge(folio.id, { folioId: folio.id, category: cCat, chargeStatus: 'posted', title: cTitle.trim(), amount, sourceReferenceType: 'manual_adjustment' });
    setCTitle('');
    setCAmount('');
    setPanel('none');
  };

  return (
    <div className="border border-sand-200 rounded-2xl overflow-hidden">
      <div className="bg-sand-100/60 px-4 py-2.5 flex items-center justify-between border-b border-sand-200">
        <span className="text-xs font-bold text-forest-950">Bill lines</span>
        <span className="text-[11px] text-forest-600 font-mono">{folio.folioNumber}</span>
      </div>
      <ul className="divide-y divide-sand-100 bg-white">
        {lines.map((c) => {
          const Icon = ICON[groupOf(c)] || Package;
          const isVoid = c.chargeStatus === 'void';
          const isPending = c.chargeStatus === 'pending';
          return (
            <li key={c.id} className={`px-4 py-2.5 text-xs ${isVoid ? 'opacity-55' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <Icon className="w-3.5 h-3.5 mt-0.5 text-forest-600 shrink-0" />
                  <div className="min-w-0">
                    <p className={`font-semibold text-forest-950 ${isVoid ? 'line-through' : ''}`}>{c.title}</p>
                    <p className="text-[10px] text-forest-600">
                      {label(c)}
                      {c.postedByName ? ` · ${c.postedByName}` : ''}
                      {isPending && <span className="text-amber-700 font-bold inline-flex items-center gap-0.5 ml-1"><Clock className="w-3 h-3" /> awaiting confirmation (not billed)</span>}
                      {isVoid && c.voidReason ? <span className="text-rose-700 font-bold"> · void: {c.voidReason}</span> : null}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-bold">{inr(c.amount)}</p>
                  {canEdit && !isVoid && (
                    <button onClick={() => { setVoiding(c.id); setReason(''); }} className="text-[10px] font-bold text-rose-700 underline">
                      Void
                    </button>
                  )}
                </div>
              </div>
              {voiding === c.id && (
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                  <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className="flex-1 px-3 py-2 rounded-lg border border-rose-300" />
                  <button
                    onClick={() => {
                      voidFolioCharge(folio.id, c.id, reason);
                      if (reason.trim().length >= 3) setVoiding(null);
                    }}
                    className="px-3 py-2 rounded-lg bg-rose-600 text-white font-bold"
                  >
                    Void line
                  </button>
                  <button onClick={() => setVoiding(null)} className="px-3 py-2 rounded-lg border border-sand-300 font-bold">Cancel</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="px-4 py-3 bg-sand-50/70 border-t border-sand-200 text-xs space-y-1">
        <div className="flex justify-between"><span>Billed lines</span><span className="font-mono">{inr(folio.totalRoomCharges + folio.totalFbCharges + folio.totalAddonCharges)}</span></div>
        {folio.discountAmount > 0 && (
          <div className="flex justify-between text-emerald-700"><span>Discount{folio.discountReason ? ` (${folio.discountReason})` : ''}</span><span className="font-mono">−{inr(folio.discountAmount)}</span></div>
        )}
        {folio.totalTax > 0 && <div className="flex justify-between"><span>GST</span><span className="font-mono">{inr(folio.totalTax)}</span></div>}
        <div className="flex justify-between font-bold text-sm text-forest-950"><span>Bill total</span><span className="font-mono">{inr(folio.netPayable)}</span></div>
        <div className="flex justify-between text-emerald-700"><span>Paid (net of refunds)</span><span className="font-mono">−{inr(folio.totalPaid)}</span></div>
        {pending > 0 && <div className="flex justify-between text-amber-800"><span>Awaiting confirmation (not billed)</span><span className="font-mono">{inr(pending)}</span></div>}
        {credit > 0 ? (
          <div className="flex justify-between font-bold text-sm text-sky-800"><span>Credit owed to guest</span><span className="font-mono">{inr(credit)}</span></div>
        ) : (
          <div className={`flex justify-between font-bold text-sm ${folio.balanceDue > 0 ? 'text-rose-700' : 'text-emerald-700'}`}><span>Balance due</span><span className="font-mono">{inr(folio.balanceDue)}</span></div>
        )}
      </div>

      {canEdit && (
        <div className="px-4 py-3 border-t border-sand-200 bg-white space-y-3">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setPanel(panel === 'charge' ? 'none' : 'charge')} className="min-h-[36px] px-3 rounded-lg border border-sand-300 text-[11px] font-bold inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add charge</button>
            <button onClick={() => { setPanel(panel === 'discount' ? 'none' : 'discount'); setDAmount(String(folio.discountAmount || '')); setDReason(folio.discountReason || ''); }} className="min-h-[36px] px-3 rounded-lg border border-sand-300 text-[11px] font-bold inline-flex items-center gap-1"><Percent className="w-3.5 h-3.5" /> Discount</button>
            {credit > 0 && isManager && (
              <button onClick={() => { setPanel(panel === 'refund' ? 'none' : 'refund'); setRAmount(String(credit)); setRSign(false); }} className="min-h-[36px] px-3 rounded-lg border border-sky-300 text-sky-800 text-[11px] font-bold inline-flex items-center gap-1"><Undo2 className="w-3.5 h-3.5" /> Refund credit</button>
            )}
          </div>

          {panel === 'charge' && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <select value={cCat} onChange={(e) => setCCat(e.target.value as ChargeCategory)} className="px-2 py-2 rounded-lg border border-sand-300 bg-white">
                {ADD_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <input value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="Description, e.g. Laundry 4 pcs" className="sm:col-span-2 px-3 py-2 rounded-lg border border-sand-300" />
              <div className="flex gap-2">
                <input value={cAmount} onChange={(e) => setCAmount(e.target.value)} inputMode="decimal" placeholder="₹" className="w-full px-3 py-2 rounded-lg border border-sand-300 font-mono" />
                <button onClick={submitCharge} className="px-3 py-2 rounded-lg bg-forest-900 text-white font-bold">Add</button>
              </div>
            </div>
          )}

          {panel === 'discount' && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <input value={dAmount} onChange={(e) => setDAmount(e.target.value)} inputMode="decimal" placeholder="Discount ₹" className="px-3 py-2 rounded-lg border border-sand-300 font-mono" />
              <input value={dReason} onChange={(e) => setDReason(e.target.value)} placeholder="Reason (required)" className="sm:col-span-2 px-3 py-2 rounded-lg border border-sand-300" />
              <button
                onClick={() => {
                  setFolioDiscount(folio.id, Number(dAmount) || 0, dReason);
                  setPanel('none');
                }}
                className="px-3 py-2 rounded-lg bg-forest-900 text-white font-bold"
              >
                Save discount
              </button>
              {isManager && <p className="sm:col-span-4 text-[10px] text-forest-600">Managers can give up to 10% of the bill (max ₹1,000). Larger discounts need the owner.</p>}
            </div>
          )}

          {panel === 'refund' && (
            <div className="space-y-2 text-xs">
              <div className="flex gap-2">
                <input value={rAmount} onChange={(e) => setRAmount(e.target.value)} inputMode="decimal" className="w-32 px-3 py-2 rounded-lg border border-sand-300 font-mono" />
                <select value={rMethod} onChange={(e) => setRMethod(e.target.value as PaymentMethod)} className="px-2 py-2 rounded-lg border border-sand-300 bg-white">
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <label className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer">
                <input type="checkbox" checked={rSign} onChange={(e) => setRSign(e.target.checked)} className="mt-0.5" />
                <span>I, <strong>{currentUser?.fullName}</strong>, confirm I paid back <strong>{inr(Number(rAmount) || 0)}</strong> to {booking.guest.fullName}.</span>
              </label>
              <button
                onClick={() => {
                  const amount = Number(rAmount);
                  if (!(amount > 0) || amount > credit + 0.001) {
                    showToast(`Enter an amount up to the credit of ${inr(credit)}.`, 'error');
                    return;
                  }
                  recordFolioRefund(folio.id, { amount, paymentMethod: rMethod, signOffConfirmed: rSign });
                  if (rSign) setPanel('none');
                }}
                className="px-3 py-2 rounded-lg bg-sky-700 text-white font-bold inline-flex items-center gap-1"
              >
                <Ban className="w-3.5 h-3.5 rotate-45" /> Record refund (signed)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
