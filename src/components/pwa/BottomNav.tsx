'use client';

import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Truck,
  Receipt,
  UtensilsCrossed,
  Lock,
} from 'lucide-react';
import { StaffRole } from '@/types/crm';

interface BottomNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  role: StaffRole;
  pendingDispatchCount?: number;
  pendingKitchenOrdersCount?: number;
}

export default function BottomNav({
  activeTab,
  onSelectTab,
  role,
  pendingDispatchCount = 0,
  pendingKitchenOrdersCount = 0,
}: BottomNavProps) {
  // Mobile bottom bar tabs:
  // Admin: [Dashboard, Tape Chart, Orders/Dispatch, Ledger]
  // Manager: [Dashboard, Tape Chart, Orders/Dispatch, Ledger (Guarded Lock)]
  // Kitchen Staff: [Dashboard, Tape Chart, Orders/Dispatch, Kitchen]
  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: 0,
      isGuarded: false,
    },
    {
      id: 'tape_chart',
      label: 'Tape Chart',
      icon: CalendarDays,
      badge: 0,
      isGuarded: false,
    },
    {
      id: 'dispatch',
      label: 'Orders/Dispatch',
      icon: Truck,
      badge: pendingDispatchCount + (role === 'kitchen_staff' ? pendingKitchenOrdersCount : 0),
      isGuarded: false,
    },
    {
      id: role === 'kitchen_staff' ? 'kitchen' : 'ledger',
      label: role === 'kitchen_staff' ? 'Kitchen View' : 'Ledger',
      icon: role === 'kitchen_staff' ? UtensilsCrossed : Receipt,
      badge: role === 'kitchen_staff' ? pendingKitchenOrdersCount : 0,
      isGuarded: role === 'manager', // Manager is strictly guarded from Financial Ledger
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-forest-950/95 backdrop-blur-md border-t border-forest-800/80 px-2 py-1 shadow-2xl safe-area-pb"
    >
      <div className="grid grid-cols-4 items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`min-h-[48px] min-w-[48px] py-1.5 px-1 flex flex-col items-center justify-center relative transition-all rounded-xl ${
                isActive
                  ? 'text-amber-300 font-bold'
                  : tab.isGuarded
                  ? 'text-forest-400/60 hover:text-forest-300'
                  : 'text-sand-300/80 hover:text-sand-100'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {tab.isGuarded && (
                  <Lock className="w-2.5 h-2.5 absolute -top-1 -right-2 text-amber-400" />
                )}
                {tab.badge > 0 && !tab.isGuarded && (
                  <span className="absolute -top-1.5 -right-2.5 bg-amber-500 text-forest-950 text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-forest-950 animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-1 truncate max-w-full">
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
