'use client';

import { useState } from 'react';
import {
  Lock,
  Trees,
  Eye,
  EyeOff,
  ArrowRight,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useCRM } from '@/context/CRMContext';

interface AdminAuthProps {
  onAuthenticated: (token: string, user: { name: string; role: string }) => void;
}

export default function AdminAuth({ onAuthenticated }: AdminAuthProps) {
  const { authenticateStaff } = useCRM();

  // Credentials state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle Individual Email + Password Login
  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both your email address and password.');
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
        setError(result.error || 'Invalid credentials. Please check your email and password.');
      }
    } catch {
      setError('An unexpected error occurred during login. Please try again.');
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
                Savera Homestay Staff Portal
              </h1>
            </div>
          </div>
          <p className="text-xs text-sand-300">
            Secure individual sign-in for Administrators, Duty Managers, and Kitchen Staff.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

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
                  placeholder="e.g. admin@saverahomestay.com"
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

            {/* 1-Click Test Credentials Helper */}
            <div className="pt-1">
              <span className="text-[10px] uppercase tracking-wider font-bold text-forest-600 block mb-1.5">
                1-Click Fill Demo Credentials:
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => handlePrefill('admin@saverahomestay.com', 'admin123')}
                  className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-lg font-semibold text-center transition-colors"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => handlePrefill('manager@saverahomestay.com', 'manager123')}
                  className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-lg font-semibold text-center transition-colors"
                >
                  Manager
                </button>
                <button
                  type="button"
                  onClick={() => handlePrefill('kitchen@saverahomestay.com', 'kitchen123')}
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
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Sign In with Account</span>
                  <ArrowRight className="w-4 h-4 text-sand-300" />
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="pt-2 border-t border-sand-200 text-center">
            <p className="text-[11px] text-forest-600">
              Access restricted to authorized personnel. Session will persist until sign out.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
