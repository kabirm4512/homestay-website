'use client';

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

interface GuestCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: CRMBooking | null;
}

export default function GuestCheckoutModal({ isOpen, onClose, booking }: GuestCheckoutModalProps) {
  const {
    folios,
    foodOrders,
    dispatchRequests,
    currentUser,
    staffAccounts,
    completeCheckoutWithSettlement,
    showToast,
  } = useCRM();

  // Find folio for this booking
  const folio = useMemo(() => {
    if (!booking) return null;
    return (
      folios.find(
        (f) =>
          f.bookingId === booking.id ||
          (booking.roomNumber && f.roomNumber === booking.roomNumber)
      ) || null
    );
  }, [folios, booking]);

  // Active Manager info (support multi-manager handover)
  const [selectedManagerId, setSelectedManagerId] = useState<string>(() => {
    return currentUser?.id || 'staff-1';
  });

  const activeManager = useMemo(() => {
    return (
      staffAccounts.find((s) => s.id === selectedManagerId) ||
      currentUser || {
        id: 'staff-1',
        fullName: 'Boutique Duty Manager',
        role: 'manager',
      }
    );
  }, [staffAccounts, selectedManagerId, currentUser]);

  // Calculate bill items
  const billBreakdown = useMemo(() => {
    if (!folio) {
      return {
        roomCharges: [] as any[],
        fbCharges: [] as any[],
        specialCharges: [] as any[],
        transportCharges: [] as any[],
        miscCharges: [] as any[],
      };
    }

    const roomCharges = folio.charges.filter(
      (c) => c.category === 'room_tariff' && c.chargeStatus !== 'void'
    );
    const fbCharges = folio.charges.filter(
      (c) => c.category === 'food_beverage' && c.chargeStatus !== 'void'
    );
    const transportCharges = folio.charges.filter(
      (c) =>
        ['transport_transfer', 'vehicle_rental'].includes(c.category) &&
        c.chargeStatus !== 'void'
    );
    const specialCharges = folio.charges.filter(
      (c) =>
        c.title.toLowerCase().includes('celebration') ||
        c.title.includes('🎉') ||
        (c.category === 'miscellaneous' && c.chargeStatus !== 'void')
    );
    const miscCharges = folio.charges.filter(
      (c) =>
        c.category === 'laundry' ||
        (!c.title.toLowerCase().includes('celebration') &&
          !c.title.includes('🎉') &&
          c.category === 'miscellaneous' &&
          c.chargeStatus !== 'void')
    );

    return {
      roomCharges,
      fbCharges,
      specialCharges,
      transportCharges,
      miscCharges,
    };
  }, [folio]);

  // Related orders list
  const relatedFoodOrders = useMemo(() => {
    if (!booking) return [];
    return foodOrders.filter(
      (o) =>
        (o.bookingId === booking.id || o.roomNumber === booking.roomNumber) &&
        o.status !== 'cancelled'
    );
  }, [foodOrders, booking]);

  // Related dispatches
  const relatedDispatches = useMemo(() => {
    if (!booking) return [];
    return dispatchRequests.filter(
      (d) =>
        (d.bookingId === booking.id || d.roomNumber === booking.roomNumber) &&
        d.dispatchStatus !== 'cancelled'
    );
  }, [dispatchRequests, booking]);

  const balanceDue = folio ? folio.balanceDue : 0;

  // Collection Form State
  const [collectionAmount, setCollectionAmount] = useState<number>(() => balanceDue);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [transactionRef, setTransactionRef] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettledSuccess, setIsSettledSuccess] = useState(false);

  // Sync default collection amount when folio changes
  React.useEffect(() => {
    if (folio) {
      setCollectionAmount(folio.balanceDue);
    }
  }, [folio]);

  if (!isOpen || !booking) return null;

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (collectionAmount < 0) {
      alert('Collection amount cannot be negative.');
      return;
    }

    if (balanceDue > 0 && collectionAmount === 0 && !checkoutNotes.trim()) {
      const confirmZero = confirm(
        `There is an outstanding balance of ₹${balanceDue.toLocaleString(
          'en-IN'
        )}. Are you sure you want to complete checkout with ₹0 collected? Please provide a reason in notes.`
      );
      if (!confirmZero) return;
    }

    setIsProcessing(true);

    try {
      completeCheckoutWithSettlement(booking.id, {
        paymentMethod,
        amountCollected: Number(collectionAmount) || 0,
        transactionReference: transactionRef.trim() || undefined,
        notes: checkoutNotes.trim() || undefined,
        managerId: activeManager.id,
        managerName: activeManager.fullName,
      });

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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-sand-300 overflow-hidden my-6 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-[#0B1733] via-[#12234D] to-[#25479E] text-white p-5 flex items-center justify-between border-b border-primary-900 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-forest-950 flex items-center justify-center font-bold shadow-xs">
              <Receipt className="w-5 h-5 text-forest-950" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-white flex items-center space-x-2">
                <span>Guest Checkout &amp; Dues Settlement</span>
                <span className="text-xs font-sans font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  Room {booking.roomNumber}
                </span>
              </h3>
              <p className="text-xs text-sand-300">
                Review all stay bills, verify dues &amp; log collection to Manager profile.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-white/10 text-sand-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-forest-950">
          {/* Guest Stay Brief */}
          <div className="bg-sand-50/80 p-4 rounded-2xl border border-sand-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-forest-600 uppercase font-bold block">Guest Name</span>
              <span className="font-bold text-forest-950 text-sm">{booking.guest.fullName}</span>
              <span className="text-[11px] text-forest-600 block">{booking.guest.phone}</span>
            </div>
            <div>
              <span className="text-[10px] text-forest-600 uppercase font-bold block">Room &amp; Plan</span>
              <span className="font-bold text-forest-950">Room {booking.roomNumber}</span>
              <span className="text-[11px] text-forest-600 block">{booking.mealPlan} Plan</span>
            </div>
            <div>
              <span className="text-[10px] text-forest-600 uppercase font-bold block">Dates of Stay</span>
              <span className="font-bold text-forest-950">
                {booking.checkInDate} → {booking.checkOutDate}
              </span>
              <span className="text-[11px] text-forest-600 block">{booking.totalNights} Nights</span>
            </div>
            <div>
              <span className="text-[10px] text-forest-600 uppercase font-bold block">Folio Reference</span>
              <span className="font-mono font-bold text-forest-950">
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

          {/* ITEM AUDIT 1: ROOM CHARGES */}
          <div className="border border-sand-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="bg-sand-100/60 px-4 py-2.5 flex items-center justify-between border-b border-sand-200">
              <span className="text-xs font-bold text-forest-950 flex items-center space-x-1.5">
                <BedDouble className="w-4 h-4 text-primary-700" />
                <span>Room Stay &amp; Extra Guest Charges</span>
              </span>
              <span className="font-mono text-xs font-bold text-forest-950">
                ₹{folio ? folio.totalRoomCharges : booking.totalRoomAmount}
              </span>
            </div>
            <div className="p-3 bg-white text-xs space-y-1.5">
              <div className="flex justify-between text-forest-700">
                <span>
                  Room Stay ({booking.totalNights} nights @ ₹{booking.roomRatePerNight.toLocaleString('en-IN')})
                </span>
                <span className="font-mono">
                  ₹{(booking.totalNights * booking.roomRatePerNight).toLocaleString('en-IN')}
                </span>
              </div>
              {(booking.totalExtraCharges || 0) > 0 && (
                <div className="flex justify-between text-emerald-800">
                  <span>Additional Guests / Child Rollaway Surcharge</span>
                  <span className="font-mono font-semibold">
                    ₹{booking.totalExtraCharges?.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ITEM AUDIT 2: FOOD & BEVERAGE BILLS */}
          <div className="border border-sand-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="bg-sand-100/60 px-4 py-2.5 flex items-center justify-between border-b border-sand-200">
              <span className="text-xs font-bold text-forest-950 flex items-center space-x-1.5">
                <UtensilsCrossed className="w-4 h-4 text-amber-600" />
                <span>In-Room Dining &amp; QR Food Bills</span>
              </span>
              <span className="font-mono text-xs font-bold text-forest-950">
                ₹{folio ? folio.totalFbCharges : 0}
              </span>
            </div>
            <div className="p-3 bg-white text-xs space-y-2">
              {relatedFoodOrders.length === 0 ? (
                <p className="text-forest-500 italic">No food orders recorded during this stay.</p>
              ) : (
                relatedFoodOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="flex items-start justify-between border-b border-sand-100 pb-1.5 last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-[11px] bg-sand-200 px-1.5 py-0.2 rounded text-forest-800">
                          {ord.orderNumber}
                        </span>
                        <span className="font-semibold text-forest-900">
                          {ord.items?.map((i) => `${i.quantity}x ${i.itemName || (i as any).name}`).join(', ')}
                        </span>
                      </div>
                      {ord.specialInstructions && (
                        <p className="text-[10px] text-forest-600 mt-0.5">
                          Note: {ord.specialInstructions}
                        </p>
                      )}
                    </div>
                    <span className="font-mono font-bold text-forest-950">₹{ord.totalAmount}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ITEM AUDIT 3: SPECIAL CELEBRATIONS & TRANSFERS */}
          {(billBreakdown.specialCharges.length > 0 || relatedDispatches.length > 0) && (
            <div className="border border-sand-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="bg-sand-100/60 px-4 py-2.5 flex items-center justify-between border-b border-sand-200">
                <span className="text-xs font-bold text-forest-950 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-[#FE6E00]" />
                  <span>Celebration Add-ons, Transfers &amp; Rentals</span>
                </span>
                <span className="font-mono text-xs font-bold text-forest-950">
                  ₹{folio ? folio.totalAddonCharges : 0}
                </span>
              </div>
              <div className="p-3 bg-white text-xs space-y-2">
                {billBreakdown.specialCharges.map((chg, idx) => (
                  <div key={idx} className="flex justify-between text-forest-800">
                    <span className="font-semibold flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>{chg.title}</span>
                    </span>
                    <span className="font-mono font-bold">₹{chg.amount}</span>
                  </div>
                ))}
                {relatedDispatches.map((disp) => (
                  <div key={disp.id} className="flex justify-between text-forest-800">
                    <span className="font-semibold flex items-center space-x-1">
                      <Car className="w-3.5 h-3.5 text-primary-600" />
                      <span>
                        {disp.serviceType === 'point_to_point' ? 'Transfer' : 'Rental'}:{' '}
                        {disp.routeTitle || disp.rentalVehicleName}
                      </span>
                    </span>
                    <span className="font-mono font-bold">₹{disp.quotedPrice}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FINANCIAL SUMMARY & BALANCE BANNER */}
          <div className="bg-sand-50 p-4 rounded-2xl border border-sand-300 space-y-2">
            <div className="flex justify-between text-xs text-forest-700">
              <span>Total Stay &amp; Services Subtotal</span>
              <span className="font-mono">
                ₹{((folio?.totalRoomCharges || 0) + (folio?.totalFbCharges || 0) + (folio?.totalAddonCharges || 0)).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between text-xs text-forest-700">
              <span>Applicable GST / Homestay Surcharges (5%)</span>
              <span className="font-mono">₹{(folio?.totalTax || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-forest-950 pt-2 border-t border-sand-200">
              <span>Net Payable Stay Total</span>
              <span className="font-mono text-base text-primary-900">
                ₹{(folio?.netPayable || booking.totalRoomAmount).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between text-xs text-emerald-800 font-medium">
              <span>Advance &amp; Prior Payments Received</span>
              <span className="font-mono">
                - ₹{(folio?.totalPaid || booking.advancePaid || 0).toLocaleString('en-IN')}
              </span>
            </div>

            {/* Dues Highlight Banner */}
            <div
              className={`p-3.5 rounded-xl border mt-2 flex items-center justify-between ${
                balanceDue > 0
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-950'
              }`}
            >
              <div className="flex items-center space-x-2">
                {balanceDue > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
                <div>
                  <span className="font-bold text-xs block">
                    {balanceDue > 0 ? 'Outstanding Balance Due for Settlement' : 'Folio Fully Settled & Clear'}
                  </span>
                  <span className="text-[11px] opacity-80">
                    {balanceDue > 0
                      ? 'Collect remaining dues before handing over final clearance.'
                      : 'No pending charges. Ready for final departure confirmation.'}
                  </span>
                </div>
              </div>
              <span className="font-serif font-bold text-xl font-mono">
                ₹{balanceDue.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* CHECKOUT SETTLEMENT FORM */}
          {!isSettledSuccess ? (
            <form onSubmit={handleCheckoutSubmit} className="space-y-4 pt-2">
              {/* Manager Profile Assignment */}
              <div className="bg-primary-50/60 p-4 rounded-2xl border border-primary-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <UserCheck className="w-5 h-5 text-primary-700 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-primary-900 uppercase tracking-wider block">
                      Duty Manager Handling Checkout
                    </span>
                    <span className="text-xs font-bold text-forest-950">
                      {activeManager.fullName} ({activeManager.role})
                    </span>
                  </div>
                </div>

                {staffAccounts.length > 1 && (
                  <div className="flex items-center space-x-1.5 self-start sm:self-auto">
                    <span className="text-[10px] text-forest-600 font-semibold">Switch Profile:</span>
                    <select
                      value={selectedManagerId}
                      onChange={(e) => setSelectedManagerId(e.target.value)}
                      className="text-xs font-semibold px-2 py-1 rounded-lg border border-primary-300 bg-white text-forest-900 focus:outline-none"
                    >
                      {staffAccounts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName} ({s.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Payment Collection Inputs */}
              {balanceDue > 0 && (
                <div className="space-y-3 p-4 rounded-2xl border border-sand-200 bg-white">
                  <h4 className="font-serif font-bold text-xs uppercase text-forest-950 tracking-wider">
                    Log Final Payment Collection
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-forest-700 block mb-1">
                        Amount to Collect (₹) *
                      </label>
                      <input
                        type="number"
                        min="0"
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
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-sand-300 text-xs font-bold text-forest-700 hover:bg-sand-100 transition-colors cursor-pointer"
                >
                  Cancel &amp; Keep In-House
                </button>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>
                    {isProcessing
                      ? 'Recording Settlement...'
                      : balanceDue > 0
                      ? `Collect ₹${collectionAmount.toLocaleString('en-IN')} & Complete Checkout`
                      : 'Complete Checkout & Release Room'}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            /* Checkout Success State */
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-300 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h4 className="font-serif font-bold text-base text-emerald-950">
                Checkout &amp; Folio Settlement Completed!
              </h4>
              <p className="text-xs text-emerald-900 max-w-md mx-auto">
                Room {booking.roomNumber} has been marked vacant dirty and turnover cleaning scheduled.
                Audit activity logged to Manager <strong>{activeManager.fullName}</strong>.
              </p>
              <div className="flex items-center justify-center space-x-3 pt-2">
                <button
                  onClick={handlePrintFolio}
                  className="px-4 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-900 font-bold text-xs flex items-center space-x-1.5 shadow-2xs hover:bg-emerald-50 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-emerald-700" />
                  <span>Print Final Invoice</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-emerald-700 text-white font-bold text-xs shadow hover:bg-emerald-600 cursor-pointer"
                >
                  Done &amp; Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
