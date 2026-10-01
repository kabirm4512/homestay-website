/**
 * Pricing parity check
 * ====================
 * Proves that the public website, the CRM and the booking API all charge the same
 * rupee amount, using the LIVE tariffs served by a running instance of the app.
 *
 * Usage (start the app first: `npm run dev` or `npm run build && npm start`):
 *
 *   node --experimental-strip-types scripts/check-pricing-parity.mts [baseUrl]
 *       Read-only parity checks. Safe to run against any environment.
 *
 *   STAFF_EMAIL=... STAFF_PASSWORD=... node --experimental-strip-types scripts/check-pricing-parity.mts [baseUrl] --write-test
 *       (an admin or manager account)
 *       Also changes a tariff and a seasonal range through POST /api/tariffs, confirms the
 *       public price picks them up, then RESTORES the original values. It writes to whatever
 *       store that server uses, so run it against a local dev server or a copy.
 *
 *   ... --write-test --with-booking
 *       Also creates ONE test booking (guest name "PRICING TEST") with a tampered total of
 *       ₹1 and checks the server re-priced it (room tariff + GST + add-ons). It is left as a
 *       pending request, so only use this against a test database.
 *
 * Run it in two timezones to prove timezone independence, e.g.
 *   TZ=Asia/Kolkata node --experimental-strip-types scripts/check-pricing-parity.mts
 *   TZ=UTC          node --experimental-strip-types scripts/check-pricing-parity.mts
 *
 * Exit code 0 = all checks passed.
 */

import {
  addCalendarDays,
  calculateDynamicTariff,
  calendarDayOfWeek,
  nightsBetween,
  sanitizeSeasonalRanges,
  sanitizeTariffsMap,
  BASE_OCCUPANCY_ADULTS,
} from '../src/lib/tariff-calculator.ts';
import { AIRPORT_TRANSFER_RATE } from '../src/lib/booking-addons.ts';
import { calculateBookingTotals, sanitizeGstConfig, type GstConfig } from '../src/lib/gst.ts';
import type { MealPlan, RoomSeasonalTariffs, SeasonalDateRange } from '../src/types/crm.ts';

const args = process.argv.slice(2);
const BASE_URL = (args.find((a) => /^https?:\/\//.test(a)) || 'http://localhost:3000').replace(/\/$/, '');
const WRITE_TEST = args.includes('--write-test');
const WITH_BOOKING = args.includes('--with-booking');
const MEAL_PLANS: MealPlan[] = ['EP', 'CP', 'MAP', 'AP'];

// Website category -> the physical CRM rooms that belong to it
const CATEGORIES: Record<string, string[]> = {
  'room-cat-1': ['room-101', 'room-102', 'room-103'],
  'room-cat-2': ['room-104'],
  'room-cat-3': ['room-201', 'room-202', 'room-203'],
};

let failures = 0;
let passes = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passes += 1;
    console.log(`  PASS  ${label}${detail ? `  (${detail})` : ''}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`);
  }
}

interface LiveData {
  tariffs: Record<string, RoomSeasonalTariffs>;
  seasonalDateRanges: SeasonalDateRange[];
  gstConfig: GstConfig;
  airportTransfer: number;
}

async function getLive(): Promise<LiveData> {
  const res = await fetch(`${BASE_URL}/api/tariffs`, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok || !json?.success) throw new Error(`GET /api/tariffs failed: ${res.status} ${json?.error || ''}`);
  // Same validation the browser applies (src/lib/live-tariffs.ts -> parseTariffResponse)
  return {
    tariffs: sanitizeTariffsMap(json.data.tariffs),
    seasonalDateRanges: sanitizeSeasonalRanges(json.data.seasonalDateRanges),
    gstConfig: sanitizeGstConfig(json.data.gstConfig),
    airportTransfer: Number(json.data.addonRates?.airportTransfer ?? AIRPORT_TRANSFER_RATE),
  };
}

