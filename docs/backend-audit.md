# Savera Homestay backend audit

Audited October 2026 against the working tree (Next.js 14 App Router, Supabase client, JSON-file fallback store). Line numbers refer to the current files.

**Severity scale**

- **Critical:** exploitable now, or loses money or guest data.
- **High:** wrong prices, wrong availability or data loss under normal use.
- **Medium:** correctness or operability gaps.
- **Low:** hygiene.

---

## Status after the full fix pass (1 Oct 2026)

Every Critical, High, Medium and Low finding below has now been worked on. New third-party integrations (payments, WhatsApp, channel manager, Sentry) were out of scope by decision and remain on the roadmap. Setup steps for the new backend are in `docs/SETUP.md`.

**Architecture now:** Postgres (Supabase) is the only source of truth, in a private `pms` schema that the public Supabase API cannot reach (RLS on, no policies, grants revoked). The server talks to it with `DATABASE_URL`; the browser never does. Staff sign in with server sessions (httpOnly, signed cookies, scrypt password hashes, roles). Guests get their own short-lived session only after Booking ID **and** mobile number match, or by scanning their room's secret QR code. Files go to Supabase Storage (photos public, ID documents private behind an access check). Every write is validated (zod), rate-limited where public, and recorded in `pms.audit_log`.

| # | Finding | Status | What changed (main files) |
|---|---|---|---|
| C1 | Client-side staff login, password in bundle | **Fixed** | Server auth: `api/auth/*`, `lib/server/auth/*`. Default admin from env, must change password at first sign-in; admin creates other logins (`api/staff`). Old shipped passwords and `/api/admin/auth` removed. |
| C2 | Guest PII readable by anyone | **Fixed** | Public endpoints return counts or the signed-in guest's own booking only; ID numbers masked; ID documents private (`api/files/[id]`). Guest lookup needs reference + phone (exact match). |
| C3 | Open write endpoints | **Fixed** | Every write needs a staff session with the right role, or a guest session for that guest's own booking. Origin check on all API writes (`src/middleware.ts`). |
| C4 | Supabase RLS grants full access | **Fixed** (on migration) | `supabase/migrations/20261001000000_pms_core.sql` enables RLS and drops all policies on the legacy public tables; new data lives in the private `pms` schema. |
| C5 | No durable source of truth | **Fixed** | Postgres via `lib/server/db.ts` + repositories in `lib/server/repos/*`. JSON store and localStorage data are imported once (`npm run db:import-json`, and the admin "Move this device's data" banner). |
| H1 | No rate limiting / validation / generic errors | **Fixed** | `lib/server/rate-limit.ts` (Postgres-backed), zod on every route, `lib/server/http.ts` returns generic messages and logs details. |
| H2 | Guessable references, partial phone match | **Fixed** | Guest access needs reference AND full mobile (last 10 digits must match). References stay readable (SH-2K…), but are no longer enough on their own. |
| H3 | Silent Supabase write failures | **Fixed** | Single store; every save is awaited and errors are shown to staff. |
| H4 | Drifted schemas | **Fixed** | One migration; `supabase/schema.sql`, `schema_crm.sql` and `prisma/schema.prisma` removed. Website requests and front-desk bookings share `pms.bookings` (`kind` column). |
| H5 | Lost updates (whole-file / whole-array writes) | **Fixed** | Row-level writes; the CRM sends per-record changes (`api/crm/mutate`); bookings and inventory serialise on an advisory lock. |
| H6 | Availability ignores CRM bookings | **Fixed** | `getAvailability` counts website requests + front-desk bookings per night against real rooms (maintenance excluded). `api/availability` is public, counts only. |
| H7 | Matched by room name; multi-room counted as one | **Fixed** | Category ids per room booked (`category_ids` array). |
| H8 | No holds / locking / idempotency | **Fixed** | 24 h holds (`BOOKING_HOLD_HOURS`), inventory lock, `idempotency_key` from the booking form, room double-booking refused (409). |
| H9 | GST | **Fixed** | Correction to the original finding: the website said "Taxes Included" while the CRM folio added a flat 5% at check-out, so suites above ₹7,500 were under-taxed and every guest saw a different total from their bill. Now `lib/gst.ts` taxes each room-night on its own value (5% ≤ ₹7,500, 18% above; configurable, admin-only, in Website Settings → Dine-in Menu & Add-ons), add-ons at the transport rate, food at 5%. The website shows "+ GST" and the same total the server stores; folios carry per-line tax. Confirm rates with your CA. |
| H10 | CRM state in browser localStorage | **Fixed** | The CRM loads from `api/crm/state` and saves per record; all devices refresh every 8 s and on focus. Old device data is moved with the admin banner, never deleted automatically. |
| M1 | ID documents as base64 in JSON/localStorage | **Fixed** | Stored privately in Supabase Storage (or `pms.files`), compressed in the browser first; served only to admins/managers and that guest. |
| M2 | No audit trail / backups | **Fixed** (backups: setting) | `pms.audit_log` records before/after for every write, including tariffs and seasons. Turn on Supabase backups / PITR (see SETUP). |
| M3 | Money fields | **Fixed** | One rounding function (`roundMoney`, paise) used by browser and server. |
| M4 | Pending requests block forever; no cancellation flow | **Partly fixed** | Pending requests release their rooms when the hold expires; status changes follow allowed transitions and re-check availability. A cancellation/refund policy and guest self-cancel need your business rules first. |
| M5 | Hardcoded room topology | **Fixed** | Inventory comes from `pms.physical_rooms`; capacities from the room category. The legacy id map remains only to read old ids. |
| M6 | Rate model gaps | **Partly fixed** | Added per-category adults-included, free-child age (uses the ages guests enter) and minimum stay per season. Rate plans, promo codes, CTA/CTD and occupancy-based pricing remain on the roadmap. |
| M7 | Food totals from the client | **Fixed** | Orders, celebrations and transfers are priced on the server from the live menu/routes. |
| M8 | Ledger integrity | **Fixed** | Non-admins can only add payments and void charges; staff ids are stamped by the server; expenses are immutable for non-admins; new **Day close** in the Ledger locks each day's expenses. |
| M9 | Notifications | **In-app only** | Staff alerts now cover website bookings, inquiries and check-ins. WhatsApp/email to guests is a third-party integration (out of scope). |
| M10 | No tests / CI | **Fixed** | Vitest unit tests, API integration tests, pricing parity check, and a GitHub Actions workflow in `docs/github-actions-ci.yml` (copy it to `.github/workflows/ci.yml` to enable: Postgres service, lint, typecheck, build). |
| M11 | No logging / monitoring | **Fixed** (Sentry out of scope) | Structured JSON logs (`lib/server/logger.ts`), `GET /api/health`. Use Vercel Observability or an uptime check on `/api/health`. |
| L1 | Mock data in production paths | **Fixed** | No demo bookings, inquiries or staff; no seed-price fallbacks. First-run seeding adds only business content (rooms, menu, tariffs). |
| L2 | Add-on prices are constants | **Fixed** | Stored in settings, editable in Website Settings → Dine-in Menu & Add-ons. |
| L3 | Type safety / hygiene | **Improved** | Server code is split by domain (`lib/server/repos`, `auth`, `guest-services`, `crm-sync`). `CRMContext.tsx` is still large; splitting it is a follow-up. |
| L4 | Google Fonts at build time | **Fixed** | Fonts self-hosted with `next/font/local` (`src/app/fonts`, OFL). |

