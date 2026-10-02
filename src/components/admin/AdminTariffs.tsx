'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Save, RotateCcw, Users, Percent, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Room } from '@/types';
import type { MealPlan, RoomSeasonalTariffs } from '@/types/crm';
import { useCRM } from '@/context/CRMContext';
import { resolveRoomTariffs, todayInIST } from '@/lib/tariff-calculator';

/**
 * TARIFFS & MEAL PLANS: the one place where room prices are set.
 *
 * Everything that shows or charges a room price reads what is saved here, through the
 * shared pricing engine: the public website (room cards, availability, booking form),
 * the booking API (which re-prices every request), front-desk bookings and the admin
 * room cards. Rooms themselves carry no price fields.
 */

const PLANS: { key: MealPlan; label: string; hint: string }[] = [
  { key: 'EP', label: 'EP', hint: 'Room only' },
  { key: 'CP', label: 'CP', hint: 'Room + breakfast' },
  { key: 'MAP', label: 'MAP', hint: 'Breakfast + dinner' },
  { key: 'AP', label: 'AP', hint: 'All meals' },
];

type Tier = 'regular' | 'season' | 'offSeason';
const TIERS: { key: Tier; label: string; when: string; dot: string; input: string }[] = [
  { key: 'regular', label: 'Regular', when: 'All dates not in a Peak or Off-season range', dot: 'bg-forest-700', input: 'border-sand-300 bg-white' },
  { key: 'season', label: 'Peak season', when: 'Dates inside a Peak range', dot: 'bg-amber-500', input: 'border-amber-300 bg-amber-50/40' },
  { key: 'offSeason', label: 'Off-season', when: 'Dates inside an Off-season range', dot: 'bg-emerald-600', input: 'border-emerald-300 bg-emerald-50/40' },
];

const EMPTY: RoomSeasonalTariffs = {
  regular: { EP: 0, CP: 0, MAP: 0, AP: 0 },
  season: { EP: 0, CP: 0, MAP: 0, AP: 0 },
  offSeason: { EP: 0, CP: 0, MAP: 0, AP: 0 },
  weekendSurchargePercent: 0,
  extraAdultRate: 0,
  extraChildRate: 0,
  baseAdults: 2,
};

function clone(t: RoomSeasonalTariffs): RoomSeasonalTariffs {
  return {
    regular: { ...t.regular },
    season: { ...t.season },
    offSeason: { ...t.offSeason },
    weekendSurchargePercent: t.weekendSurchargePercent ?? 0,
    extraAdultRate: t.extraAdultRate ?? 0,
    extraChildRate: t.extraChildRate ?? 0,
    baseAdults: t.baseAdults ?? 2,
    freeChildUnderAge: t.freeChildUnderAge,
  };
}

function keyOf(t: RoomSeasonalTariffs | null): string {
  if (!t) return '';
  return JSON.stringify([
    TIERS.map(({ key }) => PLANS.map(({ key: p }) => Number(t[key]?.[p]) || 0)),
    Number(t.weekendSurchargePercent) || 0,
    Number(t.extraAdultRate) || 0,
    Number(t.extraChildRate) || 0,
    Number(t.baseAdults) || 2,
    Number(t.freeChildUnderAge) || 0,
  ]);
}

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

