import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handler, ok, readJson, parseWith, HttpError, NO_STORE, clientIp } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { getStaff, requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { getGuestBooking, issueGuestSession } from '@/lib/server/auth/guest-session';
import {
  findActiveBookingForRoom,
  findBookingForGuest,
  getCrmBooking,
  listCrmBookings,
  rowToGuestBooking,
  upsertCrmBooking,
} from '@/lib/server/repos/bookings';
import { findPhysicalRoom, listPhysicalRooms, upsertPhysicalRoom } from '@/lib/server/repos/physical-rooms';
import { bookingForGuest, folioForGuest, submitGuestCheckin } from '@/lib/server/guest-services';
import { getSql } from '@/lib/server/db';
import { persistDataUrl } from '@/lib/server/repos/files';
import { raiseStaffAlert } from '@/lib/server/alerts';
import { audit } from '@/lib/server/audit';
import { normalizePhone } from '@/lib/phone';
import { isCalendarDate, nightsBetween, todayInIST, tomorrowInIST } from '@/lib/tariff-calculator';
import type { CRMBooking, PhysicalRoom, RoomTapeStatus, HousekeepingStatus } from '@/types/crm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function publicRoom(r: PhysicalRoom) {
  return {
    id: r.id,
    roomNumber: r.roomNumber,
    name: r.name,
    categoryId: r.categoryId,
    categoryCode: r.categoryCode,
    categoryName: r.categoryName,
    floorLevel: r.floorLevel,
  };
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a || '');
  const bb = Buffer.from(b || '');
  return ab.length === bb.length && ab.length > 0 && crypto.timingSafeEqual(ab, bb);
}

/**
 * GET
 *  ?room=101&t=<qr token>   in-room QR page: the room's live stay (signs the device in as that guest)
 *  ?room=101&phone=<mobile> same, verified by the mobile number on the stay (older printed QR codes)
 *  ?query=<ref>&phone=<mobile>  guest sign-in for the portal / digital check-in
 *  (no params)              staff only: all front-desk bookings and rooms
 */
export const GET = handler('checkin.get', async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const roomParam = params.get('room')?.trim();
  const query = (params.get('query') || params.get('booking') || '').trim();
  const phone = (params.get('phone') || '').trim();

  if (roomParam) {
    await rateLimit(request, 'room-status', 240, 60);
    const roomNumber = parseInt(roomParam, 10);
    const room = Number.isFinite(roomNumber) ? await findPhysicalRoom({ roomNumber }) : await findPhysicalRoom({ id: roomParam });
    if (!room) throw new HttpError(404, 'Room not found.');

    const staff = await getStaff(request);
    const booking = await findActiveBookingForRoom(room.id);
    const guestRow = await getGuestBooking(request);
    const token = params.get('t') || '';

    let authorised = Boolean(staff);
    let issueFor: CRMBooking | null = null;
    if (!authorised && booking) {
      if (guestRow && guestRow.id === booking.id) authorised = true;
      else if (token && safeEqual(token, room.qrSecretToken)) {
        authorised = true;
        issueFor = booking;
      } else if (phone) {
        await rateLimit(request, 'room-phone', 10, 15 * 60, String(room.roomNumber));
        if (normalizePhone(phone).length >= 10 && normalizePhone(phone) === normalizePhone(booking.guest?.phone)) {
          authorised = true;
          issueFor = booking;
        }
      }
    }

    if (!authorised) {
      return ok({
        room: publicRoom(room),
        booking: null,
        isCheckedIn: false,
        requiresVerification: Boolean(booking),
        status: booking ? 'verification_required' : 'available',
      });
    }

    const isCheckedIn = booking?.bookingStatus === 'checked_in';
    const body = {
      success: true,
      room: staff ? room : publicRoom(room),
      booking: booking ? (staff ? booking : bookingForGuest(booking)) : null,
      folio: booking ? await folioForGuest(booking) : null,
      isCheckedIn,
      status: isCheckedIn ? 'checked_in' : room.currentStatus || 'available',
    };
    const response = NextResponse.json(body, { headers: NO_STORE });
    if (issueFor) issueGuestSession(response, issueFor.id, issueFor.checkOutDate);
    return response;
  }

  if (query) {
    // Already signed in to this booking?
    const guestRow = await getGuestBooking(request);
    if (guestRow && !phone) {
      const current = rowToGuestBooking(guestRow);
      const q = query.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (current.bookingReference.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === q || current.id === query) {
        return ok({ booking: bookingForGuest(current) });
      }
    }
    const staff = await getStaff(request);
    if (staff && !phone) {
      const all = await listCrmBookings();
      const q = query.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const found = all.find((b) => b.id === query || b.bookingReference.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === q);
      if (found) return ok({ booking: found });
    }
    if (!phone) {
      throw new HttpError(400, 'Please enter your Booking ID and the mobile number used for the booking.', 'PHONE_REQUIRED');
    }
    await rateLimit(request, 'guest-login', 10, 15 * 60);
    const row = await findBookingForGuest(query, phone);
    if (!row) {
      await audit({ actor: 'guest', action: 'guest_login_failed', entity: 'booking', ip: clientIp(request) });
      return NextResponse.json(
        { success: false, notFound: true, message: 'Reservation not found for that Booking ID and mobile number.' },
        { status: 404, headers: NO_STORE }
      );
    }
    const booking = rowToGuestBooking(row);
    const response = NextResponse.json({ success: true, booking: bookingForGuest(booking) }, { headers: NO_STORE });
    issueGuestSession(response, row.id, booking.checkOutDate);
    return response;
  }

  await requireStaff(request, ROLES.MANAGERS);
  const [bookings, rooms] = await Promise.all([listCrmBookings(), listPhysicalRooms()]);
  return ok({ bookings, rooms });
});

