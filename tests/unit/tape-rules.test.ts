import { describe, expect, it } from 'vitest';
import {
  bookingTakesRoom,
  cellActions,
  checkInProblem,
  clampHoldExpiry,
  holdLabel,
  isHoldExpired,
  roomBusyReason,
  roomViewLabel,
  validateHoldInput,
  blockIsActive,
} from '@/lib/tape-rules';
import type { CRMBooking } from '@/types/crm';

const now = new Date('2026-10-11T10:00:00Z');
const today = '2026-10-11';

function bk(p: Partial<CRMBooking>): CRMBooking {
  return {
    id: 'b1',
    bookingReference: 'SH-1',
    roomId: 'room-101',
    roomNumber: 101,
    roomName: 'Room 101',
    guestId: 'g1',
    guest: { id: 'g1', fullName: 'Asha Roy', phone: '9876543210', totalLifetimeStays: 1 },
    checkInDate: today,
    checkOutDate: '2026-10-13',
    tapeStatus: 'confirmed',
    bookingStatus: 'confirmed',
    mealPlan: 'CP',
    adultsCount: 2,
    childrenCount: 0,
    roomRatePerNight: 4000,
    totalNights: 2,
    totalRoomAmount: 8000,
    ...p,
  };
}

describe('holds', () => {
  it('a hold with an expiry lapses; one without lasts until released', () => {
    expect(blockIsActive({ expiresAt: '2026-10-11T09:00:00Z' }, now)).toBe(false);
    expect(blockIsActive({ expiresAt: '2026-10-11T11:00:00Z' }, now)).toBe(true);
    expect(blockIsActive({}, now)).toBe(true);
  });

  it('needs rooms, valid future dates and a name or reason', () => {
    const base = { roomIds: ['room-101'], fromDate: today, toDate: '2026-10-12', reason: 'geyser repair' };
    expect(validateHoldInput(base, { today })).toBeNull();
    expect(validateHoldInput({ ...base, roomIds: [] }, { today })).toMatch(/at least one room/);
    expect(validateHoldInput({ ...base, roomIds: ['room-101', 'room-101'] }, { today })).toMatch(/twice/);
    expect(validateHoldInput({ ...base, toDate: today }, { today })).toMatch(/free again/);
    expect(validateHoldInput({ ...base, fromDate: '2026-10-10' }, { today })).toMatch(/past/);
    expect(validateHoldInput({ ...base, fromDate: '2026-10-10' }, { today, isAdmin: true })).toBeNull();
    expect(validateHoldInput({ ...base, reason: '' }, { today })).toMatch(/held for/);
    expect(validateHoldInput({ ...base, reason: '', guestName: 'Mehta' }, { today })).toBeNull();
    expect(validateHoldInput({ ...base, releaseAfterHours: 500 }, { today })).toMatch(/release itself/);
    expect(validateHoldInput({ ...base, roomIds: ['room-101', 'room-102', 'room-201'], releaseAfterHours: null }, { today })).toBeNull();
  });

  it('labels show the guest and the reason', () => {
    expect(holdLabel({ reason: 'Held for Mehta', guestName: 'Mehta' })).toBe('Held for Mehta');
    expect(holdLabel({ reason: 'awaiting advance', guestName: 'Mehta' })).toBe('Mehta · awaiting advance');
    expect(holdLabel({ reason: '', guestName: '' })).toBe('Hold');
  });

  it('expiry is kept between 30 minutes and 7 days', () => {
    expect(clampHoldExpiry(new Date(now.getTime() + 60_000), now).getTime()).toBe(now.getTime() + 30 * 60_000);
    expect(clampHoldExpiry(new Date(now.getTime() + 30 * 86_400_000), now).getTime()).toBe(now.getTime() + 7 * 86_400_000);
  });

  it('legacy hold bookings past expiry stop taking the room', () => {
    const lapsed = bk({ bookingStatus: 'hold', holdExpiresAt: '2026-10-11T09:00:00Z' });
    expect(isHoldExpired(lapsed, now)).toBe(true);
    expect(bookingTakesRoom(lapsed, now)).toBe(false);
    expect(bookingTakesRoom(bk({}), now)).toBe(true);
    expect(bookingTakesRoom(bk({ bookingStatus: 'cancelled' }), now)).toBe(false);
  });
});

