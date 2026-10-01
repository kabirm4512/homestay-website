'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, UploadCloud, Trash2, CheckCircle2 } from 'lucide-react';
import { compressDataUrl } from '@/lib/image-upload';

/**
 * The old version kept front-desk data (bookings, folios, food orders, expenses …) only in
 * this browser's storage. This banner shows what is still here and lets an admin move it to
 * the server, download a backup, and then clear it from the device. Nothing is deleted
 * automatically.
 */

const OPERATION_KEYS: Record<string, string> = {
  wp_crm_bookings: 'crmBookings',
  wp_crm_folios: 'folios',
  wp_crm_food_orders: 'foodOrders',
  wp_crm_dispatch: 'dispatchRequests',
  wp_crm_housekeeping: 'housekeepingTasks',
  wp_crm_expenses: 'expenses',
  wp_crm_activity_logs: 'activityLogs',
  homestay_bookings: 'bookings',
  homestay_inquiries: 'inquiries',
};

const CONTENT_KEYS: Record<string, string> = {
  wp_crm_rooms: 'physicalRooms',
  wp_crm_menu_items: 'menuItems',
  wp_crm_transfer_routes: 'transferRoutes',
  wp_crm_rental_vehicles: 'rentalVehicles',
  wp_crm_room_tariffs: 'roomTariffs',
  wp_crm_seasonal_ranges: 'seasonalDateRanges',
  wp_site_rooms: 'rooms',
};

const OTHER_KEYS = ['wp_site_cms', 'wp_crm_staff_accounts', 'wp_crm_version_key'];

const LABELS: Record<string, string> = {
  crmBookings: 'front-desk bookings',
  folios: 'guest folios',
  foodOrders: 'food orders',
  dispatchRequests: 'transport requests',
  housekeepingTasks: 'housekeeping tasks',
  expenses: 'expenses',
  activityLogs: 'activity log entries',
  bookings: 'website bookings',
  inquiries: 'inquiries',
};

const CHUNK_BYTES = 2_500_000; // stay well under the hosting request limit

/** Old uploads were stored uncompressed; shrink embedded photos so each request stays small. */
async function shrinkImages(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...data };
  const fix = async (v: unknown) => (typeof v === 'string' && v.startsWith('data:image/') ? compressDataUrl(v).catch(() => v) : v);
  if (Array.isArray(out.crmBookings)) {
    out.crmBookings = await Promise.all(
      (out.crmBookings as { guest?: Record<string, unknown> }[]).map(async (b) =>
        b.guest
          ? { ...b, guest: { ...b.guest, idDocumentUrl: await fix(b.guest.idDocumentUrl), idDocumentBackUrl: await fix(b.guest.idDocumentBackUrl) } }
          : b
      )
    );
  }
  if (Array.isArray(out.rooms)) {
    out.rooms = await Promise.all(
      (out.rooms as { images?: unknown[] }[]).map(async (r) => ({ ...r, images: await Promise.all((r.images || []).map(fix)) }))
    );
  }
  if (Array.isArray(out.heroSlides)) {
    out.heroSlides = await Promise.all((out.heroSlides as { image?: unknown }[]).map(async (h) => ({ ...h, image: await fix(h.image) })));
  }
  return out;
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

interface Snapshot {
  operations: Record<string, unknown[]>;
  content: Record<string, unknown>;
  staffNames: string[];
  keys: string[];
}

function takeSnapshot(): Snapshot {
  const operations: Record<string, unknown[]> = {};
  const content: Record<string, unknown> = {};
  const keys: string[] = [];
  for (const [key, field] of Object.entries(OPERATION_KEYS)) {
    const v = readJson(key);
    if (Array.isArray(v) && v.length > 0) {
      operations[field] = v;
      keys.push(key);
    }
  }
  for (const [key, field] of Object.entries(CONTENT_KEYS)) {
    const v = readJson(key);
    if (v && (Array.isArray(v) ? v.length > 0 : Object.keys(v as object).length > 0)) {
      content[field] = field === 'seasonalDateRanges' && !Array.isArray(v) ? (v as { ranges?: unknown }).ranges : v;
      keys.push(key);
    }
  }
  const cms = readJson('wp_site_cms') as Record<string, unknown> | null;
  if (cms && typeof cms === 'object') {
    for (const f of ['heroSlides', 'aboutData', 'siteInfo', 'reviews']) if (cms[f]) content[f] = cms[f];
    keys.push('wp_site_cms');
  }
  const staff = readJson('wp_crm_staff_accounts');
  const staffNames = Array.isArray(staff) ? staff.map((s: { fullName?: string; email?: string; role?: string }) => `${s.fullName || s.email} (${s.role || 'staff'})`) : [];
  if (staffNames.length) keys.push('wp_crm_staff_accounts');
  if (localStorage.getItem('wp_crm_version_key')) keys.push('wp_crm_version_key');
  return { operations, content, staffNames, keys };
}

