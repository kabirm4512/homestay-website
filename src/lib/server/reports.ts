import type { CRMBooking, Expense, GuestFolio, RoomBlock } from '@/types/crm';
import { listRecords } from './repos/records';
import { listCrmBookings } from './repos/bookings';
import { listPhysicalRooms } from './repos/physical-rooms';
import { getGstConfig } from './repos/settings';
import { MoneySummary, summarizeMoney } from '@/lib/reports-core';
import { addCalendarDays, nightsBetween } from '@/lib/tariff-calculator';

/** Loads the data once and computes the summary (and optionally the previous period). */
export async function moneySummary(from: string, to: string, opts: { compare?: boolean } = {}): Promise<{ current: MoneySummary; previous?: MoneySummary }> {
  const [folios, bookings, expenses, rooms, blocks, gst] = await Promise.all([
    listRecords<GuestFolio>('folios', { limit: 20000 }),
    listCrmBookings(),
    listRecords<Expense>('expenses', { limit: 20000 }),
    listPhysicalRooms(),
    listRecords<RoomBlock>('roomBlocks', { limit: 5000 }),
    getGstConfig(),
  ]);
  const input = { folios, bookings: bookings as CRMBooking[], expenses, roomIds: rooms.map((r) => r.id), blocks, gst };
  const current = summarizeMoney(from, to, input);
  if (!opts.compare) return { current };
  const len = (nightsBetween(from, to) ?? 0) + 1;
  const prevTo = addCalendarDays(from, -1);
  const prevFrom = addCalendarDays(prevTo, -(len - 1));
  return { current, previous: summarizeMoney(prevFrom, prevTo, input) };
}
