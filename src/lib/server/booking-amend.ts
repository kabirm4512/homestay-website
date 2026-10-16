import type { CRMBooking, FolioCharge, GuestFolio, MealPlan } from '@/types/crm';
import { HttpError } from './http';
import type { StaffContext } from './auth/staff-session';
import { deleteBooking, getCrmBooking, upsertCrmBooking } from './repos/bookings';
import { findPhysicalRoom } from './repos/physical-rooms';
import { upsertRecord } from './repos/records';
import { getGstConfig } from './repos/settings';
import { audit } from './audit';
import { ensureFolioTx, withFolioLock } from './folio-store';
import { accommodationGstForTotal, apportionTax, recalculateFolioTotals } from '@/lib/folio';
import { roundMoney } from '@/lib/gst';
import { nightsBetween, todayInIST } from '@/lib/tariff-calculator';

export interface BookingAmendment {
  reason: string;
  checkInDate?: string;
  checkOutDate?: string;
  roomId?: string;
  mealPlan?: MealPlan;
  adultsCount?: number;
  childrenCount?: number;
  roomRatePerNight?: number;
  guestName?: string;
  guestPhone?: string;
  specialRequests?: string;
}

const AMENDABLE = ['hold', 'confirmed', 'checked_in'];

/**
 * Admin: amend a front-desk booking (dates, room, meal plan, guests, rate, guest name/phone).
 * The same room/date/inventory rules as a new booking apply (upsertCrmBooking). When the stay's
 * price changes, the old room lines on the bill are voided with the reason and new ones posted,
 * so the bill always matches the booking and nothing is silently overwritten.
 */
export async function amendBooking(
  bookingId: string,
  input: BookingAmendment,
  staff: StaffContext,
  ip?: string
): Promise<{ booking: CRMBooking; folio: GuestFolio | null }> {
  if (staff.role !== 'admin') throw new HttpError(403, 'Only admins can amend bookings.', 'FORBIDDEN');
  const reason = (input.reason || '').trim();
  if (reason.length < 3) throw new HttpError(400, 'Please give a reason for the change.');
  const before = await getCrmBooking(bookingId);
  if (!before) throw new HttpError(404, 'Booking not found.');
  if (!AMENDABLE.includes(before.bookingStatus)) {
    throw new HttpError(409, `A ${before.bookingStatus.replace('_', ' ')} booking cannot be amended.`, 'NOT_AMENDABLE');
  }

  const checkInDate = input.checkInDate ?? before.checkInDate;
  const checkOutDate = input.checkOutDate ?? before.checkOutDate;
  if (before.bookingStatus === 'checked_in' && checkInDate !== before.checkInDate) {
    throw new HttpError(409, 'The guest is already in-house: the arrival date cannot be changed.', 'IN_HOUSE');
  }
  if (before.bookingStatus === 'checked_in' && checkOutDate < todayInIST()) {
    throw new HttpError(409, 'Check-out cannot be before today for an in-house guest.', 'IN_HOUSE');
  }
  const nights = nightsBetween(checkInDate, checkOutDate);
  if (nights === null || nights < 1) throw new HttpError(400, 'Check-out must be after check-in.');

  let room = { roomId: before.roomId, roomNumber: before.roomNumber, roomName: before.roomName };
  if (input.roomId && input.roomId !== before.roomId) {
    const r = await findPhysicalRoom({ id: input.roomId });
    if (!r) throw new HttpError(404, 'Room not found.');
    room = { roomId: r.id, roomNumber: r.roomNumber, roomName: r.name };
  }

  const rate = input.roomRatePerNight ?? before.roomRatePerNight;
  if (!(rate >= 0) || rate > 500000) throw new HttpError(400, 'Enter a valid nightly rate.');
  const adults = input.adultsCount ?? before.adultsCount;
  const children = input.childrenCount ?? before.childrenCount;
  if (!(adults >= 1)) throw new HttpError(400, 'At least one adult is required.');

  const extraAdultPerNight = (before.extraAdultsCount || 0) * (before.extraAdultChargePerNight || 0);
  const extraChildPerNight = (before.extraChildrenCount || 0) * (before.extraChildChargePerNight || 0);
  const totalExtraCharges = roundMoney((extraAdultPerNight + extraChildPerNight) * nights);
  const totalRoomAmount = roundMoney(rate * nights + totalExtraCharges);

  const guest = {
    ...before.guest,
    ...(input.guestName?.trim() ? { fullName: input.guestName.trim() } : {}),
    ...(input.guestPhone?.trim() ? { phone: input.guestPhone.trim() } : {}),
  };

  const priceChanged =
    nights !== before.totalNights || rate !== before.roomRatePerNight || totalRoomAmount !== before.totalRoomAmount || room.roomId !== before.roomId;

  const gst = await getGstConfig();
  const draft: CRMBooking = {
    ...before,
    ...room,
    guest,
    checkInDate,
    checkOutDate,
    mealPlan: input.mealPlan ?? before.mealPlan,
    adultsCount: adults,
    childrenCount: children,
    roomRatePerNight: rate,
    isManualRate: rate !== before.roomRatePerNight ? true : before.isManualRate,
    totalNights: nights,
    totalExtraCharges,
    totalRoomAmount,
    gstAmount: accommodationGstForTotal(totalRoomAmount, nights, gst),
    specialRequests: input.specialRequests ?? before.specialRequests,
  };

  const actor = `staff:${staff.id}`;
  const { after } = await upsertCrmBooking(draft, actor, { role: staff.role, actorName: staff.fullName });

  const why = `Amended by admin: ${reason.slice(0, 200)}`;
  const folio = await withFolioLock(bookingId, async (tx, current) => {
    const needsUpdate = priceChanged || (current && (current.guestName !== guest.fullName || current.roomNumber !== room.roomNumber));
    if (!needsUpdate) return current;
    const base = await ensureFolioTx(tx, current, after, actor);
    const now = new Date().toISOString();
    let charges: FolioCharge[] = base.charges;
    if (priceChanged) {
      charges = charges.map((c) =>
        c.category === 'room_tariff' && c.chargeStatus !== 'void' && c.sourceReferenceType === 'booking' && c.sourceReferenceId === bookingId
          ? { ...c, chargeStatus: 'void' as const, voidReason: why.slice(0, 300), voidedAt: now, voidedByName: staff.fullName }
          : c
      );
      const stamp = Date.now();
      const lines: FolioCharge[] = [
        {
          id: `chg-${stamp}-room-amend`,
          folioId: base.id,
          category: 'room_tariff',
          chargeStatus: 'posted',
          title: `Stay Tariff: ${room.roomName} (${nights} night${nights > 1 ? 's' : ''} @ ₹${rate.toLocaleString('en-IN')}/nt) [Amended]`,
          amount: roundMoney(rate * nights),
          sourceReferenceType: 'booking',
          sourceReferenceId: bookingId,
          postedAt: now,
          postedByName: staff.fullName,
          postedById: staff.id,
        },
      ];
      if (totalExtraCharges > 0) {
        lines.push({
          id: `chg-${stamp}-extra-amend`,
          folioId: base.id,
          category: 'room_tariff',
          chargeStatus: 'posted',
          title: `Extra guest charges (${nights} nt) [Amended]`,
          amount: totalExtraCharges,
          sourceReferenceType: 'booking',
          sourceReferenceId: bookingId,
          postedAt: now,
          postedByName: staff.fullName,
          postedById: staff.id,
        });
      }
      charges = [...charges, ...apportionTax(lines, after.gstAmount || 0, gst)];
    }
    const next = recalculateFolioTotals(
      { ...base, guestName: guest.fullName, roomNumber: room.roomNumber, roomName: room.roomName, status: base.status === 'void' ? 'open' : base.status },
      charges,
      base.payments,
      gst
    );
    await upsertRecord('folios', next, actor, tx);
    await audit({ actor, action: 'amend', entity: 'folios', entityId: next.id, before: current, after: next, ip }, tx);
    return next;
  });

  await audit({ actor, action: 'amend', entity: 'booking', entityId: bookingId, before, after: { ...after, amendReason: reason }, ip });
  return { booking: after, folio };
}

