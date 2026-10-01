import { getSql, SqlOrTx } from './db';
import { log } from './logger';

export interface AuditEntry {
  actor: string;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

/** Strips document images/ID numbers from audit snapshots (keep the trail, not the PII). */
function redact(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value ?? null;
  return JSON.parse(
    JSON.stringify(value, (key, v) => {
      if (['idDocumentUrl', 'idDocumentBackUrl', 'password', 'password_hash'].includes(key)) return v ? '[redacted]' : v;
      if (key === 'idNumber' && typeof v === 'string' && v.length > 4) return `••••${v.slice(-4)}`;
      if (typeof v === 'string' && v.startsWith('data:') && v.length > 200) return '[inline file]';
      return v;
    })
  );
}

export async function audit(entry: AuditEntry, db?: SqlOrTx): Promise<void> {
  try {
    const sql = db || getSql();
    await sql`
      insert into pms.audit_log (actor, action, entity, entity_id, before, after, ip)
      values (${entry.actor}, ${entry.action}, ${entry.entity}, ${entry.entityId ?? null},
              ${entry.before === undefined ? null : sql.json(redact(entry.before) as never)},
              ${entry.after === undefined ? null : sql.json(redact(entry.after) as never)},
              ${entry.ip ?? null})`;
  } catch (err) {
    // An audit failure must never block the business action, but it must be visible.
    log.error('audit.write_failed', err, { action: entry.action, entity: entry.entity, entityId: entry.entityId });
  }
}