**Also changed:** security headers (`next.config.mjs`), cookie-based guest sessions for the portal, check-in page and in-room QR (QR codes now carry a secret token: **reprint the room QR standees** from Admin → QRs; old ones still work after the guest confirms their mobile number).

---

## 0. What was fixed in the first pass (pricing)

These items are done and are not repeated in the findings below.

| # | Problem | Fix |
|---|---|---|
| F1 | The public calculator built dates with `new Date(d + 'T00:00:00').toISOString()`. In an IST browser that priced every night one day early, so Oct 1 was priced as Sep 30. The CRM's separate copy of the calculator did not have this bug, so the website and the CRM disagreed at every season boundary. | One engine in `src/lib/tariff-calculator.ts`. It uses pure calendar-date maths, so it behaves the same in any timezone. Season ranges are inclusive at both ends, and stays are priced night by night. |
| F2 | `CRMContext` merged `{ ...server, ...prev }`, so the built-in seed prices and localStorage always beat the server. Seasonal ranges from the server were ignored whenever localStorage had any. | The CRM now loads tariffs and seasons only from `/api/tariffs`, clears the old localStorage keys, and applies whatever the server returns after each save. |
| F3 | Manual check-in (`ManualBookingModal`) always charged `tariffs.regular[plan]` × nights. Season, off-season and weekend pricing were never applied. | The default is now the live engine total. Manual override is an explicit opt-in, and editing any rate field switches it on. |
| F4 | Every component used the seed tariffs (`INITIAL_ROOM_SEASONAL_TARIFFS`) as its starting state and as a silent fallback, so guests saw stale prices whenever the fetch was slow or failed. | One shared fetch (`src/lib/live-tariffs.ts`) with no seed fallback. Missing data now shows "Loading live rates…" or "Price on request". |
| F5 | The booking API trusted the browser's `total_price`. A guest could submit ₹1. | `POST /api/bookings` re-prices every room, plus add-ons, from live tariffs. It returns 422 if the stay can't be priced. |
| F6 | `POST /api/tariffs` had no authentication, so anyone could set every price to ₹1. | It now needs an HMAC-signed httpOnly admin session cookie, issued by `POST /api/admin/auth` against `ADMIN_ACCESS_CODE`. The old `/api/admin/auth` returned `base64(passcode + time)` as its "token", which revealed the passcode; that is removed, along with the default passcode. |
| F7 | Saving tariffs was fire-and-forget. The admin always saw "saved", even when the server write failed. | Saves are awaited. Errors are shown in the admin. File writes are atomic (temp file then rename) and throw on failure. |
| F8 | Seasonal ranges were saved as a whole array built from the browser's (possibly stale) state, so a second admin device could wipe out ranges. | Seasons are now changed one at a time on the server (`seasonal_range_upsert` / `seasonal_range_delete`). |
| F9 | Deleting every seasonal range silently brought the demo ranges back (the `length > 0` check). | The seed is used only when the key has never existed. |
| F10 | Room photos were lost. (a) `getStoreData()` replaced all of a room's images with the demo images if any image was an Unsplash URL, and the admin form always added an Unsplash placeholder. (b) Full-size base64 photos made `POST /api/rooms` too large (over Vercel's 4.5 MB limit) and too large for localStorage, and the request was fire-and-forget, so the toast said "uploaded". (c) The tariff save and the active/inventory toggles re-posted the whole room from local state, overwriting newer photos. | (a) Only placeholder URLs are stripped now. (b) Photos are compressed in the browser (1600 px JPEG, about 450 KB), there's a payload guard, and saves are awaited with errors shown. (c) Toggles send partial updates, and the tariff save no longer posts the room. |
| F11 | `POST`/`DELETE /api/rooms` had no authentication, so anyone could replace room photos or delete rooms. | Same admin session as F6. |
| F12 | Pricing for physical rooms (`room-101`) and categories (`room-cat-1`) could drift apart, and a Supabase UUID room fell back to a hardcoded ₹4,500 price. | Lookup is category-first. Unknown IDs now return "price on request" instead of a made-up price. |

