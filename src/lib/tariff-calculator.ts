import { RoomSeasonalTariffs, SeasonalDateRange, MealPlan } from '@/types/crm';
import { Room } from '@/types';
import { RoomConfig } from '@/components/RoomGuestSelector';
import { INITIAL_ROOM_SEASONAL_TARIFFS, INITIAL_SEASONAL_DATE_RANGES } from '@/lib/crm-data';

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

/**
 * Mapping between physical room IDs and category IDs
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
 * Normalizes any room ID (physical or category) to canonical category ID
 */
export function normalizeCategoryId(roomId: string): string {
  if (!roomId) return 'room-cat-1';
  return PHYSICAL_TO_CATEGORY_MAP[roomId] || roomId;
}

/**
 * Canonical dynamic tariff calculator matching the CRM backend to the exact rupee
 */
export function calculateDynamicTariff(params: {
  roomId: string;
  checkIn: string;
  checkOut: string;
  mealPlan?: MealPlan;
  adultsCount?: number;
  childrenCount?: number;
  tariffsMap?: Record<string, RoomSeasonalTariffs>;
  seasonalDateRanges?: SeasonalDateRange[];
}): DynamicTariffResult {
  const {
    roomId,
    checkIn,
    checkOut,
    mealPlan = 'CP',
    adultsCount = 2,
    childrenCount = 0,
    tariffsMap = {},
    seasonalDateRanges = INITIAL_SEASONAL_DATE_RANGES,
  } = params;

  const catKey = normalizeCategoryId(roomId);
  const tariffs =
    tariffsMap[roomId] ||
    tariffsMap[catKey] ||
    INITIAL_ROOM_SEASONAL_TARIFFS[roomId] ||
    INITIAL_ROOM_SEASONAL_TARIFFS[catKey] || {
      regular: { EP: 4500, CP: 5200, MAP: 6200, AP: 7200 },
      season: { EP: 5800, CP: 6600, MAP: 7800, AP: 8900 },
      offSeason: { EP: 3800, CP: 4300, MAP: 5100, AP: 5900 },
      weekendSurchargePercent: 10,
      extraAdultRate: 1200,
      extraChildRate: 600,
    };

  const start = new Date(checkIn + (checkIn.includes('T') ? '' : 'T00:00:00'));
  const end = new Date(checkOut + (checkOut.includes('T') ? '' : 'T00:00:00'));
  const diffTime = end.getTime() - start.getTime();
  const nights = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));

  let baseRoomAmount = 0;
  const breakdown: TariffBreakdownItem[] = [];

  const curr = new Date(start);
  for (let i = 0; i < nights; i++) {
    const dateStr = curr.toISOString().split('T')[0];
    const dayOfWeek = curr.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

    let seasonType: 'season' | 'off_season' | 'regular' = 'regular';
    let matchedSeasonName = 'Regular Tariff';

    for (const range of seasonalDateRanges) {
      if (dateStr >= range.startDate && dateStr <= range.endDate) {
        seasonType = range.seasonType;
        matchedSeasonName = range.name;
        break;
      }
    }

    let baseNightlyRate = tariffs.regular[mealPlan] || tariffs.regular.CP;
    if (seasonType === 'season') {
      baseNightlyRate = tariffs.season[mealPlan] || tariffs.season.CP;
    } else if (seasonType === 'off_season') {
      baseNightlyRate = tariffs.offSeason[mealPlan] || tariffs.offSeason.CP;
    }

    // Weekend surcharge applied on regular season Friday and Saturday nights
    if (isWeekend && tariffs.weekendSurchargePercent && seasonType === 'regular') {
      baseNightlyRate = Math.round(baseNightlyRate * (1 + tariffs.weekendSurchargePercent / 100));
      matchedSeasonName += ' (Weekend)';
    }

    baseRoomAmount += baseNightlyRate;
    breakdown.push({
      date: dateStr,
      rateName: `${matchedSeasonName} (${mealPlan})`,
      seasonType,
      amount: baseNightlyRate,
    });

    curr.setDate(curr.getDate() + 1);
  }

  const extraAdultsCount = Math.max(0, adultsCount - 2);
  const extraChildrenCount = Math.max(0, childrenCount);
  const extraAdultRate = tariffs.extraAdultRate ?? 1200;
  const extraChildRate = tariffs.extraChildRate ?? 600;
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
    nights,
    avgRatePerNight,
    mealPlan,
    breakdown,
  };
}