/**
 * Independent reference implementation of the documented pricing rules, written
 * separately from the engine so the engine is checked against the spec, not itself.
 */
function referencePrice(
  t: RoomSeasonalTariffs,
  ranges: SeasonalDateRange[],
  checkIn: string,
  checkOut: string,
  plan: MealPlan,
  adults: number,
  children: number
): number {
  let total = 0;
  const nights = nightsBetween(checkIn, checkOut)!;
  for (let i = 0; i < nights; i++) {
    const d = addCalendarDays(checkIn, i);
    const inRanges = ranges.filter((r) => d >= r.startDate && d <= r.endDate);
    const type = inRanges.some((r) => r.seasonType === 'season')
      ? 'season'
      : inRanges.some((r) => r.seasonType === 'off_season')
        ? 'off_season'
        : 'regular';
    let rate = type === 'season' ? t.season[plan] : type === 'off_season' ? t.offSeason[plan] : t.regular[plan];
    const dow = calendarDayOfWeek(d);
    if (type === 'regular' && (dow === 5 || dow === 6) && t.weekendSurchargePercent) {
      rate = Math.round(rate * (1 + t.weekendSurchargePercent / 100));
    }
    total += rate;
  }
  total += Math.max(0, adults - (t.baseAdults || BASE_OCCUPANCY_ADULTS)) * (t.extraAdultRate || 0) * nights;
  total += children * (t.extraChildRate || 0) * nights;
  return total;
}

function isSeasonNight(d: string, ranges: SeasonalDateRange[], type: 'season' | 'off_season') {
  return ranges.some((r) => r.seasonType === type && d >= r.startDate && d <= r.endDate);
}
function isAnySeasonNight(d: string, ranges: SeasonalDateRange[]) {
  return ranges.some((r) => d >= r.startDate && d <= r.endDate);
}

/** Builds test stays from the LIVE season calendar (so the check still works after admin edits). */
function buildScenarios(ranges: SeasonalDateRange[]) {
  const scenarios: { name: string; checkIn: string; checkOut: string; expectTypes?: string[] }[] = [];
  const season = [...ranges].filter((r) => r.seasonType === 'season').sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const off = [...ranges].filter((r) => r.seasonType === 'off_season').sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  if (off) {
    const len = Math.min(3, (nightsBetween(off.startDate, off.endDate) ?? 0) + 1);
    scenarios.push({ name: `pure off-season (${off.name})`, checkIn: off.startDate, checkOut: addCalendarDays(off.startDate, len) });
  }
  if (season) {
    const len = Math.min(3, (nightsBetween(season.startDate, season.endDate) ?? 0) + 1);
    scenarios.push({ name: `pure season (${season.name})`, checkIn: season.startDate, checkOut: addCalendarDays(season.startDate, len) });
    // Cross INTO the season: 2 nights before its first day (if those are not seasonal) + 2 nights inside
    const before1 = addCalendarDays(season.startDate, -2);
    const before2 = addCalendarDays(season.startDate, -1);
    if (!isAnySeasonNight(before1, ranges) && !isAnySeasonNight(before2, ranges)) {
      scenarios.push({
        name: `crossing into season on ${season.startDate} (boundary inclusive)`,
        checkIn: before1,
        checkOut: addCalendarDays(season.startDate, 2),
        expectTypes: ['regular', 'regular', 'season', 'season'],
      });
    }
    // Cross OUT of the season: its last night + 1 night after (end date inclusive)
    const after = addCalendarDays(season.endDate, 1);
    if (!isAnySeasonNight(after, ranges)) {
      scenarios.push({
        name: `crossing out of season after ${season.endDate}`,
        checkIn: season.endDate,
        checkOut: addCalendarDays(season.endDate, 2),
        expectTypes: ['season', 'regular'],
      });
    }
  }
  return scenarios;
}

