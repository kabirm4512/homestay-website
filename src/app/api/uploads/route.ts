import { z } from 'zod';
import { handler, ok, readJson, HttpError } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { getStaff } from '@/lib/server/auth/staff-session';
import { getGuestBooking } from '@/lib/server/auth/guest-session';
import { decodeDataUrl, storeFile } from '@/lib/server/repos/files';

export const dynamic = 'force-dynamic';

const Body = z.object({
  kind: z.enum(['room_photo', 'cms_image', 'id_document', 'receipt']),
  dataUrl: z.string().min(20).max(9_000_000),
  bookingId: z.string().max(100).optional(),
});

/**
 * Upload a (browser-compressed) image.
 *  room_photo / cms_image: admin & managers → public storage
 *  id_document: staff, or the signed-in guest for their own booking → private storage
 *  receipt: staff → private storage
 */
export const POST = handler('uploads.create', async (request: Request) => {
  await rateLimit(request, 'upload', 40, 10 * 60);
  const body = await readJson(request, Body);
  const staff = await getStaff(request);
  let actor: string;
  let ownerId: string | undefined;

  if (body.kind === 'room_photo' || body.kind === 'cms_image') {
    if (!staff || staff.role === 'kitchen_staff') throw new HttpError(401, 'Please sign in to upload photos.', 'AUTH_REQUIRED');
    actor = `staff:${staff.id}`;
  } else if (staff) {
    actor = `staff:${staff.id}`;
    ownerId = body.bookingId;
  } else {
    const guest = await getGuestBooking(request);
    if (!guest || (body.bookingId && body.bookingId !== guest.id)) {
      throw new HttpError(401, 'Please sign in with your Booking ID and mobile number first.', 'GUEST_AUTH_REQUIRED');
    }
    if (body.kind !== 'id_document') throw new HttpError(403, 'Not allowed.');
    actor = `guest:${guest.id}`;
    ownerId = guest.id;
  }

  const { bytes, contentType } = decodeDataUrl(body.dataUrl);
  const stored = await storeFile({
    bytes,
    contentType,
    visibility: body.kind === 'room_photo' || body.kind === 'cms_image' ? 'public' : 'private',
    ownerKind: body.kind === 'room_photo' ? 'room' : body.kind === 'cms_image' ? 'cms' : body.kind === 'receipt' ? 'receipt' : 'booking',
    ownerId,
    actor,
  });
  return ok({ file: stored }, { status: 201 });
}, { timeoutMs: 60_000 });
