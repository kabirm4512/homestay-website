import { getSql, SqlOrTx } from '../db';
import { ensureSeeded } from '../seed';

/**
 * Generic front-desk collections stored row by row in pms.records.
 * (Bookings, physical rooms, rooms and staff have their own tables.)
 */
export const RECORD_COLLECTIONS = [
  'folios',
  'foodOrders',
  'dispatchRequests',
  'housekeepingTasks',
  'expenses',
  'menuItems',
  'transferRoutes',
  'rentalVehicles',
  'activityLogs',
  'staffAlerts',
] as const;

export type RecordCollection = (typeof RECORD_COLLECTIONS)[number];

export function isRecordCollection(v: string): v is RecordCollection {
  return (RECORD_COLLECTIONS as readonly string[]).includes(v);
}

const CATALOGS: RecordCollection[] = ['menuItems', 'transferRoutes', 'rentalVehicles'];

/** Catalogues come back in the order they were created; operational records newest first. */
export async function listRecords<T = Record<string, unknown>>(collection: RecordCollection, opts: { limit?: number } = {}, db?: SqlOrTx): Promise<T[]> {
  await ensureSeeded();
  const sql = db || getSql();
  const limit = opts.limit ?? 5000;
  const rows = CATALOGS.includes(collection)
    ? await sql<{ data: T }[]>`select data from pms.records where collection = ${collection} order by seq asc limit ${limit}`
    : await sql<{ data: T }[]>`select data from pms.records where collection = ${collection} order by seq desc limit ${limit}`;
  return rows.map((r) => r.data);
}

/**
 * Several collections in ONE database round trip (same ordering and limits as listRecords).
 * The CRM working set uses this: the database is in another region, so round trips dominate.
 */
export async function listRecordsMany(
  collections: RecordCollection[],
  limits: Partial<Record<RecordCollection, number>> = {},
  db?: SqlOrTx
): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const c of collections) out[c] = [];
  if (collections.length === 0) return out;
  await ensureSeeded();
  const sql = db || getSql();
  const limitMap: Record<string, number> = {};
  for (const c of collections) limitMap[c] = limits[c] ?? 5000;
  const rows = await sql<{ collection: string; data: unknown }[]>`
    select collection, data from (
      select collection, data,
             row_number() over (
               partition by collection
               order by case when collection = any(${CATALOGS}) then seq else -seq end
             ) as rn
      from pms.records
      where collection = any(${collections})
    ) x
    where rn <= coalesce((${sql.json(limitMap)}::jsonb ->> collection)::int, 5000)
    order by collection, rn`;
  for (const r of rows) out[r.collection].push(r.data);
  return out;
}

export async function getRecord<T = Record<string, unknown>>(collection: RecordCollection, id: string, db?: SqlOrTx): Promise<T | null> {
  const sql = db || getSql();
  const rows = await sql<{ data: T }[]>`select data from pms.records where collection = ${collection} and id = ${id}`;
  return rows[0]?.data ?? null;
}

export async function upsertRecord<T extends { id: string }>(collection: RecordCollection, record: T, actor: string, db?: SqlOrTx): Promise<T> {
  const sql = db || getSql();
  await sql`
    insert into pms.records (collection, id, data, updated_by)
    values (${collection}, ${record.id}, ${sql.json(record as never)}, ${actor})
    on conflict (collection, id) do update set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by`;
  return record;
}

export async function deleteRecord(collection: RecordCollection, id: string, db?: SqlOrTx): Promise<boolean> {
  const sql = db || getSql();
  const rows = await sql`delete from pms.records where collection = ${collection} and id = ${id} returning id`;
  return rows.length > 0;
}
