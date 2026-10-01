import { z } from 'zod';
import { handler, ok, readJson, HttpError, clientIp } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { createWebBooking, listWebBookings, updateWebBookingStatus } from '@/lib/server/repos/bookings';
import { getAddonRates, getGstConfig, getTariffData } from '@/lib/server/repos/settings';
import { listRoomCategories } from '@/lib/server/repos/rooms';
import { stayRestriction, calculateMultiRoomStay, isCalendarDate, nightsBetween, normalizeCategoryId, todayInIST } from '@/lib/tariff-calculator';
import { calculateBookingTotals } from '@/lib/gst';
import { normalizePhone } from '@/lib/phone';
import { audit } from '@/lib/server/audit';
import { raiseStaffAlert } from '@/lib/server/alerts';
import { log } from '@/lib/server/logger';

export const dynamic = 'force-dynamic';

/** Admin / manager: all website booking requests. */
export const GET = handler('bookings.list', async (request: Request) => {
  await requireStaff(request, ROLES.MANAGERS);
  return ok({ data: await listWebBookings() });
});

const NewBooking = z.object({
  guest_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(10).max(20),
  email: z.union([z.string().trim().email().max(200), z.literal('')]).optional(),
  room_name: z.string().trim().min(1).max(500),
  check_in: z.string(),
  check_out: z.string(),
  meal_plan: z.enum(['EP', 'CP', 'MAP', 'AP']).default('CP'),
  rooms_config: z
    .array(
      z.object({
        room_id: z.string().min(1).max(100),
        adults: z.number().int().min(1).max(6),
        children: z.number().int().min(0).max(4),
        child_ages: z.array(z.number().int().min(0).max(17)).max(4).optional(),
      })
    )
    .min(1)
    .max(7),
  addons: z.object({ airport_transfer: z.boolean().optional(), bike_rental: z.boolean().optional() }).optional(),
  special_requests: z.string().max(2000).optional(),
  total_price: z.number().optional(),
  idempotency_key: z.string().min(8).max(100).optional(),
});

/**
 * Public: a guest reserves rooms. The stay is re-priced here from live tariffs (incl.
 * GST), inventory is checked under a lock, and the request holds the rooms for a
 * limited time until the host confirms it.
 */
export const POST = handler('bookings.create', async (request: Request) => {
  await rateLimit(request, 'booking', 5, 10 * 60);
  const body = await readJson(request, NewBooking);

  const checkIn = body.check_in.slice(0, 10);
  const checkOut = body.check_out.slice(0, 10);
  if (!isCalendarDate(checkIn) || !isCalendarDate(checkOut)) throw new HttpError(400, 'Dates must be valid YYYY-MM-DD dates.');
  const nights = nightsBetween(checkIn, checkOut);
  if (nights === null || nights < 1) throw new HttpError(400, 'Check-out must be after check-in.');
  if (checkIn < todayInIST()) throw new HttpError(400, 'Check-in date is in the past.');
  if (nights > 30) throw new HttpError(400, 'For stays longer than 30 nights please send us an enquiry.');
  if (normalizePhone(body.phone).length < 10) throw new HttpError(400, 'Please enter a valid 10-digit mobile number.');

  // Capacity per category
  const categories = await listRoomCategories();
  const catById = new Map(categories.map((c) => [c.id, c]));
  for (const r of body.rooms_config) {
    const cat = catById.get(normalizeCategoryId(r.room_id));
    if (!cat) throw new HttpError(400, 'One of the selected rooms is not available for booking.');
    if (r.adults > (cat.capacity_adults || 2) || r.children > (cat.capacity_children ?? 0)) {
      throw new HttpError(400, `${cat.name} fits up to ${cat.capacity_adults} adults and ${cat.capacity_children} children.`);
    }
  }

  const rooms = body.rooms_config.map((r) => ({
    roomId: normalizeCategoryId(r.room_id),
    adults: r.adults,
    children: r.children,
    childAges: r.child_ages && r.child_ages.length === r.children ? r.child_ages : undefined,
  }));
  const [live, gstConfig, addonRates] = await Promise.all([getTariffData(), getGstConfig(), getAddonRates()]);
  const restriction = stayRestriction(checkIn, checkOut, live.seasonalDateRanges);
  if (restriction) throw new HttpError(422, restriction, 'MIN_STAY');
  const priced = calculateMultiRoomStay({
    rooms,
    checkIn,
    checkOut,
    mealPlan: body.meal_plan || 'CP',
    tariffsMap: live.tariffs,
    seasonalDateRanges: live.seasonalDateRanges,
  });
  if (!priced) {
    throw new HttpError(
      422,
      'Live prices for these dates or rooms are not available right now. Please send us an enquiry and we will confirm your tariff.',
      'PRICE_UNAVAILABLE'
    );
  }
  const addonsGross =
    (body.addons?.airport_transfer ? addonRates.airportTransfer : 0) + (body.addons?.bike_rental ? addonRates.bikeRentalPerNight * nights : 0);
  const totals = calculateBookingTotals(priced.perRoom, addonsGross, gstConfig);
  const totalPrice = totals.total;

  if (typeof body.total_price === 'number' && Math.abs(body.total_price - totalPrice) >= 1) {
    log.warn('bookings.price_mismatch', { client: body.total_price, server: totalPrice, checkIn, checkOut, mealPlan: body.meal_plan });
  }

  const { booking, created } = await createWebBooking({
    guest_name: body.guest_name,
    email: body.email || '',
    phone: body.phone,
    room_name: body.room_name,
    check_in: checkIn,
    check_out: checkOut,
    rooms,
    meal_plan: body.meal_plan || 'CP',
    special_requests: [
      body.special_requests || '',
      body.addons?.airport_transfer ? `[Add-on: Airport/Railway transfer ₹${addonRates.airportTransfer}]` : '',
      body.addons?.bike_rental ? `[Add-on: Bike rental ₹${addonRates.bikeRentalPerNight}/night]` : '',
    ]
      .filter(Boolean)
      .join(' '),
    totals: {
      roomSubtotal: totals.roomSubtotal,
      gstAmount: totals.gstAmount,
      addonsTotal: totals.addonsTotal,
      extraChargesTotal: priced.extraChargesTotal,
      totalPrice,
      extraAdults: priced.perRoom.reduce((s, r) => s + r.extraAdultsCount, 0),
      extraChildren: priced.perRoom.reduce((s, r) => s + r.extraChildrenCount, 0),
    },
    idempotencyKey: body.idempotency_key,
  });

  if (created) {
    await audit({ actor: 'guest:web', action: 'create', entity: 'web_booking', entityId: booking.id, after: booking, ip: clientIp(request) });
    await raiseStaffAlert({
      type: 'booking',
      roomNumber: 0,
      guestName: booking.guest_name,
      orderDetails: `🛎️ New website booking ${booking.booking_reference}: ${booking.room_name} · ${checkIn} → ${checkOut}`,
      totalAmount: totalPrice,
    });
  }
  return ok({ data: booking }, { status: created ? 201 : 200 });
});

const Patch = z.object({
  id: z.string().min(1),
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']),
  payment_status: z.enum(['unpaid', 'deposit_paid', 'fully_paid']).optional(),
});

/** Admin / manager: confirm, cancel or complete a website booking. */
export const PATCH = handler('bookings.update', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.MANAGERS);
  const body = await readJson(request, Patch);
  const { before, after } = await updateWebBookingStatus(body.id, body.status, body.payment_status);
  await audit({ actor: `staff:${staff.id}`, action: 'status_change', entity: 'web_booking', entityId: body.id, before, after, ip: clientIp(request) });
  return ok({ data: after });
});