describe('room availability preview', () => {
  const hold = { id: 'h1', roomId: 'room-102', fromDate: today, toDate: '2026-10-12', reason: 'repair' };
  it('reports stays and active holds, ignores the hold being converted', () => {
    expect(roomBusyReason('room-101', today, '2026-10-12', [bk({})], [], { now })).toMatch(/Booked: Asha Roy/);
    expect(roomBusyReason('room-101', '2026-10-13', '2026-10-14', [bk({})], [], { now })).toBeNull();
    expect(roomBusyReason('room-102', today, '2026-10-12', [], [hold], { now })).toMatch(/On hold: repair/);
    expect(roomBusyReason('room-102', today, '2026-10-12', [], [hold], { now, ignoreHoldIds: ['h1'] })).toBeNull();
    expect(roomBusyReason('room-102', today, '2026-10-12', [], [{ ...hold, expiresAt: '2026-10-11T09:00:00Z' }], { now })).toBeNull();
  });
});

describe('check-in rules', () => {
  const withId = bk({ guest: { id: 'g1', fullName: 'Asha Roy', phone: '9876543210', idNumber: '1234 5678 9012', totalLifetimeStays: 1 } });
  const ctx = { today, now, room: { id: 'room-101', roomNumber: 101, currentStatus: 'available' as const }, bookings: [], blocks: [] };

  it('allows an arrival today with ID', () => {
    expect(checkInProblem(withId, ctx)).toBeNull();
  });
  it('refuses early, ended, held, occupied, out of service, and no-ID check-ins', () => {
    expect(checkInProblem({ ...withId, checkInDate: '2026-10-12', checkOutDate: '2026-10-14' }, ctx)?.code).toBe('TOO_EARLY');
    expect(checkInProblem({ ...withId, checkInDate: '2026-10-09', checkOutDate: today }, ctx)?.code).toBe('STAY_OVER');
    expect(checkInProblem(withId, { ...ctx, blocks: [{ roomId: 'room-101', fromDate: today, toDate: '2026-10-12', reason: 'leak' }] })?.code).toBe('ROOM_BLOCKED');
    expect(checkInProblem(withId, { ...ctx, blocks: [{ roomId: 'room-101', fromDate: today, toDate: '2026-10-12', reason: 'x', expiresAt: '2026-10-11T09:00:00Z' }] })).toBeNull();
    expect(checkInProblem(withId, { ...ctx, bookings: [bk({ id: 'b0', bookingStatus: 'checked_in', checkOutDate: today })] })?.code).toBe('ROOM_OCCUPIED');
    expect(checkInProblem(withId, { ...ctx, room: { ...ctx.room, currentStatus: 'maintenance' } })?.code).toBe('ROOM_OUT_OF_SERVICE');
    expect(checkInProblem(bk({}), ctx)?.code).toBe('ID_REQUIRED');
    expect(checkInProblem({ ...withId, bookingStatus: 'checked_in' }, ctx)?.code).toBe('BAD_STATUS');
  });
});

describe('tape chart cells and labels', () => {
  it('offers check-in only today, nothing in the past for managers', () => {
    expect(cellActions(today, { today })).toMatchObject({ checkIn: true, preBook: true, hold: true });
    expect(cellActions('2026-10-15', { today })).toMatchObject({ checkIn: false, preBook: true, hold: true });
    expect(cellActions('2026-10-10', { today })).toMatchObject({ checkIn: false, preBook: false, hold: false, past: true });
  });
  it('labels rooms by view', () => {
    expect(roomViewLabel({ roomNumber: 101, categoryName: 'x' })).toBe('Kanchenjunga View with Balcony');
    expect(roomViewLabel({ roomNumber: 103, categoryName: 'x' })).toBe('Valley View with Balcony');
    expect(roomViewLabel({ roomNumber: 104, categoryName: 'x' })).toBe('Forest View with Balcony');
    expect(roomViewLabel({ roomNumber: 202, categoryName: 'x' })).toBe('Premium View Suite');
  });
});

describe('room 103 is its own room type', () => {
  it('maps room 103 to Valley View (room-cat-4) and keeps 101/102 together', async () => {
    const { normalizeCategoryId, CATEGORY_CAPACITIES } = await import('@/lib/tariff-calculator');
    expect(normalizeCategoryId('room-103')).toBe('room-cat-4');
    expect(normalizeCategoryId('103')).toBe('room-cat-4');
    expect(normalizeCategoryId('room-101')).toBe('room-cat-1');
    expect(normalizeCategoryId('room-102')).toBe('room-cat-1');
    expect(CATEGORY_CAPACITIES['room-cat-1'].totalInventory).toBe(2);
    expect(CATEGORY_CAPACITIES['room-cat-4'].totalInventory).toBe(1);
  });
});
