import crypto from 'crypto';
import type { CRMBooking, ManagerActivityLog, PhysicalRoom, RoomBlock } from '@/types/crm';
import { HttpError } from './http';
import { audit } from './audit';
import { withTx, lockInventory } from './db';
import type { StaffContext } from './auth/staff-session';
import { getCrmBooking, getAvailability, listCrmBookings, upsertCrmBooking } from './repos/bookings';
import { findPhysicalRoom, upsertPhysicalRoom } from './repos/physical-rooms';
import { getRecord, listRecords, upsertRecord, deleteRecord } from './repos/records';
import { normalizeCategoryId, todayInIST } from '@/lib/tariff-calculator';
import { blockIsActive, bookingTakesRoom, checkInProblem, holdExpiryFromHours, holdLabel, rangesOverlap, validateHoldInput, HoldInput } from '@/lib/tape-rules';
import type { Tx } from './db';

/**
 * The tape chart's three desk flows, each with its own server rules:
 * - check-in (this file: checkInBooking),
 * - pre-book (the normal booking save, upsertCrmBooking, which enforces availability, holds
 *   and the status rules; groupRoomProblems checks a whole group before it is saved),
 * - hold (this file: createRoomHold / extendRoomHold / releaseRoomHold).
 */

async function logActivity(entry: Omit<ManagerActivityLog, 'id' | 'timestamp'>, actor: string): Promise<ManagerActivityLog> {
  const record: ManagerActivityLog = { id: `log-${crypto.randomUUID()}`, timestamp: new Date().toISOString(), ...entry };
  await upsertRecord('activityLogs', record, actor);
  return record;
}

// ------------------------------------------------------------------ check-in
export interface CheckInInput {
  idType?: string;
  idNumber?: string;
  idDocumentUrl?: string;
  idDocumentBackUrl?: string;
  adultsCount?: number;
  childrenCount?: number;
}

/**
 * Checks an arriving pre-booking or hold in. Refused before the arrival day, after the stay
 * ended, on a blocked or out-of-service room, while the last guest is still in-house, or
 * without the guest's ID. Stamps who checked in and when (server clock).
 */
export async function checkInBooking(bookingId: string, input: CheckInInput, staff: StaffContext, ip?: string) {
  const booking = await getCrmBooking(bookingId);
  if (!booking) throw new HttpError(404, 'Booking not found.');
  const actor = `staff:${staff.id}`;

  const guest = {
    ...booking.guest,
    ...(input.idType ? { idType: input.idType } : {}),
    ...(input.idNumber && input.idNumber.trim() ? { idNumber: input.idNumber.trim() } : {}),
    ...(input.idDocumentUrl ? { idDocumentUrl: input.idDocumentUrl } : {}),
    ...(input.idDocumentBackUrl ? { idDocumentBackUrl: input.idDocumentBackUrl } : {}),
  };
  const candidate: CRMBooking = { ...booking, guest };

  const [room, bookings, blocks] = await Promise.all([
    findPhysicalRoom({ id: booking.roomId }),
    listCrmBookings(),
    listRecords<RoomBlock>('roomBlocks', { limit: 1000 }),
  ]);
  const problem = checkInProblem(candidate, { room, bookings, blocks });
  if (problem) throw new HttpError(problem.code === 'ID_REQUIRED' ? 400 : 409, problem.message, problem.code);

  const now = new Date().toISOString();
  const hasNewId = Boolean(input.idNumber || input.idDocumentUrl);
  const next: CRMBooking = {
    ...candidate,
    bookingStatus: 'checked_in',
    tapeStatus: 'checked_in',
    checkedInAt: now,
    checkedInByManagerId: staff.id,
    checkedInByManagerName: staff.fullName,
    adultsCount: input.adultsCount && input.adultsCount > 0 ? Math.min(20, Math.round(input.adultsCount)) : booking.adultsCount,
    childrenCount: input.childrenCount !== undefined && input.childrenCount >= 0 ? Math.min(20, Math.round(input.childrenCount)) : booking.childrenCount,
    documentStatus: booking.documentStatus === 'verified' ? 'verified' : hasNewId || booking.documentStatus === 'submitted' ? 'submitted' : booking.documentStatus,
    guest: { ...guest, documentStatus: booking.documentStatus === 'verified' ? 'verified' : hasNewId ? 'submitted' : guest.documentStatus },
  };
  const { before, after } = await upsertCrmBooking(next, actor, { role: staff.role, actorName: staff.fullName });

  let roomAfter: PhysicalRoom | null = null;
  if (room) roomAfter = (await upsertPhysicalRoom({ ...room, currentStatus: 'checked_in' })).after;

  const log = await logActivity(
    {
      managerId: staff.id,
      managerName: staff.fullName,
      action: 'check_in',
      bookingId: after.id,
      bookingReference: after.bookingReference,
      roomNumber: after.roomNumber,
      guestName: after.guest?.fullName,
      notes: `Guest checked into Room ${after.roomNumber}${before?.bookingStatus === 'hold' ? ' (from a hold)' : ''}. In-room QR activated.`,
    },
    actor
  );
  await audit({ actor, action: 'check_in', entity: 'booking', entityId: after.id, before, after, ip });
  return { booking: after, room: roomAfter, activityLog: log };
}

