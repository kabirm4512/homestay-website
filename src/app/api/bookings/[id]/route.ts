import { z } from 'zod';
import { handler, ok, readJson, clientIp } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { amendBooking, deleteBookingByAdmin } from '@/lib/server/booking-amend';

export const dynamic = 'force-dynamic';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD dates.');

const Amend = z.object({
  reason: z.string().trim().min(3, 'Please give a reason for the change.').max(300),
  checkInDate: date.optional(),
  checkOutDate: date.optional(),
  roomId: z.string().min(1).max(100).optional(),
  mealPlan: z.enum(['EP', 'CP', 'MAP', 'AP']).optional(),
  adultsCount: z.number().int().min(1).max(20).optional(),
  childrenCount: z.number().int().min(0).max(20).optional(),
  roomRatePerNight: z.number().min(0).max(500000).optional(),
  guestName: z.string().trim().max(120).optional(),
  guestPhone: z.string().trim().max(20).optional(),
  specialRequests: z.string().max(1000).optional(),
});

const Delete = z.object({
  reason: z.string().trim().min(3, 'Please give a reason.').max(300),
});

/** Admin: amend a booking (dates, room, meal plan, guests, rate). Room rules and the bill follow. */
export const PATCH = handler('bookings.amend', async (request: Request, ctx: { params: { id: string } }) => {
  const staff = await requireStaff(request, ROLES.ADMIN);
  const body = await readJson(request, Amend);
  return ok(await amendBooking(ctx.params.id, body, staff, clientIp(request)));
});

/** Admin: delete a booking made by mistake (not allowed once money is recorded or the guest is in-house). */
export const DELETE = handler('bookings.delete', async (request: Request, ctx: { params: { id: string } }) => {
  const staff = await requireStaff(request, ROLES.ADMIN);
  const body = await readJson(request, Delete);
  return ok(await deleteBookingByAdmin(ctx.params.id, body, staff, clientIp(request)));
});