/**
 * Admin: delete a booking entered by mistake (duplicate, test, wrong guest). A booking that has
 * money recorded against it (any payment not voided) cannot be deleted: cancel it instead, so the
 * advance stays visible as a credit. The bill is voided (never deleted) and the audit log keeps
 * the full booking.
 */
export async function deleteBookingByAdmin(
  bookingId: string,
  input: { reason: string },
  staff: StaffContext,
  ip?: string
): Promise<{ deleted: true; folio: GuestFolio | null }> {
  if (staff.role !== 'admin') throw new HttpError(403, 'Only admins can delete bookings.', 'FORBIDDEN');
  const reason = (input.reason || '').trim();
  if (reason.length < 3) throw new HttpError(400, 'Please give a reason.');
  const before = await getCrmBooking(bookingId);
  if (!before) throw new HttpError(404, 'Booking not found.');
  if (before.bookingStatus === 'checked_in') {
    throw new HttpError(409, 'The guest is in-house: check them out (or amend the booking) instead.', 'IN_HOUSE');
  }
  const actor = `staff:${staff.id}`;
  const why = `Booking deleted by admin: ${reason.slice(0, 200)}`;
  const gst = await getGstConfig();

  const folio = await withFolioLock(bookingId, async (tx, current) => {
    if (!current) return null;
    if (current.payments.some((p) => !p.voidedAt)) {
      throw new HttpError(
        409,
        'This booking has payments recorded. Void the payments on the bill first, or cancel the booking so the advance stays as a credit.',
        'HAS_PAYMENTS'
      );
    }
    const now = new Date().toISOString();
    const charges = current.charges.map((c) =>
      c.chargeStatus !== 'void' ? { ...c, chargeStatus: 'void' as const, voidReason: why.slice(0, 300), voidedAt: now, voidedByName: staff.fullName } : c
    );
    const next = recalculateFolioTotals({ ...current, status: 'void' }, charges, current.payments, gst);
    await upsertRecord('folios', next, actor, tx);
    await audit({ actor, action: 'delete_booking', entity: 'folios', entityId: current.id, before: current, after: next, ip }, tx);
    return next;
  });

  await deleteBooking(bookingId);
  await audit({ actor, action: 'delete', entity: 'booking', entityId: bookingId, before: { ...before, deleteReason: reason }, ip });
  return { deleted: true, folio };
}
