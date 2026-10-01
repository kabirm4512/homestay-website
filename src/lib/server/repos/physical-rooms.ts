import { getSql, SqlOrTx } from '../db';
import type { PhysicalRoom } from '@/types/crm';
import { normalizeCategoryId } from '@/lib/tariff-calculator';
import { ensureSeeded, newQrToken } from '../seed';

interface Row {
  id: string;
  room_number: number;
  category_id: string;
  qr_token: string;
  data: PhysicalRoom;
}

function rowToRoom(r: Row): PhysicalRoom {
  return { ...r.data, id: r.id, roomNumber: r.room_number, qrSecretToken: r.qr_token };
}

/** Full rooms incl. QR tokens and live status (staff only). */
export async function listPhysicalRooms(db?: SqlOrTx): Promise<PhysicalRoom[]> {
  await ensureSeeded();
  const sql = db || getSql();
  const rows = await sql<Row[]>`select * from pms.physical_rooms order by room_number`;
  return rows.map(rowToRoom);
}

/** What guests may see about rooms (no QR secrets, no live occupancy). */
export type PublicPhysicalRoom = Pick<PhysicalRoom, 'id' | 'roomNumber' | 'name' | 'categoryId' | 'categoryCode' | 'categoryName' | 'floorLevel'>;

export async function listPublicPhysicalRooms(): Promise<PublicPhysicalRoom[]> {
  const rooms = await listPhysicalRooms();
  return rooms.map((r) => ({
    id: r.id,
    roomNumber: r.roomNumber,
    name: r.name,
    categoryId: r.categoryId,
    categoryCode: r.categoryCode,
    categoryName: r.categoryName,
    floorLevel: r.floorLevel,
  }));
}

export async function findPhysicalRoom(by: { id?: string; roomNumber?: number }, db?: SqlOrTx): Promise<PhysicalRoom | null> {
  const sql = db || getSql();
  const rows = by.id
    ? await sql<Row[]>`select * from pms.physical_rooms where id = ${by.id}`
    : await sql<Row[]>`select * from pms.physical_rooms where room_number = ${by.roomNumber ?? -1}`;
  return rows[0] ? rowToRoom(rows[0]) : null;
}

/** Upsert from the CRM. The QR token is server-managed: a client can only keep or rotate it. */
export async function upsertPhysicalRoom(room: PhysicalRoom, opts: { rotateToken?: boolean } = {}, db?: SqlOrTx): Promise<{ before: PhysicalRoom | null; after: PhysicalRoom }> {
  const sql = db || getSql();
  const before = await findPhysicalRoom({ id: room.id }, sql);
  const token = opts.rotateToken || !before ? newQrToken() : before.qrSecretToken;
  const data: PhysicalRoom = { ...room, qrSecretToken: token };
  await sql`
    insert into pms.physical_rooms (id, room_number, category_id, qr_token, data, updated_at)
    values (${room.id}, ${room.roomNumber}, ${normalizeCategoryId(room.categoryId)}, ${token}, ${sql.json(data as never)}, now())
    on conflict (id) do update set room_number = excluded.room_number, category_id = excluded.category_id,
      qr_token = excluded.qr_token, data = excluded.data, updated_at = now()`;
  return { before, after: data };
}

export async function deletePhysicalRoom(id: string, db?: SqlOrTx): Promise<PhysicalRoom | null> {
  const sql = db || getSql();
  const before = await findPhysicalRoom({ id }, sql);
  await sql`delete from pms.physical_rooms where id = ${id}`;
  return before;
}
