import { getSql } from './db';
import { log } from './logger';
import { ensureSeeded, newQrToken } from './seed';
import { persistDataUrl } from './repos/files';
import { SETTINGS, putSetting } from './repos/settings';
import { RECORD_COLLECTIONS, RecordCollection } from './repos/records';
import { normalizePhone } from '@/lib/phone';
import {
  isCalendarDate,
  nightsBetween,
  normalizeCategoryId,
  sanitizeSeasonalRanges,
  sanitizeTariffsMap,
} from '@/lib/tariff-calculator';
import { recalculateFolioTotals } from '@/lib/folio';
import type { Booking, Inquiry, Room, HeroSlide, AboutSectionData, SiteInfo, Review } from '@/types';
import type { CRMBooking, GuestFolio, PhysicalRoom, RoomSeasonalTariffs, SeasonalDateRange } from '@/types/crm';

/**
 * Moves data from the old storage into Postgres:
 *  - the server JSON store (data/homestay-store.json), via scripts/import-json-store.ts;
 *  - a staff browser's localStorage (the old CRM kept bookings, folios, orders and
 *    expenses only on the device), via the admin "Move this device's data" banner.
 *
 * Modes
 *  - 'replace' (JSON store): every record is written; existing rows with the same id are overwritten.
 *  - 'merge'   (device): records the server doesn't have are added; folios present on both are
 *               merged (charges and payments united by id); other existing rows are kept as they are.
 * Website content and tariffs are only written when `includeContent` is set.
 * Old staff accounts are never imported (they held plain-text passwords): recreate them in Staff.
 */

export interface LegacyPayload {
  rooms?: Room[];
  physicalRooms?: PhysicalRoom[];
  heroSlides?: HeroSlide[];
  aboutData?: AboutSectionData;
  siteInfo?: SiteInfo;
  reviews?: Review[];
  roomTariffs?: Record<string, RoomSeasonalTariffs>;
  seasonalDateRanges?: SeasonalDateRange[];
  inquiries?: Inquiry[];
  bookings?: Booking[];
  crmBookings?: CRMBooking[];
  folios?: GuestFolio[];
  foodOrders?: { id: string }[];
  dispatchRequests?: { id: string }[];
  housekeepingTasks?: { id: string }[];
  expenses?: { id: string }[];
  menuItems?: { id: string }[];
  transferRoutes?: { id: string }[];
  rentalVehicles?: { id: string }[];
  activityLogs?: { id: string }[];
  staffAlerts?: { id: string }[];
}

export interface ImportOptions {
  mode: 'replace' | 'merge';
  includeContent: boolean;
  includeOperations: boolean;
  actor: string;
  dryRun?: boolean;
}

export interface ImportReport {
  added: Record<string, number>;
  updated: Record<string, number>;
  kept: Record<string, number>;
  skipped: { what: string; reason: string }[];
  warnings: string[];
}

const CONTENT_RECORDS: RecordCollection[] = ['menuItems', 'transferRoutes', 'rentalVehicles'];
const OPERATION_RECORDS: RecordCollection[] = RECORD_COLLECTIONS.filter((c) => !CONTENT_RECORDS.includes(c));

function bump(map: Record<string, number>, key: string, n = 1) {
  map[key] = (map[key] || 0) + n;
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string') as T[]) : [];
}

function dateOnly(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, 10) : '';
}

function ts(v: unknown): Date {
  const d = typeof v === 'string' ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : new Date();
}

async function persistImages(images: unknown, ownerId: string, actor: string, report: ImportReport): Promise<string[]> {
  const out: string[] = [];
  for (const img of Array.isArray(images) ? images : []) {
    if (typeof img !== 'string' || !img) continue;
    try {
      const url = await persistDataUrl(img, { visibility: 'public', ownerKind: 'room', ownerId, actor });
      if (url) out.push(url);
    } catch (err) {
      report.warnings.push(`A photo for ${ownerId} could not be stored (${err instanceof Error ? err.message : 'error'}).`);
    }
  }
  return out;
}

async function persistPrivate(value: string | undefined, bookingId: string, actor: string, report: ImportReport): Promise<string | undefined> {
  try {
    return await persistDataUrl(value, { visibility: 'private', ownerKind: 'booking', ownerId: bookingId, actor });
  } catch (err) {
    report.warnings.push(`An ID document for booking ${bookingId} could not be stored (${err instanceof Error ? err.message : 'error'}).`);
    return undefined;
  }
}

