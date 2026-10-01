import type { RoomSeasonalTariffs, SeasonalDateRange, MealPlan, MealPlanRates } from '@/types/crm';
import type { Room } from '@/types';
import type { RoomConfig } from '@/components/RoomGuestSelector';

/**
 * ============================================================================
 * CANONICAL ROOM PRICING ENGINE
 * ============================================================================
 * The single source of room-pricing logic for:
 *   - the public website (rooms section, availability, booking and inquiry modals),
 *   - the CRM / PMS (manual booking, rate simulator),
 *   - the server (the booking API re-prices every stay before saving it).
 *
 * Rules (explicit so that every caller agrees to the rupee):
 *   - Dates are Indian calendar dates, 'YYYY-MM-DD' (Asia/Kolkata). All date maths
 *     is done on the calendar date itself (via UTC arithmetic), so the result is
 *     identical in an IST browser, a UTC server, or any other timezone.
 *   - A stay is charged for each NIGHT starting on checkIn, checkIn+1 ... checkOut-1.
 *     The checkOut date itself is never charged.
 *   - A night belongs to a seasonal range when startDate <= night <= endDate
 *     (BOTH ends inclusive). Nights are priced one by one, so a stay that crosses
 *     a season boundary gets a mixed per-night breakdown.
 *   - If ranges overlap, 'season' (peak) wins over 'off_season'. Otherwise 'regular'.
 *   - Weekend surcharge: Friday and Saturday nights, REGULAR nights only,
 *     rounded to the nearest rupee per night.
 *   - Extra adults: per adult above BASE_OCCUPANCY_ADULTS, per night.
 *     Every child is charged the extra-child rate per night.
 *   - Tariffs are looked up by room CATEGORY first, so a physical room ('room-101')
 *     and its website category ('room-cat-1') always read the same saved tariff.
 *   - There is NO hardcoded fallback price. If saved tariffs or a needed rate are
 *     missing, the engine returns null and the UI shows "price on request".
 * ============================================================================
 */

export const PRICING_TIMEZONE = 'Asia/Kolkata';
export const BASE_OCCUPANCY_ADULTS = 2;
const MEAL_PLANS: MealPlan[] = ['EP', 'CP', 'MAP', 'AP'];

export interface TariffBreakdownItem {
  date: string;
  rateName: string;
  seasonType: 'season' | 'off_season' | 'regular';
  amount: number;
}

export interface DynamicTariffResult {
  totalAmount: number;
  baseAmount: number;
  extraAdultsCount: number;
  extraAdultRate: number;
  extraAdultsCharge: number;
  extraChildrenCount: number;
  extraChildRate: number;
  extraChildrenCharge: number;
  /** Children who stay free (younger than the room's free-child age). */
  freeChildrenCount?: number;
  /** Adults included in the room rate for this category. */
  baseAdults?: number;
  nights: number;
  avgRatePerNight: number;
  mealPlan: MealPlan;
  breakdown: TariffBreakdownItem[];
}

export interface SuggestedRoomItem {
  roomNumber: number;
  roomCategory: Room;
  adults: number;
  children: number;
  childAges: number[];
  nightlyRate: number;
  totalStayPrice: number;
  capacityFitReason: string;
  tariffResult: DynamicTariffResult;
}

export interface SuggestedCombination {
  id: 'best_value' | 'comfort_upgrade' | 'luxury_suites' | 'custom';
  badge: string;
  badgeColor: string; // Tailwind color class
  title: string;
  tagline: string;
  description: string;
  rooms: SuggestedRoomItem[];
  totalNightlyRate: number;
  totalStayPrice: number;
  mealPlan: MealPlan;
  nights: number;
  isRecommended?: boolean;
}