// ------------------------------------------------------------------ group pre-check
export interface GroupCheckInput {
  roomIds: string[];
  checkInDate: string;
  checkOutDate: string;
  /** Holds these rooms are being booked from (they don't count against the group). */
  fromHoldIds?: string[];
  /** Check-in now (walk-in): adds the in-house and out-of-service checks for tonight. */
  checkInNow?: boolean;
}

/**
 * Checks every room of a group booking before anything is saved, so a group is not half
 * created: room clashes, holds, a guest still in-house, and the room-type count (website
 * requests included) across the whole group. Returns one message per problem room.
 */
export async function groupRoomProblems(input: GroupCheckInput, db?: Tx): Promise<{ roomId: string; roomNumber?: number; message: string }[]> {
  const problems: { roomId: string; roomNumber?: number; message: string }[] = [];
  const { checkInDate: from, checkOutDate: to } = input;
  const now = new Date();
  const fromHolds = new Set(input.fromHoldIds || []);
  const [bookings, holds, avail] = await Promise.all([
    listCrmBookings(db),
    listRecords<RoomBlock>('roomBlocks', { limit: 1000 }, db),
    getAvailability(from, to, { excludeBlockIds: Array.from(fromHolds) }, db),
  ]);
  const needByCat: Record<string, number> = {};
  for (const roomId of input.roomIds) {
    const room = await findPhysicalRoom({ id: roomId }, db);
    if (!room) {
      problems.push({ roomId, message: 'Unknown room.' });
      continue;
    }
    const cat = normalizeCategoryId(room.categoryId);
    needByCat[cat] = (needByCat[cat] || 0) + 1;
    const stay = bookings.find((b) => b.roomId === roomId && bookingTakesRoom(b, now) && rangesOverlap(b.checkInDate, b.checkOutDate, from, to));
    if (stay) {
      problems.push({ roomId, roomNumber: room.roomNumber, message: `Room ${room.roomNumber} is booked for ${stay.guest?.fullName || 'a guest'} (${stay.checkInDate} → ${stay.checkOutDate}).` });
      continue;
    }
    const hold = holds.find((h) => h.roomId === roomId && !fromHolds.has(h.id) && blockIsActive(h, now) && rangesOverlap(h.fromDate, h.toDate, from, to));
    if (hold) {
      problems.push({ roomId, roomNumber: room.roomNumber, message: `Room ${room.roomNumber} is on hold ${hold.fromDate} → ${hold.toDate} (${holdLabel(hold)}).` });
      continue;
    }
    if (input.checkInNow) {
      const inHouse = bookings.find((b) => b.roomId === roomId && b.bookingStatus === 'checked_in');
      if (inHouse) {
        problems.push({ roomId, roomNumber: room.roomNumber, message: `Room ${room.roomNumber} still has ${inHouse.guest?.fullName || 'a guest'} in-house. Check them out first.` });
        continue;
      }
      if (room.currentStatus === 'maintenance') {
        problems.push({ roomId, roomNumber: room.roomNumber, message: `Room ${room.roomNumber} is marked out of service tonight.` });
      }
    }
  }
  if (problems.length === 0) {
    for (const [cat, n] of Object.entries(needByCat)) {
      if ((avail[cat]?.available ?? n) < n) {
        problems.push({
          roomId: '',
          message: `Only ${avail[cat]?.available ?? 0} room(s) of one type are free on some of those nights (website requests included); the group needs ${n}.`,
        });
      }
    }
  }
  return problems;
}