/**
 * Calculates live category availability across the 7 physical rooms given bookings
 */
export function calculateCategoryAvailability(params: {
  checkIn: string;
  checkOut: string;
  bookings: any[];
  rooms: Room[];
}): Record<string, { availableCount: number; totalCapacity: number; bookedCount: number }> {
  const { checkIn, checkOut, bookings = [], rooms = [] } = params;

  // Active bookings overlapping date range
  const activeBookings = bookings.filter((b) => {
    if (!b || b.status === 'cancelled') return false;
    return b.check_in < checkOut && b.check_out > checkIn;
  });

  const result: Record<string, { availableCount: number; totalCapacity: number; bookedCount: number }> = {};

  rooms.forEach((room) => {
    const totalCapacity = room.total_inventory || CATEGORY_CAPACITIES[room.id]?.totalInventory || 1;

    // Count bookings matching this category or any of its physical rooms
    const bookedCount = activeBookings.filter((b) => {
      const bRoomId = b.room_id || '';
      const bRoomName = (b.room_name || '').toLowerCase();

      // Direct category ID match
      if (bRoomId === room.id) return true;

      // Physical room ID match
      if (PHYSICAL_TO_CATEGORY_MAP[bRoomId] === room.id) return true;

      // Name heuristics
      if (room.id === 'room-cat-1') {
        return (
          bRoomName.includes('mountain view with balcony') ||
          bRoomName.includes('room 101') ||
          bRoomName.includes('room 102') ||
          bRoomName.includes('room 103')
        );
      }
      if (room.id === 'room-cat-2') {
        return (
          bRoomName.includes('forest view') ||
          bRoomName.includes('room 104')
        );
      }
      if (room.id === 'room-cat-3') {
        return (
          bRoomName.includes('suite') ||
          bRoomName.includes('room 201') ||
          bRoomName.includes('room 202') ||
          bRoomName.includes('room 203')
        );
      }

      return false;
    }).length;

    const availableCount = Math.max(0, totalCapacity - bookedCount);
    result[room.id] = { availableCount, totalCapacity, bookedCount };
  });

  return result;
}

/**
 * Checks if a specific room category can physically accommodate the guests
 */
export function canCategoryFit(categoryId: string, adults: number, children: number): boolean {
  const cap = CATEGORY_CAPACITIES[categoryId] || { maxAdults: 3, maxChildren: 2 };
  return adults <= cap.maxAdults && children <= cap.maxChildren;
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
  tariffsMap?: Record<string, RoomSeasonalTariffs>;
  seasonalDateRanges?: SeasonalDateRange[];
}): SuggestedCombination[] {
  const {
    roomsConfig,
    checkIn,
    checkOut,
    mealPlan = 'CP',
    availableCategories,
    rooms,
    tariffsMap = {},
    seasonalDateRanges = INITIAL_SEASONAL_DATE_RANGES,
  } = params;

  if (!roomsConfig || roomsConfig.length === 0 || !rooms || rooms.length === 0) {
    return [];
  }

  const roomMap = new Map<string, Room>(rooms.map((r) => [r.id, r]));

  // Get list of active category IDs that have inventory > 0
  const availableCatIds = Object.keys(availableCategories).filter(
    (catId) => (availableCategories[catId]?.availableCount || 0) > 0
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
      if (!canCategoryFit(catId, adults, children)) continue;

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
      });

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

  // Evaluate each valid assignment's total cost & suite count
  const scoredAssignments = validAssignments.map((assignment) => {
    let cost = 0;
    let suiteCount = 0;

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
      cost += res.totalAmount;
      if (catId === 'room-cat-3') suiteCount++;
    });

    return { assignment, cost, suiteCount };
  });

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