// ============================================================================
// Calendar-date helpers (timezone independent)
// ============================================================================
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseCalendarDate(dateStr: string): { y: number; m: number; d: number } | null {
  if (typeof dateStr !== 'string') return null;
  const match = ISO_DATE_RE.exec(dateStr.trim().slice(0, 10));
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

function calendarDateToUTCMillis(dateStr: string): number | null {
  const p = parseCalendarDate(dateStr);
  return p ? Date.UTC(p.y, p.m - 1, p.d) : null;
}

function utcMillisToCalendarDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** True when the string is a real calendar date in YYYY-MM-DD form. */
export function isCalendarDate(dateStr: string): boolean {
  return parseCalendarDate(dateStr) !== null;
}

/** Adds (or subtracts) whole days to a YYYY-MM-DD date without any timezone shift. */
export function addCalendarDays(dateStr: string, days: number): string {
  const ms = calendarDateToUTCMillis(dateStr);
  if (ms === null) return dateStr;
  return utcMillisToCalendarDate(ms + days * DAY_MS);
}

/** Nights between two YYYY-MM-DD dates (0/negative when checkOut <= checkIn, null when invalid). */
export function nightsBetween(checkIn: string, checkOut: string): number | null {
  const a = calendarDateToUTCMillis(checkIn);
  const b = calendarDateToUTCMillis(checkOut);
  if (a === null || b === null) return null;
  return Math.round((b - a) / DAY_MS);
}

/** Day of week for a calendar date: 0 = Sunday ... 5 = Friday, 6 = Saturday. */
export function calendarDayOfWeek(dateStr: string): number | null {
  const ms = calendarDateToUTCMillis(dateStr);
  return ms === null ? null : new Date(ms).getUTCDay();
}

/** Today's date in India (Asia/Kolkata) as YYYY-MM-DD, whatever the device timezone. */
export function todayInIST(now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: PRICING_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    // IST is a fixed +05:30 offset with no DST, so this fallback is exact.
    return utcMillisToCalendarDate(now.getTime() + 330 * 60 * 1000);
  }
}

/** Tomorrow's date in India (Asia/Kolkata). */
export function tomorrowInIST(now: Date = new Date()): string {
  return addCalendarDays(todayInIST(now), 1);
}

// ============================================================================
// Room / category identity
// ============================================================================

/**
 * Every known room identifier -> canonical website category ID.
 * Physical rooms (CRM), legacy sequential IDs and CRM category IDs all resolve here.
 */
export const PHYSICAL_TO_CATEGORY_MAP: Record<string, string> = {
  'room-101': 'room-cat-1',
  'room-102': 'room-cat-1',
  'room-103': 'room-cat-1',
  'room-104': 'room-cat-2',
  'room-201': 'room-cat-3',
  'room-202': 'room-cat-3',
  'room-203': 'room-cat-3',
  '101': 'room-cat-1',
  '102': 'room-cat-1',
  '103': 'room-cat-1',
  '104': 'room-cat-2',
  '201': 'room-cat-3',
  '202': 'room-cat-3',
  '203': 'room-cat-3',
  // Legacy sequential physical-room IDs
  'room-1': 'room-cat-1',
  'room-2': 'room-cat-1',
  'room-3': 'room-cat-1',
  'room-4': 'room-cat-2',
  'room-5': 'room-cat-3',
  'room-6': 'room-cat-3',
  'room-7': 'room-cat-3',
  // CRM physical-room category IDs
  'cat-1': 'room-cat-1',
  'cat-2': 'room-cat-2',
  'cat-3': 'room-cat-3',
};

/**
 * Standard capacity specifications per category
 */
export const CATEGORY_CAPACITIES: Record<string, {
  maxAdults: number;
  maxChildren: number;
  baseAdults: number;
  totalInventory: number;
}> = {
  'room-cat-1': { maxAdults: 3, maxChildren: 2, baseAdults: 2, totalInventory: 3 },
  'room-cat-2': { maxAdults: 2, maxChildren: 1, baseAdults: 2, totalInventory: 1 },
  'room-cat-3': { maxAdults: 4, maxChildren: 2, baseAdults: 2, totalInventory: 3 },
};

/**
 * Normalizes any room ID (physical, legacy or category) to its canonical category ID.
 * Unknown IDs (for example a Supabase UUID) are returned unchanged.
 */
