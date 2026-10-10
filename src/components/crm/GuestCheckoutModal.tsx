'use client';

import { useSiteContact } from '@/lib/contact';
import React, { useState, useMemo } from 'react';
import {
  X,
  ShieldCheck,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  CheckCircle2,
  AlertTriangle,
  UtensilsCrossed,
  Sparkles,
  Truck,
  Car,
  BedDouble,
  Clock,
  Printer,
  UserCheck,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { CRMBooking, PaymentMethod } from '@/types/crm';
import { folioForBooking } from '@/lib/folio-links';
import { SERVICE_GROUP_NAMES, serviceGroup } from '@/lib/guest-bills';
import FolioLinesPanel from './FolioLinesPanel';

interface GuestCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: CRMBooking | null;
}

export default function GuestCheckoutModal({ isOpen, onClose, booking }: GuestCheckoutModalProps) {
  const siteContact = useSiteContact();
  const {
    folios,
    currentUser,
    completeCheckoutWithSettlement,
    addFolioPayment,
    showToast,
  } = useCRM();
  const isManager = currentUser?.role === 'manager';

  // Find folio for this booking
  const folio = useMemo(() => folioForBooking(folios, booking), [folios, booking]);

  // The signer is always the signed-in account (no switching to another person's name)
  const activeManager = currentUser || { id: '', fullName: 'Staff', role: 'manager' as const };

  const balanceDue = folio ? folio.balanceDue : 0;

  // Collection Form State
  const [collectionAmount, setCollectionAmount] = useState<number>(() => balanceDue);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [transactionRef, setTransactionRef] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettledSuccess, setIsSettledSuccess] = useState(false);
  const [dueAfterCheckout, setDueAfterCheckout] = useState(0);
  const [signOff, setSignOff] = useState(false);

  // Sync default collection amount when folio changes
  React.useEffect(() => {
    if (folio) {
      setCollectionAmount(folio.balanceDue);
    }
  }, [folio]);

  if (!isOpen || !booking) return null;

  const isInHouse = booking.bookingStatus === 'checked_in';
  // Managers record money. After checkout they can still collect whatever the guest owes.
  const canCollect =
    isManager && booking.bookingStatus !== 'cancelled' && (booking.bookingStatus !== 'checked_out' || balanceDue > 0);
  const amountNow = isManager ? Number(collectionAmount) || 0 : 0;
  const leftDue = Math.max(0, Math.round((balanceDue - amountNow) * 100) / 100);

  /** Manager records a signed collection without checking the guest out (advance / part payment). */
  const handleCollectOnly = () => {
    const amount = Number(collectionAmount) || 0;
    if (!folio || amount <= 0) {
      showToast('Enter the amount received.', 'error');
      return;
    }
    if (!signOff) {
      showToast('Tick the confirmation to sign this collection.', 'error');
      return;
    }
    addFolioPayment(folio.id, {
      folioId: folio.id,
      amount,
      paymentMethod,
      transactionReference: transactionRef.trim() || undefined,
      receiptNotes: checkoutNotes.trim() || 'Collection recorded at the desk',
      signOffConfirmed: true,
    });
    setSignOff(false);
    setTransactionRef('');
    setCheckoutNotes('');
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isInHouse) {
      showToast('Only an in-house guest can be checked out.', 'error');
      return;
    }
    if ((folio?.pendingTotal || 0) > 0) {
      showToast('Some orders or transfers are still awaiting confirmation. Approve or reject them first.', 'error');
      return;
    }
    if (collectionAmount < 0) {
      alert('Collection amount cannot be negative.');
      return;
    }
    const amountToCollect = isManager ? Number(collectionAmount) || 0 : 0;
    if (amountToCollect > 0 && !signOff) {
      showToast('Tick the confirmation to sign the amount collected.', 'error');
      return;
    }

    // Leaving money due is allowed (it becomes a receivable), but only with a reason.
    if (balanceDue - amountToCollect > 0.009 && checkoutNotes.trim().length < 3) {
      showToast(
        `₹${(balanceDue - amountToCollect).toLocaleString('en-IN')} would stay due after checkout. Write the reason in the notes (e.g. "paying by bank transfer tomorrow").`,
        'error'
      );
      return;
    }

    setIsProcessing(true);

    try {
      completeCheckoutWithSettlement(booking.id, {
        paymentMethod,
        amountCollected: amountToCollect,
        transactionReference: transactionRef.trim() || undefined,
        notes: checkoutNotes.trim() || undefined,
        managerId: activeManager.id,
        managerName: activeManager.fullName,
        signOffConfirmed: signOff,
      });

      setDueAfterCheckout(Math.max(0, Math.round((balanceDue - amountToCollect) * 100) / 100));
      setIsSettledSuccess(true);
      showToast(
        `Guest ${booking.guest.fullName} (Room ${booking.roomNumber}) successfully checked out by ${activeManager.fullName}!`
      );
    } catch (err) {
      alert('Failed to process checkout. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintFolio = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-[#E5DEC9] overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-[#142820] via-[#1E3A2F] to-[#142820] text-white p-4 sm:p-5 flex items-center justify-between border-b border-[#1E3A2F] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1E3A2F] border border-[#C5A059]/40 text-[#C5A059] flex items-center justify-center font-bold shadow-xs shrink-0">
              <Receipt className="w-5 h-5 text-[#C5A059]" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base sm:text-lg text-white flex items-center space-x-2">
                <span>Guest Checkout &amp; Dues Settlement</span>
                <span className="text-xs font-sans font-bold px-2 py-0.5 rounded-full bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30">
                  Room {booking.roomNumber}
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-[#A3B899]">
                Review all stay bills, verify dues &amp; log collection to Manager profile
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout modal"
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition-all border border-white/20 shrink-0 cursor-pointer shadow-xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-[#142820]">
          {/* Guest Stay Brief */}
          <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E5DEC9] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-[#5C6D66] uppercase font-bold block">Guest Name</span>
              <span className="font-bold text-[#142820] text-sm">{booking.guest.fullName}</span>
              <span className="text-[11px] text-[#5C6D66] block">{booking.guest.phone}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#5C6D66] uppercase font-bold block">Room &amp; Plan</span>
              <span className="font-bold text-[#142820]">Room {booking.roomNumber}</span>
              <span className="text-[11px] text-[#5C6D66] block">{booking.mealPlan} Plan</span>
            </div>
            <div>
              <span className="text-[10px] text-[#5C6D66] uppercase font-bold block">Dates of Stay</span>
              <span className="font-bold text-[#142820]">
                {booking.checkInDate} → {booking.checkOutDate}
              </span>
              <span className="text-[11px] text-[#5C6D66] block">{booking.totalNights} Nights</span>
            </div>
            <div>
              <span className="text-[10px] text-[#5C6D66] uppercase font-bold block">Folio Reference</span>
              <span className="font-mono font-bold text-[#142820]">
                {folio?.folioNumber || `FOL-${booking.roomNumber}`}
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded inline-block uppercase ${
                  folio?.status === 'settled'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {folio?.status || 'Open'}
              </span>
            </div>
          </div>

          {/* The bill exactly as stored, with the desk actions */}
          <FolioLinesPanel folio={folio} booking={booking} />

          {(folio?.pendingTotal || 0) > 0 && booking.bookingStatus === 'checked_in' && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
              <span>
                ₹{(folio?.pendingTotal || 0).toLocaleString('en-IN')} of orders or transfers are still awaiting confirmation. Approve (to bill them) or reject them in Orders before checking out.
              </span>
            </div>
          )}

          {/* CHECKOUT SETTLEMENT FORM */}
          {!isSettledSuccess ? (
            <form onSubmit={handleCheckoutSubmit} className="space-y-4 pt-2">
              {/* Who signs: the signed-in account (collections are manager-only) */}
              <div className="bg-primary-50/60 p-4 rounded-2xl border border-primary-200 flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-primary-700 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-primary-900 uppercase tracking-wider block">
                    {isManager ? 'Signed by (your account)' : 'Viewing as'}
                  </span>
                  <span className="text-xs font-bold text-forest-950">
                    {activeManager.fullName} ({activeManager.role})
                  </span>
                  {!isManager && (
                    <span className="block text-[11px] text-forest-700 mt-0.5">
                      Collections are recorded only by a manager account, with their sign-off.
                    </span>
                  )}
                </div>
              </div>

              {/* Payment Collection Inputs */}
              {canCollect && (
                <div className="space-y-3 p-4 rounded-2xl border border-sand-200 bg-white">
                  <h4 className="font-serif font-bold text-xs uppercase text-forest-950 tracking-wider">
                    {isInHouse ? 'Record collection' : 'Record advance / payment'}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-forest-700 block mb-1">
                        Amount to Collect (₹) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={collectionAmount}
                        onChange={(e) => setCollectionAmount(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm font-mono font-bold border border-sand-300 rounded-xl focus:ring-2 focus:ring-[#25479E] focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-forest-700 block mb-1">
                        Payment Mode *
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('upi')}
                          className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                            paymentMethod === 'upi'
                              ? 'bg-[#25479E] text-white border-[#25479E]'
                              : 'bg-sand-50 text-forest-800 border-sand-200 hover:bg-sand-100'
                          }`}
                        >
                          <Smartphone className="w-4 h-4" />
                          <span className="text-[10px]">UPI</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('cash')}
                          className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                            paymentMethod === 'cash'
                              ? 'bg-[#25479E] text-white border-[#25479E]'
                              : 'bg-sand-50 text-forest-800 border-sand-200 hover:bg-sand-100'
                          }`}
                        >
                          <Banknote className="w-4 h-4" />
                          <span className="text-[10px]">Cash</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('card')}
                          className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                            paymentMethod === 'card'
                              ? 'bg-[#25479E] text-white border-[#25479E]'
                              : 'bg-sand-50 text-forest-800 border-sand-200 hover:bg-sand-100'
                          }`}
                        >
                          <CreditCard className="w-4 h-4" />
                          <span className="text-[10px]">Card</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('bank_transfer')}
                          className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 ${
                            paymentMethod === 'bank_transfer'
                              ? 'bg-[#25479E] text-white border-[#25479E]'
                              : 'bg-sand-50 text-forest-800 border-sand-200 hover:bg-sand-100'
                          }`}
                        >
                          <Building className="w-4 h-4" />
                          <span className="text-[10px]">Bank</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-forest-700 block mb-1">
                        UTR / Transaction Reference (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. GPay Ref 439201992"
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-sand-300 rounded-xl focus:ring-2 focus:ring-[#25479E] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-forest-700 block mb-1">
                        Settlement Notes
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Cleared at front desk, cash deposited"
                        value={checkoutNotes}
                        onChange={(e) => setCheckoutNotes(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-sand-300 rounded-xl focus:ring-2 focus:ring-[#25479E] focus:outline-none"
                      />
                    </div>
                  </div>

                  {Number(collectionAmount) > 0 && (
                    <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={signOff}
                        onChange={(e) => setSignOff(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-[#142820]"
                      />
                      <span>
                        I, <strong>{currentUser?.fullName}</strong>, confirm I received{' '}
                        <strong>₹{Number(collectionAmount).toLocaleString('en-IN')}</strong> by {paymentMethod.replace('_', ' ')} from this guest.
                        This entry is signed with my account and the server time.
                      </span>
                    </label>
                  )}

                  {!isInHouse && (
                    <button
                      type="button"
                      onClick={handleCollectOnly}
                      className="w-full min-h-[44px] rounded-xl bg-[#142820] text-white text-xs font-bold hover:bg-[#1E3A2F]"
                    >
                      Record ₹{(Number(collectionAmount) || 0).toLocaleString('en-IN')} (signed)
                    </button>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              {isInHouse && !canCollect && balanceDue > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-forest-700 block mb-1">Reason the guest leaves with money due *</label>
                  <input
                    type="text"
                    placeholder="e.g. Paying by bank transfer tomorrow; manager Pema to collect"
                    value={checkoutNotes}
                    onChange={(e) => setCheckoutNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-sand-300 rounded-xl focus:ring-2 focus:ring-[#25479E] focus:outline-none"
                  />
                </div>
              )}
              {isInHouse && leftDue > 0 && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-1">
                  <p className="font-bold">₹{leftDue.toLocaleString('en-IN')} will stay due on this bill after checkout.</p>
                  <p>
                    {isManager
                      ? 'Write the reason in the notes. You can record the payment later from Bookings → Collect due.'
                      : 'Admin accounts can’t record money. Ask a manager to collect it now, or write the reason in the notes; a manager can record the payment later from Bookings → Collect due.'}
                  </p>
                </div>
              )}
              {!isInHouse && booking.bookingStatus === 'checked_out' && balanceDue > 0 && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                  <p className="font-bold">The guest has checked out and still owes ₹{balanceDue.toLocaleString('en-IN')}.</p>
                  {booking.checkoutNote && <p>Note at checkout: {booking.checkoutNote}</p>}
                  {!isManager && <p>A manager records the payment when it arrives (Bookings → Collect due).</p>}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-sand-300 text-xs font-bold text-forest-700 hover:bg-sand-100 transition-colors cursor-pointer"
                >
                  {isInHouse ? <>Cancel &amp; Keep In-House</> : 'Close'}
                </button>

                {isInHouse && canCollect && Number(collectionAmount) > 0 && (
                  <button
                    type="button"
                    onClick={handleCollectOnly}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#142820] text-xs font-bold text-[#142820] hover:bg-sand-100"
                  >
                    Record payment only
                  </button>
                )}
                {isInHouse && (
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>
                    {isProcessing
                      ? 'Recording Settlement...'
                      : leftDue > 0
                      ? amountNow > 0
                        ? `Collect ₹${amountNow.toLocaleString('en-IN')} & Check out (₹${leftDue.toLocaleString('en-IN')} stays due)`
                        : `Check out (₹${leftDue.toLocaleString('en-IN')} stays due)`
                      : amountNow > 0
                      ? `Collect ₹${amountNow.toLocaleString('en-IN')} & Check out`
                      : 'Complete Checkout & Release Room'}
                  </span>
                </button>
                )}
              </div>
            </form>
          ) : (
            /* Checkout Success State */
            <div className={`p-6 rounded-2xl border text-center space-y-3 ${dueAfterCheckout > 0 ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-300'}`}>
              <CheckCircle2 className={`w-12 h-12 mx-auto ${dueAfterCheckout > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
              <h4 className="font-serif font-bold text-base text-emerald-950">
                {dueAfterCheckout > 0
                  ? `Checked out. ₹${dueAfterCheckout.toLocaleString('en-IN')} is still due.`
                  : 'Checked out. The bill is settled.'}
              </h4>
              <p className="text-xs text-emerald-900 max-w-md mx-auto">
                Room {booking.roomNumber} has been marked vacant dirty and turnover cleaning scheduled.
                {dueAfterCheckout > 0 && ' The bill stays open until a manager records the payment (Bookings → Collect due).'}
              </p>
              <div className="flex items-center justify-center space-x-3 pt-2">
                <button
                  onClick={handlePrintFolio}
                  className="px-4 py-2 rounded-xl bg-white border border-[#E5DEC9] text-[#142820] font-bold text-xs flex items-center space-x-1.5 shadow-2xs hover:bg-[#FAF8F5] cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-[#C5A059]" />
                  <span>Print Final Invoice</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-[#142820] text-white font-bold text-xs shadow hover:bg-[#1E3A2F] cursor-pointer"
                >
                  Done &amp; Close
                </button>
              </div>
            </div>
          )}

          {/* Official Printable Luxury Homestay Tax Invoice (Formatted for A4 / Letter Print) */}
          <div id="savera-printable-invoice" className="hidden print:block p-8 bg-white text-black font-sans">
            {/* Letterhead */}
            <div className="border-b-2 border-[#142820] pb-4 mb-6 flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#142820] uppercase font-serif">
                  Savera Boutique Homestay
                </h1>
                <p className="text-xs text-gray-600 mt-0.5">
                  Lava - Rishyap Hilltop Ridge, Kalimpong District, West Bengal - 734319
                </p>
                {(folio?.totalTax || 0) > 0 && (
                  <p className="text-xs text-gray-600">
                    GSTIN: 19AAAFS8821Q1Z8 • Phone: {siteContact.frontDeskPhone} • reservations@saverahomestay.in
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold block">
                  {(folio?.totalTax || 0) > 0 ? 'Official Guest Tax Invoice' : 'Guest Bill'}
                </span>
                <span className="text-base font-mono font-bold block text-[#142820]">
                  {folio?.folioNumber || `INV-${booking.bookingReference}`}
                </span>
                <span className="text-xs text-gray-600">
                  Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Guest & Stay Meta Grid */}
            <div className="grid grid-cols-2 gap-4 pb-4 mb-6 border-b border-gray-200 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-500 block">Billed To:</span>
                <span className="font-bold text-sm block">{booking.guest.fullName}</span>
                <span>Contact: {booking.guest.phone}</span>
                {booking.guest.city && <span className="block">Location: {booking.guest.city}</span>}
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">Reservation Details:</span>
                <span className="font-semibold block">Room {booking.roomNumber} ({booking.roomName})</span>
                <span>Stay: {booking.checkInDate} to {booking.checkOutDate} ({booking.totalNights} Nights)</span>
                <span className="block">Meal Plan: {booking.mealPlan}</span>
              </div>
            </div>

            {/* Itemized Table */}
            <table className="w-full text-left text-xs mb-6 border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 text-gray-700">
                  <th className="py-2 font-bold uppercase text-[10px]">Description</th>
                  <th className="py-2 font-bold uppercase text-[10px]">Category</th>
                  <th className="py-2 text-right font-bold uppercase text-[10px]">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(folio?.charges || [])
                  .filter((c) => c.chargeStatus === 'posted')
                  .map((c) => (
                    <tr key={c.id}>
                      <td className="py-2.5">{c.title}</td>
                      <td className="py-2.5 text-gray-600">
                        {c.category === 'room_tariff' ? 'Room accommodation' : SERVICE_GROUP_NAMES[serviceGroup(c)]}
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold">₹{c.amount.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                {(folio?.discountAmount || 0) > 0 && (
                  <tr>
                    <td className="py-2.5">Discount{folio?.discountReason ? ` (${folio.discountReason})` : ''}</td>
                    <td className="py-2.5 text-gray-600">Discount</td>
                    <td className="py-2.5 text-right font-mono font-semibold">−₹{(folio?.discountAmount || 0).toLocaleString('en-IN')}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Tax & Reconciliation Summary */}
            <div className="border-t-2 border-gray-300 pt-4 flex justify-end">
              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span className="font-mono">
                    ₹{((folio?.totalRoomCharges || 0) + (folio?.totalFbCharges || 0) + (folio?.totalAddonCharges || 0)).toLocaleString('en-IN')}
                  </span>
                </div>
                {(folio?.totalTax || 0) > 0 && (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>CGST:</span>
                      <span className="font-mono">₹{((folio?.totalTax || 0) / 2).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>SGST:</span>
                      <span className="font-mono">₹{((folio?.totalTax || 0) / 2).toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold text-sm text-[#142820] pt-1 border-t border-gray-200">
                  <span>Grand Total:</span>
                  <span className="font-mono">₹{(folio?.netPayable || booking.totalRoomAmount).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-semibold">
                  <span>Payments Received:</span>
                  <span className="font-mono">- ₹{(folio?.totalPaid || booking.advancePaid || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-gray-800 font-semibold">
                  <span>Departure Settlement:</span>
                  <span className="font-mono">₹{collectionAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-emerald-900 bg-emerald-50 p-2 rounded border border-emerald-200">
                  <span>Balance Due:</span>
                  <span className="font-mono">{(folio?.balanceDue || 0) > 0 ? `₹${(folio?.balanceDue || 0).toLocaleString('en-IN')}` : '₹0.00 (Fully Settled)'}</span>
                </div>
              </div>
            </div>

            {/* Signatures & Seal */}
            <div className="mt-12 pt-6 border-t border-gray-300 flex justify-between items-end text-xs text-gray-600">
              <div className="text-center w-48">
                <div className="h-10 border-b border-gray-400 mb-1" />
                <span>Guest Signature</span>
              </div>
              <div className="text-center w-56">
                <div className="h-10 border-b border-gray-400 mb-1 flex items-end justify-center pb-1 font-mono text-[10px] text-gray-700">
                  {activeManager.fullName} (Duty Manager)
                </div>
                <span>Authorized Signatory &amp; Stamp</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
