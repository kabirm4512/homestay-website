import { getSql, SqlOrTx } from '../db';
import type { Room } from '@/types';
import { ensureSeeded } from '../seed';

/** Website room categories. */

function rowToRoom(row: { id: string; is_active: boolean; data: Room }): Room {
  return { ...row.data, id: row.id, is_active: row.is_active };
}

export async function listRoomCategories(opts: { includeInactive?: boolean } = {}, db?: SqlOrTx): Promise<Room[]> {
  await ensureSeeded();
  const sql = db || getSql();
  const rows = opts.includeInactive
    ? await sql<{ id: string; is_active: boolean; data: Room }[]>`
        select id, is_active, data from pms.room_categories order by sort_order, created_at`
    : await sql<{ id: string; is_active: boolean; data: Room }[]>`
        select id, is_active, data from pms.room_categories where is_active order by sort_order, created_at`;
  return rows.map(rowToRoom);
}

export async function getRoomCategory(id: string, db?: SqlOrTx): Promise<Room | null> {
  const sql = db || getSql();
  const rows = await sql<{ id: string; is_active: boolean; data: Room }[]>`
    select id, is_active, data from pms.room_categories where id = ${id}`;
  return rows[0] ? rowToRoom(rows[0]) : null;
}

/** Creates or partially updates a room category; fields not sent are kept. */
export async function saveRoomCategory(input: Partial<Room> & { name: string }, db?: SqlOrTx): Promise<{ before: Room | null; after: Room }> {
  const sql = db || getSql();
  const id = input.id || `room-${Date.now()}`;
  const before = input.id ? await getRoomCategory(input.id, sql) : null;
  const now = new Date().toISOString();
  const base: Room = before || {
    id,
    name: input.name,
    slug: (input.slug || input.name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: '',
    room_type: 'Deluxe Suite',
    price_per_night: 0,
    capacity_adults: 2,
    capacity_children: 0,
    base_adults: 2,
    bed_type: 'King Bed',
    room_size_sqft: 350,
    amenities: [],
    images: [],
    total_inventory: 1,
    available_inventory: 1,
    is_active: true,
    created_at: now,
  };
  const merged: Room = { ...base };
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) (merged as unknown as Record<string, unknown>)[k] = v;
  }
  // Keep existing photos when an update doesn't send any (partial updates such as toggles)
  if (!Array.isArray(input.images) || input.images.length === 0) merged.images = base.images;
  merged.id = id;
  merged.updated_at = now;
  for (const k of ['price_per_night', 'weekend_price', 'capacity_adults', 'capacity_children', 'base_adults', 'room_size_sqft', 'total_inventory', 'available_inventory', 'extra_adult_charge', 'extra_child_charge'] as const) {
    const v = merged[k];
    if (v !== undefined && v !== null) (merged as unknown as Record<string, unknown>)[k] = Number(v) || 0;
  }
  const order = before ? undefined : Date.now() % 1_000_000;
  await sql`
    insert into pms.room_categories (id, sort_order, is_active, data, updated_at)
    values (${id}, ${order ?? 0}, ${merged.is_active !== false}, ${sql.json(merged as never)}, now())
    on conflict (id) do update set is_active = excluded.is_active, data = excluded.data, updated_at = now()`;
  return { before, after: merged };
}

export async function deleteRoomCategory(id: string, db?: SqlOrTx): Promise<Room | null> {
  const sql = db || getSql();
  const before = await getRoomCategory(id, sql);
  await sql`delete from pms.room_categories where id = ${id}`;
  return before;
}

/** Mirrors display price fields after a tariff save (never used for pricing). */
export async function mirrorDisplayPrices(categoryId: string, fields: Partial<Room>, db?: SqlOrTx): Promise<void> {
  const sql = db || getSql();
  await sql`
    update pms.room_categories
    set data = data || ${sql.json(fields as never)}, updated_at = now()
    where id = ${categoryId}`;
}