export function normalizeCategoryId(roomId: string): string {
  if (!roomId) return '';
  return PHYSICAL_TO_CATEGORY_MAP[roomId] || roomId;
}

/** The category ID plus every physical/legacy 'room-*' alias that belongs to it. */
export function getCategoryAliases(categoryId: string): string[] {
  const cat = normalizeCategoryId(categoryId);
  const aliases = Object.keys(PHYSICAL_TO_CATEGORY_MAP).filter(
    (k) => PHYSICAL_TO_CATEGORY_MAP[k] === cat && k.startsWith('room-')
  );
  return [cat, ...aliases];
}

// ============================================================================
// Tariff data validation
// ============================================================================
function isPositiveRate(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function isValidMealPlanRates(rates: unknown): rates is MealPlanRates {
  if (!rates || typeof rates !== 'object') return false;
  return MEAL_PLANS.every((p) => {
    const v = (rates as Record<string, unknown>)[p];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0;
  });
}

/** Structural check for a room tariff record as saved by the admin. */
export function isValidRoomTariffs(t: unknown): t is RoomSeasonalTariffs {
  if (!t || typeof t !== 'object') return false;
  const obj = t as RoomSeasonalTariffs;
  if (!isValidMealPlanRates(obj.regular) || !isValidMealPlanRates(obj.season) || !isValidMealPlanRates(obj.offSeason)) {
    return false;
  }
  const optional = [obj.weekendSurchargePercent, obj.extraAdultRate, obj.extraChildRate, obj.freeChildUnderAge];
  const okOptional = optional.every(
    (v) => v === undefined || v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0)
  );
  const okBase = obj.baseAdults === undefined || obj.baseAdults === null || (Number.isInteger(obj.baseAdults) && obj.baseAdults >= 1 && obj.baseAdults <= 10);
  return okOptional && okBase;
}

/** Structural check for a seasonal date range (dates valid and start <= end). */
export function isValidSeasonalRange(r: unknown): r is SeasonalDateRange {
  if (!r || typeof r !== 'object') return false;
  const obj = r as SeasonalDateRange;
  return (
    typeof obj.id === 'string' &&
    obj.id.length > 0 &&
    typeof obj.name === 'string' &&
    (obj.seasonType === 'season' || obj.seasonType === 'off_season') &&
    isCalendarDate(obj.startDate) &&
    isCalendarDate(obj.endDate) &&
    obj.startDate <= obj.endDate &&
    (obj.minNights === undefined || obj.minNights === null || (Number.isInteger(obj.minNights) && obj.minNights >= 1 && obj.minNights <= 30))
  );
}

/**
 * Stay restrictions from the seasonal calendar (minimum nights). Returns a guest-facing
 * message when the stay is not allowed, otherwise null.
 */
export function stayRestriction(checkIn: string, checkOut: string, ranges: SeasonalDateRange[] | null | undefined): string | null {
  const nights = nightsBetween(checkIn, checkOut);
  if (nights === null || nights < 1 || !Array.isArray(ranges)) return null;
  let required = 0;
  let name = '';
  for (let i = 0; i < nights; i++) {
    const night = addCalendarDays(checkIn.slice(0, 10), i);
    for (const r of ranges) {
      if (!isValidSeasonalRange(r) || !r.minNights) continue;
      if (night >= r.startDate && night <= r.endDate && r.minNights > required) {
        required = r.minNights;
        name = r.name;
      }
    }
  }
  return required > nights ? `Stays during ${name} need at least ${required} nights.` : null;
}

/** Keeps only structurally valid tariff records. */
export function sanitizeTariffsMap(input: unknown): Record<string, RoomSeasonalTariffs> {
  const out: Record<string, RoomSeasonalTariffs> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (isValidRoomTariffs(value)) out[key] = value;
  }
  return out;
}

/** Keeps only structurally valid seasonal ranges. */
export function sanitizeSeasonalRanges(input: unknown): SeasonalDateRange[] {
  if (!Array.isArray(input)) return [];
  return input.filter(isValidSeasonalRange);
}

