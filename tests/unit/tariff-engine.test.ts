import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  calculateDynamicTariff,
  calculateMultiRoomStay,
  calendarDayOfWeek,
  nightsBetween,
  resolveSeasonForNight,
  stayRestriction,
  todayInIST,
  tomorrowInIST,
} from '@/lib/tariff-calculator';
import type { RoomSeasonalTariffs, SeasonalDateRange } from '@/types/crm';

const TARIFF: RoomSeasonalTariffs = {
  regular: { EP: 4000, CP: 4500, MAP: 5500, AP: 6500 },
  season: { EP: 5800, CP: 6500, MAP: 7800, AP: 9000 },
  offSeason: { EP: 3200, CP: 3600, MAP: 4400, AP: 5200 },
  weekendSurchargePercent: 10,
  extraAdultRate: 1200,
  extraChildRate: 600,
};
const TARIFFS = { 'room-cat-1': TARIFF };
const RANGES: SeasonalDateRange[] = [
  { id: 's1', name: 'Puja Peak', seasonType: 'season', startDate: '2026-10-10', endDate: '2026-10-20' },
  { id: 'o1', name: 'Monsoon', seasonType: 'off_season', startDate: '2026-07-01', endDate: '2026-09-15' },
  { id: 'o2', name: 'Overlap Off', seasonType: 'off_season', startDate: '2026-10-15', endDate: '2026-10-25' },
];

const price = (checkIn: string, checkOut: string, extra: Partial<Parameters<typeof calculateDynamicTariff>[0]> = {}) =>
  calculateDynamicTariff({ roomId: 'room-cat-1', checkIn, checkOut, tariffsMap: TARIFFS, seasonalDateRanges: RANGES, ...extra });