/** Splits the payload into requests of a safe size (whole records, never split). */
function chunkPayload(data: Record<string, unknown>): Record<string, unknown>[] {
  const chunks: Record<string, unknown>[] = [];
  let current: Record<string, unknown> = {};
  let size = 0;
  const push = () => {
    if (Object.keys(current).length) chunks.push(current);
    current = {};
    size = 0;
  };
  for (const [field, value] of Object.entries(data)) {
    if (!Array.isArray(value)) {
      const s = JSON.stringify(value).length;
      if (size + s > CHUNK_BYTES) push();
      current[field] = value;
      size += s;
      continue;
    }
    for (const item of value) {
      const s = JSON.stringify(item).length;
      if (size + s > CHUNK_BYTES) push();
      const list = (current[field] as unknown[] | undefined) || [];
      list.push(item);
      current[field] = list;
      size += s;
    }
  }
  push();
  return chunks;
}

export default function LegacyDataMigration({ isAdmin, showToast }: { isAdmin: boolean; showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [includeContent, setIncludeContent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moved, setMoved] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [result, setResult] = useState<string>('');

  useEffect(() => {
    try {
      const s = takeSnapshot();
      if (s.keys.length > 0) setSnapshot(s);
    } catch {}
  }, []);

  const summary = useMemo(() => {
    if (!snapshot) return '';
    return Object.entries(snapshot.operations)
      .map(([k, v]) => `${v.length} ${LABELS[k] || k}`)
      .join(', ');
  }, [snapshot]);

  if (!snapshot) return null;
  const hasOperations = Object.keys(snapshot.operations).length > 0;

  const download = () => {
    const backup: Record<string, unknown> = { exportedAt: new Date().toISOString() };
    for (const key of snapshot.keys) {
      try {
        backup[key] = JSON.parse(localStorage.getItem(key) || 'null');
      } catch {
        backup[key] = localStorage.getItem(key);
      }
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `savera-device-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setDownloaded(true);
  };

  const moveToServer = async () => {
    setBusy(true);
    setResult('');
    try {
      const totals: Record<string, number> = {};
      const kept: Record<string, number> = {};
      const warnings: string[] = [];
      const send = async (data: Record<string, unknown>, content: boolean, operations: boolean) => {
        for (const chunk of chunkPayload(await shrinkImages(data))) {
          const res = await fetch('/api/admin/legacy-import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ includeContent: content, includeOperations: operations, data: chunk }),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.success) throw new Error(json?.error || `Server error (${res.status})`);
          for (const [k, v] of Object.entries(json.report.added as Record<string, number>)) totals[k] = (totals[k] || 0) + v;
          for (const [k, v] of Object.entries(json.report.updated as Record<string, number>)) totals[k] = (totals[k] || 0) + v;
          for (const [k, v] of Object.entries(json.report.kept as Record<string, number>)) kept[k] = (kept[k] || 0) + v;
          warnings.push(...(json.report.warnings as string[]));
        }
      };
      // Rooms and menus first (bookings refer to them), then the front-desk records
      if (includeContent) await send(snapshot.content, true, false);
      if (hasOperations) await send(snapshot.operations, false, true);
      const added = Object.entries(totals).map(([k, v]) => `${v} ${LABELS[k] || k}`).join(', ') || 'nothing new';
      const already = Object.entries(kept).map(([k, v]) => `${v} ${LABELS[k] || k}`).join(', ');
      setResult(`Saved to the server: ${added}.${already ? ` Already on the server (kept): ${already}.` : ''}${warnings.length ? ` Please check: ${warnings.join(' ')}` : ''}`);
      setMoved(true);
      showToast('This device’s data is now on the server.');
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'The move failed. Nothing on this device was changed.');
      showToast('Could not move the data. Nothing on this device was changed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const clearDevice = () => {
    if (!moved && !downloaded) return;
    for (const key of snapshot.keys.concat(OTHER_KEYS)) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
    setSnapshot(null);
    showToast('Old data removed from this browser.');
  };

  return (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-bold">This browser still holds data from the old version</p>
          <p>
            {hasOperations ? <>Found {summary}. </> : null}
            The old version saved front-desk records only on the device, so other staff could not see them. Move them to the
            server so every device shares them; records the server already has are kept as they are.
          </p>
          {snapshot.staffNames.length > 0 && (
            <p>
              Old staff logins are not carried over (they stored passwords insecurely). Recreate them in Staff:{' '}
              <span className="font-semibold">{snapshot.staffNames.join(', ')}</span>.
            </p>
          )}
          {isAdmin ? (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={includeContent} onChange={(e) => setIncludeContent(e.target.checked)} />
                <span>
                  Also replace the server’s website content, tariffs and menus with this browser’s copy (only if your recent edits
                  are missing on the live site)
                </span>
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={download} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400 bg-white px-3 py-2 font-bold">
                  <Download className="h-4 w-4" /> Download backup
                </button>
                <button
                  onClick={moveToServer}
                  disabled={busy || moved || (!hasOperations && !includeContent)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 font-bold text-white disabled:opacity-50"
                >
                  {moved ? <CheckCircle2 className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
                  {busy ? 'Moving…' : moved ? 'Moved' : 'Move to server'}
                </button>
                <button
                  onClick={clearDevice}
                  disabled={!moved && !downloaded}
                  title={!moved && !downloaded ? 'Move to the server or download a backup first' : ''}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-3 py-2 font-bold text-red-700 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" /> Remove from this browser
                </button>
              </div>
              {result && <p className="rounded-lg bg-white/70 p-2">{result}</p>}
            </>
          ) : (
            <p className="font-semibold">Ask the administrator to sign in on this device to move this data.</p>
          )}
        </div>
      </div>
    </div>
  );
}