/**
 * Finds the saved tariff for any room identifier. The canonical CATEGORY entry wins,
 * so physical rooms and website categories can never drift apart.
 * Returns null when nothing valid is saved (the caller shows "price on request").
 */
export function resolveRoomTariffs(
  roomId: string,
  tariffsMap: Record<string, RoomSeasonalTariffs> | null | undefined
): RoomSeasonalTariffs | null {
  if (!roomId || !tariffsMap) return null;
  const catKey = normalizeCategoryId(roomId);
  const byCategory = tariffsMap[catKey];
  if (isValidRoomTariffs(byCategory)) return byCategory;
  const byId = tariffsMap[roomId];
  if (isValidRoomTariffs(byId)) return byId;
  return null;
}

/** Which season a single night falls into (peak wins over off-season on overlap). */
export function resolveSeasonForNight(
  nightDate: string,
  seasonalDateRanges: SeasonalDateRange[]
): { seasonType: 'season' | 'off_season' | 'regular'; name: string } {
  let offSeasonMatch: SeasonalDateRange | null = null;
  for (const range of seasonalDateRanges) {
    if (!isValidSeasonalRange(range)) continue;
    if (nightDate >= range.startDate && nightDate <= range.endDate) {
      if (range.seasonType === 'season') {
        return { seasonType: 'season', name: range.name };
      }
      if (!offSeasonMatch) offSeasonMatch = range;
    }
  }
  if (offSeasonMatch) return { seasonType: 'off_season', name: offSeasonMatch.name };
  return { seasonType: 'regular', name: 'Regular Tariff' };
}

// ============================================================================
// The canonical calculator
// ============================================================================

/**
 * Canonical dynamic tariff calculator, shared by the website, the CRM and the server.
 * Returns null when the stay cannot be priced from saved backend data
 * (invalid dates, no saved tariff for the room, or a needed rate is missing).
 */