/** Highest number in strings like "ORD-1042" (to continue counters after an import). */
function maxSuffix(values: unknown[], prefix: RegExp): number {
  let max = 0;
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const m = prefix.exec(v);
    if (m) max = Math.max(max, Number(m[1]) || 0);
  }
  return max;
}

export async function importLegacyData(payload: LegacyPayload, opts: ImportOptions): Promise<ImportReport> {
  const sql = getSql();
  const report: ImportReport = { added: {}, updated: {}, kept: {}, skipped: [], warnings: [] };
  const replace = opts.mode === 'replace';
  const write = !opts.dryRun;

  const exists = await sql<{ ok: boolean }[]>`select to_regclass('pms.settings') is not null as ok`;
  if (!exists[0]?.ok) throw new Error('Database schema missing: run supabase/migrations/*.sql first (see docs/SETUP.md).');

  if (opts.includeContent && replace && write) {
    // The imported content replaces the built-in defaults: don't let first-run seeding add them back.
    await sql`insert into pms.settings (key, value, updated_by)
              values ('seeded_at', ${sql.json({ at: new Date().toISOString(), source: 'legacy-import' } as never)}, ${opts.actor})
              on conflict (key) do nothing`;
  } else if (write) {
    await ensureSeeded();
  }

  // ------------------------------------------------------------ website content & tariffs
  if (opts.includeContent) {
    const tariffs = sanitizeTariffsMap(payload.roomTariffs);
    if (Object.keys(tariffs).length > 0) {
      const kept: Record<string, RoomSeasonalTariffs> = {};
      for (const [k, v] of Object.entries(tariffs)) {
        if (k.startsWith('room-cat-') || /^room-\d{3}$/.test(k) || !/^room-\d{1,2}$/.test(k)) kept[k] = v;
        else report.skipped.push({ what: `tariff ${k}`, reason: 'legacy id, not used by the pricing engine' });
      }
      if (write) await putSetting(SETTINGS.TARIFFS, { tariffs: kept }, opts.actor);
      bump(report.updated, 'tariffs', Object.keys(kept).length);
    }
    if (Array.isArray(payload.seasonalDateRanges)) {
      const ranges = sanitizeSeasonalRanges(payload.seasonalDateRanges);
      if (write) await putSetting(SETTINGS.SEASONS, { ranges }, opts.actor);
      bump(report.updated, 'seasonalDateRanges', ranges.length);
    }
    if (Array.isArray(payload.heroSlides) && payload.heroSlides.length > 0) {
      const slides: HeroSlide[] = [];
      for (const s of payload.heroSlides) {
        const [image] = write ? await persistImages([s.image], `hero-${s.id || slides.length}`, opts.actor, report) : [s.image];
        slides.push({ ...s, image: image || s.image });
      }
      if (write) await putSetting(SETTINGS.CMS_HERO, { slides }, opts.actor);
      bump(report.updated, 'heroSlides', slides.length);
    }
    if (payload.aboutData && typeof payload.aboutData === 'object') {
      if (write) await putSetting(SETTINGS.CMS_ABOUT, payload.aboutData, opts.actor);
      bump(report.updated, 'aboutData');
    }
    if (payload.siteInfo && typeof payload.siteInfo === 'object') {
      if (write) await putSetting(SETTINGS.CMS_SITE, payload.siteInfo, opts.actor);
      bump(report.updated, 'siteInfo');
    }
    if (Array.isArray(payload.reviews) && payload.reviews.length > 0) {
      if (write) await putSetting(SETTINGS.CMS_REVIEWS, { reviews: payload.reviews }, opts.actor);
      bump(report.updated, 'reviews', payload.reviews.length);
    }

    let order = 0;
    for (const room of arr<Room>(payload.rooms)) {
      const images = write ? await persistImages(room.images, room.id, opts.actor, report) : room.images || [];
      const data = { ...room, images: images.filter((u) => !u.includes('images.unsplash.com')) };
      if (write) {
        const res = await sql<{ inserted: boolean }[]>`
          insert into pms.room_categories (id, sort_order, is_active, data, updated_at)
          values (${room.id}, ${order}, ${room.is_active !== false}, ${sql.json(data as never)}, now())
          on conflict (id) do update set is_active = excluded.is_active, data = excluded.data, updated_at = now()
          returning (xmax = 0) as inserted`;
        bump(res[0]?.inserted ? report.added : report.updated, 'roomCategories');
      } else bump(report.added, 'roomCategories');
      order += 1;
    }

    for (const pr of arr<PhysicalRoom>(payload.physicalRooms)) {
      if (typeof pr.roomNumber !== 'number') {
        report.skipped.push({ what: `room ${pr.id}`, reason: 'no room number' });
        continue;
      }
      const existing = await sql<{ qr_token: string }[]>`select qr_token from pms.physical_rooms where id = ${pr.id}`;
      if (existing[0] && !replace) {
        bump(report.kept, 'physicalRooms'); // live room status on the server is newer than a device copy
        continue;
      }
      // Old tokens were shipped in the website's code, so they are never reused.
      const token = existing[0]?.qr_token || newQrToken();
      const data = { ...pr, qrSecretToken: token };
      if (write) {
        await sql`
          insert into pms.physical_rooms (id, room_number, category_id, qr_token, data, updated_at)
          values (${pr.id}, ${pr.roomNumber}, ${normalizeCategoryId(pr.categoryId)}, ${token}, ${sql.json(data as never)}, now())
          on conflict (id) do update set room_number = excluded.room_number, category_id = excluded.category_id,
            data = excluded.data, updated_at = now()`;
      }
      bump(existing[0] ? report.updated : report.added, 'physicalRooms');
    }

    for (const collection of CONTENT_RECORDS) {
      await importRecords(collection, arr<{ id: string }>((payload as Record<string, unknown>)[collection]), replace, opts, report);
    }
  }

  if (!opts.includeOperations) return finish(report, opts, sql);

  // ------------------------------------------------------------ website booking requests
  // The old server copied front-desk bookings into the website list under the same id;
  // those copies are not separate requests (they would double-count the room).
  const crmIds = new Set(arr<CRMBooking>(payload.crmBookings).map((b) => b.id));
  for (const b of arr<Booking>(payload.bookings)) {
    if (crmIds.has(b.id)) {
      report.skipped.push({ what: `website copy of front-desk booking ${b.booking_reference || b.id}`, reason: 'imported once, as the front-desk booking' });
      continue;
    }
    const checkIn = dateOnly(b.check_in);
    const checkOut = dateOnly(b.check_out);
    if (!isCalendarDate(checkIn) || !isCalendarDate(checkOut) || (nightsBetween(checkIn, checkOut) ?? 0) < 1) {
      report.skipped.push({ what: `website booking ${b.booking_reference || b.id}`, reason: 'invalid dates' });
      continue;
    }
    const found = await sql<{ id: string; kind: string }[]>`select id, kind from pms.bookings where id = ${b.id}`;
    if (found[0] && (!replace || found[0].kind !== 'web')) {
      bump(report.kept, 'bookings');
      continue;
    }
    let reference = (b.booking_reference || '').trim() || `IMPORT-${b.id}`;
    const clash = await sql`select 1 from pms.bookings where upper(reference) = ${reference.toUpperCase()} and id <> ${b.id}`;
    if (clash.length > 0) {
      report.warnings.push(`Website booking ${reference} shares its reference with another booking; imported as ${reference}-W.`);
      reference = `${reference}-W`;
    }
    const categories = Array.isArray(b.rooms_config) && b.rooms_config.length > 0
      ? b.rooms_config.map((r) => normalizeCategoryId(r.room_id))
      : String(b.room_id || '').split(',').map((s) => s.trim()).filter(Boolean).map(normalizeCategoryId);
    const created = ts(b.created_at);
    const hold = b.status === 'pending' ? new Date(created.getTime() + Number(process.env.BOOKING_HOLD_HOURS || 24) * 3600_000) : null;
    const data = { ...b, booking_reference: reference };
    if (write) {
      await sql`
        insert into pms.bookings (id, kind, reference, status, check_in, check_out, category_ids, guest_phone, hold_expires_at, data, created_at)
        values (${b.id}, 'web', ${reference}, ${b.status || 'pending'}, ${checkIn}, ${checkOut}, ${categories},
                ${normalizePhone(b.phone)}, ${hold}, ${sql.json(data as never)}, ${created})
        on conflict (id) do update set reference = excluded.reference, status = excluded.status, check_in = excluded.check_in,
          check_out = excluded.check_out, category_ids = excluded.category_ids, guest_phone = excluded.guest_phone,
          hold_expires_at = excluded.hold_expires_at, data = excluded.data, updated_at = now()`;
    }
    bump(found[0] ? report.updated : report.added, 'bookings');
  }

  // ------------------------------------------------------------ front-desk bookings
  for (const b of arr<CRMBooking>(payload.crmBookings)) {
    const checkIn = dateOnly(b.checkInDate);
    const checkOut = dateOnly(b.checkOutDate);
    if (!isCalendarDate(checkIn) || !isCalendarDate(checkOut) || (nightsBetween(checkIn, checkOut) ?? 0) < 1) {
      report.skipped.push({ what: `front-desk booking ${b.bookingReference || b.id}`, reason: 'invalid dates' });
      continue;
    }
    const found = await sql<{ id: string; kind: string }[]>`select id, kind from pms.bookings where id = ${b.id}`;
    if (found[0] && (!replace || found[0].kind !== 'crm')) {
      bump(report.kept, 'crmBookings');
      continue;
    }
    let reference = (b.bookingReference || '').trim() || `IMPORT-${b.id}`;
    const clash = await sql`select 1 from pms.bookings where upper(reference) = ${reference.toUpperCase()} and id <> ${b.id}`;
    if (clash.length > 0) {
      report.warnings.push(`Front-desk booking ${reference} shares its reference with another booking; imported as ${reference}-F.`);
      reference = `${reference}-F`;
    }
    const status = b.bookingStatus || 'confirmed';
    if (b.roomId && !['cancelled', 'checked_out'].includes(status)) {
      const overlap = await sql<{ reference: string }[]>`
        select reference from pms.bookings
        where kind = 'crm' and physical_room_id = ${b.roomId} and id <> ${b.id}
          and status not in ('cancelled', 'checked_out') and check_in < ${checkOut} and check_out > ${checkIn}
        limit 1`;
      if (overlap[0]) report.warnings.push(`Room ${b.roomNumber}: ${reference} overlaps ${overlap[0].reference}. Both were imported; please fix one on the tape chart.`);
    }
    const guest = b.guest
      ? {
          ...b.guest,
          idDocumentUrl: write ? await persistPrivate(b.guest.idDocumentUrl, b.id, opts.actor, report) : b.guest.idDocumentUrl,
          idDocumentBackUrl: write ? await persistPrivate(b.guest.idDocumentBackUrl, b.id, opts.actor, report) : b.guest.idDocumentBackUrl,
        }
      : b.guest;
    const physical = b.roomId ? await sql<{ category_id: string }[]>`select category_id from pms.physical_rooms where id = ${b.roomId}` : [];
    const categoryId = physical[0]?.category_id || normalizeCategoryId(b.roomId || '');
    const data: CRMBooking = { ...b, guest, bookingReference: reference, bookingStatus: status, checkInDate: checkIn, checkOutDate: checkOut };
    if (write) {
      await sql`
        insert into pms.bookings (id, kind, reference, status, check_in, check_out, category_ids, physical_room_id,
                                  linked_booking_id, guest_phone, data, created_at)
        values (${b.id}, 'crm', ${reference}, ${status}, ${checkIn}, ${checkOut}, ${categoryId ? [categoryId] : []},
                ${b.roomId || null}, ${b.sourceBookingId || null}, ${normalizePhone(guest?.phone)}, ${sql.json(data as never)},
                ${ts(b.checkedInAt || b.checkInDate)})
        on conflict (id) do update set reference = excluded.reference, status = excluded.status, check_in = excluded.check_in,
          check_out = excluded.check_out, category_ids = excluded.category_ids, physical_room_id = excluded.physical_room_id,
          linked_booking_id = excluded.linked_booking_id, guest_phone = excluded.guest_phone, data = excluded.data, updated_at = now()`;
    }
    bump(found[0] ? report.updated : report.added, 'crmBookings');
  }

  // ------------------------------------------------------------ inquiries
  for (const inq of arr<Inquiry>(payload.inquiries)) {
    const found = await sql`select 1 from pms.inquiries where id = ${inq.id}`;
    if (found.length > 0 && !replace) {
      bump(report.kept, 'inquiries');
      continue;
    }
    if (write) {
      await sql`
        insert into pms.inquiries (id, status, data, created_at)
        values (${inq.id}, ${inq.status || 'pending'}, ${sql.json(inq as never)}, ${ts(inq.created_at)})
        on conflict (id) do update set status = excluded.status, data = excluded.data, updated_at = now()`;
    }
    bump(found.length > 0 ? report.updated : report.added, 'inquiries');
  }

  // ------------------------------------------------------------ folios, orders, expenses, ...
  for (const collection of OPERATION_RECORDS) {
    await importRecords(collection, arr<{ id: string }>((payload as Record<string, unknown>)[collection]), replace, opts, report);
  }

  // Continue numbering after the imported records
  if (write) {
    const all = await sql<{ collection: string; data: Record<string, unknown> }[]>`
      select collection, data from pms.records where collection in ('folios', 'foodOrders', 'dispatchRequests')`;
    const counters: [string, number][] = [
      ['folio', maxSuffix(all.filter((r) => r.collection === 'folios').map((r) => r.data.folioNumber), /-(\d{4,})$/)],
      ['order', maxSuffix(all.filter((r) => r.collection === 'foodOrders').map((r) => r.data.orderNumber), /^ORD-(\d+)$/)],
      ['celebration', maxSuffix(all.filter((r) => r.collection === 'foodOrders').map((r) => r.data.orderNumber), /^CEL-(\d+)$/)],
      ['transport', maxSuffix(all.filter((r) => r.collection === 'dispatchRequests').map((r) => r.data.requestNumber), /^DSP-(\d+)$/)],
    ];
    for (const [name, max] of counters) {
      if (max > 0) {
        await sql`insert into pms.counters as c (name, value) values (${name}, ${max})
                  on conflict (name) do update set value = greatest(c.value, ${max})`;
      }
    }
  }

  return finish(report, opts, sql);
}

