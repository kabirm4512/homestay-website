'use client';

import { useEffect, useState } from 'react';
import { Percent, Car, Save } from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { useLiveTariffs, publishLiveTariffs, parseTariffResponse } from '@/lib/live-tariffs';
import { adminPostJson } from '@/lib/admin-api';
import type { GstConfig } from '@/lib/gst';

/**
 * GST rules and the website's booking add-on prices. Every quote, booking and folio is
 * computed from these on the server, so a change here applies everywhere at once.
 */
export default function AdminTaxSettings() {
  const { currentUser, showToast } = useCRM();
  const live = useLiveTariffs();
  const isAdmin = currentUser?.role === 'admin';
  const [gst, setGst] = useState<GstConfig | null>(null);
  const [addons, setAddons] = useState<{ airportTransfer: number; bikeRentalPerNight: number } | null>(null);
  const [saving, setSaving] = useState<'gst' | 'addons' | null>(null);

  useEffect(() => {
    if (live.status === 'ready') {
      setGst((g) => g || live.gstConfig);
      setAddons((a) => a || live.addonRates || { airportTransfer: 2800, bikeRentalPerNight: 800 });
    }
  }, [live.status, live.gstConfig, live.addonRates]);

  const save = async (kind: 'gst' | 'addons') => {
    setSaving(kind);
    const body = kind === 'gst' ? { type: 'gst_config', gstConfig: gst } : { type: 'addon_rates', addonRates: addons };
    const res = await adminPostJson<unknown>('/api/tariffs', body);
    setSaving(null);
    if (!res.ok) {
      showToast(res.error || 'Could not save.', 'error');
      return;
    }
    try {
      publishLiveTariffs(parseTariffResponse(res.data));
    } catch {}
    showToast(kind === 'gst' ? 'GST settings saved. New quotes and folios use them now.' : 'Add-on prices saved.');
  };

  if (!gst || !addons) {
    return <div className="bg-white rounded-2xl border border-sand-200 p-5 text-xs text-forest-600 mb-6">Loading tax settings…</div>;
  }

  const num = (v: string) => (v === '' ? 0 : Math.max(0, Number(v)));
  const field = (label: string, value: number, onChange: (n: number) => void, suffix: string, disabled = false) => (
    <label className="block text-xs">
      <span className="text-forest-700 font-semibold block mb-1">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          step="any"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(num(e.target.value))}
          className="w-full px-3 py-2 rounded-xl border border-sand-300 bg-white font-mono text-sm disabled:bg-sand-50"
        />
        <span className="text-forest-500 shrink-0">{suffix}</span>
      </div>
    </label>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <section className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4 text-forest-700" />
          <h3 className="font-bold text-sm text-forest-950">GST rules</h3>
        </div>
        <p className="text-[11px] text-forest-600">
          Room GST is decided per room per night on the value charged (room rate + extra persons). Confirm the slabs and rates with
          your CA. {isAdmin ? '' : 'Only an admin can change these.'}
        </p>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={gst.tariffsIncludeGst}
            disabled={!isAdmin}
            onChange={(e) => setGst({ ...gst, tariffsIncludeGst: e.target.checked })}
          />
          <span>My room tariffs already include GST (show GST inside the price instead of adding it)</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {field('Slab limit per night', gst.accommodationThreshold, (n) => setGst({ ...gst, accommodationThreshold: n }), '₹', !isAdmin)}
          {field('Rate up to limit', gst.accommodationLowRate, (n) => setGst({ ...gst, accommodationLowRate: n }), '%', !isAdmin)}
          {field('Rate above limit', gst.accommodationHighRate, (n) => setGst({ ...gst, accommodationHighRate: n }), '%', !isAdmin)}
          {field('Food & dining', gst.foodRate, (n) => setGst({ ...gst, foodRate: n }), '%', !isAdmin)}
          {field('Transfers & rentals', gst.transportRate, (n) => setGst({ ...gst, transportRate: n }), '%', !isAdmin)}
          {field('Laundry & other', gst.otherRate, (n) => setGst({ ...gst, otherRate: n }), '%', !isAdmin)}
        </div>
        {isAdmin && (
          <button
            onClick={() => save('gst')}
            disabled={saving !== null}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-forest-900 text-white text-xs font-bold disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving === 'gst' ? 'Saving…' : 'Save GST rules'}
          </button>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-forest-700" />
          <h3 className="font-bold text-sm text-forest-950">Website booking add-ons</h3>
        </div>
        <p className="text-[11px] text-forest-600">Prices offered in the website booking form (before GST).</p>
        <div className="grid grid-cols-2 gap-3">
          {field('Airport / NJP transfer (per booking)', addons.airportTransfer, (n) => setAddons({ ...addons, airportTransfer: n }), '₹')}
          {field('Scooty / bike (per night)', addons.bikeRentalPerNight, (n) => setAddons({ ...addons, bikeRentalPerNight: n }), '₹')}
        </div>
        <button
          onClick={() => save('addons')}
          disabled={saving !== null}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-forest-900 text-white text-xs font-bold disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving === 'addons' ? 'Saving…' : 'Save add-on prices'}
        </button>
      </section>
    </div>
  );
}
