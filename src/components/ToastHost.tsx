'use client';

import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useCRM } from '@/context/CRMContext';

/** Shows the app-wide toast (save confirmations and, importantly, errors from the server). */
export default function ToastHost() {
  const { toast } = useCRM();
  if (!toast) return null;
  const tone =
    toast.type === 'error'
      ? 'bg-rose-700 text-white'
      : toast.type === 'info'
      ? 'bg-[#1E3A2F] text-white'
      : 'bg-[#142820] text-white';
  const Icon = toast.type === 'error' ? AlertTriangle : toast.type === 'info' ? Info : CheckCircle2;
  return (
    <div className="fixed inset-x-0 bottom-20 sm:bottom-6 z-[100] flex justify-center px-4 pointer-events-none">
      <div
        key={toast.id}
        role={toast.type === 'error' ? 'alert' : 'status'}
        className={`pointer-events-auto max-w-md w-full sm:w-auto flex items-start gap-2.5 px-4 py-3 rounded-2xl shadow-2xl text-[13px] font-semibold ${tone}`}
      >
        <Icon className="w-4.5 h-4.5 shrink-0 mt-0.5" />
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
