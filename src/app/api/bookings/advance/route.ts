import { z } from 'zod';
import { handler, ok, readJson, clientIp } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { recordWebAdvance } from '@/lib/server/folio-store';

export const dynamic = 'force-dynamic';

const Body = z.object({
  bookingId: z.string().min(1).max(100),
  amount: z.number().positive().max(1_000_000),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'card']),
  transactionReference: z.string().max(120).optional(),
  receiptNotes: z.string().max(300).optional(),
  signOffConfirmed: z.literal(true, { errorMap: () => ({ message: 'Please tick the confirmation to sign this advance.' }) }),
});

/**
 * Manager: record a deposit / advance received for a WEBSITE booking request (before a room
 * is assigned). It is signed and server-stamped like every collection, counts in the day's
 * collections and the manager's cash book, and moves to the room bill when the room is assigned.
 */
export const POST = handler('bookings.advance', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.MANAGERS);
  const body = await readJson(request, Body);
  const folio = await recordWebAdvance(
    body.bookingId,
    {
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      transactionReference: body.transactionReference,
      receiptNotes: body.receiptNotes || 'Advance for website booking',
      signOffConfirmed: true,
    },
    staff,
    clientIp(request)
  );
  return ok({ folio }, { status: 201 });
});
