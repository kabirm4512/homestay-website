import { z } from 'zod';
import { handler, ok, readJson, HttpError, clientIp } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { sanitizeGstConfig } from '@/lib/gst';
import {
  getTariffData,
  getGstConfig,
  getAddonRates,
  putSetting,
  SETTINGS,
  saveRoomTariff,
  saveSeasonalRanges,
  upsertSeasonalRange,
  deleteSeasonalRange,
} from '@/lib/server/repos/settings';
import { audit } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function payload() {
  const [t, gstConfig, addonRates] = await Promise.all([getTariffData(), getGstConfig(), getAddonRates()]);
  return { data: { tariffs: t.tariffs, seasonalDateRanges: t.seasonalDateRanges, gstConfig, addonRates } };
}

/** Public: live tariffs, seasonal calendar, GST rules and add-on rates (every price is computed from these). */
export const GET = handler('tariffs.get', async () => ok(await payload()));

const Price = z.number().positive('Every room price must be above ₹0').max(10_000_000);
const Rates = z.object({ EP: Price, CP: Price, MAP: Price, AP: Price });
const Tariffs = z.object({
  regular: Rates,
  season: Rates,
  offSeason: Rates,
  weekendSurchargePercent: z.number().min(0).max(200).optional(),
  extraAdultRate: z.number().min(0).optional(),
  extraChildRate: z.number().min(0).optional(),
  baseAdults: z.number().int().min(1).max(10).optional(),
  freeChildUnderAge: z.number().int().min(0).max(17).optional(),
});
const Range = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  seasonType: z.enum(['season', 'off_season']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500).optional(),
  minNights: z.number().int().min(1).max(30).optional(),
});
const Gst = z.object({
  tariffsIncludeGst: z.boolean(),
  accommodationThreshold: z.number().min(0).max(1_000_000),
  accommodationLowRate: z.number().min(0).max(50),
  accommodationHighRate: z.number().min(0).max(50),
  foodRate: z.number().min(0).max(50),
  transportRate: z.number().min(0).max(50),
  otherRate: z.number().min(0).max(50),
});
const Addons = z.object({ airportTransfer: z.number().min(0).max(100_000), bikeRentalPerNight: z.number().min(0).max(100_000) });
const Body = z.union([
  z.object({ type: z.literal('gst_config'), gstConfig: Gst }),
  z.object({ type: z.literal('addon_rates'), addonRates: Addons }),
  z.object({ type: z.literal('seasonal_range_upsert'), range: Range }),
  z.object({ type: z.literal('seasonal_range_delete'), id: z.string().min(1) }),
  z.object({ type: z.literal('seasonal_ranges'), ranges: z.array(Range).max(200) }),
  z.object({ roomId: z.string().min(1).max(100), tariffs: Tariffs }),
]);

/** Admin / manager: change prices or the seasonal calendar. */
export const POST = handler('tariffs.save', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.MANAGERS);
  const actor = `staff:${staff.id}`;
  const ip = clientIp(request);
  const body = await readJson(request, Body);

  if ('type' in body && body.type === 'gst_config') {
    // Tax rules affect every invoice: admin only.
    if (staff.role !== 'admin') throw new HttpError(403, 'Only an admin can change GST settings.', 'FORBIDDEN');
    const before = await getGstConfig();
    const after = sanitizeGstConfig(body.gstConfig);
    await putSetting(SETTINGS.GST, after, actor);
    await audit({ actor, action: 'update', entity: 'gst_config', before, after, ip });
    return ok({ message: 'GST settings saved', ...(await payload()) });
  }
  if ('type' in body && body.type === 'addon_rates') {
    const before = await getAddonRates();
    await putSetting(SETTINGS.ADDON_RATES, body.addonRates, actor);
    await audit({ actor, action: 'update', entity: 'addon_rates', before, after: body.addonRates, ip });
    return ok({ message: 'Add-on prices saved', ...(await payload()) });
  }

  if ('type' in body) {
    if (body.type === 'seasonal_range_upsert') {
      if (body.range.startDate > body.range.endDate) throw new HttpError(400, 'Start date must be on or before end date.');
      const before = await upsertSeasonalRange(body.range, actor);
      await audit({ actor, action: before ? 'update' : 'create', entity: 'season', entityId: body.range.id, before, after: body.range, ip });
    } else if (body.type === 'seasonal_range_delete') {
      const before = await deleteSeasonalRange(body.id, actor);
      await audit({ actor, action: 'delete', entity: 'season', entityId: body.id, before, ip });
    } else {
      await saveSeasonalRanges(body.ranges, actor);
      await audit({ actor, action: 'replace', entity: 'season', after: body.ranges, ip });
    }
    return ok({ message: 'Seasonal calendar saved', ...(await payload()) });
  }

  const { before } = await saveRoomTariff(body.roomId, body.tariffs, actor);
  await audit({ actor, action: 'update', entity: 'room_tariff', entityId: body.roomId, before, after: body.tariffs, ip });
  return ok({ message: 'Room tariffs saved', ...(await payload()) });
});
