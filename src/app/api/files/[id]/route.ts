import { handler, HttpError } from '@/lib/server/http';
import { getStaff } from '@/lib/server/auth/staff-session';
import { getGuestBooking } from '@/lib/server/auth/guest-session';
import { getFileRow, readFileBytes } from '@/lib/server/repos/files';

export const dynamic = 'force-dynamic';

/**
 * Serves stored files. Public files (room photos) to anyone; private files (ID documents,
 * receipts) only to admin/manager staff or to the guest whose booking owns them.
 */
export const GET = handler('files.get', async (request: Request, ctx: { params: { id: string } }) => {
  const row = await getFileRow(ctx.params.id);
  if (!row) throw new HttpError(404, 'File not found.');
  if (row.visibility === 'private') {
    const staff = await getStaff(request);
    const staffOk = staff && staff.role !== 'kitchen_staff';
    let guestOk = false;
    if (!staffOk && row.owner_kind === 'booking' && row.owner_id) {
      const guest = await getGuestBooking(request);
      guestOk = Boolean(guest && guest.id === row.owner_id);
    }
    if (!staffOk && !guestOk) throw new HttpError(403, 'You do not have access to this file.');
  }
  const bytes = await readFileBytes(row);
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': row.content_type,
      'Content-Length': String(bytes.length),
      'Cache-Control': row.visibility === 'public' ? 'public, max-age=31536000, immutable' : 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