// ---------------------------------------------------------------------------------- POST
const GuestFields = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(10).max(20),
    email: z.string().trim().max(200).optional(),
    idType: z.string().max(60).optional(),
    idNumber: z.string().max(60).optional(),
    idDocumentUrl: z.string().max(9_000_000).optional(),
    idDocumentBackUrl: z.string().max(9_000_000).optional(),
    address: z.string().max(500).optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(120).optional(),
    nationality: z.string().max(60).optional(),
    dietaryPreferences: z.string().max(500).optional(),
    hospitalityPreferences: z.string().max(500).optional(),
  })
  .passthrough();

const Submission = z.object({
  bookingId: z.string().max(100).optional(),
  bookingReference: z.string().max(60).optional(),
  guest: GuestFields,
  roomId: z.string().max(100).optional(),
  roomName: z.string().max(200).optional(),
  roomNumber: z.number().optional(),
  checkInDate: z.string().max(10).optional(),
  checkOutDate: z.string().max(10).optional(),
  specialRequests: z.string().max(1000).optional(),
});

const StaffAction = z.object({
  action: z.enum(['check_in', 'check_out', 'update_room_status']),
  bookingId: z.string().optional(),
  roomId: z.string().optional(),
  status: z.string().optional(),
  housekeeping: z.string().optional(),
});