`npm run check:pricing` (see `scripts/check-pricing-parity.mts`) checks that the website, CRM and booking API agree to the rupee across off-season, season, boundary crossings, all four meal plans and extra-guest charges, in any timezone. It also checks that an admin save reaches the public price.

---

## 1. Security and access control

### C1. Staff login is client-side only, the admin password ships in the JavaScript bundle, and admin access is bypassable. **Critical**
- **Where:** `src/lib/crm-data.ts:1433` (`password: 'admin123'`), `src/context/CRMContext.tsx:1924` (`authenticateStaff` compares passwords in the browser), `src/app/admin/page.tsx:98` (any `wp_crm_current_user` value in localStorage grants access).
- **What's wrong:** Staff accounts and passwords live in client code and localStorage. There is no server identity at all.
- **Failure scenario:** Anyone opens DevTools and runs `localStorage.setItem('wp_crm_current_user', '{"name":"x","role":"admin"}')`, then reloads `/admin`. They now have the full CRM: guest list, ID documents, ledger and room status. The seed admin password is also readable in the shipped JS.
- **Fix:** Move staff authentication to the server. Use Supabase Auth (email + password, or magic link) with a `staff_users.role` claim, or the signed-cookie pattern from `src/lib/admin-session.ts` backed by a server-side `staff_users` table with bcrypt hashes. Gate `/admin` with `middleware.ts`. Delete the passwords from `crm-data.ts`.

```ts
// middleware.ts
export const config = { matcher: ['/admin/:path*', '/api/((?!tariffs$|rooms$|cms$|addons$).*)'] };
export function middleware(req: NextRequest) {
  if (isPublicRead(req)) return NextResponse.next();
  return verifySession(req.cookies.get('savera_staff')?.value) ? NextResponse.next() : new NextResponse('Unauthorized', { status: 401 });
}
```

