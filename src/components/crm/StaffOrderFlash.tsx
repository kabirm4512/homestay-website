'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Sparkles, Utensils, Check, X, Volume2, ArrowRight } from 'lucide-react';
import { StaffAlert } from '@/lib/data-service';

interface StaffOrderFlashProps {
  onViewOrders?: () => void;
}

export default function StaffOrderFlash({ onViewOrders }: StaffOrderFlashProps) {
  const [alerts, setAlerts] = useState<StaffAlert[]>([]);
  const seenAlertIdsRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);

  // Synthesize hotel reception chime via Web Audio API
  const playChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Note 1: D5 (587.33 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);

      // Note 2: A5 (880.00 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.18);
      gain2.gain.setValueAtTime(0.3, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.9);
    } catch {
      // Audio playback restrictions fallback gracefully
    }
  }, []);

  // Check for alerts from API
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?alerts=true');
      const json = await res.json();
      if (json?.success && Array.isArray(json.alerts)) {
        const unacked: StaffAlert[] = json.alerts;
        let hasNew = false;

        unacked.forEach((a) => {
          if (!seenAlertIdsRef.current.has(a.id)) {
            seenAlertIdsRef.current.add(a.id);
            hasNew = true;
          }
        });

        if (hasNew && unacked.length > 0) {
          playChime();
        }

        setAlerts(unacked);
      }
    } catch {
      // Silent error polling fallback
    }
  }, [playChime]);

  // Storage listener for instantaneous cross-tab updates
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'wp_new_order_alert' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          playChime();
          fetchAlerts();
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [playChime, fetchAlerts]);

  // Initial fetch and 4s polling interval
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 4000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action: 'acknowledge' }),
      });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    }
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-3 max-w-sm sm:max-w-md w-full pointer-events-auto">
      {alerts.slice(0, 3).map((alert) => (
        <div
          key={alert.id}
          className="bg-white rounded-2xl shadow-2xl border-2 border-amber-400 p-4 sm:p-5 animate-bounce-subtle text-forest-950 flex flex-col space-y-3 relative overflow-hidden"
          style={{ animationDuration: '3s' }}
        >
          {/* Top highlight strip */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-emerald-500 to-amber-500" />

          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                {alert.type === 'special_request' ? '🎉 Celebration Request' : '🛎️ New Room Order'}
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={playChime}
                className="p-1 text-forest-400 hover:text-forest-700 transition-colors cursor-pointer"
                title="Re-play Chime"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleAcknowledge(alert.id)}
                className="p-1 text-forest-400 hover:text-forest-700 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-forest-900 text-amber-300 flex items-center justify-center shrink-0 shadow-inner">
              {alert.type === 'special_request' ? (
                <Sparkles className="w-5 h-5" />
              ) : (
                <Utensils className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-1">
                <h4 className="font-bold text-sm text-forest-950 truncate">
                  Room {alert.roomNumber} • {alert.guestName}
                </h4>
                <span className="font-mono font-bold text-sm text-emerald-800 shrink-0">
                  ₹{alert.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-xs text-forest-700 mt-1 leading-snug break-words">
                {alert.orderDetails}
              </p>
              <span className="text-[10px] text-forest-500 block mt-1">
                {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Auto-charged to room folio
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-2 pt-1 border-t border-sand-100">
            {onViewOrders && (
              <button
                type="button"
                onClick={() => {
                  handleAcknowledge(alert.id);
                  onViewOrders();
                }}
                className="px-3 py-1.5 bg-sand-100 hover:bg-sand-200 text-forest-900 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <span>View in Orders</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}

            <button
              type="button"
              onClick={() => handleAcknowledge(alert.id)}
              className="px-4 py-1.5 bg-forest-900 hover:bg-forest-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Acknowledge</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