export function calculateDynamicTariff(params: {
  roomId: string;
  checkIn: string;
  checkOut: string;
  mealPlan?: MealPlan;
  adultsCount?: number;
  childrenCount?: number;
  /** Ages of the children (optional); used for the free-child age rule. */
  childAges?: number[];
  tariffsMap: Record<string, RoomSeasonalTariffs> | null | undefined;
  seasonalDateRanges: SeasonalDateRange[] | null | undefined;
}): DynamicTariffResult | null {
  const {
    roomId,
    checkIn,
    checkOut,
    mealPlan = 'CP',
    adultsCount = BASE_OCCUPANCY_ADULTS,
    childrenCount = 0,
    childAges,
    tariffsMap,
    seasonalDateRanges,
  } = params;

  if (!MEAL_PLANS.includes(mealPlan)) return null;
  if (!Array.isArray(seasonalDateRanges)) return null;

  const tariffs = resolveRoomTariffs(roomId, tariffsMap);
  if (!tariffs) return null;

  const nights = nightsBetween(checkIn, checkOut);
  if (nights === null || nights < 1) return null;

  const firstNight = checkIn.trim().slice(0, 10);
  let baseRoomAmount = 0;
  const breakdown: TariffBreakdownItem[] = [];

  for (let i = 0; i < nights; i++) {
    const nightDate = addCalendarDays(firstNight, i);
    const dayOfWeek = calendarDayOfWeek(nightDate);
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

    const { seasonType, name } = resolveSeasonForNight(nightDate, seasonalDateRanges);
    const tier: MealPlanRates =
      seasonType === 'season' ? tariffs.season : seasonType === 'off_season' ? tariffs.offSeason : tariffs.regular;

    let nightlyRate = tier[mealPlan];
    if (!isPositiveRate(nightlyRate)) return null;

    let rateName = name;
    if (seasonType === 'regular' && isWeekend && isPositiveRate(tariffs.weekendSurchargePercent)) {
      nightlyRate = Math.round(nightlyRate * (1 + tariffs.weekendSurchargePercent / 100));
      rateName += ' (Weekend)';
    }

    baseRoomAmount += nightlyRate;
    breakdown.push({
      date: nightDate,
      rateName: `${rateName} (${mealPlan})`,
      seasonType,
      amount: nightlyRate,
    });
  }

  const safeAdults = Math.max(0, Math.floor(Number(adultsCount) || 0));
  const safeChildren = Math.max(0, Math.floor(Number(childrenCount) || 0));
  const baseAdults = tariffs.baseAdults && tariffs.baseAdults > 0 ? tariffs.baseAdults : BASE_OCCUPANCY_ADULTS;
  const extraAdultsCount = Math.max(0, safeAdults - baseAdults);
  // Free-child rule applies only when every child's age is known
  const freeUnder = typeof tariffs.freeChildUnderAge === 'number' && tariffs.freeChildUnderAge > 0 ? tariffs.freeChildUnderAge : null;
  const agesKnown = Array.isArray(childAges) && childAges.length === safeChildren && childAges.every((a) => Number.isFinite(a) && a >= 0);
  const freeChildrenCount = freeUnder !== null && agesKnown ? childAges!.filter((a) => a < freeUnder).length : 0;
  const extraChildrenCount = safeChildren - freeChildrenCount;

  const extraAdultRate = Number(tariffs.extraAdultRate ?? 0);
  const extraChildRate = Number(tariffs.extraChildRate ?? 0);
  // Never guess a missing extra-person rate: if one is needed but not saved, the stay is unpriceable.
  if (extraAdultsCount > 0 && !isPositiveRate(extraAdultRate)) return null;
  if (extraChildrenCount > 0 && !isPositiveRate(extraChildRate)) return null;

  const extraAdultsCharge = extraAdultsCount * extraAdultRate * nights;
  const extraChildrenCharge = extraChildrenCount * extraChildRate * nights;
  const totalAmount = baseRoomAmount + extraAdultsCharge + extraChildrenCharge;
  const avgRatePerNight = Math.round(totalAmount / nights);

  return {
    totalAmount,
    baseAmount: baseRoomAmount,
    extraAdultsCount,
    extraAdultRate,
    extraAdultsCharge,
    extraChildrenCount,
    extraChildRate,
    extraChildrenCharge,
    freeChildrenCount,
    baseAdults,
    nights,
    avgRatePerNight,
    mealPlan,
    breakdown,
  };
}

/**
 * Prices a multi-room stay. Returns null if ANY room cannot be priced, so a partial
 * total is never shown or charged.
 */
export function calculateMultiRoomStay(params: {
  rooms: { roomId: string; adults: number; children: number; childAges?: number[] }[];
  checkIn: string;
  checkOut: string;
  mealPlan?: MealPlan;
  tariffsMap: Record<string, RoomSeasonalTariffs> | null | undefined;
  seasonalDateRanges: SeasonalDateRange[] | null | undefined;
}): { totalAmount: number; extraChargesTotal: number; nights: number; perRoom: DynamicTariffResult[] } | null {
  const { rooms, checkIn, checkOut, mealPlan = 'CP', tariffsMap, seasonalDateRanges } = params;
  if (!Array.isArray(rooms) || rooms.length === 0) return null;
  const perRoom: DynamicTariffResult[] = [];
  for (const r of rooms) {
    const res = calculateDynamicTariff({
      roomId: r.roomId,
      checkIn,
      checkOut,
      mealPlan,
      adultsCount: r.adults,
      childrenCount: r.children,
      childAges: r.childAges,
      tariffsMap,
      seasonalDateRanges,
    });
    if (!res) return null;
    perRoom.push(res);
  }
  return {
    totalAmount: perRoom.reduce((s, r) => s + r.totalAmount, 0),
    extraChargesTotal: perRoom.reduce((s, r) => s + r.extraAdultsCharge + r.extraChildrenCharge, 0),
    nights: perRoom[0].nights,
    perRoom,
  };
}


/**
 * Checks if a specific room category can physically accommodate the guests
 */
