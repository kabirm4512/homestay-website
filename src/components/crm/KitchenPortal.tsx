'use client';

import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { FoodOrderStatus, MenuItem } from '@/types/crm';

export default function KitchenPortal() {
  const {
    bookings,
    foodOrders,
    menuItems,
    updateFoodOrderStatus,
    toggleMenuItemAvailability,
    showToast,
  } = useCRM();

  const [activeTab, setActiveTab] = useState<'orders' | 'mandate' | 'menu'>('orders');

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

  const pendingOrdersCount = foodOrders.filter((o) => o.status === 'pending').length;

  const nextStatusMap: Record<FoodOrderStatus, FoodOrderStatus | null> = {
    pending: 'accepted_kitchen',
    accepted_kitchen: 'preparing',
    preparing: 'out_for_delivery',
    out_for_delivery: 'delivered',
    delivered: null,
    cancelled: null,
  };

  const getStatusBadge = (status: FoodOrderStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500 text-forest-950 animate-pulse';
      case 'accepted_kitchen':
        return 'bg-blue-600 text-white';
      case 'preparing':
        return 'bg-orange-500 text-white';
      case 'out_for_delivery':
        return 'bg-purple-600 text-white';
      case 'delivered':
        return 'bg-emerald-600 text-white';
      case 'cancelled':
        return 'bg-gray-400 text-white';
    }
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
                Kitchen View & Live Orders
              </h2>
              <p className="text-xs text-sand-300">
                Live QR orders, meal plan headcounts (CP/MAP/AP) & menu stock control.
              </p>
            </div>
          </div>

          {/* Quick Sub-Tabs */}
          <div className="flex items-center space-x-1.5 bg-forest-800/80 p-1.5 rounded-2xl border border-forest-700/60 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('orders')}
              className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'orders'
                  ? 'bg-amber-500 text-forest-950 shadow-sm'
                  : 'text-sand-200 hover:text-white hover:bg-forest-700/50'
              }`}
            >
              <span>Live Orders</span>
              {pendingOrdersCount > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-600 text-white text-[10px] font-extrabold rounded-full">
                  {pendingOrdersCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('mandate')}
              className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'mandate'
                  ? 'bg-amber-500 text-forest-950 shadow-sm'
                  : 'text-sand-200 hover:text-white hover:bg-forest-700/50'
              }`}
            >
              <span>Kitchen Mandate</span>
            </button>
            <button
              onClick={() => setActiveTab('menu')}
              className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
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

      {/* SUB-TAB 1: LIVE FOOD ORDERS QUEUE */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-base text-forest-950 flex items-center space-x-2">
              <BellRing className="w-5 h-5 text-amber-600" />
              <span>In-Room QR Orders Queue</span>
            </h3>
            <span className="text-xs text-forest-600 font-medium">
              Orders automatically sync from /concierge
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {foodOrders.map((ord) => {
              const nextStatus = nextStatusMap[ord.status];

              return (
                <div
                  key={ord.id}
                  className={`bg-white rounded-3xl p-5 border transition-all flex flex-col justify-between shadow-xs ${
                    ord.status === 'pending'
                      ? 'border-amber-400 ring-2 ring-amber-300/40'
                      : ord.status === 'delivered'
                      ? 'border-sand-200 opacity-75'
                      : 'border-sand-300'
                  }`}
                >
                  <div>
                    {/* Order Top Bar */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold bg-forest-900 text-sand-200 px-2 py-0.5 rounded-lg">
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

                    <p className="text-xs text-forest-700 font-semibold mb-3">
                      Guest: {ord.guestName}
                    </p>

                    {/* Order Line Items */}
                    <div className="bg-sand-50 p-3 rounded-2xl border border-sand-200 text-xs space-y-1.5 mb-3">
                      {ord.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between border-b border-sand-200/60 pb-1.5 last:border-b-0 last:pb-0"
                        >
                          <div>
                            <span className="font-bold text-forest-950">
                              {item.quantity}x {item.itemName}
                            </span>
                            {item.itemNotes && (
                              <p className="text-[10px] text-amber-800 font-medium italic">
                                Note: {item.itemNotes}
                              </p>
                            )}
                          </div>
                          <span className="font-mono text-forest-800">
                            ₹{item.lineTotal}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Special Instructions / Dietary Warning */}
                    {ord.specialInstructions && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-900 mb-3 flex items-start space-x-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Chef Instruction:</strong> {ord.specialInstructions}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Controls */}
                  <div className="pt-3 border-t border-sand-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase block">Total</span>
                      <span className="font-mono font-bold text-sm text-forest-950">₹{ord.totalAmount}</span>
                    </div>

                    {nextStatus && (
                      <button
                        onClick={() => updateFoodOrderStatus(ord.id, nextStatus)}
                        className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-forest-900 hover:bg-forest-800 active:scale-95 text-white shadow-sm transition-all flex items-center space-x-1.5"
                      >
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Advance to {nextStatus.replace(/_/g, ' ')}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: KITCHEN & DINING MANDATE (CP / MAP / AP HEADCOUNTS) */}
      {activeTab === 'mandate' && (
        <div className="space-y-6">
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
              {/* CP: Continental Plan */}
              <div className="bg-amber-50/80 p-5 rounded-2xl border border-amber-200 text-center">
                <span className="text-[10px] font-mono uppercase font-bold text-amber-800 block">
                  CP (Continental Plan)
                </span>
                <span className="text-3xl font-serif font-bold text-amber-950 my-1 block">
                  {mandateStats.CP}
                </span>
                <span className="text-[11px] text-amber-800 font-medium">
                  Room + Gourmet Breakfast
                </span>
              </div>

              {/* MAP: Modified American Plan */}
              <div className="bg-blue-50/80 p-5 rounded-2xl border border-blue-200 text-center">
                <span className="text-[10px] font-mono uppercase font-bold text-blue-800 block">
                  MAP (Modified American)
                </span>
                <span className="text-3xl font-serif font-bold text-blue-950 my-1 block">
                  {mandateStats.MAP}
                </span>
                <span className="text-[11px] text-blue-800 font-medium">
                  Breakfast + Lunch / Dinner
                </span>
              </div>

              {/* AP: American Plan */}
              <div className="bg-emerald-50/80 p-5 rounded-2xl border border-emerald-200 text-center">
                <span className="text-[10px] font-mono uppercase font-bold text-emerald-800 block">
                  AP (Full Board American)
                </span>
                <span className="text-3xl font-serif font-bold text-emerald-950 my-1 block">
                  {mandateStats.AP}
                </span>
                <span className="text-[11px] text-emerald-800 font-medium">
                  All 3 Meals Included
                </span>
              </div>

              {/* EP: European Plan */}
              <div className="bg-sand-100/80 p-5 rounded-2xl border border-sand-300 text-center">
                <span className="text-[10px] font-mono uppercase font-bold text-forest-700 block">
                  EP (European Plan)
                </span>
                <span className="text-3xl font-serif font-bold text-forest-950 my-1 block">
                  {mandateStats.EP}
                </span>
                <span className="text-[11px] text-forest-700 font-medium">
                  Room Only (A La Carte)
                </span>
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
                className="min-h-[44px] px-4 py-2 bg-amber-500 hover:bg-amber-400 text-forest-950 text-xs font-bold rounded-xl transition-colors"
              >
                Print Kitchen Mandate Sheet
              </button>
            </div>
          </div>

          {/* Dietary Restrictions & Allergy Mandates Card */}
          <div className="bg-white rounded-3xl p-6 border border-sand-200 shadow-xs">
            <h4 className="font-serif font-bold text-base text-forest-950 mb-3 flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>High Priority Dietary & Allergy Alerts</span>
            </h4>

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
                      <p className="text-xs text-rose-900 font-semibold mt-1">
                        Mandate: {alert.alert}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                    Kitchen Acknowledged ✓
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: MENU MANAGEMENT & STOCK TOGGLING */}
      {activeTab === 'menu' && (
        <div className="bg-white rounded-3xl p-6 border border-sand-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-forest-950">
                Menu Stock Management
              </h3>
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
                  item.isAvailable
                    ? 'bg-white border-sand-200'
                    : 'bg-sand-100/60 border-sand-300 opacity-70'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-sand-200 shrink-0 relative">
                    {item.imageUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 truncate">
                    <span className="text-[10px] uppercase font-bold text-forest-600 block">
                      {item.categoryName}
                    </span>
                    <h4 className="font-bold text-xs text-forest-950 truncate">
                      {item.name}
                    </h4>
                    <span className="font-mono text-xs text-forest-800 font-semibold">
                      ₹{item.price}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => toggleMenuItemAvailability(item.id)}
                    className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
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
