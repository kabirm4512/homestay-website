import crypto from 'crypto';
import { SqlOrTx } from './db';
import { upsertRecord } from './repos/records';
import { log } from './logger';
import type { StaffAlert } from '@/types/crm';

export type { StaffAlert };

/** In-app alert for the front desk (chime + flash card in the admin). Never throws. */
export async function raiseStaffAlert(alert: Omit<StaffAlert, 'id' | 'createdAt' | 'acknowledged'>, db?: SqlOrTx): Promise<void> {
  try {
    await upsertRecord(
      'staffAlerts',
      { ...alert, id: `alt-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), acknowledged: false },
      'system',
      db
    );
  } catch (err) {
    log.error('alerts.raise_failed', err, { type: alert.type });
  }
}
