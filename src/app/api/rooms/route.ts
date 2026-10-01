import { z } from 'zod';
import { handler, ok, readJson, HttpError, clientIp } from '@/lib/server/http';
import { getStaff, requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { listRoomCategories, saveRoomCategory, deleteRoomCategory } from '@/lib/server/repos/rooms';
import { persistDataUrl } from '@/lib/server/repos/files';
import { audit } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Public: active room categories. Staff with ?all=1 also get inactive ones. */
export const GET = handler('rooms.list', async (request: Request) => {
  const all = new URL(request.url).searchParams.get('all') === '1';
  const includeInactive = all && Boolean(await getStaff(request));
  return ok({ data: await listRoomCategories({ includeInactive }) });
});

const RoomInput = z
  .object({
    id: z.string().max(100).optional(),
    name: z.string().trim().min(1).max(150),
    images: z.array(z.string().max(9_000_000)).max(20).optional(),
  })
  .passthrough();

/** Admin / manager: create or update a room category (details & photos). */
export const POST = handler('rooms.save', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.MANAGERS);
  const actor = `staff:${staff.id}`;
  const body = await readJson(request, RoomInput);
  // Inline photos (legacy uploads) are moved into public storage; URLs are kept as-is.
  let images = body.images;
  if (images) {
    images = await Promise.all(
      images.map(async (img) => (await persistDataUrl(img, { visibility: 'public', ownerKind: 'room', ownerId: body.id, actor })) || img)
    );
    images = images.filter((u) => u && !u.includes('images.unsplash.com'));
  }
  const { before, after } = await saveRoomCategory({ ...(body as Record<string, unknown>), name: body.name, images } as never);
  await audit({ actor, action: before ? 'update' : 'create', entity: 'room_category', entityId: after.id, before, after, ip: clientIp(request) });
  return ok({ data: after });
});

/** Admin: delete a room category. */
export const DELETE = handler('rooms.delete', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.ADMIN);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) throw new HttpError(400, 'Room ID is required');
  const before = await deleteRoomCategory(id);
  await audit({ actor: `staff:${staff.id}`, action: 'delete', entity: 'room_category', entityId: id, before, ip: clientIp(request) });
  return ok({ deleted: Boolean(before) });
});