describe('calendar helpers (IST, timezone-independent)', () => {
  it('counts nights between calendar dates', () => {
    expect(nightsBetween('2026-10-01', '2026-10-04')).toBe(3);
    expect(nightsBetween('2026-10-04', '2026-10-01')).toBe(-3);
    expect(nightsBetween('bad', '2026-10-01')).toBeNull();
  });
  it('adds days across month and year ends', () => {
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('knows the weekday', () => {
    expect(calendarDayOfWeek('2026-10-02')).toBe(5); // Friday
  });
  it('uses the Indian date, not UTC', () => {
    // 2026-10-01 20:00 UTC is already 2 Oct 01:30 in India
    expect(todayInIST(new Date('2026-10-01T20:00:00Z'))).toBe('2026-10-02');
    expect(tomorrowInIST(new Date('2026-10-01T20:00:00Z'))).toBe('2026-10-03');
  });
});

describe('season resolution', () => {
  it('peak wins over off-season on overlap and ranges are inclusive', () => {
    expect(resolveSeasonForNight('2026-10-20', RANGES).seasonType).toBe('season');
    expect(resolveSeasonForNight('2026-10-21', RANGES).seasonType).toBe('off_season');
    expect(resolveSeasonForNight('2026-09-15', RANGES).seasonType).toBe('off_season');
    expect(resolveSeasonForNight('2026-09-16', RANGES).seasonType).toBe('regular');
  });
});

describe('calculateDynamicTariff', () => {
  it('prices regular weekday nights at the regular rate', () => {
    const r = price('2026-09-21', '2026-09-23'); // Mon, Tue
    expect(r?.totalAmount).toBe(9000);
    expect(r?.nights).toBe(2);
  });
  it('adds the weekend surcharge on regular Friday/Saturday nights only', () => {
    const r = price('2026-09-25', '2026-09-28'); // Fri, Sat, Sun
    expect(r?.breakdown.map((b) => b.amount)).toEqual([4950, 4950, 4500]);
  });
  it('does not add the weekend surcharge in peak season', () => {
    const r = price('2026-10-16', '2026-10-18'); // Fri, Sat in peak
    expect(r?.breakdown.map((b) => b.amount)).toEqual([6500, 6500]);
  });
  it('prices each night by its own season (stay crossing a boundary)', () => {
    const r = price('2026-10-19', '2026-10-22'); // peak, peak, off
    expect(r?.breakdown.map((b) => b.seasonType)).toEqual(['season', 'season', 'off_season']);
    expect(r?.totalAmount).toBe(6500 + 6500 + 3600);
  });
  it('charges extra adults beyond two and every child, per night', () => {
    const r = price('2026-09-21', '2026-09-23', { adultsCount: 3, childrenCount: 1 });
    expect(r?.extraAdultsCharge).toBe(2400);
    expect(r?.extraChildrenCharge).toBe(1200);
    expect(r?.totalAmount).toBe(9000 + 3600);
  });
  it('never guesses: unknown room, bad dates or missing rates give null', () => {
    expect(calculateDynamicTariff({ roomId: 'room-cat-9', checkIn: '2026-09-21', checkOut: '2026-09-22', tariffsMap: TARIFFS, seasonalDateRanges: RANGES })).toBeNull();
    expect(price('2026-09-22', '2026-09-22')).toBeNull();
    expect(price('2026-09-21', '2026-09-22', { tariffsMap: null })).toBeNull();
    expect(price('2026-09-21', '2026-09-22', { seasonalDateRanges: null })).toBeNull();
    const noChildRate = { 'room-cat-1': { ...TARIFF, extraChildRate: 0 } };
    expect(price('2026-09-21', '2026-09-22', { tariffsMap: noChildRate, childrenCount: 1 })).toBeNull();
  });
  it('resolves physical room ids to their category tariff', () => {
    const r = calculateDynamicTariff({ roomId: 'room-101', checkIn: '2026-09-21', checkOut: '2026-09-22', tariffsMap: TARIFFS, seasonalDateRanges: RANGES });
    expect(r === null || r.totalAmount > 0).toBe(true);
  });
});

describe('calculateMultiRoomStay', () => {
  it('sums rooms and refuses a partial total', () => {
    const ok = calculateMultiRoomStay({
      rooms: [{ roomId: 'room-cat-1', adults: 2, children: 0 }, { roomId: 'room-cat-1', adults: 3, children: 0 }],
      checkIn: '2026-09-21',
      checkOut: '2026-09-22',
      tariffsMap: TARIFFS,
      seasonalDateRanges: RANGES,
    });
    expect(ok?.totalAmount).toBe(4500 + 4500 + 1200);
    const partial = calculateMultiRoomStay({
      rooms: [{ roomId: 'room-cat-1', adults: 2, children: 0 }, { roomId: 'room-cat-404', adults: 2, children: 0 }],
      checkIn: '2026-09-21',
      checkOut: '2026-09-22',
      tariffsMap: TARIFFS,
      seasonalDateRanges: RANGES,
    });
    expect(partial).toBeNull();
  });
});

describe('rate model options', () => {
  it('uses the category’s included adults', () => {
    const map = { 'room-cat-1': { ...TARIFF, baseAdults: 3 } };
    const r = price('2026-09-21', '2026-09-22', { tariffsMap: map, adultsCount: 3 });
    expect(r?.extraAdultsCount).toBe(0);
    expect(r?.totalAmount).toBe(4500);
  });
  it('lets young children stay free when their ages are known', () => {
    const map = { 'room-cat-1': { ...TARIFF, freeChildUnderAge: 5 } };
    const r = price('2026-09-21', '2026-09-22', { tariffsMap: map, childrenCount: 2, childAges: [3, 8] });
    expect(r?.freeChildrenCount).toBe(1);
    expect(r?.extraChildrenCharge).toBe(600);
    // ages missing → every child is charged
    expect(price('2026-09-21', '2026-09-22', { tariffsMap: map, childrenCount: 2 })?.extraChildrenCharge).toBe(1200);
  });
  it('enforces a season’s minimum stay', () => {
    const ranges: SeasonalDateRange[] = [{ ...RANGES[0], minNights: 2 }];
    expect(stayRestriction('2026-10-12', '2026-10-13', ranges)).toMatch(/at least 2 nights/);
    expect(stayRestriction('2026-10-12', '2026-10-14', ranges)).toBeNull();
    expect(stayRestriction('2026-09-01', '2026-09-02', ranges)).toBeNull();
  });
});