async function readOnlyChecks(live: LiveData) {
  console.log(`\nTimezone of this process: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  console.log(`Seasonal ranges: ${live.seasonalDateRanges.length}, tariff records: ${Object.keys(live.tariffs).length}\n`);

  const scenarios = buildScenarios(live.seasonalDateRanges);
  check('season calendar provides off-season, season and boundary scenarios', scenarios.length >= 3, `${scenarios.length} scenarios`);

  const occupancies = [
    { label: '2 adults', adults: 2, children: 0 },
    { label: '3 adults + 1 child (extra adult + child)', adults: 3, children: 1 },
  ];

  for (const [categoryId, physicalRooms] of Object.entries(CATEGORIES)) {
    const t = live.tariffs[categoryId];
    console.log(`\n${categoryId} (CRM rooms: ${physicalRooms.join(', ')})`);
    check(`${categoryId} has a live saved tariff`, Boolean(t));
    if (!t) continue;

    for (const sc of scenarios) {
      for (const plan of MEAL_PLANS) {
        for (const occ of occupancies) {
          // Public website path: category id + live data (RoomsSection / BookingModal / AvailabilityModal)
          const publicRes = calculateDynamicTariff({
            roomId: categoryId,
            checkIn: sc.checkIn,
            checkOut: sc.checkOut,
            mealPlan: plan,
            adultsCount: occ.adults,
            childrenCount: occ.children,
            tariffsMap: live.tariffs,
            seasonalDateRanges: live.seasonalDateRanges,
          });
          // CRM path: physical room ids through the same data (CRMContext -> ManualBookingModal)
          const crmTotals = physicalRooms.map(
            (pid) =>
              calculateDynamicTariff({
                roomId: pid,
                checkIn: sc.checkIn,
                checkOut: sc.checkOut,
                mealPlan: plan,
                adultsCount: occ.adults,
                childrenCount: occ.children,
                tariffsMap: live.tariffs,
                seasonalDateRanges: live.seasonalDateRanges,
              })?.totalAmount ?? null
          );
          const expected = referencePrice(t, live.seasonalDateRanges, sc.checkIn, sc.checkOut, plan, occ.adults, occ.children);
          const ok =
            publicRes !== null &&
            publicRes.totalAmount === expected &&
            crmTotals.every((x) => x === publicRes.totalAmount);
          check(
            `${sc.name} · ${plan} · ${occ.label}`,
            ok,
            `${sc.checkIn}→${sc.checkOut}: website ₹${publicRes?.totalAmount ?? 'n/a'}, CRM ₹${crmTotals.join('/₹')}, spec ₹${expected}`
          );
          if (sc.expectTypes && publicRes && plan === 'CP' && occ.adults === 2) {
            const types = publicRes.breakdown.map((b) => b.seasonType);
            check(
              `  per-night seasons for ${sc.name}`,
              JSON.stringify(types) === JSON.stringify(sc.expectTypes),
              types.join(', ')
            );
          }
        }
      }
    }
  }
}

async function adminLogin(): Promise<string> {
  const email = process.env.STAFF_EMAIL;
  const password = process.env.STAFF_PASSWORD;
  if (!email || !password) throw new Error('Set STAFF_EMAIL and STAFF_PASSWORD (an admin or manager) to run --write-test.');
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => null);
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  if (!res.ok || !cookie.startsWith('savera_staff=')) throw new Error(`Staff login failed (${res.status} ${json?.error || ''})`);
  if (json?.user?.mustChangePassword) throw new Error('This account must set a new password first (sign in on /admin).');
  return cookie;
}

async function postTariffs(body: unknown, cookie?: string) {
  const res = await fetch(`${BASE_URL}/api/tariffs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function writeChecks(original: LiveData) {
  console.log('\nWrite test: change a tariff + a season through /api/tariffs, confirm the website sees it, restore.');

  const anon = await postTariffs({ roomId: 'room-cat-1', tariffs: original.tariffs['room-cat-1'] });
  check('anonymous POST /api/tariffs is rejected', anon.status === 401, `HTTP ${anon.status}`);

  const cookie = await adminLogin();
  const originalCat1 = original.tariffs['room-cat-1'];
  const testRange: SeasonalDateRange = {
    id: `pricing-check-${Date.now()}`,
    name: 'Pricing Check Peak (temporary)',
    seasonType: 'season',
    startDate: '2031-03-10',
    endDate: '2031-03-11',
  };
  const changed: RoomSeasonalTariffs = {
    ...originalCat1,
    season: { ...originalCat1.season, CP: originalCat1.season.CP + 1111 },
  };

  try {
    const r1 = await postTariffs({ roomId: 'room-cat-1', tariffs: changed }, cookie);
    check('admin saves changed room-cat-1 season CP', r1.status === 200 && r1.json?.success, `HTTP ${r1.status}`);
    const r2 = await postTariffs({ type: 'seasonal_range_upsert', range: testRange }, cookie);
    check('admin adds a seasonal range', r2.status === 200 && r2.json?.success, `HTTP ${r2.status}`);

    const after = await getLive(); // exactly what a reloaded public page fetches
    const expectedTotal = 2 * changed.season.CP; // 2 season nights, base occupancy
    for (const roomId of ['room-cat-1', ...CATEGORIES['room-cat-1']]) {
      const res = calculateDynamicTariff({
        roomId,
        checkIn: '2031-03-10',
        checkOut: '2031-03-12',
        mealPlan: 'CP',
        tariffsMap: after.tariffs,
        seasonalDateRanges: after.seasonalDateRanges,
      });
      check(
        `after save, ${roomId} prices the new season at the new rate`,
        res?.totalAmount === expectedTotal,
        `₹${res?.totalAmount ?? 'n/a'} vs expected ₹${expectedTotal}`
      );
    }

    if (WITH_BOOKING) {
      const bookingRes = await fetch(`${BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: 'PRICING TEST',
          phone: '0000000000',
          room_name: 'Pricing check',
          check_in: '2031-03-10',
          check_out: '2031-03-12',
          meal_plan: 'CP',
          rooms_config: [{ room_id: 'room-cat-1', adults: 3, children: 1 }],
          addons: { airport_transfer: true, bike_rental: false },
          total_price: 1, // tampered client total must be ignored
        }),
      });
      const bj = await bookingRes.json().catch(() => null);
      const engine = calculateDynamicTariff({
        roomId: 'room-cat-1',
        checkIn: '2031-03-10',
        checkOut: '2031-03-12',
        mealPlan: 'CP',
        adultsCount: 3,
        childrenCount: 1,
        tariffsMap: after.tariffs,
        seasonalDateRanges: after.seasonalDateRanges,
      });
      const expectedBooking = engine ? calculateBookingTotals([engine], after.airportTransfer, after.gstConfig).total : NaN;
      check(
        'booking API ignores a tampered total and re-prices with live tariffs + GST',
        bookingRes.status === 201 && Number(bj?.data?.total_price) === expectedBooking,
        `stored ₹${bj?.data?.total_price}, expected ₹${expectedBooking}`
      );
    }
  } finally {
    // Restore the original values whatever happened above
    const restore1 = await postTariffs({ roomId: 'room-cat-1', tariffs: originalCat1 }, cookie);
    const restore2 = await postTariffs({ type: 'seasonal_range_delete', id: testRange.id }, cookie);
    const restored = await getLive();
    check(
      'original tariff and season calendar restored',
      restore1.status === 200 &&
        restore2.status === 200 &&
        JSON.stringify(restored.tariffs['room-cat-1']) === JSON.stringify(originalCat1) &&
        JSON.stringify(restored.seasonalDateRanges) === JSON.stringify(original.seasonalDateRanges)
    );
  }
}

async function main() {
  console.log(`Pricing parity check against ${BASE_URL}`);
  const live = await getLive();
  await readOnlyChecks(live);
  if (WRITE_TEST) await writeChecks(live);
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nPricing check could not run:', err instanceof Error ? err.message : err);
  process.exit(1);
});
