import type { GuestFolio } from '@/types/crm';
import { listRecords, upsertRecord } from './repos/records';
import { getGstConfig, getSetting, putSetting } from './repos/settings';
import { recalculateFolioTotals } from '@/lib/folio';
import { audit } from './audit';
import { log } from './logger';

/**
 * Applies the GST switch to every OPEN folio (settled bills keep the tax they were issued
 * with). Runs when an admin saves the GST rules, and once automatically after a deploy that
 * changes the switch (tracked in the `gst_mode_applied` setting).
 */
const APPLIED_KEY = 'gst_mode_applied';
let appliedInThisInstance: boolean | null = null;
let lastCheckAt = 0;

export async function applyGstModeToOpenFolios(actor: string): Promise<number> {
  const cfg = await getGstConfig();
  const folios = await listRecords<GuestFolio>('folios', { limit: 5000 });
  let changed = 0;
  for (const f of folios) {
    if (f.status !== 'open') continue;
    const next = recalculateFolioTotals(f, f.charges || [], f.payments || [], cfg);
    if (JSON.stringify(next) === JSON.stringify(f)) continue;
    await upsertRecord('folios', next, actor);
    await audit({ actor, action: cfg.enabled ? 'gst_on_recalculate' : 'gst_off_recalculate', entity: 'folios', entityId: f.id, before: f, after: next });
    changed += 1;
  }
  await putSetting(APPLIED_KEY, { enabled: cfg.enabled, at: new Date().toISOString(), folios: changed }, actor);
  appliedInThisInstance = cfg.enabled;
  return changed;
}

/** Cheap check on every CRM load; does the sweep once if the switch changed since last time. */
export async function ensureGstModeApplied(): Promise<void> {
  try {
    // Checked at most once a minute per server instance (a switch made in the admin is
    // applied immediately by the save itself; this only catches deploys and other instances).
    if (appliedInThisInstance !== null && Date.now() - lastCheckAt < 60_000) return;
    lastCheckAt = Date.now();
    const cfg = await getGstConfig();
    if (appliedInThisInstance === cfg.enabled) return;
    const applied = await getSetting<{ enabled?: boolean }>(APPLIED_KEY);
    if (applied && applied.enabled === cfg.enabled) {
      appliedInThisInstance = cfg.enabled;
      return;
    }
    const n = await applyGstModeToOpenFolios('system:gst-switch');
    log.info('gst.sweep', { enabled: cfg.enabled, folios: n });
  } catch (err) {
    log.error('gst.sweep_failed', err);
  }
}
