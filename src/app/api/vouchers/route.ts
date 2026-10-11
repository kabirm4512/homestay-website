import { z } from 'zod';
import { handler, ok, readJson } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { voucherPath } from '@/lib/server/vouchers';

export const dynamic = 'force-dynamic';

const Body = z.object({ bookingId: z.string().min(1).max(100) });

/** Manager / admin: the shareable voucher link for a booking (covers its whole group). */
export const POST = handler('vouchers.link', async (request: Request) => {
  await requireStaff(request, ROLES.MANAGERS);
  const { bookingId } = await readJson(request, Body);
  return ok({ path: voucherPath(bookingId) });
});