### C2. Guest personal data is readable by anyone. **Critical**
- **Where:**
  - `GET /api/checkin` (no params, `src/app/api/checkin/route.ts:79`) returns every CRM booking (names, phones, ID numbers, base64 ID scans) and every room's `qrSecretToken`.
  - `GET /api/checkin?room=101` returns the active guest of any room.
  - `GET /api/bookings` (`route.ts:7`) and `GET /api/inquiries` (`route.ts:4`) return every website booking and inquiry.
- **Failure scenario:** A scraper loads `/api/checkin` once and has every guest's Aadhaar scan. That is a reportable personal-data breach under the DPDP Act 2023.
- **Why not fixed in this pass:** The admin, the KDS, the tape chart and the public availability modal all read these endpoints with no credentials. Locking them needs the server staff session from C1 first, otherwise the CRM breaks.
- **Fix:**
  1. Add server staff auth (C1) and require it on these GETs.
  2. Give the public availability check its own endpoint that returns counts only (H2).
  3. Let the guest portal look up a booking only with reference **and** phone, and return a redacted view.

### C3. Every other write endpoint is open. **Critical**
- **Where:**
  - `POST /api/cms` (`src/app/api/cms/route.ts:19`): anyone can rewrite the homepage and reviews.
  - `POST /api/addons`: menu, transfer and rental prices.
  - `POST /api/orders` with `isExpense` (`orders/route.ts:53`): anyone can add expenses to the ledger.
  - `PATCH /api/bookings`: anyone can confirm or cancel bookings.
  - `POST /api/checkin`: anyone can check rooms in or out, or bulk-overwrite bookings through `syncBookings`.
  - `PATCH /api/inquiries`.
- **Failure scenario:** A competitor marks every booking cancelled, or edits the transfer price list.
- **Fix:** Apply the same session check used for tariffs and rooms (`isAdminRequest`), or the staff session from C1, to every mutating handler. Guest-originated writes (new booking, inquiry, food order, self check-in) should stay public, with validation and rate limiting.

### C4. Supabase RLS policies grant full access to any signed-in user. **Critical (if Supabase is used)**
- **Where:** `supabase/schema.sql:114-125`, `FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')`.
- **Failure scenario:** Supabase Auth sign-ups are on by default. Anyone can sign up with the public anon key and then read or write every booking and inquiry directly through the Supabase REST API, bypassing the app entirely.
- **Fix:** Drop the `authenticated` clause. Use the service role server-side only, or role-checked policies such as `auth.jwt() ->> 'role' = 'staff'`. Disable open sign-ups.

### H1. No rate limiting, no input validation, and raw error messages
- **Where:** Every route returns `error.message` to the client (for example `inquiries/route.ts`, `orders/route.ts`, `checkin/route.ts`). There is no schema validation. `/api/admin/auth` has no brute-force protection.
- **Failure scenario:**
  - Booking and inquiry spam fill the store.
  - Internal paths and Supabase errors leak to the client.
  - The access code can be brute-forced. It's server-side and uses a constant-time compare, but it is still unthrottled.
- **Fix:**
  - Validate request bodies with `zod` in each route.
  - Return generic errors to the client and log the details.
  - Add a per-IP limiter (Upstash Ratelimit, or Vercel WAF rules) on `/api/admin/auth`, `/api/bookings`, `/api/inquiries` and `/api/orders`.

### H2. Booking references are sequential and guessable, and phone lookup matches on partial numbers
- **Where:** `src/lib/booking-id.ts:73-113` (`SH-2K2610001`, `…002` and so on); `src/lib/data-service.ts:1108` (`norm.endsWith(cleanPhoneParam)` with 6+ digits).
- **Failure scenario:** Someone walks references `SH-2K2610001…099` through the guest portal lookup and collects bookings. A 6-digit phone fragment also matches other guests.
- **Fix:**
  - Keep the human-readable reference, but require reference **and** the full phone number, or a random portal token, to open a booking.
  - Match phone numbers exactly after normalising to E.164.
  - Return the minimum guest view.

### M1. ID documents are stored as base64 inside the JSON store and in browser localStorage
- **Where:** `ManualBookingModal.tsx` (file → base64), `Guest.idDocumentUrl`.
- **Failure scenario:** The 75 KB store grows to megabytes per guest, every `GET /api/checkin` ships the ID scans, and the scans persist on shared front-desk browsers.
- **Fix:** Store them in a private Supabase Storage bucket with short-lived signed URLs, set a retention policy (for example, delete 90 days after check-out), and never put them in localStorage.

---

## 2. Data layer

