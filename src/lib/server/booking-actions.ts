import type { CRMBooking, GuestFolio } from '@/types/crm';
import { HttpError } from './http';
import type { StaffContext } from './auth/staff-session';
import { getCrmBooking, upsertCrmBooking } from './repos/bookings';
import { upsertRecord } from './repos/records';
import { getGstConfig } from './repos/settings';
import { audit } from './audit';
import { withFolioLock } from './folio-store';
import { recalculateFolioTotals } from '@/lib/folio';

/**
 * Cancel a booking, or mark a guest who never arrived as a no-show. The room is released, the
 * room charges are voided (with the reason), and any advance already paid stays on the bill as
 * a credit owed to the guest, for the owner to refund or keep under the cancellation policy.
 */
export async function cancelBooking(
  bookingId: string,
  input: { reason: string; noShow?: boolean },
  staff: StaffContext,
  ip?: string
): Promise<{ booking: CRMBooking; folio: GuestFolio | null }> {
  const reason = (input.reason || '').trim();
  if (reason.length < 3) throw new HttpError(400, 'Please give a reason.');
  const before = await getCrmBooking(bookingId);
  if (!before) throw new HttpError(404, 'Booking not found.');
  if (!['hold', 'confirmed'].includes(before.bookingStatus)) {
    throw new HttpError(409, before.bookingStatus === 'checked_in' ? 'The guest is in-house: check them out instead.' : `This booking is already ${before.bookingStatus.replace('_', ' ')}.`);
  }
  const actor = `staff:${staff.id}`;
  const now = new Date().toISOString();
  const { after } = await upsertCrmBooking(
    {
      ...before,
      bookingStatus: 'cancelled',
      tapeStatus: 'available',
      cancelledAt: now,
      cancelledByName: staff.fullName,
      cancelReason: reason.slice(0, 300),
      noShow: Boolean(input.noShow),
    },
    actor,
    { role: staff.role }
  );

  const gst = await getGstConfig();
  const folio = await withFolioLock(bookingId, async (tx, current) => {
    if (!current) return null;
    const why = `${input.noShow ? 'No-show' : 'Cancelled'}: ${reason.slice(0, 200)}`;
    const charges = current.charges.map((c) =>
      c.category === 'room_tariff' && c.chargeStatus !== 'void'
        ? { ...c, chargeStatus: 'void' as const, voidReason: why, voidedAt: now, voidedByName: staff.fullName }
        : c
    );
    const hasMoney = current.payments.some((p) => !p.voidedAt) || charges.some((c) => c.chargeStatus === 'posted');
    const next = recalculateFolioTotals({ ...current, status: hasMoney ? 'open' : 'void' }, charges, current.payments, gst);
    await upsertRecord('folios', next, actor, tx);
    await audit({ actor, action: input.noShow ? 'no_show' : 'cancel', entity: 'folios', entityId: current.id, before: current, after: next, ip }, tx);
    return next;
  });
  await audit({ actor, action: input.noShow ? 'no_show' : 'cancel', entity: 'booking', entityId: bookingId, before, after, ip });
  return { booking: after, folio };
}
