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
  onAuthenticated: (token: string, user: { name: string; role: string; [key: string]: any }) => void;
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
          id: result.user.id,
          name: result.user.fullName,
          fullName: result.user.fullName,
          email: result.user.email,
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
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#E5DEC9] overflow-hidden">
        {/* Header decoration */}
        <div className="bg-[#142820] px-8 py-8 text-white relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-[#C5A059]/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#1E3A2F] rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center space-x-3 mb-3 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-[#1E3A2F] border border-[#C5A059]/40 flex items-center justify-center shadow-inner">
              <Trees className="w-5 h-5 text-[#C5A059]" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#C5A059] font-bold block">
                Boutique Homestay Sanctuary OS
              </span>
              <h1
                className="font-bold text-xl text-white tracking-tight"
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                Savera Homestay Portal
              </h1>
            </div>
          </div>
          <p className="text-xs text-[#A3B899] relative z-10 leading-relaxed">
            Secure executive sign-in for Administrators, Duty Managers, and Kitchen Staff.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCredentialSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#142820] block mb-1.5">
                Staff Email / Login ID
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. admin@saverahomestay.com"
                  className="w-full text-xs p-3.5 pl-10 rounded-xl border border-[#E5DEC9] bg-[#FAF8F5] text-[#142820] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#142820] focus:border-transparent focus:bg-white transition-all"
                />
                <Mail className="w-4 h-4 text-[#8C9B90] absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#142820] block mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  className="w-full text-xs p-3.5 pl-10 pr-10 rounded-xl border border-[#E5DEC9] bg-[#FAF8F5] text-[#142820] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#142820] focus:border-transparent focus:bg-white transition-all"
                />
                <Lock className="w-4 h-4 text-[#8C9B90] absolute left-3.5 top-3.5 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8C9B90] hover:text-[#142820] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 1-Click Fill Administrator Credentials */}
            <div className="pt-1">
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#6B7C72] block mb-1.5">
                Default Administrator Account:
              </span>
              <button
                type="button"
                onClick={() => handlePrefill('admin@saverahomestay.com', 'admin123')}
                className="w-full py-2.5 px-3 bg-[#F4F1EA] hover:bg-[#EBE5DA] border border-[#E5DEC9] text-[#142820] rounded-xl font-medium text-xs flex items-center justify-between transition-colors group cursor-pointer"
              >
                <div className="flex items-center space-x-2.5 text-left">
                  <div className="w-6 h-6 rounded-lg bg-[#142820] text-[#C5A059] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-[#142820] block leading-tight text-xs">Savera Admin (Owner)</span>
                    <span className="text-[11px] text-[#5C6D66] font-mono">admin@saverahomestay.com</span>
                  </div>
                </div>
                <span className="text-[10px] uppercase bg-[#C5A059]/20 text-[#8C6B1F] border border-[#C5A059]/40 px-2 py-0.5 rounded-md font-bold group-hover:bg-[#C5A059]/30 transition-colors">
                  1-Click Fill
                </span>
              </button>
              <p className="text-[11px] text-[#6B7C72] mt-2 leading-relaxed">
                Log in as Administrator to access the <strong>Staff &amp; Logins</strong> portal and manage team permissions.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[46px] bg-[#C85A32] hover:bg-[#B34D28] text-white font-bold py-3 px-4 rounded-xl shadow-[0_4px_14px_rgba(200,90,50,0.3)] hover:shadow-[0_6px_20px_rgba(200,90,50,0.4)] transition-all flex items-center justify-center space-x-2 text-xs cursor-pointer active:scale-98"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>Sign In with Account</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="pt-2 border-t border-[#E5DEC9] text-center">
            <p className="text-[11px] text-[#6B7C72]">
              Access restricted to authorized personnel. Session will persist securely.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
