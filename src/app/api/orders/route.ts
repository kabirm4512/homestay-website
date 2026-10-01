import { z } from 'zod';
import { handler, ok, readJson, HttpError, clientIp } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { getStaff, requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { getGuestBooking } from '@/lib/server/auth/guest-session';
import { getCrmBooking, rowToGuestBooking } from '@/lib/server/repos/bookings';
import { getRecord, listRecords, upsertRecord } from '@/lib/server/repos/records';
import { folioForGuest, ordersForGuest, placeCelebration, placeFoodOrder } from '@/lib/server/guest-services';
import { audit } from '@/lib/server/audit';
import type { StaffAlert } from '@/lib/server/alerts';
import type { CRMBooking, FoodOrder } from '@/types/crm';

export const dynamic = 'force-dynamic';

/** Resolves which booking a guest (or staff member acting for one) may act on. */
async function resolveBooking(request: Request, bookingId: string | null): Promise<{ booking: CRMBooking; actor: string; isStaff: boolean }> {
  const staff = await getStaff(request);
  if (staff) {
    if (!bookingId) throw new HttpError(400, 'Booking is required.');
    const booking = await getCrmBooking(bookingId);
    if (!booking) throw new HttpError(404, 'Booking not found.');
    return { booking, actor: `staff:${staff.id}`, isStaff: true };
  }
  const row = await getGuestBooking(request);
  if (!row || (bookingId && row.id !== bookingId)) {
    throw new HttpError(401, 'Please scan the QR code in your room or sign in with your Booking ID and mobile number.', 'GUEST_AUTH_REQUIRED');
  }
  return { booking: rowToGuestBooking(row), actor: `guest:${row.id}`, isStaff: false };
}

/**
 * GET
 *  ?alerts=true                 staff: unacknowledged front-desk alerts
 *  ?orders=true                 staff: all orders · guest: their own orders
 *  ?folio=true&booking=<id>     staff or that booking's guest: the folio
 */
export const GET = handler('orders.get', async (request: Request) => {
  const params = new URL(request.url).searchParams;

  if (params.get('alerts') === 'true') {
    await requireStaff(request, ROLES.ALL);
    const alerts = (await listRecords<StaffAlert>('staffAlerts', { limit: 100 })).filter((a) => !a.acknowledged);
    return ok({ alerts });
  }

  if (params.get('expenses') === 'true') {
    await requireStaff(request, ROLES.ADMIN);
    return ok({ expenses: await listRecords('expenses') });
  }

  if (params.get('folio') === 'true') {
    const { booking } = await resolveBooking(request, params.get('booking'));
    return ok({ folio: await folioForGuest(booking) });
  }

  const staff = await getStaff(request);
  if (staff) {
    const orders = await listRecords<FoodOrder>('foodOrders', { limit: 1500 });
    return ok({ orders: staff.role === 'kitchen_staff' ? orders.map((o) => ({ ...o, folioId: '' })) : orders });
  }
  const { booking } = await resolveBooking(request, null);
  return ok({ orders: await ordersForGuest(booking) });
});

const Order = z.object({
  type: z.enum(['food_order', 'special_request']).default('food_order'),
  bookingId: z.string().max(100).optional(),
  items: z
    .array(z.object({ menuItemId: z.string().max(100), quantity: z.number().int().min(1).max(20), itemNotes: z.string().max(300).optional() }).passthrough())
    .max(40)
    .optional(),
  celebrationId: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

/**
 * POST: in-room dining order or celebration request, from the guest (QR / portal) or
 * staff. Prices come from the live menu on the server; totals sent by the browser are ignored.
 */
export const POST = handler('orders.create', async (request: Request) => {
  await rateLimit(request, 'order', 20, 10 * 60);
  const body = await readJson(request, Order);
  const { booking, actor } = await resolveBooking(request, body.bookingId || null);
  const ip = clientIp(request);

  if (body.type === 'special_request') {
    if (!body.celebrationId) throw new HttpError(400, 'Please choose a celebration option.');
    const result = await placeCelebration({ booking, celebrationId: body.celebrationId, notes: body.notes, actor, ip });
    return ok(result, { status: 201 });
  }
  if (!body.items || body.items.length === 0) throw new HttpError(400, 'Your order is empty.');
  const result = await placeFoodOrder({
    booking,
    items: body.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, itemNotes: i.itemNotes })),
    specialInstructions: body.notes,
    actor,
    ip,
  });
  return ok(result, { status: 201 });
});

const Patch = z.union([
  z.object({ alertId: z.string().min(1), action: z.string().optional() }),
  z.object({
    orderId: z.string().min(1),
    status: z.enum(['pending_manager_approval', 'pending', 'accepted_kitchen', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']),
  }),
]);

/** Staff: acknowledge an alert or move an order along (the CRM normally syncs via /api/crm/mutate). */
export const PATCH = handler('orders.update', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.ALL);
  const body = await readJson(request, Patch);
  if ('alertId' in body) {
    const alert = await getRecord<StaffAlert>('staffAlerts', body.alertId);
    if (!alert) throw new HttpError(404, 'Alert not found.');
    await upsertRecord('staffAlerts', { ...alert, acknowledged: true }, `staff:${staff.id}`);
    return ok({ acknowledged: true });
  }
  if (body.status === 'accepted_kitchen' || body.status === 'cancelled') {
    if (staff.role === 'kitchen_staff') throw new HttpError(403, 'Only managers can approve or cancel orders.', 'FORBIDDEN');
  }
  const order = await getRecord<FoodOrder>('foodOrders', body.orderId);
  if (!order) throw new HttpError(404, 'Order not found.');
  const updated: FoodOrder =
    body.status === 'accepted_kitchen'
      ? { ...order, status: body.status, approvedByManagerId: staff.id, approvedByManagerName: staff.fullName, approvedAt: new Date().toISOString() }
      : { ...order, status: body.status };
  await upsertRecord('foodOrders', updated, `staff:${staff.id}`);
  await audit({ actor: `staff:${staff.id}`, action: 'status_change', entity: 'foodOrders', entityId: order.id, before: order, after: updated, ip: clientIp(request) });
  return ok({ orderId: order.id, status: updated.status });
});