### C5. There is no durable source of truth in production. **Critical**
- **Where:**
  - `src/lib/data-service.ts:70` (`getActiveStorePath`) and `:151` (`saveStoreData`).
  - `.gitignore` excludes `data/homestay-store.json`.
  - `src/lib/supabase.ts:4` reads `NEXT_PUBLIC_SUPABASE_ANON_KEY`, but your `.env.local` defines `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **What's wrong:**
  1. Supabase is effectively off, because the env var names don't match.
  2. Everything runs on the JSON file.
  3. On Vercel the bundled file doesn't exist (it's gitignored), so each serverless instance seeds its own `/tmp/homestay-store.json`. Writes land on one instance and vanish on the next cold start.
  4. Room tariffs, seasons, room photos, bookings and CRM data therefore don't persist on a serverless host.
- **Failure scenario:** The admin saves a new peak rate. Some visitors see it and others see the seed prices. After a redeploy, everyone sees seed prices.
- **Fix (decision needed):** Make Supabase the source of truth.
  1. Rename the env var, or read `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as well.
  2. Do server-side writes with the service-role key. `getSupabaseAdmin()` at `supabase.ts:46` currently falls back to the anon key, which silently fails RLS.
  3. Move each JSON-store collection into tables: `room_categories`, `room_rates`, `seasons`, `bookings`, `booking_rooms`, `guests`, `folios`, `payments`.

  The tariff code is already wired for this: when Supabase is configured with a service-role key, tariffs and seasons are read from and written to `cms_content` rows `room_tariffs` and `seasonal_date_ranges`, with no schema change. If you stay self-hosted on a VM instead, the JSON file works but needs backups and a lock (M2).

### H3. Writes to Supabase fail silently, then the read path shows Supabase data
- **Where:**
  - `saveRoom` (`data-service.ts:201`) inserts rows with fields that don't exist in `rooms` (`base_adults`, `tariffs`, …) and non-UUID IDs; errors are swallowed and it falls back to the file.
  - `updateHeroSlides` and the other CMS writers ignore the `upsert` error (the anon key is blocked by RLS).
  - `getRooms` and `getCMSContent` read Supabase first.
- **Failure scenario:** With Supabase enabled, an admin edits a room or the homepage. The file is updated, but the site keeps showing the old Supabase row.
- **Fix:** One repository per entity. Write with the service role, check `error` on every call, return 500 on failure, and never fall back on write.

