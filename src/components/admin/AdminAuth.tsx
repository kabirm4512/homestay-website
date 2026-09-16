'use client';

import { useState } from 'react';
import {
  Lock,
  Trees,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  UserCog,
  ChefHat,
  Mail,
  KeyRound,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { StaffRole } from '@/types/crm';
import { useCRM } from '@/context/CRMContext';

interface AdminAuthProps {
  onAuthenticated: (token: string, user: { name: string; role: string }) => void;
}

export default function AdminAuth({ onAuthenticated }: AdminAuthProps) {
  const { setRole, authenticateStaff } = useCRM();

  // Login mode: 'credentials' (Email & Password) or 'passcode' (Master Passcode)
  const [authMode, setAuthMode] = useState<'credentials' | 'passcode'>('credentials');

  // Credentials state
  const [email, setEmail] = useState('admin@whisperingpines.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);

  // Passcode state
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Handle Individual Email + Password Login
  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both your email/username and password.');
      return;
    }

    setLoading(true);
    try {
      const result = await authenticateStaff(email, password);
      if (result.success && result.user) {
        onAuthenticated(`token-${result.user.id}-${Date.now()}`, {
          name: result.user.fullName,
          role: result.user.role,
        });
      } else {
        setError(result.error || 'Invalid login credentials. Please try again.');
      }
    } catch {
      setError('An unexpected error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Master Passcode Login (Fallback)
  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Please enter the access passcode.');
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
        setError(data.error || 'Invalid passcode. Default passcode is: homestay2025');
      }
    } catch {
      setError('Authentication failed. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Quick autofill helpers for testing individual logins
  const handlePrefill = (targetEmail: string, targetPass: string) => {
    setEmail(targetEmail);
    setPassword(targetPass);
    setError(null);
  };

  // Fast RBAC switcher shortcut
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
              <Trees className="w-5 h-5 text-amber-300" />
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
            Secure individual sign-in for Administrators, Duty Managers, and Kitchen Staff.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 bg-sand-100/70 p-1.5 border-b border-sand-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setAuthMode('credentials');
              setError(null);
            }}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center space-x-2 ${
              authMode === 'credentials'
                ? 'bg-white text-forest-950 shadow-xs'
                : 'text-forest-700 hover:text-forest-950'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staff Login</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('passcode');
              setError(null);
            }}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center space-x-2 ${
              authMode === 'passcode'
                ? 'bg-white text-forest-950 shadow-xs'
                : 'text-forest-700 hover:text-forest-950'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Passcode Login</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {/* Mode 1: Individual Staff Login (Email & Password) */}
          {authMode === 'credentials' && (
            <form onSubmit={handleCredentialSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-forest-900 block mb-1">
                  Staff Email / Login ID
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@whisperingpines.com"
                    className="w-full text-xs p-3 pl-9 rounded-xl border border-sand-300 bg-sand-50/50 text-forest-950 focus:ring-1 focus:ring-forest-800"
                  />
                  <Mail className="w-4 h-4 text-forest-400 absolute left-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-forest-900 block mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your account password"
                    className="w-full text-xs p-3 pl-9 pr-10 rounded-xl border border-sand-300 bg-sand-50/50 text-forest-950 focus:ring-1 focus:ring-forest-800"
                  />
                  <Lock className="w-4 h-4 text-forest-400 absolute left-3 top-3.5 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-forest-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 1-Click Test Credentials Buttons */}
              <div className="pt-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-forest-600 block mb-1.5">
                  1-Click Test Accounts:
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handlePrefill('admin@whisperingpines.com', 'admin123')}
                    className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-lg font-semibold text-center transition-colors"
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrefill('manager@whisperingpines.com', 'manager123')}
                    className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-lg font-semibold text-center transition-colors"
                  >
                    Manager
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrefill('kitchen@whisperingpines.com', 'kitchen123')}
                    className="py-1.5 px-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-900 rounded-lg font-semibold text-center transition-colors"
                  >
                    Kitchen
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
                    <span>Sign In with Account</span>
                    <ArrowRight className="w-4 h-4 text-sand-300" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Mode 2: Master Passcode Login */}
          {authMode === 'passcode' && (
            <form onSubmit={handlePasscodeSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-forest-800 block mb-1">
                  Estate Master Passcode
                </label>
                <div className="relative">
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter passcode (default: homestay2025)"
                    className="w-full text-xs p-3 pr-10 rounded-xl border border-sand-300 bg-sand-50/50 text-forest-950 focus:ring-1 focus:ring-forest-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-forest-700"
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
          )}

          {/* Fast RBAC Switcher Buttons for instant preview */}
          <div className="pt-2 border-t border-sand-200">
            <span className="text-[11px] uppercase tracking-wider font-bold text-forest-700 block mb-2">
              Instant Demo Access (Skip Login)
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
        </div>
      </div>
    </div>
  );
}
