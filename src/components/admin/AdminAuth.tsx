'use client';

import { useState } from 'react';
import { Lock, Trees, ShieldCheck, Eye, EyeOff, ArrowRight, Sparkles, UserCog, ChefHat } from 'lucide-react';
import { StaffRole } from '@/types/crm';
import { useCRM } from '@/context/CRMContext';

interface AdminAuthProps {
  onAuthenticated: (token: string, user: { name: string; role: string }) => void;
}

export default function AdminAuth({ onAuthenticated }: AdminAuthProps) {
  const { setRole } = useCRM();
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Please enter the access code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onAuthenticated(data.token, data.user);
      } else {
        setError(data.error || 'Invalid passcode. Default code is: homestay2025');
      }
    } catch {
      setError('Authentication failed. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFastRoleEnter = (selectedRole: StaffRole, name: string) => {
    setRole(selectedRole);
    onAuthenticated(`mock-token-${selectedRole}`, {
      name,
      role: selectedRole,
    });
  };

  return (
    <div className="min-h-screen bg-sand-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-sand-200 overflow-hidden">
        {/* Header decoration */}
        <div className="bg-forest-900 px-8 py-8 text-white relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-forest-800 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-xs">
              <Trees className="w-5 h-5 text-sand-200" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-amber-300 font-semibold block">
                Boutique Homestay CRM
              </span>
              <h1 className="font-serif font-bold text-xl text-white">
                Whispering Pines Staff Portal
              </h1>
            </div>
          </div>
          <p className="text-xs text-sand-300">
            7-Room Operations, Digital Concierge, Kitchen Mandates & Financial Ledger.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-8 space-y-6">
          {/* Fast RBAC Role Switcher Buttons */}
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-forest-700 block mb-2">
              Fast Role Switcher (RBAC)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleFastRoleEnter('admin', 'Tenzing (Owner & Admin)')}
                className="min-h-[44px] p-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-center transition-all flex flex-col items-center justify-center group"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-700 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold text-emerald-950 mt-1">Admin</span>
                <span className="text-[9px] text-emerald-700">All Modules</span>
              </button>

              <button
                type="button"
                onClick={() => handleFastRoleEnter('manager', 'Rinchen (Duty Manager)')}
                className="min-h-[44px] p-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl text-center transition-all flex flex-col items-center justify-center group"
              >
                <UserCog className="w-4 h-4 text-amber-700 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold text-amber-950 mt-1">Manager</span>
                <span className="text-[9px] text-amber-700">Ops & Dispatch</span>
              </button>

              <button
                type="button"
                onClick={() => handleFastRoleEnter('kitchen_staff', 'Chef Sonam (Kitchen)')}
                className="min-h-[44px] p-2 bg-orange-50 hover:bg-orange-100 border border-orange-300 rounded-xl text-center transition-all flex flex-col items-center justify-center group"
              >
                <ChefHat className="w-4 h-4 text-orange-700 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold text-orange-950 mt-1">Kitchen</span>
                <span className="text-[9px] text-orange-700">Food Orders</span>
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-sand-200 w-full" />
            <span className="bg-white px-2 text-[10px] uppercase font-bold text-gray-400 absolute">
              or enter passcode
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-forest-800 block mb-1">
                Admin Passcode
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter passcode (default: homestay2025)"
                  className="w-full text-xs p-3 pr-10 rounded-xl border border-sand-300 bg-sand-50/50 text-forest-950 focus:ring-1 focus:ring-forest-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-forest-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] bg-forest-900 hover:bg-forest-800 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 text-xs"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In with Passcode</span>
                  <ArrowRight className="w-4 h-4 text-sand-300" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