### H4. Three schemas have drifted; the CRM `bookings` table clashes with the website `bookings` table
- **Where:** `supabase/schema.sql:51` (`public.bookings`), `supabase/schema_crm.sql:140` (`bookings`), `prisma/schema.prisma` (Prisma isn't installed, so this file is unused).
- **Failure scenario:** Running both SQL files leaves only the first `bookings` definition (`IF NOT EXISTS`). The CRM columns (`tape_status`, `guest_id`, …) don't exist, so every CRM write to Supabase fails.
- **Fix:**
  - Choose one schema, managed by Supabase migrations (`supabase/migrations/*.sql`).
  - Delete the Prisma file, or adopt Prisma or Drizzle fully.
  - Rename website requests to `booking_requests`, or merge them into a single `bookings` table with a `source` column.

### H5. Lost updates on the file store
- **Where:** Every `getStoreData()` → modify → `saveStoreData()` cycle rewrites the whole 75 KB+ file. The CRM also syncs whole arrays (`syncBookings`, `syncRooms`).
- **Failure scenario:** Two devices check in guests at the same time, and the last whole-array sync overwrites the other device's booking.
- **Fix:**
  - Use row-level writes in Postgres, with optimistic concurrency (`updated_at` / `version` column checked in the `WHERE` clause).
  - Until then, serialise file writes with an in-process mutex.
  - Stop whole-array syncs.

### M2. No backups, audit trail or history for rates and bookings
- **Where:** The tariff record is simply overwritten. `audit_logs` exists in `schema_crm.sql` but is never written to.
- **Fix:**
  - Add a `rate_change_log(id, room_category, before jsonb, after jsonb, changed_by, changed_at)` table and write it in `saveRoomTariff`.
  - Turn on Supabase point-in-time recovery or daily backups.
  - For the file store, copy the file nightly to S3 or Drive.

### M3. Money fields
- **Where:** `NUMERIC(10,2)` in SQL, but JS `number` in the app, with `Math.round` per night.
- **Status:** Fine for whole-rupee tariffs today.
- **Fix:** Before adding GST and discounts, store integer paise (`bigint`) or keep `NUMERIC` and round once per line, using the same function on the server and in the browser.

---

## 3. Booking engine and inventory

### H6. Public availability ignores CRM bookings and walk-ins, so overbooking is possible
- **Where:** `AvailabilityModal.tsx:232` reads `/api/bookings` (website requests only). CRM bookings live in `crmBookings` and the tape chart.
- **Failure scenario:** All three suites are checked in through the CRM, but the website still shows "3 of 3 available" and accepts a request.
- **Fix:** Create `GET /api/availability?checkIn&checkOut`. It should compute counts on the server from **all** bookings (website + CRM, excluding cancelled and expired holds) against physical-room inventory, and return counts only. That also removes the PII leak in C2.

### H7. Availability is matched by room name, and multi-room requests count as one room
- **Where:** `tariff-calculator.ts:488-530` (`calculateCategoryAvailability`). It falls back to `room_name.includes('suite')`. The `room_id` of a multi-room booking is the joined string `"room-cat-1, room-cat-3"`.
- **Failure scenario:**
  - A 3-suite group booking blocks only 1 suite.
  - A booking with "suite" anywhere in its name blocks a suite.
- **Fix:** Store a `booking_rooms(booking_id, category_id, physical_room_id)` row per room and count those rows. Remove the name heuristics.

### H8. No holds, no locking, no idempotency
- **What's wrong:** Website bookings are created as `pending` requests with no expiry and no inventory lock. Double-submits create duplicates.
- **Fix:**
  - Hold inventory for 15–30 minutes on submit, using `status='hold'` with `hold_expires_at`.
  - Do an atomic availability check plus insert in a Postgres function, or use a `SELECT … FOR UPDATE` on per-night inventory rows.
  - Make submits idempotent with an `Idempotency-Key` header from the modal.
  - Expire holds with a cron job (Vercel Cron or Supabase `pg_cron`).

### M4. Pending requests block inventory forever, and there is no cancellation or modification flow
- **What's wrong:** `calculateCategoryAvailability` only excludes `cancelled`, so a "pending" request that never converts blocks the room. There is no guest cancellation, no date change and no cancellation policy (refund %) in the data model.
- **Fix:** Add a status machine (`hold → confirmed → checked_in → checked_out` / `cancelled` / `no_show`) with timestamps, a policy per rate plan, and an auto-expiry for pending requests.

### M5. Hardcoded room topology
- **Where:** `PHYSICAL_TO_CATEGORY_MAP`, `CATEGORY_CAPACITIES` (`tariff-calculator.ts`), `INITIAL_PHYSICAL_ROOMS`, and the name heuristics.
- **Failure scenario:** Adding a room, or a new category from the admin, doesn't add inventory, and its capacities default to 3 adults / 2 children.
- **Fix:** Store `room_categories(capacity_adults, capacity_children, base_adults)` and `physical_rooms(category_id)` in the database, and derive the maps from them.

### L1. Mock data leaks into production paths
- **Where:**
  - `AvailabilityModal.tsx:243` falls back to `INITIAL_BOOKINGS` (demo bookings) when the fetch fails.
  - `page.tsx` and `admin/page.tsx` start from `INITIAL_ROOMS` / localStorage.
  - `INITIAL_INQUIRIES` / `INITIAL_BOOKINGS` seed the store.
- **Fix:** Show an error state instead of demo data, and seed only in development.

---

## 4. Rates and revenue

### H9. GST is not calculated, but the booking modal says "Taxes Included"
- **Where:** `BookingModal.tsx:990`. `totalTax` exists in `types/crm.ts:183`, but nothing computes it.
- **What's wrong:** As far as I know, Indian GST on hotel accommodation is now 5% (without ITC) when the value of supply is at or below ₹7,500 per unit per day, and 18% above that. This was changed in September 2025. Several of your rates cross ₹7,500, for example the suite season AP at ₹12,500. Confirm the exact treatment, including how extra-bed charges and meal plans count towards the value, with your CA.
- **Failure scenario:** You absorb the tax on every booking, or under-collect on suites. Invoices can't be GST-compliant (no GSTIN, SAC 9963, or tax breakup).
- **Fix:** Add GST to the engine: work out the per-night value per room (including extra-person charges) → pick the slab → tax per night → invoice lines. Keep the slab table in config, not in code. Change the copy to "+ GST" until this is done.

```ts
const gstRate = (nightlyValue: number) => (nightlyValue <= 7500 ? 0.05 : 0.18); // confirm with CA
```

### M6. Rate model gaps
- **What's missing:**
  - Children are all charged the same rate, so ages (`childAges` is collected) are ignored. There is no free-under-5 rule.
  - Base occupancy is fixed at 2 for every category (`BASE_OCCUPANCY_ADULTS`), even though `room.base_adults` exists.
  - No minimum stay, closed-to-arrival, stop-sell, promo codes, length-of-stay discounts or holiday-specific surcharges.
  - Weekend surcharge applies only to regular nights (now documented in the engine), but is a single percentage.
- **Fix:** Move to a `rate_plans` model: per category × plan × date-range price, plus restrictions (`min_los`, `cta`, `ctd`, `stop_sell`) and child-age bands. The engine already prices night by night, so this is an extension rather than a rewrite.

### L2. Add-on prices are constants
- **Where:** `src/lib/booking-addons.ts`. The airport transfer (₹2,800) and bike rental (₹800 per night) are shared by the modal and the server now.
- **Fix:** Read them from the add-ons store, which already holds transfer routes.

---

## 5. Operations

### H10. CRM state lives mostly in each browser's localStorage
- **Where:** `CRMContext.tsx` holds bookings, folios, staff, menu, food orders and expenses in localStorage, with partial best-effort syncs to `/api/checkin`, `/api/orders` and `/api/addons`.
- **Failure scenario:** The front desk and the owner's phone show different guests, folios or ledgers. Clearing the browser loses unsynced folios.
- **Fix:** Use the server as the only store, with React Query or SWR for caching. For live updates (KDS, tape chart), use Supabase Realtime instead of polling plus localStorage `storage` events.

### M7. Food order totals come from the client
- **Where:** `orders/route.ts:76-91`.
- **Failure scenario:** A guest portal request posts a ₹1 total for a full meal, and the folio charge is ₹1.
- **Fix:** Look up menu prices on the server from `menu_items` and ignore client prices, the same approach as F5.

### M8. Ledger integrity
- **What's wrong:** Expenses and payments are mutable rows with no `created_by`, no immutability and no daily close.
- **Fix:** Use append-only `folio_charges` / `folio_payments` with reversal entries instead of edits, record staff IDs from the server session, and add a nightly "day close" snapshot.

### M9. Notifications
- **What's wrong:** No booking confirmation to the guest, and no alert to the owner apart from the in-app chime.
- **Fix:**
  - Send the guest a WhatsApp template message (via the WhatsApp Cloud API or a BSP such as Interakt or AiSensy) when a booking is created or confirmed.
  - Send the owner an email or push notification.
  - Queue both via a `notifications` table plus a cron worker, so failures retry.

---

## 6. Reliability and quality

### M10. No tests or CI
- **What's wrong:** Apart from the new `check:pricing` script, nothing guards regressions. The pricing bug here (F1) is exactly the kind a unit test catches.
- **Fix:**
  - Add Vitest for `tariff-calculator.ts` and the booking-id helpers.
  - Add Playwright for book-a-room and admin-saves-a-rate.
  - Add a GitHub Action that runs `lint`, `tsc`, `vitest` and `check:pricing` on every PR.

### M11. No logging or monitoring
- **Fix:** Add Sentry (or Vercel Observability) on both server and client, structured logs for every write (`entity`, `id`, `staff`, `before`/`after`), and an uptime check on `/api/tariffs`.

### L3. Type safety and hygiene
- **What's wrong:**
  - `any` in API routes and `catch (error: any)`.
  - A duplicate `lib/supabase.ts` re-export at the repo root.
  - The 1,700-line `data-service.ts` and 2,500-line `CRMContext.tsx` mix storage, business rules and UI state.
- **Fix:** Split by domain (`rates`, `inventory`, `bookings`, `folio`, `cms`) with typed repositories.

### L4. The `next/font/google` build depends on the network
- **What's wrong:** Builds fail in restricted CI (seen during this audit).
- **Fix:** Self-host the three fonts with `next/font/local`.

---

## 7. What would make this a world-class independent hotel backend

Each item says where it plugs into this codebase.

| Capability | Why it matters | Where it plugs in |
|---|---|---|
| **Server-side PMS core** (rooms, rates, inventory, bookings in Postgres) | Foundation for everything below. Fixes C5, H3–H8 and H10. | Replace `data-service.ts` collections with Supabase tables plus a typed repository layer. `tariff-calculator.ts` stays as the pricing engine. |
| **Channel manager / OTA sync** (Booking.com, Airbnb, MakeMyTrip/Goibibo, Agoda) | Single inventory, so OTAs can't overbook. Rates are pushed from one place. | Integrate a channel manager such as eZee Centrix, STAAH, AxisRooms or SiteMinder via its API. Push `room_rates` + availability on every change to rates or bookings (`saveRoomTariff`, booking create/cancel). Pull OTA reservations into `bookings` with `source='ota:<name>'`. |
| **Payments** (Razorpay: UPI, cards, deposits, refunds) | Confirmed, paid bookings instead of WhatsApp follow-ups. | `POST /api/bookings` creates a hold plus a Razorpay order for the deposit. A webhook (`/api/payments/webhook`, signature-verified) confirms the booking and writes `folio_payments`. Refunds follow the cancellation policy (M4). |
| **Revenue management rules** | Higher ADR in peaks and better occupancy in troughs. | Extend seasons into `rate_plans` + restrictions (M6). Add occupancy-based rules ("over 80% booked for a date → +10%") evaluated in the engine, and a 365-day rate calendar UI in `AdminRooms`. |
| **GST-compliant invoicing** | Legal compliance and B2B guests. | Slab logic in the engine (H9), with GSTIN, SAC 9963, and CGST/SGST vs IGST on the invoice. Generate invoices from folios using sequential, non-editable invoice numbers. |
| **Housekeeping and maintenance** | Rooms ready on time, no selling of out-of-order rooms. | `housekeeping_tasks` already exists in `schema_crm.sql`. Tie it to check-out events, and block `out_of_order` rooms from inventory (H6). |
| **Guest CRM** | Repeat stays, and personalisation for families or Bengali-speaking travellers. | A `guests` table keyed by normalised phone, with stay history, preferences (dietary, already collected) and lifetime value. Auto-tag repeat guests at check-in. |
| **Messaging** (WhatsApp) | Confirmations, pre-arrival info (ILP for Sikkim, route), check-out invoice, review request. | `notifications` queue (M9) with templated messages per booking event. |
| **Reviews pipeline** | More Google and TripAdvisor reviews. | Send a post-check-out WhatsApp with a review link. Pull approved reviews into `reviews` (the CMS already shows them). |
| **Reporting** (ADR, RevPAR, occupancy, pickup, source mix, F&B revenue) | Owner decisions. | SQL views over `bookings`/`booking_rooms`/`folio_*` and a dashboard in `AdminOverview`. RevPAR = room revenue ÷ available room-nights. |
| **Audit and security** | Trust and DPDP compliance. | Server auth + roles (C1), RLS (C4), `audit_logs` writes, ID-document retention (M1). |

---

## 8. Phased roadmap

Effort estimates are rough, for one experienced developer.

### Fix now (this week, about 3–5 days)
1. **Decide on the source of truth.** Point the env var at the publishable or anon key and add the service-role key, so tariffs persist in `cms_content` immediately (C5). Set `ADMIN_ACCESS_CODE` on the host; without it, nobody can save prices or rooms. *0.5 day*
2. **Server staff auth and `/admin` middleware.** Remove the shipped passwords (C1). *1.5 days*
3. **Lock the PII and write endpoints** behind the staff session, and add the counts-only `/api/availability` (C2, C3, H6). *1.5 days*
4. **Fix Supabase RLS** and turn off open sign-ups (C4). *0.5 day*
5. **Change "Taxes Included" to "+ GST"** until H9 ships. *10 minutes*

### Next 30 days (about 3 weeks)
1. Unified Postgres schema and migrations. Move bookings, guests, folios and rooms off the JSON file and localStorage (H3, H4, H5, H10). *8–10 days*
2. `booking_rooms` and server-side availability, with holds, expiry and idempotency (H7, H8, M4). *3–4 days*
3. Razorpay deposits plus webhook confirmation. *3 days*
4. GST in the engine and on invoices (H9). *2 days*
5. Vitest, Playwright and CI. Sentry. Nightly backups (M2, M10, M11). *2 days*
6. Rate limiting, zod validation and generic errors (H1). *1 day*

### Next quarter
1. Channel-manager integration. *2–3 weeks, including certification*
2. Rate plans, restrictions, child-age bands and occupancy-based pricing (M6). *1–2 weeks*
3. WhatsApp notification pipeline, reviews flow and guest CRM (M9). *1–2 weeks*
4. Reporting dashboard (ADR, RevPAR, pickup, source mix). *1 week*
5. Self-hosted fonts and a refactor of `data-service.ts` / `CRMContext.tsx` by domain (L3, L4). *1 week*
