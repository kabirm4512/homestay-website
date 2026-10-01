import type { RentalVehicle, SeasonalDateRange, TransferRoute } from '@/types/crm';
import { addCalendarDays, isCalendarDate, nightsBetween, resolveSeasonForNight, todayInIST } from './tariff-calculator';

/**
 * Transfer & rental pricing shared by the website, the in-room concierge, the CRM and
 * the server (which re-prices every guest transport request). Seasons come from the
 * same live seasonal calendar as room tariffs.
 */

export type VehicleTier = 'wagonr' | 'sedan' | 'suv';

export function seasonForDate(dateStr: string, ranges: SeasonalDateRange[]) {
  const d = (dateStr || '').slice(0, 10);
  const r = resolveSeasonForNight(isCalendarDate(d) ? d : todayInIST(), ranges || []);
  return { seasonType: r.seasonType, seasonName: r.seasonType === 'regular' ? 'Regular Season' : r.name };
}

export function transferRate(route: TransferRoute, dateStr: string, tier: VehicleTier, ranges: SeasonalDateRange[]) {
  const key = tier === 'wagonr' ? 'priceWagonR' : tier === 'suv' ? 'priceSUV' : 'priceSedan';
  const baseRate = route[key];
  const { seasonType, seasonName } = seasonForDate(dateStr, ranges);
  let rate = baseRate;
  let isSurgeApplied = false;
  if (seasonType === 'season') {
    const o = route.seasonalTariffs?.season?.[key];
    rate = typeof o === 'number' ? o : Math.round(baseRate * 1.2);
    isSurgeApplied = true;
  } else if (seasonType === 'off_season') {
    const o = route.seasonalTariffs?.offSeason?.[key];
    rate = typeof o === 'number' ? o : Math.round(baseRate * 0.85);
  }
  return { rate, baseRate, seasonType, seasonName, isSurgeApplied };
}

export function rentalRate(vehicle: RentalVehicle, startDateStr: string, endDateStr: string | undefined, ranges: SeasonalDateRange[]) {
  const start = isCalendarDate((startDateStr || '').slice(0, 10)) ? startDateStr.slice(0, 10) : todayInIST();
  let days = 1;
  if (endDateStr && isCalendarDate(endDateStr.slice(0, 10))) {
    days = Math.max(1, nightsBetween(start, endDateStr.slice(0, 10)) ?? 1);
  }
  let totalRate = 0;
  const breakdown: { date: string; rate: number; seasonType: 'season' | 'off_season' | 'regular'; seasonName: string }[] = [];
  for (let i = 0; i < days; i++) {
    const date = addCalendarDays(start, i);
    const { seasonType, seasonName } = seasonForDate(date, ranges);
    let dayRate = vehicle.ratePerDay;
    if (seasonType === 'season') {
      dayRate = typeof vehicle.seasonalTariffs?.seasonRatePerDay === 'number' ? vehicle.seasonalTariffs.seasonRatePerDay : Math.round(vehicle.ratePerDay * 1.2);
    } else if (seasonType === 'off_season') {
      dayRate = typeof vehicle.seasonalTariffs?.offSeasonRatePerDay === 'number' ? vehicle.seasonalTariffs.offSeasonRatePerDay : Math.round(vehicle.ratePerDay * 0.85);
    }
    totalRate += dayRate;
    breakdown.push({ date, rate: dayRate, seasonType, seasonName });
  }
  return { totalRate, days, dailyAvgRate: Math.round(totalRate / days), breakdown };
}
