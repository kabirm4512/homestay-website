'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  ChefHat,
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Check,
  X,
  BellRing,
  Coffee,
  Sparkles,
  PartyPopper,
  Layers,
  Filter,
  ShieldCheck,
  UserCheck,
  ClipboardCheck,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { FoodOrderStatus, MenuItem, FoodOrder } from '@/types/crm';

interface KitchenPortalProps {
  initialTab?: 'approvals' | 'orders' | 'mandate' | 'menu';
}

export default function KitchenPortal({ initialTab = 'orders' }: KitchenPortalProps) {
  const {
    bookings,
    foodOrders,
    menuItems,
    updateFoodOrderStatus,
    approveFoodOrder,
    rejectFoodOrder,
    toggleMenuItemAvailability,
    currentUser,
    showToast,
  } = useCRM();

  // Helper to determine if an order is waiting for manager approval
  const isPendingApproval = (ord: FoodOrder) => {
    return ord.status === 'pending_manager_approval' || ord.status === 'pending';
  };

  const unapprovedOrders = useMemo(() => {
    return foodOrders.filter(isPendingApproval);
  }, [foodOrders]);

  // Default active tab to 'approvals' if there are unapproved orders waiting for manager check
  const [activeTab, setActiveTab] = useState<'approvals' | 'orders' | 'mandate' | 'menu'>(() => {
    if (initialTab) return initialTab;
    return unapprovedOrders.length > 0 ? 'approvals' : 'orders';
  });

  const [orderFilter, setOrderFilter] = useState<'all' | 'cooking' | 'celebrations' | 'delivered'>('all');
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Helper to determine if an order is a special celebration package
  const isOrderCelebration = (ord: FoodOrder) => {
    return Boolean(
      ord.orderNumber?.startsWith('CEL-') ||
      ord.specialInstructions?.toLowerCase().includes('celebration') ||
      ord.specialInstructions?.includes('🎉') ||
      ord.items?.some(
        (i: any) =>
          (i.itemName || i.name || '').includes('🎉') ||
          (i.itemName || i.name || '').toLowerCase().includes('celebration') ||
          i.menuItemId === 'celebration-item'
      )
    );
  };

  // Only approved orders reach the kitchen live preparation line
  const approvedOrders = useMemo(() => {
    return foodOrders.filter((ord) => !isPendingApproval(ord) && ord.status !== 'cancelled');
  }, [foodOrders]);

  const activeCookingCount = useMemo(() => {
    return approvedOrders.filter((o) => ['accepted_kitchen', 'preparing', 'out_for_delivery'].includes(o.status)).length;
  }, [approvedOrders]);

  // Calculate Kitchen Mandate headcount tallies based on active checked-in or arriving bookings
  const mandateStats = useMemo(() => {
    const activeStays = bookings.filter((b) => ['checked_in', 'confirmed'].includes(b.tapeStatus));

    const counts = {
      CP: 0,
      MAP: 0,
      AP: 0,
      EP: 0,
      totalAdults: 0,
      totalChildren: 0,
      dietaryAlerts: [] as { guestName: string; roomNumber: number; alert: string; plan: string }[],
    };

    activeStays.forEach((b) => {
      counts[b.mealPlan] = (counts[b.mealPlan] || 0) + (b.adultsCount + b.childrenCount);
      counts.totalAdults += b.adultsCount;
      counts.totalChildren += b.childrenCount;

      if (b.guest.dietaryPreferences && b.guest.dietaryPreferences.trim() !== '') {
        counts.dietaryAlerts.push({
          guestName: b.guest.fullName,
          roomNumber: b.roomNumber,
          alert: b.guest.dietaryPreferences,
          plan: b.mealPlan,
        });
      }
    });

    return counts;
  }, [bookings]);

  // Aggregated live dish prep tallies across approved orders in cooking
  const activeDishTallies = useMemo(() => {
    const tallies: Record<
      string,
      { name: string; count: number; rooms: number[]; statuses: Record<string, number>; isCelebration: boolean }
    > = {};

    approvedOrders
      .filter((o) => ['accepted_kitchen', 'preparing', 'out_for_delivery'].includes(o.status))
      .forEach((o) => {
        const orderIsCel = isOrderCelebration(o);
        o.items?.forEach((item: any) => {
          const rawName = item.itemName || item.name || 'Special Dish';
          if (!tallies[rawName]) {
            tallies[rawName] = {
              name: rawName,
              count: 0,
              rooms: [],
              statuses: {},
              isCelebration: orderIsCel || rawName.includes('🎉'),
            };
          }
          const qty = item.quantity || 1;
          tallies[rawName].count += qty;
          if (!tallies[rawName].rooms.includes(o.roomNumber)) {
            tallies[rawName].rooms.push(o.roomNumber);
          }
          tallies[rawName].statuses[o.status] = (tallies[rawName].statuses[o.status] || 0) + qty;
        });
      });

    return Object.values(tallies).sort((a, b) => b.count - a.count);
  }, [approvedOrders]);

  // Approved celebrations list for Kitchen Mandates
  const celebrationOrders = useMemo(() => {
    return approvedOrders.filter(isOrderCelebration);
  }, [approvedOrders]);

  const pendingCelebrationsCount = useMemo(() => {
    return celebrationOrders.filter((ord) => ['accepted_kitchen', 'preparing'].includes(ord.status)).length;
  }, [celebrationOrders]);

  const nextStatusMap: Record<FoodOrderStatus, FoodOrderStatus | null> = {
    pending_manager_approval: 'accepted_kitchen',
    pending: 'accepted_kitchen',
    accepted_kitchen: 'preparing',
    preparing: 'out_for_delivery',
    out_for_delivery: 'delivered',
    delivered: null,
    cancelled: null,
  };

  const getStatusBadge = (status: FoodOrderStatus) => {
    switch (status) {
      case 'pending_manager_approval':
      case 'pending':
        return 'bg-amber-500 text-forest-950 animate-pulse font-extrabold';
      case 'accepted_kitchen':
        return 'bg-blue-600 text-white font-bold';
      case 'preparing':
        return 'bg-orange-500 text-white font-bold';
      case 'out_for_delivery':
        return 'bg-purple-600 text-white font-bold';
      case 'delivered':
        return 'bg-emerald-600 text-white font-bold';
      case 'cancelled':
        return 'bg-gray-400 text-white font-bold';
    }
  };

  // Filtered orders for the Live Orders tab
  const filteredLiveOrders = useMemo(() => {
    return approvedOrders.filter((ord) => {
      if (orderFilter === 'cooking') return ['accepted_kitchen', 'preparing'].includes(ord.status);
      if (orderFilter === 'celebrations') return isOrderCelebration(ord);
      if (orderFilter === 'delivered') return ord.status === 'delivered';
      return true;
    });
  }, [approvedOrders, orderFilter]);

  const formatOrderTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const activeManagerInfo = {
    id: currentUser?.id || 'staff-1',
    name: currentUser?.fullName || 'Duty Manager',
  };

  const handleApproveOrder = (ordId: string) => {
    approveFoodOrder(ordId, activeManagerInfo);
  };

  const handleConfirmReject = (ordId: string) => {
    if (!rejectionReason.trim()) {
      alert('Please specify a rejection reason (e.g. ingredient out of stock).');
      return;
    }
    rejectFoodOrder(ordId, rejectionReason.trim(), activeManagerInfo);
    setRejectingOrderId(null);
    setRejectionReason('');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-forest-950 via-forest-900 to-forest-800 text-white rounded-3xl p-6 shadow-md border border-forest-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-forest-950 flex items-center justify-center font-bold shadow-md shrink-0">
              <ChefHat className="w-7 h-7" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-xl text-white">
                Kitchen KDS &amp; Order Inventory Gate
              </h2>
              <p className="text-xs text-sand-300">
                Manager stock verification gate, live kitchen queue, batch prep &amp; meal plan mandates.
              </p>
            </div>
          </div>

          {/* Quick Sub-Tabs */}
          <div className="flex items-center space-x-1.5 bg-forest-800/80 p-1.5 rounded-2xl border border-forest-700/60 self-start sm:self-auto overflow-x-auto no-scrollbar">
            {/* TAB 1: MANAGER APPROVAL GATE */}
            <button
              onClick={() => setActiveTab('approvals')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'approvals'
                  ? 'bg-[#FE6E00] text-white shadow-sm'
                  : 'text-sand-200 hover:text-white hover:bg-forest-700/50'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Manager Approvals</span>
              {unapprovedOrders.length > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-600 text-white text-[10px] font-extrabold rounded-full animate-bounce">
                  {unapprovedOrders.length}
                </span>
              )}
            </button>

            {/* TAB 2: LIVE KITCHEN ORDERS */}
            <button
              onClick={() => setActiveTab('orders')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'bg-amber-500 text-forest-950 shadow-sm'
                  : 'text-sand-200 hover:text-white hover:bg-forest-700/50'
              }`}
            >
              <span>Live Kitchen KDS</span>
              {activeCookingCount > 0 && (
                <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[10px] font-extrabold rounded-full">
                  {activeCookingCount}
                </span>
              )}
            </button>

            {/* TAB 3: KITCHEN MANDATE */}
            <button
              onClick={() => setActiveTab('mandate')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'mandate'
                  ? 'bg-amber-500 text-forest-950 shadow-sm'
                  : 'text-sand-200 hover:text-white hover:bg-forest-700/50'
              }`}
            >
              <span>Kitchen Mandate</span>
              {pendingCelebrationsCount > 0 && (
                <span className="px-1.5 py-0.2 bg-[#FE6E00] text-white text-[10px] font-extrabold rounded-full flex items-center space-x-0.5">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>{pendingCelebrationsCount}</span>
                </span>
              )}
            </button>

            {/* TAB 4: MENU STOCK */}
            <button
              onClick={() => setActiveTab('menu')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'menu'
                  ? 'bg-amber-500 text-forest-950 shadow-sm'
                  : 'text-sand-200 hover:text-white hover:bg-forest-700/50'
              }`}
            >
              <span>Menu Stock</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          SUB-TAB 1: MANAGER APPROVAL & INVENTORY CHECK GATE
      ======================================================== */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-sand-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <ClipboardCheck className="w-5 h-5 text-[#FE6E00] shrink-0" />
              <div>
                <h3 className="font-serif font-bold text-base text-forest-950 leading-tight">
                  Manager Order Inventory Verification Gate
                </h3>
                <p className="text-[11px] text-forest-600 font-medium">
                  Verify stock portions before releasing orders to the kitchen cooking line.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="text-forest-600 font-medium">Manager on Duty:</span>
              <span className="font-bold text-primary-900 bg-primary-50 px-2 py-1 rounded-lg border border-primary-200 flex items-center space-x-1">
                <UserCheck className="w-3.5 h-3.5 text-primary-700" />
                <span>{activeManagerInfo.name}</span>
              </span>
            </div>
          </div>

          {unapprovedOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-sand-200 text-center shadow-xs space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h4 className="font-serif font-bold text-base text-forest-950">
                All Incoming Orders Verified &amp; Approved!
              </h4>
              <p className="text-xs text-forest-600 max-w-md mx-auto">
                There are no orders awaiting inventory check. New orders from room QR standees or the guest portal will appear here for manager release.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unapprovedOrders.map((ord) => {
                const isCel = isOrderCelebration(ord);

                return (
                  <div
                    key={ord.id}
                    className="bg-white rounded-3xl p-5 border-2 border-[#FE6E00]/60 ring-2 ring-orange-200/50 shadow-md flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-[#FE6E00] text-white">
                            {ord.orderNumber}
                          </span>
                          <span className="font-serif font-bold text-xs text-forest-950">
                            Room {ord.roomNumber}
                          </span>
                        </div>
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 animate-pulse">
                          Awaiting Approval
                        </span>
                      </div>

                      {/* Guest and Timestamps */}
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-forest-700 font-semibold">
                          Guest: <span className="text-forest-950 font-bold">{ord.guestName}</span>
                        </p>
                        {ord.createdAt && (
                          <span className="text-[10px] text-forest-500 font-mono flex items-center space-x-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{formatOrderTime(ord.createdAt)}</span>
                          </span>
                        )}
                      </div>

                      {/* Line Items */}
                      <div className="bg-sand-50 p-3 rounded-2xl border border-sand-200 text-xs space-y-2 mb-3">
                        {(ord.items || []).map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between border-b border-sand-200/60 pb-1 last:border-0 last:pb-0">
                            <div>
                              <span className="font-bold text-forest-950">
                                {item.quantity || 1}x {item.itemName || item.name}
                              </span>
                              {item.itemNotes && (
                                <p className="text-[10px] text-amber-800 font-medium italic mt-0.5">
                                  Note: {item.itemNotes}
                                </p>
                              )}
                            </div>
                            <span className="font-mono text-forest-800 font-semibold shrink-0">
                              ₹{item.lineTotal || (item.unitPrice || 0) * (item.quantity || 1)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Special instructions */}
                      {ord.specialInstructions && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-950 mb-3">
                          <strong>Guest / Chef Note:</strong> {ord.specialInstructions}
                        </div>
                      )}

                      {/* Manager Checklist Banner */}
                      <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-[11px] text-sky-950 mb-3 flex items-start space-x-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-sky-700 shrink-0 mt-0.5" />
                        <div>
                          <strong>Inventory Check:</strong> Verify raw ingredients, kitchen stock &amp; prep capacity before accepting.
                        </div>
                      </div>

                      {/* Reject Form Modal / Inline */}
                      {rejectingOrderId === ord.id && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs mb-3 space-y-2">
                          <label className="text-[11px] font-bold text-rose-900 block">
                            Rejection Reason (Out of Stock / Unavailable):
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Dish unavailable, contacted guest"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-rose-300 rounded-lg bg-white focus:outline-none"
                          />
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleConfirmReject(ord.id)}
                              className="px-3 py-1 bg-rose-600 text-white font-bold text-[11px] rounded-lg cursor-pointer hover:bg-rose-700"
                            >
                              Confirm Rejection
                            </button>
                            <button
                              onClick={() => setRejectingOrderId(null)}
                              className="px-2.5 py-1 text-forest-600 font-medium text-[11px] hover:underline cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-sand-200 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase block font-medium">Order Total</span>
                        <span className="font-mono font-bold text-sm text-forest-950">₹{ord.totalAmount}</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => setRejectingOrderId(ord.id)}
                          className="px-3 py-2 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 border border-rose-300 transition-colors cursor-pointer"
                        >
                          Reject / OOS
                        </button>

                        <button
                          onClick={() => handleApproveOrder(ord.id)}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
                        >
                          <Check className="w-4 h-4 text-emerald-200" />
                          <span>Approve &amp; Release</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          SUB-TAB 2: LIVE KITCHEN ORDERS (APPROVED ORDERS ONLY)
      ======================================================== */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Controls Bar & Filter Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-sand-200 shadow-2xs">
            <div className="flex items-center space-x-2">
              <BellRing className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <h3 className="font-serif font-bold text-base text-forest-950 leading-tight">
                  Kitchen Live Preparation Queue (Approved Orders)
                </h3>
                <p className="text-[11px] text-forest-600 font-medium">
                  Orders verified by manager. Advance stages as dishes are cooked and dispatched.
                </p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                onClick={() => setOrderFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  orderFilter === 'all'
                    ? 'bg-forest-900 text-sand-100 shadow-xs'
                    : 'bg-sand-100 text-forest-700 hover:bg-sand-200'
                }`}
              >
                All Approved ({approvedOrders.length})
              </button>
              <button
                onClick={() => setOrderFilter('cooking')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  orderFilter === 'cooking'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'bg-orange-50 text-orange-800 hover:bg-orange-100'
                }`}
              >
                Active Cooking ({activeCookingCount})
              </button>
              <button
                onClick={() => setOrderFilter('celebrations')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  orderFilter === 'celebrations'
                    ? 'bg-[#FE6E00] text-white shadow-xs'
                    : 'bg-orange-50 text-orange-800 hover:bg-orange-100'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>Celebrations ({celebrationOrders.length})</span>
              </button>
              <button
                onClick={() => setOrderFilter('delivered')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  orderFilter === 'delivered'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-sand-100 text-forest-700 hover:bg-sand-200'
                }`}
              >
                Delivered
              </button>
            </div>
          </div>

          {/* Orders Cards Grid */}
          {filteredLiveOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-sand-200 text-center shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-sand-100 text-forest-600 flex items-center justify-center mx-auto mb-3">
                <UtensilsCrossed className="w-7 h-7 text-forest-400" />
              </div>
              <h4 className="font-serif font-bold text-base text-forest-950 mb-1">
                No Orders in Kitchen Preparation Queue
              </h4>
              <p className="text-xs text-forest-600 max-w-md mx-auto">
                Orders approved by the manager from the &apos;Manager Approvals&apos; tab will immediately flow here for cooking.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLiveOrders.map((ord) => {
                const nextStatus = nextStatusMap[ord.status];
                const isCel = isOrderCelebration(ord);

                return (
                  <div
                    key={ord.id}
                    className={`bg-white rounded-3xl p-5 border transition-all flex flex-col justify-between shadow-xs ${
                      ord.status === 'delivered'
                        ? 'border-sand-200 opacity-75'
                        : ord.status === 'accepted_kitchen'
                        ? 'border-blue-400 ring-2 ring-blue-300/40 bg-gradient-to-b from-blue-50/20 to-white'
                        : ord.status === 'preparing'
                        ? 'border-orange-400 ring-2 ring-orange-300/40 bg-gradient-to-b from-orange-50/20 to-white'
                        : 'border-sand-300'
                    }`}
                  >
                    <div>
                      {/* Top Bar */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg ${
                              isCel
                                ? 'bg-gradient-to-r from-[#FE6E00] to-[#EA580C] text-white'
                                : 'bg-forest-900 text-sand-200'
                            }`}
                          >
                            {ord.orderNumber}
                          </span>
                          <span className="font-serif font-bold text-xs text-forest-950">
                            Room {ord.roomNumber}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${getStatusBadge(
                            ord.status
                          )}`}
                        >
                          {ord.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Guest and Approval Attribution */}
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-forest-700 font-semibold">
                          Guest: <span className="text-forest-950 font-bold">{ord.guestName}</span>
                        </p>
                        {ord.approvedByManagerName && (
                          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            ✓ {ord.approvedByManagerName}
                          </span>
                        )}
                      </div>

                      {/* Order Line Items */}
                      <div className="bg-sand-50/80 p-3 rounded-2xl border border-sand-200 text-xs space-y-2 mb-3">
                        {(ord.items || []).map((item: any, idx: number) => {
                          const displayName = item.itemName || item.name || 'Special Item';
                          const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
                          const qty = item.quantity || 1;
                          const lineTotal = Number(item.lineTotal ?? unitPrice * qty);

                          return (
                            <div
                              key={idx}
                              className="flex items-start justify-between border-b border-sand-200/60 pb-1.5 last:border-b-0 last:pb-0"
                            >
                              <div className="pr-2">
                                <span className="font-bold text-forest-950">
                                  {qty}x {displayName}
                                </span>
                                {item.itemNotes && (
                                  <p className="text-[10px] text-amber-800 font-medium italic mt-0.5">
                                    Note: {item.itemNotes}
                                  </p>
                                )}
                              </div>
                              <span className="font-mono text-forest-800 font-semibold shrink-0">
                                ₹{lineTotal}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Special Instructions */}
                      {ord.specialInstructions && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-900 mb-3 flex items-start space-x-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>Chef Note:</strong> {ord.specialInstructions}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Controls */}
                    <div className="pt-3 border-t border-sand-200 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase block font-medium">Total</span>
                        <span className="font-mono font-bold text-sm text-forest-950">
                          ₹{ord.totalAmount}
                        </span>
                      </div>

                      <div>
                        {nextStatus ? (
                          <button
                            onClick={() => updateFoodOrderStatus(ord.id, nextStatus)}
                            className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold bg-[#25479E] hover:bg-[#1A3478] active:scale-95 text-white shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4 text-emerald-300" />
                            <span>Advance to {nextStatus.replace(/_/g, ' ')}</span>
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                            Delivered ✓
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          SUB-TAB 3: KITCHEN & DINING MANDATE (ALL CHANNELS)
      ======================================================== */}
      {activeTab === 'mandate' && (
        <div className="space-y-6">
          {/* SECTION 1: MEAL PLAN HEADCOUNTS */}
          <div className="bg-white rounded-3xl p-6 border border-sand-200 shadow-xs">
            <h3 className="font-serif font-bold text-lg text-forest-950 mb-1 flex items-center space-x-2">
              <UtensilsCrossed className="w-5 h-5 text-amber-700" />
              <span>Today&apos;s Meal Plan Mandates (Headcount Tallies)</span>
            </h3>
            <p className="text-xs text-forest-700 mb-6">
              Official guest meal-plan tallies for prep rationing and kitchen procurement.
            </p>

            {/* Plan Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-amber-50/80 p-5 rounded-2xl border border-amber-200 text-center">
                <span className="text-[10px] font-mono uppercase font-bold text-amber-800 block">
                  CP (Continental Plan)
                </span>
                <span className="text-3xl font-serif font-bold text-amber-950 my-1 block">
                  {mandateStats.CP}
                </span>
                <span className="text-[11px] text-amber-800 font-medium">Room + Gourmet Breakfast</span>
              </div>

              <div className="bg-blue-50/80 p-5 rounded-2xl border border-blue-200 text-center">
                <span className="text-[10px] font-mono uppercase font-bold text-blue-800 block">
                  MAP (Modified American)
                </span>
                <span className="text-3xl font-serif font-bold text-blue-950 my-1 block">
                  {mandateStats.MAP}
                </span>
                <span className="text-[11px] text-blue-800 font-medium">Breakfast + Lunch / Dinner</span>
              </div>

              <div className="bg-emerald-50/80 p-5 rounded-2xl border border-emerald-200 text-center">
                <span className="text-[10px] font-mono uppercase font-bold text-emerald-800 block">
                  AP (Full Board American)
                </span>
                <span className="text-3xl font-serif font-bold text-emerald-950 my-1 block">
                  {mandateStats.AP}
                </span>
                <span className="text-[11px] text-emerald-800 font-medium">All 3 Meals Included</span>
              </div>

              <div className="bg-sand-100/80 p-5 rounded-2xl border border-sand-300 text-center">
                <span className="text-[10px] font-mono uppercase font-bold text-forest-700 block">
                  EP (European Plan)
                </span>
                <span className="text-3xl font-serif font-bold text-forest-950 my-1 block">
                  {mandateStats.EP}
                </span>
                <span className="text-[11px] text-forest-700 font-medium">Room Only (A La Carte)</span>
              </div>
            </div>

            {/* Total Headcount Summary */}
            <div className="mt-6 p-4 rounded-2xl bg-forest-900 text-sand-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-forest-800 flex items-center justify-center font-bold text-amber-300">
                  {mandateStats.totalAdults + mandateStats.totalChildren}
                </div>
                <div>
                  <span className="font-bold text-white text-sm block">Total Estate Dining Headcount</span>
                  <span className="text-xs text-sand-300">
                    {mandateStats.totalAdults} Adults, {mandateStats.totalChildren} Children in Residence
                  </span>
                </div>
              </div>
              <button
                onClick={() => showToast('Kitchen mandate summary exported to Chef kitchen tablet.')}
                className="min-h-[44px] px-4 py-2 bg-amber-500 hover:bg-amber-400 text-forest-950 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Print Kitchen Mandate Sheet
              </button>
            </div>
          </div>

          {/* SECTION 2: SPECIAL CELEBRATION & EVENT MANDATES */}
          <div className="bg-white rounded-3xl p-6 border border-sand-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h4 className="font-serif font-bold text-base text-forest-950 flex items-center space-x-2">
                  <PartyPopper className="w-5 h-5 text-[#FE6E00]" />
                  <span>Approved Celebration &amp; Event Mandates</span>
                  {celebrationOrders.length > 0 && (
                    <span className="text-[11px] font-mono bg-orange-100 text-orange-900 font-bold px-2 py-0.5 rounded-full">
                      {celebrationOrders.length} Bookings
                    </span>
                  )}
                </h4>
                <p className="text-xs text-forest-600">
                  Cakes, candlelight dinners, bonfire setups &amp; bespoke celebration requests approved by Manager.
                </p>
              </div>
            </div>

            {celebrationOrders.length === 0 ? (
              <div className="p-6 rounded-2xl bg-sand-50/70 border border-sand-200 text-center">
                <Sparkles className="w-6 h-6 text-amber-500 mx-auto mb-2 opacity-60" />
                <p className="text-xs text-forest-700 font-medium">
                  No active celebration mandates currently registered in kitchen.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {celebrationOrders.map((cel) => {
                  const nextStatus = nextStatusMap[cel.status];
                  return (
                    <div
                      key={cel.id}
                      className="p-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/50 via-white to-orange-50/30 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono font-bold bg-[#FE6E00] text-white px-2 py-0.5 rounded-md">
                              {cel.orderNumber}
                            </span>
                            <span className="font-bold text-xs text-forest-950">Room {cel.roomNumber}</span>
                          </div>
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${getStatusBadge(
                              cel.status
                            )}`}
                          >
                            {cel.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <p className="text-xs font-semibold text-forest-800 mb-2">
                          Guest: <span className="font-bold text-forest-950">{cel.guestName}</span>
                        </p>

                        <div className="space-y-1 mb-2.5">
                          {(cel.items || []).map((itm: any, idx: number) => (
                            <div key={idx} className="text-xs font-bold text-forest-950 flex items-center space-x-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{itm.itemName || itm.name || 'Celebration Item'}</span>
                            </div>
                          ))}
                        </div>

                        {cel.specialInstructions && (
                          <div className="p-2.5 rounded-xl bg-white border border-amber-200 text-[11px] text-amber-950 mb-3">
                            <strong>Mandate / Chef Timing:</strong> {cel.specialInstructions}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-forest-950">Total: ₹{cel.totalAmount}</span>
                        {nextStatus ? (
                          <button
                            onClick={() => updateFoodOrderStatus(cel.id, nextStatus)}
                            className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FE6E00] hover:bg-[#EA580C] text-white shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Advance: {nextStatus.replace(/_/g, ' ')}</span>
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Arranged ✓
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 3: ACTIVE KITCHEN PREP MANDATE (DISH BATCHING TALLY) */}
          <div className="bg-white rounded-3xl p-6 border border-sand-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h4 className="font-serif font-bold text-base text-forest-950 flex items-center space-x-2">
                  <Flame className="w-5 h-5 text-rose-600" />
                  <span>Active Live Orders Prep Mandate (Dish Batching)</span>
                </h4>
                <p className="text-xs text-forest-600">
                  Aggregated dish quantities from manager-approved orders for current batch cooking.
                </p>
              </div>
              <span className="text-xs text-forest-500 font-mono self-start sm:self-auto">
                {activeDishTallies.length} active dish varieties
              </span>
            </div>

            {activeDishTallies.length === 0 ? (
              <div className="p-6 rounded-2xl bg-sand-50/70 border border-sand-200 text-center">
                <UtensilsCrossed className="w-6 h-6 text-forest-400 mx-auto mb-2" />
                <p className="text-xs text-forest-700 font-medium">All approved kitchen prep queue is clear.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeDishTallies.map((dish, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      dish.isCelebration ? 'bg-amber-50/60 border-amber-200' : 'bg-sand-50/70 border-sand-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-forest-950 block truncate">{dish.name}</span>
                        <span className="text-[10px] text-forest-600 font-mono">
                          Destination: Room {dish.rooms.join(', Room ')}
                        </span>
                      </div>
                      <span className="w-8 h-8 rounded-xl bg-forest-900 text-amber-300 font-mono font-extrabold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                        x{dish.count}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 text-[10px] text-forest-700 font-medium mt-2">
                      {dish.statuses['accepted_kitchen'] && (
                        <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md font-bold">
                          {dish.statuses['accepted_kitchen']} Queued
                        </span>
                      )}
                      {dish.statuses['preparing'] && (
                        <span className="bg-orange-100 text-orange-900 px-2 py-0.5 rounded-md font-bold">
                          {dish.statuses['preparing']} Cooking
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 4: DIETARY RESTRICTIONS & ALLERGY ALERTS */}
          <div className="bg-white rounded-3xl p-6 border border-sand-200 shadow-xs">
            <h4 className="font-serif font-bold text-base text-forest-950 mb-3 flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>High Priority Dietary &amp; Allergy Alerts</span>
            </h4>

            {mandateStats.dietaryAlerts.length === 0 ? (
              <div className="p-4 rounded-2xl bg-sand-50/70 border border-sand-200 text-xs text-forest-600 text-center">
                No active dietary allergies or restrictions recorded for in-house guests.
              </div>
            ) : (
              <div className="space-y-3">
                {mandateStats.dietaryAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border bg-sand-50/70 border-sand-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start space-x-3">
                      <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        R{alert.roomNumber}
                      </span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-forest-950">{alert.guestName}</span>
                          <span className="text-[10px] font-mono bg-sand-200 text-forest-800 px-2 py-0.5 rounded">
                            Plan: {alert.plan}
                          </span>
                        </div>
                        <p className="text-xs text-rose-900 font-semibold mt-1">Mandate: {alert.alert}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                      Kitchen Acknowledged ✓
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-TAB 4: MENU STOCK MANAGEMENT
      ======================================================== */}
      {activeTab === 'menu' && (
        <div className="bg-white rounded-3xl p-6 border border-sand-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-forest-950">Menu Stock Management</h3>
              <p className="text-xs text-forest-700">
                Toggle dish availability in or out of stock. Changes immediately reflect in guest QR Digital Concierge.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {menuItems.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  item.isAvailable ? 'bg-white border-sand-200' : 'bg-sand-100/60 border-sand-300 opacity-70'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-sand-200 shrink-0 relative">
                    {item.imageUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 truncate">
                    <span className="text-[10px] uppercase font-bold text-forest-600 block">{item.categoryName}</span>
                    <h4 className="font-bold text-xs text-forest-950 truncate">{item.name}</h4>
                    <span className="font-mono text-xs text-forest-800 font-semibold">₹{item.price}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => toggleMenuItemAvailability(item.id)}
                    className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      item.isAvailable
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-rose-100 hover:text-rose-900'
                        : 'bg-rose-100 text-rose-900 border border-rose-300 hover:bg-emerald-100 hover:text-emerald-900'
                    }`}
                  >
                    <span>{item.isAvailable ? 'In Stock ✓' : 'Out of Stock ✕'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