export const POST = handler('checkin.post', async (request: Request) => {
  const raw = await request.json().catch(() => {
    throw new HttpError(400, 'Request body must be valid JSON.');
  });

  // ---- staff actions (the CRM normally syncs through /api/crm/mutate)
  if (raw && typeof raw === 'object' && 'action' in raw) {
    const staff = await requireStaff(request, ROLES.MANAGERS);
    const body = parseWith(StaffAction, raw);
    const actor = `staff:${staff.id}`;
    if (body.action === 'update_room_status') {
      const room = body.roomId ? await findPhysicalRoom({ id: body.roomId }) : null;
      if (!room) throw new HttpError(404, 'Room not found.');
      const { after } = await upsertPhysicalRoom({
        ...room,
        currentStatus: (body.status as RoomTapeStatus) || room.currentStatus,
        housekeeping: (body.housekeeping as HousekeepingStatus) || room.housekeeping,
      });
      return ok({ room: after });
    }
    const booking = body.bookingId ? await getCrmBooking(body.bookingId) : null;
    if (!booking) throw new HttpError(404, 'Booking not found.');
    const now = new Date().toISOString();
    const next: CRMBooking =
      body.action === 'check_in'
        ? { ...booking, bookingStatus: 'checked_in', tapeStatus: 'checked_in', checkedInAt: booking.checkedInAt || now, checkedInByManagerId: staff.id, checkedInByManagerName: staff.fullName }
        : { ...booking, bookingStatus: 'checked_out', tapeStatus: 'available', checkedOutAt: now, checkedOutByManagerId: staff.id, checkedOutByManagerName: staff.fullName };
    const { after } = await upsertCrmBooking(next, actor);
    const room = await findPhysicalRoom({ id: booking.roomId });
    if (room) {
      await upsertPhysicalRoom({
        ...room,
        currentStatus: body.action === 'check_in' ? 'checked_in' : 'available',
        housekeeping: body.action === 'check_out' ? 'deep_clean_turnover' : room.housekeeping,
      });
    }
    await audit({ actor, action: body.action, entity: 'booking', entityId: booking.id, before: booking, after, ip: clientIp(request) });
    return ok({ booking: after });
  }

  // ---- guest digital check-in
  const body = parseWith(Submission, raw);
  await rateLimit(request, 'checkin-submit', 10, 15 * 60);
  const staff = await getStaff(request);
  const guestRow = await getGuestBooking(request);
  const actor = staff ? `staff:${staff.id}` : 'guest:portal';

  if (body.bookingId) {
    const booking = await getCrmBooking(body.bookingId);
    const allowed = staff || (guestRow && guestRow.id === body.bookingId);
    if (!booking || !allowed) {
      throw new HttpError(403, 'Please sign in with your Booking ID and mobile number first.', 'GUEST_AUTH_REQUIRED');
    }
    const after = await submitGuestCheckin({ booking, guest: body.guest, specialRequests: body.specialRequests, actor, ip: clientIp(request) });
    return ok({ booking: staff ? after : bookingForGuest(after) });
  }

  // ---- no booking yet (walk-in): register a request for reception to assign a room
  const checkIn = body.checkInDate && isCalendarDate(body.checkInDate) ? body.checkInDate : todayInIST();
  let checkOut = body.checkOutDate && isCalendarDate(body.checkOutDate) ? body.checkOutDate : tomorrowInIST();
  if ((nightsBetween(checkIn, checkOut) ?? 0) < 1) checkOut = tomorrowInIST();
  const id = `bk-${crypto.randomUUID()}`;
  const docs = {
    idDocumentUrl: await persistDataUrl(body.guest.idDocumentUrl, { visibility: 'private', ownerKind: 'booking', ownerId: id, actor }),
    idDocumentBackUrl: await persistDataUrl(body.guest.idDocumentBackUrl, { visibility: 'private', ownerKind: 'booking', ownerId: id, actor }),
  };
  const reference = `WALKIN-${Date.now().toString(36).toUpperCase()}`;
  const data = {
    id,
    booking_reference: reference,
    guest_name: body.guest.fullName,
    email: body.guest.email || '',
    phone: body.guest.phone,
    room_id: '',
    room_name: body.roomName ? `Walk-in request: ${body.roomName}` : 'Walk-in registration',
    check_in: checkIn,
    check_out: checkOut,
    nights: nightsBetween(checkIn, checkOut) || 1,
    total_price: 0,
    status: 'pending',
    payment_status: 'unpaid',
    special_requests: body.specialRequests || '',
    walk_in: true,
    guest_details: { ...body.guest, ...docs },
    created_at: new Date().toISOString(),
  };
  const sql = getSql();
  await sql`
    insert into pms.bookings (id, kind, reference, status, check_in, check_out, category_ids, guest_phone, data)
    values (${id}, 'web', ${reference}, 'pending', ${checkIn}, ${checkOut}, ${[]}, ${normalizePhone(body.guest.phone)}, ${sql.json(data as never)})`;
  await raiseStaffAlert({
    type: 'checkin',
    roomNumber: body.roomNumber || 0,
    guestName: body.guest.fullName,
    orderDetails: `🚪 Walk-in registration: ${body.guest.fullName} (${body.guest.phone}) — please assign a room in the CRM`,
    totalAmount: 0,
  });
  await audit({ actor, action: 'walk_in_registration', entity: 'web_booking', entityId: id, ip: clientIp(request) });
  return ok(
    {
      walkInRequest: true,
      message: 'Thank you! Your details are with reception, who will assign your room and confirm your stay.',
      booking: { id, bookingReference: reference },
    },
    { status: 201 }
  );
});
