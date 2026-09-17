'use client';

import React, { useState } from 'react';
import { ShieldCheck, UserCog, ChefHat, Info, ChevronDown, Lock } from 'lucide-react';
import { StaffRole } from '@/types/crm';
import { useCRM } from '@/context/CRMContext';

export default function RoleSwitcher() {
  const { role, setRole, currentUser, showToast } = useCRM();
  const [isOpen, setIsOpen] = useState(false);

  const isUserAdmin = !currentUser || currentUser.role === 'admin';

  const rolesConfig: Record<
    StaffRole,
    {
      label: string;
      icon: React.ElementType;
      color: string;
      badgeColor: string;
      summary: string;
      permissions: string[];
    }
  > = {
    admin: {
      label: 'Admin (Estate Owner)',
      icon: ShieldCheck,
      color: 'text-emerald-400',
      badgeColor: 'bg-emerald-950/80 border-emerald-700 text-emerald-300',
      summary: 'Unrestricted estate access: Financial ledger, P&L, expense logging, operations, and settings.',
      permissions: [
        'Financial Ledger & Profitability Analytics',
        'Expense Logger & Receipt Storage',
        'Staff Payroll & Master Audits',
        'Tape Chart & Operations Hub',
        'Transport Dispatch & Kitchen Orders',
      ],
    },
    manager: {
      label: 'Manager (Front Desk & Ops)',
      icon: UserCog,
      color: 'text-amber-400',
      badgeColor: 'bg-amber-950/80 border-amber-700 text-amber-300',
      summary: 'Operations lead: Tape chart, housekeeping schedules, check-ins, guest folios & transport dispatch.',
      permissions: [
        'Tape Chart (7 Rooms) & Booking Drawer',
        'Housekeeping Turnover & Checklists',
        'Transport & Add-on Dispatch Hub',
        'Guest Folios (Billing & Payments)',
        '🔒 RESTRICTED: Hidden from Financial Ledger, Expenses & PNL',
      ],
    },
    kitchen_staff: {
      label: 'Kitchen Staff (Head Chef)',
      icon: ChefHat,
      color: 'text-terracotta-400',
      badgeColor: 'bg-orange-950/80 border-orange-700 text-orange-300',
      summary: 'Kitchen operations: Meal plan tallies (CP/MAP/AP), live QR food orders, and instant menu availability.',
      permissions: [
        'Kitchen & Dining Mandate (CP/MAP/AP Headcounts)',
        'Live QR Food Orders Queue & Statuses',
        'Menu Stock Management (In/Out of stock)',
        'Dietary & Allergy Alerts (Jain, Nut Allergy, etc.)',
        '🔒 RESTRICTED: No Access to Financials or Tape Chart Setup',
      ],
    },
  };

  const current = rolesConfig[role];
  const CurrentIcon = current.icon;

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`min-h-[44px] flex items-center space-x-2.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold shadow-sm transition-all hover:brightness-110 active:scale-95 ${current.badgeColor}`}
        title="Click to view staff role and permissions"
      >
        <CurrentIcon className="w-4 h-4 shrink-0" />
        <div className="text-left hidden sm:block">
          <span className="text-[10px] uppercase tracking-wider text-sand-300 block font-normal leading-none">
            Active Role
          </span>
          <span className="text-white font-bold">{current.label.split(' (')[0]}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-sand-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-forest-900 border border-forest-700/80 shadow-2xl text-sand-100 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-3 py-2 border-b border-forest-800 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sand-300">
                Staff Role Permissions
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-forest-800 text-sand-200">
                {isUserAdmin ? 'Admin Switcher' : 'Role Locked'}
              </span>
            </div>

            <div className="py-2 space-y-1.5">
              {(Object.keys(rolesConfig) as StaffRole[]).map((rKey) => {
                const item = rolesConfig[rKey];
                const Icon = item.icon;
                const isSelected = role === rKey;
                const isLocked = !isUserAdmin && rKey !== currentUser?.role;

                return (
                  <button
                    key={rKey}
                    disabled={isLocked}
                    onClick={() => {
                      if (isLocked) {
                        showToast(`Access Restricted: Signed in as ${currentUser?.fullName}. To access Admin, please log in with an Administrator account.`, 'error');
                        return;
                      }
                      setRole(rKey);
                      setIsOpen(false);
                    }}
                    className={`w-full min-h-[44px] p-2.5 rounded-xl text-left transition-all flex items-start space-x-3 ${
                      isSelected
                        ? 'bg-forest-800/90 border border-amber-500/40 text-white shadow-inner'
                        : isLocked
                        ? 'opacity-40 cursor-not-allowed bg-forest-950/40 text-sand-400'
                        : 'hover:bg-forest-800/40 text-sand-200 border border-transparent'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${isSelected ? 'bg-amber-500 text-forest-950 font-bold' : 'bg-forest-950 text-sand-300'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                          <span>{item.label}</span>
                          {isLocked && <Lock className="w-3 h-3 text-rose-400" />}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] text-amber-300 font-extrabold uppercase">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-sand-300/80 line-clamp-2 mt-0.5">
                        {isLocked ? 'Restricted to Administrator accounts.' : item.summary}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Current Role Permissions Summary */}
            <div className="mt-2 p-2.5 rounded-xl bg-forest-950/70 border border-forest-800/80 text-[11px]">
              <div className="flex items-center space-x-1.5 text-amber-300 font-semibold mb-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>Permissions Guard:</span>
              </div>
              <ul className="space-y-1 text-[10px] text-sand-200">
                {current.permissions.map((perm, idx) => (
                  <li key={idx} className="flex items-center space-x-1.5">
                    <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                    <span className={perm.includes('RESTRICTED') ? 'text-rose-300 font-medium' : ''}>{perm}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