export function canCategoryFit(categoryId: string, adults: number, children: number, room?: Room): boolean {
  const cap = categoryCapacity(categoryId, room);
  return adults <= cap.maxAdults && children <= cap.maxChildren;
}

/** Guest capacity of a category: from the room's saved data, else the built-in defaults. */
export function categoryCapacity(categoryId: string, room?: Room | null): { maxAdults: number; maxChildren: number } {
  const fallback = CATEGORY_CAPACITIES[categoryId] || { maxAdults: 3, maxChildren: 2 };
  return {
    maxAdults: room && Number(room.capacity_adults) > 0 ? Number(room.capacity_adults) : fallback.maxAdults,
    maxChildren: room && room.capacity_children !== undefined && room.capacity_children !== null ? Number(room.capacity_children) : fallback.maxChildren,
  };
}

/**
 * Suggests the best possible combinations of rooms based on backend availability,
 * guest capacities per room, and live dynamic tariffs.
 */
export function suggestBestRoomCombinations(params: {
  roomsConfig: RoomConfig[];
  checkIn: string;
  checkOut: string;
  mealPlan?: MealPlan;
  availableCategories: Record<string, { availableCount: number }>;
  rooms: Room[];
  tariffsMap: Record<string, RoomSeasonalTariffs> | null | undefined;
  seasonalDateRanges: SeasonalDateRange[] | null | undefined;
}): SuggestedCombination[] {
  const {
    roomsConfig,
    checkIn,
    checkOut,
    mealPlan = 'CP',
    availableCategories,
    rooms,
    tariffsMap,
    seasonalDateRanges,
  } = params;

  if (!roomsConfig || roomsConfig.length === 0 || !rooms || rooms.length === 0) {
    return [];
  }

  const roomMap = new Map<string, Room>(rooms.map((r) => [r.id, r]));

  // Get list of active category IDs that have inventory > 0 AND a saved live tariff
  // (a category we cannot price is never recommended)
  const availableCatIds = Object.keys(availableCategories).filter(
    (catId) =>
      (availableCategories[catId]?.availableCount || 0) > 0 &&
      resolveRoomTariffs(catId, tariffsMap) !== null
  );

  // If no rooms are available at all across categories, return empty
  if (availableCatIds.length === 0) {
    return [];
  }

  const numRoomsNeeded = roomsConfig.length;

  // Generate valid category assignments: Array of length N with category IDs
  // Recursive backtracking to find all valid combinations respecting inventory and guest capacity
  const validAssignments: string[][] = [];

  function backtrack(
    roomIndex: number,
    currentAssignment: string[],
    usedCounts: Record<string, number>
  ) {
    if (roomIndex === numRoomsNeeded) {
      validAssignments.push([...currentAssignment]);
      return;
    }

    const currentRoomReq = roomsConfig[roomIndex];
    const adults = currentRoomReq.adults || 2;
    const children = currentRoomReq.children || 0;

    for (const catId of availableCatIds) {
      const maxAvailable = availableCategories[catId]?.availableCount || 0;
      const alreadyUsed = usedCounts[catId] || 0;

      // Inventory check
      if (alreadyUsed >= maxAvailable) continue;

      // Physical capacity check
      if (!canCategoryFit(catId, adults, children, roomMap.get(catId))) continue;

      // Valid branch
      usedCounts[catId] = alreadyUsed + 1;
      currentAssignment.push(catId);

      backtrack(roomIndex + 1, currentAssignment, usedCounts);

      // Backtrack
      currentAssignment.pop();
      usedCounts[catId] = alreadyUsed;
    }
  }

  backtrack(0, [], {});

  // If strict assignment yielded no results (e.g. not enough inventory for exact fit),
  // fallback to relaxing inventory slightly or returning partial
  if (validAssignments.length === 0) {
    return [];
  }

  // Helper to build a complete SuggestedCombination from an assignment
  function buildCombination(
    id: 'best_value' | 'comfort_upgrade' | 'luxury_suites',
    badge: string,
    badgeColor: string,
    title: string,
    tagline: string,
    description: string,
    assignment: string[],
    isRecommended: boolean = false
  ): SuggestedCombination {
    let totalStayPrice = 0;
    let nightsCount = 1;

    const suggestedRooms: SuggestedRoomItem[] = assignment.map((catId, idx) => {
      const req = roomsConfig[idx];
      const roomCat = roomMap.get(catId)!;
      const adults = req.adults || 2;
      const children = req.children || 0;

      const tariffResult = calculateDynamicTariff({
        roomId: catId,
        checkIn,
        checkOut,
        mealPlan,
        adultsCount: adults,
        childrenCount: children,
        tariffsMap,
        seasonalDateRanges,
      })!; // non-null: every assignment reaching here was fully priced during scoring

      nightsCount = tariffResult.nights;
      totalStayPrice += tariffResult.totalAmount;

      // Explain why this room fits
      let fitReason = `Fits ${adults} Adults${children > 0 ? ` + ${children} Child` : ''}`;
      if (catId === 'room-cat-3') {
        fitReason += ' with fireplace & 180° observation balcony';
      } else if (catId === 'room-cat-1') {
        fitReason += ' with private mountain sunrise balcony';
      } else if (catId === 'room-cat-2') {
        fitReason += ' in peaceful pine canopy';
      }

      return {
        roomNumber: idx + 1,
        roomCategory: roomCat,
        adults,
        children,
        childAges: req.childAges || [],
        nightlyRate: tariffResult.avgRatePerNight,
        totalStayPrice: tariffResult.totalAmount,
        capacityFitReason: fitReason,
        tariffResult,
      };
    });

    const totalNightlyRate = Math.round(totalStayPrice / Math.max(1, nightsCount));

    return {
      id,
      badge,
      badgeColor,
      title,
      tagline,
      description,
      rooms: suggestedRooms,
      totalNightlyRate,
      totalStayPrice,
      mealPlan,
      nights: nightsCount,
      isRecommended,
    };
  }

  // Evaluate each valid assignment's total cost & suite count.
  // Assignments containing any room that cannot be priced are dropped.
  const scoredAssignments = validAssignments.map((assignment) => {
    let cost = 0;
    let suiteCount = 0;
    let priceable = true;

    assignment.forEach((catId, idx) => {
      const req = roomsConfig[idx];
      const res = calculateDynamicTariff({
        roomId: catId,
        checkIn,
        checkOut,
        mealPlan,
        adultsCount: req.adults || 2,
        childrenCount: req.children || 0,
        tariffsMap,
        seasonalDateRanges,
      });
      if (!res) {
        priceable = false;
        return;
      }
      cost += res.totalAmount;
      if (catId === 'room-cat-3') suiteCount++;
    });

    return priceable ? { assignment, cost, suiteCount } : null;
  }).filter((s): s is { assignment: string[]; cost: number; suiteCount: number } => s !== null);

  if (scoredAssignments.length === 0) {
    return [];
  }

  // Sort by lowest cost for Best Value
  scoredAssignments.sort((a, b) => a.cost - b.cost);

  const combinations: SuggestedCombination[] = [];
  const usedKeys = new Set<string>();

  // 1. BEST VALUE MATCH (Lowest cost valid assignment)
  const bestValue = scoredAssignments[0];
  const bestValueKey = bestValue.assignment.join('|');
  usedKeys.add(bestValueKey);

  // Build descriptive title
  const catCounts: Record<string, number> = {};
  bestValue.assignment.forEach((cid) => {
    catCounts[cid] = (catCounts[cid] || 0) + 1;
  });
  const bestValueTitleParts = Object.entries(catCounts).map(([cid, count]) => {
    const name = roomMap.get(cid)?.room_type || roomMap.get(cid)?.name || 'Room';
    return count > 1 ? `${count}x ${name}` : name;
  });

  combinations.push(
    buildCombination(
      'best_value',
      'Best Value Match',
      'bg-emerald-100 text-emerald-800 border-emerald-300',
      bestValueTitleParts.join(' + '),
      'Most cost-effective allocation matching all guest counts',
      `Perfect configuration for ${numRoomsNeeded} room${numRoomsNeeded > 1 ? 's' : ''} offering optimal comfort at the lowest verified rate.`,
      bestValue.assignment,
      numRoomsNeeded === 1 || bestValue.suiteCount > 0
    )
  );

  // 2. COMFORT & FAMILY SUITE UPGRADE (Recommended)
  // Look for an assignment that allocates at least one Premium Mountain View Suite (room-cat-3)
  // to the room with the highest occupant count or children, if not identical to Best Value
  const comfortCandidates = scoredAssignments.filter((s) => {
    const key = s.assignment.join('|');
    return !usedKeys.has(key) && s.suiteCount > 0;
  });

  if (comfortCandidates.length > 0) {
    const bestComfort = comfortCandidates[0];
    const comfortKey = bestComfort.assignment.join('|');
    usedKeys.add(comfortKey);

    const cCounts: Record<string, number> = {};
    bestComfort.assignment.forEach((cid) => {
      cCounts[cid] = (cCounts[cid] || 0) + 1;
    });
    const comfortTitleParts = Object.entries(cCounts).map(([cid, count]) => {
      const name = roomMap.get(cid)?.room_type || roomMap.get(cid)?.name || 'Room';
      return count > 1 ? `${count}x ${name}` : name;
    });

    combinations.push(
      buildCombination(
        'comfort_upgrade',
        'Recommended • Suite Upgrade',
        'bg-primary-100 text-primary-800 border-primary-300',
        comfortTitleParts.join(' + '),
        'Features 520 sq.ft Premium Suite with cozy fireplace & observation balcony',
        'Gives your group extra spacious living areas, private wood heater, and top-tier mountain vistas.',
        bestComfort.assignment,
        true
      )
    );
  }

  // 3. ALL-SUITE / LUXURY EXPERIENCE (If multiple suites are available)
  const luxuryCandidates = scoredAssignments.filter((s) => {
    const key = s.assignment.join('|');
    return !usedKeys.has(key) && s.suiteCount >= 2;
  });

  if (luxuryCandidates.length > 0) {
    // Pick the one with the most suites
    luxuryCandidates.sort((a, b) => b.suiteCount - a.suiteCount || a.cost - b.cost);
    const bestLuxury = luxuryCandidates[0];
    const luxuryKey = bestLuxury.assignment.join('|');
    usedKeys.add(luxuryKey);

    const lCounts: Record<string, number> = {};
    bestLuxury.assignment.forEach((cid) => {
      lCounts[cid] = (lCounts[cid] || 0) + 1;
    });
    const luxuryTitleParts = Object.entries(lCounts).map(([cid, count]) => {
      const name = roomMap.get(cid)?.room_type || roomMap.get(cid)?.name || 'Room';
      return count > 1 ? `${count}x ${name}` : name;
    });

    combinations.push(
      buildCombination(
        'luxury_suites',
        'Ultimate Himalayan Luxury',
        'bg-amber-100 text-amber-900 border-amber-300',
        luxuryTitleParts.join(' + '),
        'Multiple observation suites with private fireplaces & daybeds',
        'The ultimate Himalayan retreat experience with maximum square footage and panoramic summit decks.',
        bestLuxury.assignment,
        false
      )
    );
  }

  // If single room search and second category fits, include it as alternative option
  if (numRoomsNeeded === 1 && combinations.length < 2 && scoredAssignments.length > 1) {
    const alternative = scoredAssignments[1];
    const altKey = alternative.assignment.join('|');
    if (!usedKeys.has(altKey)) {
      usedKeys.add(altKey);
      const roomCat = roomMap.get(alternative.assignment[0])!;
      combinations.push(
        buildCombination(
          'comfort_upgrade',
          'Alternative Option',
          'bg-gray-100 text-gray-800 border-gray-300',
          roomCat.name,
          roomCat.tagline || 'Alternate boutique accommodation',
          'A wonderful alternative category matching your dates and guest capacity.',
          alternative.assignment,
          false
        )
      );
    }
  }

  return combinations;
}
