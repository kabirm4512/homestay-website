import crypto from 'crypto';
import { getSql } from './db';
import { log } from './logger';
import { INITIAL_ROOMS, INITIAL_HERO_SLIDES, INITIAL_ABOUT_DATA, INITIAL_SITE_INFO, INITIAL_REVIEWS } from '@/lib/mock-data';
import {
  INITIAL_PHYSICAL_ROOMS,
  INITIAL_MENU_ITEMS,
  INITIAL_TRANSFER_ROUTES,
  INITIAL_RENTAL_VEHICLES,
  INITIAL_ROOM_SEASONAL_TARIFFS,
  INITIAL_SEASONAL_DATE_RANGES,
} from '@/lib/crm-data';
import { normalizeCategoryId } from '@/lib/tariff-calculator';
import { DEFAULT_GST_CONFIG } from '@/lib/gst';

/**
 * First-run seeding of business content (room categories, physical rooms, tariffs,
 * seasons, menu, transfers, rentals, website copy). Runs once per database; never
 * seeds demo bookings, guests, folios or inquiries.
 *
 * If you import the old JSON store with scripts/migrate-to-postgres.mjs first, the
 * imported content is kept and nothing here runs.
 */

let seeding: Promise<void> | null = null;

export function newQrToken(): string {
  return crypto.randomBytes(18).toString('base64url');
}

export function ensureSeeded(): Promise<void> {
  if (!seeding) {
    seeding = runSeed().catch((err) => {
      seeding = null; // retry on next request
      throw err;
    });
  }
  return seeding;
}

async function runSeed(): Promise<void> {
  const sql = getSql();
  let done;
  try {
    done = await sql`select 1 from pms.settings where key = 'seeded_at'`;
  } catch (err) {
    if ((err as { code?: string }).code === '42P01') {
      throw new Error('Database schema missing: run supabase/migrations/*.sql (see docs/SETUP.md).');
    }
    throw err;
  }
  if (done.length > 0) return;

  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(7311002)`;
    const again = await tx`select 1 from pms.settings where key = 'seeded_at'`;
    if (again.length > 0) return;

    const put = (key: string, value: unknown) =>
      tx`insert into pms.settings (key, value, updated_by) values (${key}, ${tx.json(value as never)}, 'seed')
         on conflict (key) do nothing`;

    // Tariffs: categories + their physical-room aliases only (no legacy keys)
    const tariffs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(INITIAL_ROOM_SEASONAL_TARIFFS)) {
      if (k.startsWith('room-cat-') || /^room-\d{3}$/.test(k)) tariffs[k] = v;
    }
    await put('room_tariffs', { tariffs });
    await put('seasonal_date_ranges', { ranges: INITIAL_SEASONAL_DATE_RANGES });
    await put('cms_hero', { slides: INITIAL_HERO_SLIDES });
    await put('cms_about', INITIAL_ABOUT_DATA);
    await put('cms_site', INITIAL_SITE_INFO);
    await put('cms_reviews', { reviews: INITIAL_REVIEWS });
    await put('booking_addon_rates', { airportTransfer: 2800, bikeRentalPerNight: 800 });
    await put('gst_config', DEFAULT_GST_CONFIG);

    let order = 0;
    for (const room of INITIAL_ROOMS) {
      await tx`insert into pms.room_categories (id, sort_order, is_active, data)
               values (${room.id}, ${order++}, ${room.is_active !== false}, ${tx.json(room as never)})
               on conflict (id) do nothing`;
    }
    for (const pr of INITIAL_PHYSICAL_ROOMS) {
      const token = newQrToken(); // never reuse the tokens shipped in client code
      const data = { ...pr, qrSecretToken: token };
      await tx`insert into pms.physical_rooms (id, room_number, category_id, qr_token, data)
               values (${pr.id}, ${pr.roomNumber}, ${normalizeCategoryId(pr.categoryId)}, ${token}, ${tx.json(data as never)})
               on conflict (id) do nothing`;
    }
    const records: [string, { id: string }[]][] = [
      ['menuItems', INITIAL_MENU_ITEMS],
      ['transferRoutes', INITIAL_TRANSFER_ROUTES],
      ['rentalVehicles', INITIAL_RENTAL_VEHICLES],
    ];
    for (const [collection, list] of records) {
      for (const item of list) {
        await tx`insert into pms.records (collection, id, data, updated_by)
                 values (${collection}, ${item.id}, ${tx.json(item as never)}, 'seed')
                 on conflict (collection, id) do nothing`;
      }
    }
    await put('seeded_at', { at: new Date().toISOString(), source: 'defaults' });
  });
  log.info('seed.completed');
}
