'use client';

import { useMemo } from 'react';
import { BedDouble, ConciergeBell, Printer, Clock, CheckCircle2, UtensilsCrossed, Car, Bike, Sparkles, Package } from 'lucide-react';
import type { CRMBooking, GuestFolio } from '@/types/crm';
import type { GstConfig } from '@/lib/gst';
import { GuestBill, MEAL_PLAN_NAMES, SERVICE_GROUP_NAMES, ServiceGroup, splitGuestBills } from '@/lib/guest-bills';

/**
 * Two separate bills in the guest portal: the ROOM bill (nights × the booked meal plan) and
 * the SERVICES bill (food orders, transfers, rentals, special requests, other extras).
 * Each can be printed / saved as PDF on its own.
 */

const inr = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const GROUP_ICON: Record<ServiceGroup, typeof Car> = { food: UtensilsCrossed, transfers: Car, rentals: Bike, special: Sparkles, other: Package };
const GROUP_ORDER: ServiceGroup[] = ['food', 'transfers', 'rentals', 'special', 'other'];
const fmtDate = (d: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

function printBill(bill: GuestBill, booking: CRMBooking, folio: GuestFolio | null) {
  const isRoom = bill.kind === 'room';
  const rows = bill.lines
    .map(
      (l) =>
        `<tr><td>${esc(fmtDate(l.date))}</td><td>${esc(l.title)}${l.pending ? ' <em>(awaiting confirmation)</em>' : ''}${
          l.group ? `<div class="g">${esc(SERVICE_GROUP_NAMES[l.group])}</div>` : ''
        }</td><td class="r">${inr(l.amount)}</td></tr>`
    )
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${isRoom ? 'Room bill' : 'Services bill'} – ${esc(booking.bookingReference)}</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0B1733;margin:32px;font-size:13px}
h1{font-size:20px;margin:0}h2{font-size:15px;margin:18px 0 6px}.muted{color:#5b6475}
table{width:100%;border-collapse:collapse;margin-top:8px}td,th{padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5b6475}.r{text-align:right;white-space:nowrap}.g{font-size:11px;color:#5b6475}
.tot td{border:none;padding:4px 6px}.big td{font-size:15px;font-weight:700;border-top:2px solid #0B1733}
.head{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #0B1733;padding-bottom:12px}
</style></head><body>
<div class="head"><div><h1>Savera Homestay</h1><div class="muted">${isRoom ? 'Room bill' : 'Services bill'}</div></div>
<div style="text-align:right"><strong>${esc(booking.bookingReference)}</strong><div class="muted">${esc(folio?.folioNumber || '')}</div><div class="muted">Printed ${new Date().toLocaleDateString('en-IN')}</div></div></div>
<h2>${esc(booking.guest?.fullName || 'Guest')}</h2>
<div class="muted">${esc(booking.roomName)} · ${fmtDate(booking.checkInDate)} → ${fmtDate(booking.checkOutDate)} · ${booking.totalNights} night${booking.totalNights === 1 ? '' : 's'}${
    isRoom ? ` · ${esc(MEAL_PLAN_NAMES[booking.mealPlan] || booking.mealPlan)}` : ''
  }</div>
<table><thead><tr><th>Date</th><th>Description</th><th class="r">Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="muted">No charges</td></tr>'}</tbody></table>
<table class="tot">
<tr><td>Subtotal</td><td class="r">${inr(bill.subtotal)}</td></tr>
${bill.discount > 0 ? `<tr><td>Discount</td><td class="r">−${inr(bill.discount)}</td></tr>` : ''}
${bill.tax > 0 ? `<tr><td>GST</td><td class="r">${inr(bill.tax)}</td></tr>` : ''}
<tr class="big"><td>Bill total</td><td class="r">${inr(bill.total)}</td></tr>
<tr><td>Paid</td><td class="r">−${inr(bill.paid)}</td></tr>
<tr class="big"><td>${bill.balance > 0 ? 'Balance due' : 'Settled'}</td><td class="r">${inr(Math.max(0, bill.balance))}</td></tr>
</table>
<p class="muted" style="margin-top:24px">Payments are applied to the room bill first, then to services. Thank you for staying with us.</p>
</body></html>`;
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1500);
  }, 250);
}

function Totals({ bill }: { bill: GuestBill }) {
  return (
    <div className="pt-3 mt-1 border-t border-sand-200 space-y-1.5 text-xs">
      <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="font-mono">{inr(bill.subtotal)}</span></div>
      {bill.discount > 0 && <div className="flex justify-between text-emerald-700"><span>Discount</span><span className="font-mono">−{inr(bill.discount)}</span></div>}
      {bill.tax > 0 && <div className="flex justify-between text-gray-600"><span>GST</span><span className="font-mono">{inr(bill.tax)}</span></div>}
      <div className="flex justify-between font-bold text-[#0B1733] text-sm pt-1"><span>Bill total</span><span className="font-mono">{inr(bill.total)}</span></div>
      <div className="flex justify-between text-emerald-700"><span>Paid</span><span className="font-mono">−{inr(bill.paid)}</span></div>
      <div className={`flex justify-between font-bold text-sm pt-1 border-t border-sand-200 ${bill.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
        <span>{bill.balance > 0 ? 'Balance due' : 'Settled'}</span>
        <span className="font-mono">{inr(Math.max(0, bill.balance))}</span>
      </div>
    </div>
  );
}

function LineRow({ title, sub, amount, pending }: { title: string; sub?: string; amount: number; pending: boolean }) {
  return (
    <div className="py-2.5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[#0B1733] leading-snug">{title}</p>
        <p className="text-[11px] text-gray-500 flex items-center gap-1">
          {pending && <><Clock className="w-3 h-3 text-amber-600" /><span className="text-amber-700 font-semibold">Awaiting confirmation</span>{sub ? ' · ' : ''}</>}
          {sub}
        </p>
      </div>
      <span className="font-mono font-bold text-[13px] text-[#0B1733] shrink-0">{inr(amount)}</span>
    </div>
  );
}

export default function GuestBills({ booking, folio, gstConfig }: { booking: CRMBooking; folio: GuestFolio | null; gstConfig: GstConfig }) {
  const { room, services, totalDue } = useMemo(() => splitGuestBills(folio, booking, gstConfig), [folio, booking, gstConfig]);
  const grouped = GROUP_ORDER.map((g) => ({ g, lines: services.lines.filter((l) => l.group === g) })).filter((x) => x.lines.length > 0);

  const card = 'bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-sand-300';
  const printBtn = (bill: GuestBill) => (
    <button
      type="button"
      onClick={() => printBill(bill, booking, folio)}
      aria-label={bill.kind === 'room' ? 'Print or save the room bill as PDF' : 'Print or save the services bill as PDF'}
      className="min-h-[40px] px-3 rounded-xl border border-sand-300 hover:bg-sand-100 text-[#0B1733] text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
    >
      <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Print / PDF</span><span className="sm:hidden">PDF</span>
    </button>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Summary */}
      <div className="bg-[#0B1733] text-white rounded-3xl p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-blue-200 font-bold">Room bill</p>
          <p className="text-lg font-bold font-mono">{inr(room.total)}</p>
          <p className="text-[11px] text-blue-200">{room.balance > 0 ? `${inr(room.balance)} due` : 'Settled'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-blue-200 font-bold">Services bill</p>
          <p className="text-lg font-bold font-mono">{inr(services.total)}</p>
          <p className="text-[11px] text-blue-200">{services.balance > 0 ? `${inr(services.balance)} due` : services.total > 0 ? 'Settled' : 'Nothing yet'}</p>
        </div>
        <div className="col-span-2 sm:col-span-1 sm:text-right border-t sm:border-t-0 sm:border-l border-white/15 pt-3 sm:pt-0 sm:pl-4">
          <p className="text-[10px] uppercase tracking-wider text-blue-200 font-bold">Total due now</p>
          <p className={`text-2xl font-bold font-mono ${totalDue > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{inr(Math.max(0, totalDue))}</p>
          <p className="text-[11px] text-blue-200">
            {totalDue > 0 ? 'Payable at reception (UPI, card or cash)' : (folio?.creditOwed || 0) > 0 ? `We owe you ${inr(folio!.creditOwed!)}: reception will refund it` : 'All dues cleared ✓'}
          </p>
        </div>
      </div>

      {/* Room bill */}
      <section className={card} aria-labelledby="room-bill-title">
        <div className="flex items-start justify-between gap-3 border-b border-sand-200 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E8EEFB] text-[#25479E] flex items-center justify-center shrink-0"><BedDouble className="w-5 h-5" /></div>
            <div>
              <h3 id="room-bill-title" className="font-serif font-bold text-lg text-[#0B1733]">Room bill</h3>
              <p className="text-xs text-gray-600">
                {booking.roomName} · {booking.totalNights} night{booking.totalNights === 1 ? '' : 's'} · {MEAL_PLAN_NAMES[booking.mealPlan] || booking.mealPlan}
              </p>
              <p className="text-[11px] text-gray-500">{fmtDate(booking.checkInDate)} → {fmtDate(booking.checkOutDate)}</p>
            </div>
          </div>
          {printBtn(room)}
        </div>
        <div className="divide-y divide-sand-100">
          {room.lines.map((l) => (
            <LineRow key={l.id} title={l.title} amount={l.amount} pending={l.pending} />
          ))}
        </div>
        <Totals bill={room} />
      </section>

      {/* Services bill */}
      <section className={card} aria-labelledby="services-bill-title">
        <div className="flex items-start justify-between gap-3 border-b border-sand-200 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center shrink-0"><ConciergeBell className="w-5 h-5" /></div>
            <div>
              <h3 id="services-bill-title" className="font-serif font-bold text-lg text-[#0B1733]">Services bill</h3>
              <p className="text-xs text-gray-600">Food orders, transfers, rentals and special requests</p>
            </div>
          </div>
          {services.lines.length > 0 && printBtn(services)}
        </div>
        {grouped.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-500">No services ordered yet. Anything you order from the dining, transfers or celebrations tabs appears here.</p>
        ) : (
          grouped.map(({ g, lines }) => {
            const Icon = GROUP_ICON[g];
            const sum = lines.reduce((s, l) => s + l.amount, 0);
            return (
              <div key={g} className="pt-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <span className="inline-flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {SERVICE_GROUP_NAMES[g]}</span>
                  <span className="font-mono">{inr(sum)}</span>
                </div>
                <div className="divide-y divide-sand-100">
                  {lines.map((l) => (
                    <LineRow key={l.id} title={l.title} sub={fmtDate(l.date)} amount={l.amount} pending={l.pending} />
                  ))}
                </div>
              </div>
            );
          })
        )}
        <Totals bill={services} />
      </section>

      <p className="text-[11px] text-gray-500 flex items-start gap-1.5 px-1">
        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Payments are applied to the room bill first, then to services. Items marked “awaiting confirmation” are not billed until our team confirms them.
      </p>
    </div>
  );
}
