import { getSql, SqlOrTx } from '../db';
import type { RoomSeasonalTariffs, SeasonalDateRange } from '@/types/crm';
import type { HeroSlide, AboutSectionData, SiteInfo, Review } from '@/types';
import {
  getCategoryAliases,
  isValidRoomTariffs,
  isValidSeasonalRange,
  sanitizeSeasonalRanges,
  sanitizeTariffsMap,
} from '@/lib/tariff-calculator';
import { GstConfig, sanitizeGstConfig } from '@/lib/gst';
import { HttpError } from '../http';
import { ensureSeeded } from '../seed';

export const SETTINGS = {
  TARIFFS: 'room_tariffs',
  SEASONS: 'seasonal_date_ranges',
  CMS_HERO: 'cms_hero',
  CMS_ABOUT: 'cms_about',
  CMS_SITE: 'cms_site',
  CMS_REVIEWS: 'cms_reviews',
  ADDON_RATES: 'booking_addon_rates',
  GST: 'gst_config',
} as const;

export async function getSetting<T>(key: string, db?: SqlOrTx): Promise<T | null> {
  await ensureSeeded();
  const sql = db || getSql();
  const rows = await sql<{ value: T }[]>`select value from pms.settings where key = ${key}`;
  return rows[0]?.value ?? null;
}

export async function putSetting(key: string, value: unknown, actor: string, db?: SqlOrTx): Promise<void> {
  const sql = db || getSql();
  await sql`
    insert into pms.settings (key, value, updated_at, updated_by)
    values (${key}, ${sql.json(value as never)}, now(), ${actor})
    on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by`;
}

// ---------------------------------------------------------------- tariffs
export interface TariffData {
  tariffs: Record<string, RoomSeasonalTariffs>;
  seasonalDateRanges: SeasonalDateRange[];
}

export async function getTariffData(db?: SqlOrTx): Promise<TariffData> {
  await ensureSeeded();
  const sql = db || getSql();
  const rows = await sql<{ key: string; value: unknown }[]>`
    select key, value from pms.settings where key in (${SETTINGS.TARIFFS}, ${SETTINGS.SEASONS})`;
  const t = rows.find((r) => r.key === SETTINGS.TARIFFS)?.value as { tariffs: unknown } | undefined;
  const s = rows.find((r) => r.key === SETTINGS.SEASONS)?.value as { ranges: unknown } | undefined;
  return {
    tariffs: sanitizeTariffsMap(t?.tariffs),
    seasonalDateRanges: sanitizeSeasonalRanges(s?.ranges),
  };
}

/** Saves one category's tariffs (canonical category key + physical-room aliases). */
export async function saveRoomTariff(roomId: string, tariffs: RoomSeasonalTariffs, actor: string, db?: SqlOrTx): Promise<{ before: RoomSeasonalTariffs | null }> {
  if (!isValidRoomTariffs(tariffs)) {
    throw new HttpError(400, 'Tariffs must include non-negative EP/CP/MAP/AP rates for regular, season and off-season.');
  }
  const current = await getTariffData(db);
  const next = { ...current.tariffs };
  const before = current.tariffs[roomId] || null;
  for (const k of Array.from(new Set([roomId, ...getCategoryAliases(roomId)]))) next[k] = tariffs;
  await putSetting(SETTINGS.TARIFFS, { tariffs: next }, actor, db);
  return { before };
}

export async function saveSeasonalRanges(ranges: SeasonalDateRange[], actor: string, db?: SqlOrTx): Promise<void> {
  if (!Array.isArray(ranges) || ranges.some((r) => !isValidSeasonalRange(r))) {
    throw new HttpError(400, 'Every seasonal range needs an id, a name, a type and valid dates with start on or before end.');
  }
  await putSetting(SETTINGS.SEASONS, { ranges }, actor, db);
}

export async function upsertSeasonalRange(range: SeasonalDateRange, actor: string, db?: SqlOrTx): Promise<SeasonalDateRange | null> {
  if (!isValidSeasonalRange(range)) {
    throw new HttpError(400, 'A seasonal range needs an id, a name, a type and valid dates with start on or before end.');
  }
  const current = await getTariffData(db);
  const before = current.seasonalDateRanges.find((r) => r.id === range.id) || null;
  const next = before
    ? current.seasonalDateRanges.map((r) => (r.id === range.id ? range : r))
    : [...current.seasonalDateRanges, range];
  await putSetting(SETTINGS.SEASONS, { ranges: next }, actor, db);
  return before;
}

export async function deleteSeasonalRange(id: string, actor: string, db?: SqlOrTx): Promise<SeasonalDateRange | null> {
  const current = await getTariffData(db);
  const before = current.seasonalDateRanges.find((r) => r.id === id) || null;
  await putSetting(SETTINGS.SEASONS, { ranges: current.seasonalDateRanges.filter((r) => r.id !== id) }, actor, db);
  return before;
}

// ---------------------------------------------------------------- GST & add-ons
export async function getGstConfig(db?: SqlOrTx): Promise<GstConfig> {
  return sanitizeGstConfig(await getSetting(SETTINGS.GST, db));
}

export interface AddonRates {
  airportTransfer: number;
  bikeRentalPerNight: number;
}

export const DEFAULT_ADDON_RATES: AddonRates = { airportTransfer: 2800, bikeRentalPerNight: 800 };

export async function getAddonRates(db?: SqlOrTx): Promise<AddonRates> {
  const v = await getSetting<Partial<AddonRates>>(SETTINGS.ADDON_RATES, db);
  const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : d);
  return {
    airportTransfer: num(v?.airportTransfer, DEFAULT_ADDON_RATES.airportTransfer),
    bikeRentalPerNight: num(v?.bikeRentalPerNight, DEFAULT_ADDON_RATES.bikeRentalPerNight),
  };
}

// ---------------------------------------------------------------- CMS
export interface CmsContent {
  heroSlides: HeroSlide[];
  aboutData: AboutSectionData;
  siteInfo: SiteInfo;
  reviews: Review[];
}

export async function getCmsContent(): Promise<CmsContent> {
  const [hero, about, site, reviews] = await Promise.all([
    getSetting<{ slides: HeroSlide[] }>(SETTINGS.CMS_HERO),
    getSetting<AboutSectionData>(SETTINGS.CMS_ABOUT),
    getSetting<SiteInfo>(SETTINGS.CMS_SITE),
    getSetting<{ reviews: Review[] }>(SETTINGS.CMS_REVIEWS),
  ]);
  return {
    heroSlides: hero?.slides || [],
    aboutData: about as AboutSectionData,
    siteInfo: site as SiteInfo,
    reviews: reviews?.reviews || [],
  };
}