interface Props {
  rooms: Room[];
  /** Select this room when it changes (e.g. right after a new room is created). */
  focusRoomId?: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function AdminTariffs({ rooms, focusRoomId, onDirtyChange, showToast }: Props) {
  const { roomTariffs, tariffsStatus, updateRoomTariffs, getSeasonForDate, currentUser } = useCRM();
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const [roomId, setRoomId] = useState<string>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('wp_admin_rooms_tariff_room') : null;
      if (saved && rooms.some((r) => r.id === saved)) return saved;
    } catch {}
    return rooms[0]?.id || '';
  });
  const [draft, setDraft] = useState<RoomSeasonalTariffs>(EMPTY);
  const [saving, setSaving] = useState(false);

  const saved = useMemo(() => (roomId ? resolveRoomTariffs(roomId, roomTariffs) : null), [roomId, roomTariffs]);
  const savedKey = keyOf(saved);
  const dirty = tariffsStatus === 'ready' && keyOf(draft) !== (saved ? savedKey : keyOf(EMPTY));
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  // Keep the selection valid when rooms change
  useEffect(() => {
    if (rooms.length > 0 && !rooms.some((r) => r.id === roomId)) setRoomId(rooms[0].id);
  }, [rooms, roomId]);

  useEffect(() => {
    if (focusRoomId && rooms.some((r) => r.id === focusRoomId)) setRoomId(focusRoomId);
  }, [focusRoomId, rooms]);

  // Load the saved prices into the editor: on room change always, otherwise only when
  // there are no unsaved edits (the CRM refreshes every few seconds; edits must survive it).
  const loadedRoomRef = useRef<string>('');
  useEffect(() => {
    if (tariffsStatus !== 'ready') return;
    const roomChanged = loadedRoomRef.current !== roomId;
    if (roomChanged || !dirtyRef.current) {
      setDraft(saved ? clone(saved) : clone(EMPTY));
      loadedRoomRef.current = roomId;
    }
  }, [roomId, savedKey, tariffsStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const selectRoom = (id: string) => {
    if (id === roomId) return;
    if (dirty && !window.confirm('You have unsaved price changes for this room. Discard them?')) return;
    setRoomId(id);
    try {
      localStorage.setItem('wp_admin_rooms_tariff_room', id);
    } catch {}
  };

  const setRate = (tier: Tier, plan: MealPlan, raw: string) => {
    const v = Math.max(0, Math.round(Number(raw.replace(/[^\d.]/g, '')) || 0));
    setDraft((d) => ({ ...d, [tier]: { ...d[tier], [plan]: v } }));
  };
  const setField = (field: 'weekendSurchargePercent' | 'extraAdultRate' | 'extraChildRate' | 'baseAdults' | 'freeChildUnderAge', raw: string) => {
    const v = Math.max(0, Math.round(Number(raw.replace(/[^\d.]/g, '')) || 0));
    setDraft((d) => ({ ...d, [field]: field === 'freeChildUnderAge' ? (v > 0 ? v : undefined) : v }));
  };

  // Validation (blocking) and sanity hints (non-blocking)
  const missing: string[] = [];
  for (const t of TIERS) for (const p of PLANS) if (!(draft[t.key][p.key] > 0)) missing.push(`${t.label} ${p.label}`);
  const errors: string[] = [];
  if (missing.length) errors.push(`Enter a price above ₹0 for: ${missing.join(', ')}.`);
  if ((draft.weekendSurchargePercent ?? 0) > 100) errors.push('Weekend surcharge must be 100% or less.');
  if ((draft.baseAdults ?? 2) < 1 || (draft.baseAdults ?? 2) > 10) errors.push('Adults included must be between 1 and 10.');
  if ((draft.freeChildUnderAge ?? 0) > 17) errors.push('Free-child age must be 17 or less.');
  const hints: string[] = [];
  if (!missing.length) {
    if (PLANS.some((p) => draft.season[p.key] < draft.regular[p.key])) hints.push('Some Peak prices are lower than Regular.');
    if (PLANS.some((p) => draft.offSeason[p.key] > draft.regular[p.key])) hints.push('Some Off-season prices are higher than Regular.');
    for (const t of TIERS) {
      const r = draft[t.key];
      if (!(r.EP <= r.CP && r.CP <= r.MAP && r.MAP <= r.AP)) hints.push(`${t.label}: prices usually rise EP → CP → MAP → AP.`);
    }
  }

  const handleSave = async () => {
    if (!canEdit || !roomId) return;
    if (tariffsStatus !== 'ready') {
      showToast('Prices are still loading. Please try again in a moment.', 'error');
      return;
    }
    if (errors.length) {
      showToast(errors[0], 'error');
      return;
    }
    setSaving(true);
    const toSave = clone(draft);
    if (!toSave.freeChildUnderAge) delete toSave.freeChildUnderAge;
    const ok = await updateRoomTariffs(roomId, toSave);
    setSaving(false);
    if (ok) loadedRoomRef.current = roomId;
  };

  const handleDiscard = () => setDraft(saved ? clone(saved) : clone(EMPTY));

  // What guests are charged today, so it is obvious which row the website is showing
  const today = todayInIST();
  const todaySeason = getSeasonForDate(today);
  const todayTier: Tier = todaySeason.seasonType === 'season' ? 'season' : todaySeason.seasonType === 'off_season' ? 'offSeason' : 'regular';
  const todayLabel = new Date(`${today}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const room = rooms.find((r) => r.id === roomId);

  if (rooms.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-sand-200 text-sm text-forest-700">
        Add a room in Room Inventory first, then set its prices here.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Room picker + status */}
      <div className="bg-white p-5 rounded-2xl border border-sand-200 shadow-sm space-y-4">
        <div>
          <h3 className="font-serif text-lg font-bold text-forest-950">Room prices</h3>
          <p className="text-xs text-gray-600 mt-0.5">
            The only place room prices are set. The website, booking quotes, front-desk bookings and the room cards all use the
            prices saved here. Prices are per room per night, before GST.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {rooms.map((r) => {
            const has = Boolean(resolveRoomTariffs(r.id, roomTariffs));
            const active = r.id === roomId;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => selectRoom(r.id)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors flex items-center gap-2 ${
                  active ? 'bg-forest-900 text-white border-forest-900' : 'bg-sand-50 text-forest-900 border-sand-300 hover:border-forest-600'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${has ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span>{r.name}</span>
                {!r.is_active && <span className="text-[10px] opacity-70">(hidden)</span>}
              </button>
            );
          })}
        </div>

        {tariffsStatus !== 'ready' ? (
          <div className="p-3 rounded-xl border border-sand-200 bg-sand-50 text-xs text-forest-800">
            {tariffsStatus === 'error' ? 'Could not load prices from the server. Reload the page to try again.' : 'Loading prices…'}
          </div>
        ) : dirty ? (
          <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-xs text-amber-900 font-semibold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Not saved yet. Guests still see the old prices until you click “Save prices”.</span>
          </div>
        ) : saved ? (
          <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-xs text-emerald-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Saved and in use. Today ({todayLabel}) is <strong>{todaySeason.seasonType === 'regular' ? 'a Regular day' : todaySeason.seasonName}</strong>, so the
              website is showing the <strong>{TIERS.find((t) => t.key === todayTier)?.label}</strong> prices for {room?.name}.
            </span>
          </div>
        ) : (
          <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>No prices saved for {room?.name} yet. The website shows “price on request” and it cannot be booked online until you save prices.</span>
          </div>
        )}
      </div>

      {tariffsStatus === 'ready' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-sand-200 shadow-sm space-y-6">
          {/* Rate matrix */}
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="text-left text-forest-700">
                  <th className="py-2 pr-3 font-semibold w-[28%]">Season</th>
                  {PLANS.map((p) => (
                    <th key={p.key} className="py-2 px-1.5 font-semibold">
                      <span className="text-forest-950 font-bold">{p.label}</span>
                      <span className="block text-[10px] font-normal text-gray-500">{p.hint}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t) => (
                  <tr key={t.key} className="border-t border-sand-200 align-top">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2 font-bold text-forest-950 text-sm">
                        <span className={`w-2.5 h-2.5 rounded-full ${t.dot}`} />
                        {t.label}
                        {t.key === todayTier && (
                          <span className="text-[10px] font-semibold bg-forest-900 text-white px-1.5 py-0.5 rounded">Today</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{t.when}</div>
                    </td>
                    {PLANS.map((p) => (
                      <td key={p.key} className="py-3 px-1.5">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-forest-600 text-xs">₹</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            aria-label={`${t.label} ${p.label} price per night`}
                            disabled={!canEdit}
                            value={draft[t.key][p.key] ? String(draft[t.key][p.key]) : ''}
                            placeholder="0"
                            onChange={(e) => setRate(t.key, p.key, e.target.value)}
                            className={`w-full pl-6 pr-2 py-2 rounded-xl border text-sm font-bold text-forest-950 focus:outline-none focus:ring-2 focus:ring-forest-600 disabled:opacity-70 ${t.input} ${
                              !(draft[t.key][p.key] > 0) ? 'ring-1 ring-rose-300' : ''
                            }`}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Other price rules */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <NumberField
              icon={<Percent className="w-3.5 h-3.5 text-forest-700" />}
              label="Weekend surcharge (%)"
              help="Added to Friday and Saturday nights in the Regular season only."
              value={draft.weekendSurchargePercent ?? 0}
              disabled={!canEdit}
              onChange={(v) => setField('weekendSurchargePercent', v)}
            />
            <NumberField
              icon={<Users className="w-3.5 h-3.5 text-forest-700" />}
              label="Adults included in the price"
              help="Extra-adult charges start above this number."
              value={draft.baseAdults ?? 2}
              disabled={!canEdit}
              onChange={(v) => setField('baseAdults', v)}
            />
            <NumberField
              icon={<Users className="w-3.5 h-3.5 text-forest-700" />}
              label="Extra adult (₹ per night)"
              help="For each adult above the included number."
              value={draft.extraAdultRate ?? 0}
              disabled={!canEdit}
              onChange={(v) => setField('extraAdultRate', v)}
            />
            <NumberField
              icon={<Users className="w-3.5 h-3.5 text-forest-700" />}
              label="Extra child (₹ per night)"
              help="For each child who does not stay free."
              value={draft.extraChildRate ?? 0}
              disabled={!canEdit}
              onChange={(v) => setField('extraChildRate', v)}
            />
            <NumberField
              icon={<Users className="w-3.5 h-3.5 text-forest-700" />}
              label="Children stay free under age"
              help="0 = every child is charged."
              value={draft.freeChildUnderAge ?? 0}
              disabled={!canEdit}
              onChange={(v) => setField('freeChildUnderAge', v)}
            />
          </div>

          {(errors.length > 0 || hints.length > 0) && (
            <div className="space-y-1.5">
              {errors.map((e) => (
                <p key={e} className="text-xs text-rose-700 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {e}
                </p>
              ))}
              {hints.map((h) => (
                <p key={h} className="text-xs text-amber-800 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Check: {h}
                </p>
              ))}
            </div>
          )}

          {/* Preview of one night, Regular CP, 2 adults, to sanity-check the numbers */}
          {!missing.length && (
            <p className="text-[11px] text-gray-500">
              Example: 2 adults, CP, one Regular weeknight = {rupees(draft.regular.CP)}
              {(draft.weekendSurchargePercent ?? 0) > 0 &&
                `; a Regular Friday or Saturday = ${rupees(draft.regular.CP * (1 + (draft.weekendSurchargePercent ?? 0) / 100))}`}
              ; Peak = {rupees(draft.season.CP)}; Off-season = {rupees(draft.offSeason.CP)}. GST is added at checkout.
            </p>
          )}

          {canEdit ? (
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2 border-t border-sand-200">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={!dirty || saving}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-sand-300 text-xs sm:text-sm font-semibold text-forest-900 disabled:opacity-40"
              >
                <RotateCcw className="w-4 h-4" />
                Discard changes
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || (!dirty && Boolean(saved))}
                className={`inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50 ${
                  dirty || !saved ? 'bg-terracotta-600 hover:bg-terracotta-700' : 'bg-forest-800'
                }`}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : `Save prices for ${room?.name || 'this room'}`}
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Only an admin or manager can change prices.</p>
          )}
        </div>
      )}
    </div>
  );
}

function NumberField({
  icon,
  label,
  help,
  value,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  help: string;
  value: number;
  disabled?: boolean;
  onChange: (raw: string) => void;
}) {
  return (
    <label className="block p-3 bg-sand-50 rounded-xl border border-sand-200">
      <span className="flex items-center gap-1.5 text-xs font-bold text-forest-950">
        {icon}
        {label}
      </span>
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={value ? String(value) : ''}
        placeholder="0"
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full px-3 py-2 bg-white border border-sand-300 rounded-xl text-sm font-bold text-forest-950 focus:outline-none focus:ring-2 focus:ring-forest-600 disabled:opacity-70"
      />
      <span className="text-[10px] text-gray-500 mt-1 block">{help}</span>
    </label>
  );
}
