import { handler, ok } from '@/lib/server/http';
import { listPublicPhysicalRooms } from '@/lib/server/repos/physical-rooms';

export const dynamic = 'force-dynamic';

/** Public room list (numbers, names, categories). No QR secrets or live occupancy. */
export const GET = handler('physical_rooms.list', async () => ok({ data: await listPublicPhysicalRooms() }));
