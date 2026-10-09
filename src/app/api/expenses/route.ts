import { z } from 'zod';
import { handler, ok, readJson, clientIp, HttpError } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { createExpense, listExpensesFor, reviewExpense } from '@/lib/server/expenses';
import { isCalendarDate } from '@/lib/tariff-calculator';

export const dynamic = 'force-dynamic';

/** Admins: every expense; managers: their own. ?from=YYYY-MM-DD&to=YYYY-MM-DD */
export const GET = handler('expenses.list', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.MANAGERS);
  const params = new URL(request.url).searchParams;
  const from = params.get('from') || undefined;
  const to = params.get('to') || undefined;
  if ((from && !isCalendarDate(from)) || (to && !isCalendarDate(to))) throw new HttpError(400, 'Dates must be YYYY-MM-DD.');
  return ok({ expenses: await listExpensesFor(staff, { from, to }) });
});

const Create = z.object({
  id: z.string().min(8).max(100),
  amount: z.number().positive().max(1_000_000),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'card']),
  masterCategory: z.enum(['groceries', 'utilities', 'housekeeping', 'maintenance', 'staff_payroll', 'marketing', 'transport_vendor', 'miscellaneous']),
  subTag: z.string().trim().min(1).max(80),
  vendorPayee: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  // A compressed photo (data URL), stored privately; ~3 MB of base64 at most
  billReceiptUrl: z.string().max(3_500_000).optional(),
  signOffConfirmed: z.literal(true, { errorMap: () => ({ message: 'Please tick the confirmation to sign this expense.' }) }),
});

/**
 * Managers: log a signed expense. The server sets the date, the signer and the time.
 * Idempotent on `id`: sending the same entry again (offline queue, retry) returns the saved one.
 */
export const POST = handler(
  'expenses.create',
  async (request: Request) => {
    const staff = await requireStaff(request, ROLES.MANAGERS);
    const body = await readJson(request, Create);
    const { expense, duplicate } = await createExpense(body, staff, clientIp(request));
    return ok({ expense, duplicate }, { status: duplicate ? 200 : 201 });
  },
  { timeoutMs: 45_000 }
);

const Review = z.union([
  z.object({ id: z.string().min(1), action: z.literal('approve') }),
  z.object({ id: z.string().min(1), action: z.literal('void'), reason: z.string().trim().min(3).max(300) }),
]);

/** Admins: approve an expense, or void it with a reason. */
export const PATCH = handler('expenses.review', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.ADMIN);
  const body = await readJson(request, Review);
  const expense = await reviewExpense(
    body.id,
    body.action === 'void' ? { status: 'void', voidReason: body.reason } : { status: 'approved' },
    staff,
    clientIp(request)
  );
  return ok({ expense });
});