// ------------------------------------------------------------------ holds
/**
 * Holds one or more rooms for some nights (all or nothing). Refused when a room has a stay
 * or another hold on those nights, or when website requests need the room type.
 */
export async function createRoomHold(input: HoldInput & { ids?: string[] }, staff: StaffContext, ip?: string): Promise<RoomBlock[]> {
  const err = validateHoldInput(input, { isAdmin: staff.role === 'admin' });
  if (err) throw new HttpError(400, err);
  const actor = `staff:${staff.id}`;
  const guestName = (input.guestName || '').trim().slice(0, 120) || undefined;
  const guestPhone = (input.guestPhone || '').trim().slice(0, 30) || undefined;
  const reason = ((input.reason || '').trim() || (guestName ? `Held for ${guestName}` : '')).slice(0, 200);

  const records = await withTx(async (tx) => {
    await lockInventory(tx);
    const now = new Date();
    // Expired holds on these rooms and nights make way.
    for (const roomId of input.roomIds) {
      await tx`
        delete from pms.records
        where collection = 'roomBlocks' and data->>'roomId' = ${roomId}
          and data->>'fromDate' < ${input.toDate} and data->>'toDate' > ${input.fromDate}
          and data->>'expiresAt' is not null and (data->>'expiresAt')::timestamptz <= ${now}`;
    }
    const problems = await groupRoomProblems({ roomIds: input.roomIds, checkInDate: input.fromDate, checkOutDate: input.toDate }, tx);
    if (problems.length > 0) throw new HttpError(409, problems.map((p) => p.message).join(' '), 'ROOM_CONFLICT');

    const groupId = input.roomIds.length > 1 ? `hgrp-${crypto.randomUUID()}` : undefined;
    const expiresAt = input.releaseAfterHours != null ? holdExpiryFromHours(input.releaseAfterHours, now).toISOString() : undefined;
    const out: RoomBlock[] = [];
    for (let i = 0; i < input.roomIds.length; i++) {
      const room = await findPhysicalRoom({ id: input.roomIds[i] }, tx);
      if (!room) throw new HttpError(400, 'Unknown room.');
      const rec: RoomBlock = {
        id: input.ids?.[i] || `blk-${crypto.randomUUID()}`,
        roomId: room.id,
        roomNumber: room.roomNumber,
        fromDate: input.fromDate,
        toDate: input.toDate,
        reason,
        ...(guestName ? { guestName } : {}),
        ...(guestPhone ? { guestPhone } : {}),
        ...(expiresAt ? { expiresAt } : {}),
        ...(groupId ? { groupId } : {}),
        createdAt: now.toISOString(),
        createdByName: staff.fullName,
        createdById: staff.id,
        createdByRole: staff.role,
      };
      await upsertRecord('roomBlocks', rec, actor, tx);
      await audit({ actor, action: 'create', entity: 'roomBlocks', entityId: rec.id, after: rec, ip }, tx);
      out.push(rec);
    }
    return out;
  });

  const first = records[0];
  await logActivity(
    {
      managerId: staff.id,
      managerName: staff.fullName,
      action: 'room_held',
      roomNumber: first.roomNumber,
      guestName: first.guestName,
      notes: `Hold on room${records.length > 1 ? 's' : ''} ${records.map((r) => r.roomNumber).join(', ')}, ${first.fromDate} → ${first.toDate}: ${first.reason}${first.expiresAt ? ` (releases ${first.expiresAt})` : ' (until released)'}`,
    },
    actor
  );
  return records;
}

async function holdAndGroup(holdId: string, group: boolean, db?: Tx): Promise<RoomBlock[]> {
  const hold = await getRecord<RoomBlock>('roomBlocks', holdId, db);
  if (!hold) throw new HttpError(404, 'Hold not found.');
  if (!group || !hold.groupId) return [hold];
  const all = await listRecords<RoomBlock>('roomBlocks', { limit: 1000 }, db);
  return all.filter((h) => h.groupId === hold.groupId);
}