async function importRecords(
  collection: RecordCollection,
  list: { id: string }[],
  replace: boolean,
  opts: ImportOptions,
  report: ImportReport
): Promise<void> {
  const sql = getSql();
  for (const rec of list) {
    const found = await sql<{ data: Record<string, unknown> }[]>`select data from pms.records where collection = ${collection} and id = ${rec.id}`;
    let data: Record<string, unknown> = rec as unknown as Record<string, unknown>;
    if (found[0] && !replace) {
      if (collection !== 'folios') {
        bump(report.kept, collection);
        continue;
      }
      // Folio on both sides: unite charges and payments by id, then recompute totals.
      const server = found[0].data as unknown as GuestFolio;
      const device = rec as unknown as GuestFolio;
      const byId = <T extends { id: string }>(a: T[] = [], b: T[] = []) => {
        const m = new Map<string, T>();
        a.forEach((x) => m.set(x.id, x));
        b.forEach((x) => (m.has(x.id) ? undefined : m.set(x.id, x)));
        return Array.from(m.values());
      };
      const charges = byId(server.charges, device.charges);
      const payments = byId(server.payments, device.payments);
      if (charges.length === (server.charges || []).length && payments.length === (server.payments || []).length) {
        bump(report.kept, collection);
        continue;
      }
      data = recalculateFolioTotals(server, charges, payments) as unknown as Record<string, unknown>;
    }
    if (!opts.dryRun) {
      const created = ts(data.createdAt || data.timestamp || data.postedAt);
      await sql`
        insert into pms.records (collection, id, data, created_at, updated_by)
        values (${collection}, ${rec.id}, ${sql.json(data as never)}, ${created}, ${opts.actor})
        on conflict (collection, id) do update set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by`;
    }
    bump(found[0] ? report.updated : report.added, collection);
  }
}

async function finish(report: ImportReport, opts: ImportOptions, sql: ReturnType<typeof getSql>): Promise<ImportReport> {
  if (!opts.dryRun) {
    await sql`insert into pms.settings (key, value, updated_by)
              values ('last_legacy_import', ${sql.json({ at: new Date().toISOString(), mode: opts.mode, report } as never)}, ${opts.actor})
              on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by`;
  }
  log.info('legacy_import.done', { actor: opts.actor, mode: opts.mode, dryRun: Boolean(opts.dryRun), added: report.added, updated: report.updated });
  return report;
}