/** Gives a hold (or its whole group) a new release time, or makes it last until released. An expired hold must find its nights free again. */
export async function extendRoomHold(
  holdId: string,
  input: { hours?: number; untilReleased?: boolean; group?: boolean },
  staff: StaffContext,
  ip?: string
): Promise<RoomBlock[]> {
  const actor = `staff:${staff.id}`;
  return withTx(async (tx) => {
    await lockInventory(tx);
    const holds = await holdAndGroup(holdId, Boolean(input.group), tx);
    const now = new Date();
    const lapsed = holds.filter((h) => !blockIsActive(h, now));
    for (const h of lapsed) {
      const stay = (await listCrmBookings(tx)).find((b) => b.roomId === h.roomId && bookingTakesRoom(b, now) && rangesOverlap(b.checkInDate, b.checkOutDate, h.fromDate, h.toDate));
      if (stay) throw new HttpError(409, `Room ${h.roomNumber} has since been booked for ${stay.guest?.fullName || 'a guest'}. Release this hold.`, 'ROOM_CONFLICT');
      const others = await listRecords<RoomBlock>('roomBlocks', { limit: 1000 }, tx);
      const other = others.find((k) => k.id !== h.id && k.roomId === h.roomId && blockIsActive(k, now) && rangesOverlap(k.fromDate, k.toDate, h.fromDate, h.toDate));
      if (other) throw new HttpError(409, `Room ${h.roomNumber} has since been held again (${holdLabel(other)}). Release this hold.`, 'BLOCK_OVERLAP');
    }
    const out: RoomBlock[] = [];
    for (const before of holds) {
      const after: RoomBlock = { ...before };
      if (input.untilReleased) delete after.expiresAt;
      else after.expiresAt = holdExpiryFromHours(input.hours ?? 24, now).toISOString();
      await upsertRecord('roomBlocks', after, actor, tx);
      await audit({ actor, action: 'hold_extend', entity: 'roomBlocks', entityId: before.id, before, after, ip }, tx);
      out.push(after);
    }
    return out;
  });
}

/**
 * Releases a hold (or its whole group). A hold that has already started is ended today
 * instead, so its past nights stay on record. Managers cannot release an admin's hold.
 */
export async function releaseRoomHold(
  holdId: string,
  staff: StaffContext,
  ip?: string,
  opts: { group?: boolean } = {}
): Promise<{ released: string[]; ended: RoomBlock[] }> {
  const actor = `staff:${staff.id}`;
  const holds = await holdAndGroup(holdId, Boolean(opts.group));
  const today = todayInIST();
  const released: string[] = [];
  const ended: RoomBlock[] = [];
  for (const before of holds) {
    if (staff.role !== 'admin' && before.createdByRole === 'admin') {
      throw new HttpError(403, `The hold on room ${before.roomNumber} was set by an admin. Ask an admin to release it.`, 'FORBIDDEN');
    }
  }
  for (const before of holds) {
    if (before.fromDate < today && before.toDate > today) {
      const after: RoomBlock = { ...before, toDate: today, endedEarlyAt: new Date().toISOString(), endedEarlyByName: staff.fullName };
      delete after.expiresAt;
      await upsertRecord('roomBlocks', after, actor);
      await audit({ actor, action: 'end_early', entity: 'roomBlocks', entityId: before.id, before, after, ip });
      ended.push(after);
    } else if (before.toDate <= today && staff.role !== 'admin') {
      continue; // already over: kept as history
    } else {
      await deleteRecord('roomBlocks', before.id);
      await audit({ actor, action: 'delete', entity: 'roomBlocks', entityId: before.id, before, ip });
      released.push(before.id);
    }
  }
  if (released.length + ended.length > 0) {
    await logActivity(
      {
        managerId: staff.id,
        managerName: staff.fullName,
        action: 'hold_released',
        roomNumber: holds[0].roomNumber,
        guestName: holds[0].guestName,
        notes: `Hold on room${holds.length > 1 ? 's' : ''} ${holds.map((h) => h.roomNumber).join(', ')} released (${holdLabel(holds[0])}).`,
      },
      actor
    );
  }
  return { released, ended };
}
