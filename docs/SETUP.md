# Savera Homestay: setup and go-live

The website, the staff CRM and the guest pages now run on one Postgres database (Supabase). This guide takes you from the old version (JSON file + browser storage) to the new one. Do the steps in order. Nothing here deletes your old data: the JSON file is only read, and each device's old browser data stays until an admin moves it and chooses to remove it.

## 1. What you need

- Your Supabase project (the database and file storage).
- Your Vercel project (hosting).
- About 30 minutes, ideally at a quiet time (no check-ins in progress).

## 2. Environment variables

Set these in Vercel → Project → Settings → Environment Variables (Production and Preview), and in `.env.local` for local development. `.env.example` lists them with comments. Put values in double quotes if they contain `#` or spaces (an unquoted `#` cuts the value short).

| Name | Required | What it is |
|---|---|---|
| `DATABASE_URL` | Yes | Supabase → Project Settings → Database → Connection string → **Transaction pooler** (port 6543). Use this one on Vercel. |
| `SESSION_SECRET` | Yes | A long random string (32+ characters) that signs sign-in cookies. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Changing it signs everyone out. |
| `DEFAULT_ADMIN_EMAIL` | First run | Email for the first admin account. |
| `DEFAULT_ADMIN_PASSWORD` | First run | Temporary password for that account. You must change it at first sign-in; afterwards both values can be removed. |
| `NEXT_PUBLIC_SUPABASE_URL` | Recommended | `https://<project-ref>.supabase.co`. With the key below, photos and ID documents go to Supabase Storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | Supabase → Project Settings → API → `service_role`. **Server only**: never prefix it with `NEXT_PUBLIC_`. |
| `BOOKING_HOLD_HOURS` | No | How long a website booking request holds its rooms while you review it (default 24). |

Remove these old ones from Vercel: `ADMIN_ACCESS_CODE`, `ADMIN_SESSION_SECRET`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Without the two Supabase storage values, files are kept inside the database, which works but is slower and fills the database faster.

## 3. Create the database tables

Run `supabase/migrations/20261001000000_pms_core.sql` once:

- **Supabase dashboard:** SQL Editor → New query → paste the whole file → Run.
- **or psql:** `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261001000000_pms_core.sql`

The file is safe to run again. It:

- creates a private `pms` schema (not reachable through Supabase's public API) with all tables;
- turns on row-level security and removes every policy on the old public tables, so the anon key can no longer read or change them;
- creates the storage buckets `room-photos` (public) and `guest-documents` (private).

Check in Supabase → Storage that `guest-documents` shows as **private**.

## 4. Import the old JSON store

Run this from your computer in the project folder, with `DATABASE_URL` pointing at the new database. For scripts, the **Session pooler** (port 5432) or direct connection string is the better choice.

```bash
npm install
# dry run: shows what would be imported, writes nothing
DATABASE_URL="postgres://..." npm run db:import-json -- data/homestay-store.json
# import for real
DATABASE_URL="postgres://..." NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="..." \
  npm run db:import-json -- data/homestay-store.json --apply
```

It imports rooms and photos, tariffs and seasons, website text and reviews, menu, transfers and rentals, website booking requests, front-desk bookings (ID documents move to private storage), inquiries, folios, orders and expenses. It prints what was added and any warnings (for example two bookings on the same room and nights).

- Run it once, on the empty database, before staff start using the new system. It refuses to run a second time unless you add `--force` (records with the same id are then overwritten from the file).
- Old staff logins are **not** imported (they stored passwords in plain text). You recreate them in step 6.
- Every room gets a new secret QR token (the old ones were visible in the website's code).

If you skip this step, the first request seeds the default rooms, menu and tariffs instead.

## 5. Deploy

Push to the branch Vercel deploys, or redeploy from the Vercel dashboard after setting the variables. Then check `https://<your-site>/api/health` shows `"status":"ok"`.

## 6. First sign-in and staff accounts

1. Open `/admin` and sign in with `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD`.
2. Choose a new password (at least 8 characters).
3. Ledger & Staff → Staff: create an account for each person (admin, manager or kitchen). Give them the temporary password; they must change it at first sign-in.
4. Remove `DEFAULT_ADMIN_PASSWORD` from Vercel once you're in.

Roles: **admin** sees everything (ledger, staff, GST rules, deletes); **manager** runs the front desk, rates, rooms and orders; **kitchen** sees orders and the menu only. Deactivating an account or changing its role signs that person out at once.

## 7. Move each front-desk device's old data

The old version kept bookings, folios, orders and expenses only in the browser of the device where they were entered. On **each** device that was used for the front desk or kitchen:

1. Open `/admin` and sign in as an admin.
2. A yellow banner shows what the old version left on that device.
3. Click **Download backup** (keeps a JSON copy), then **Move to server**. Records the server already has are kept as they are; folios found on both sides get their payments and charges combined.
4. Tick "Also replace … website content, tariffs and menus" only if your most recent website edits are missing on the live site (the old hosting could lose them).
5. When the report looks right, click **Remove from this browser**.

## 8. Reprint the room QR codes

Admin → **QRs** → print each room's standee again. The new codes carry the room's secret token, so scanning one opens that room's concierge straight away. Old printed codes still work: the guest is asked once for the mobile number on the booking.

## 9. Check the tax and price settings

Website Settings → Dine-in Menu & Add-ons:

- **GST rules:** room GST per room-night (default 5% up to ₹7,500, 18% above), food 5%, transfers 5%, other 5%, and whether your tariffs already include GST. Confirm these with your CA. Only an admin can change them.
- **Website booking add-ons:** airport/NJP transfer price and bike rental per night.

Site Rooms & Tariffs: each category now also has *adults included in the rate* and *children stay free under age*, and each season can have a *minimum stay*.

## 10. Daily use

- **Website bookings** arrive as *pending* and hold their rooms for 24 hours (`BOOKING_HOLD_HOURS`). Confirm or cancel them in Website Settings → Web bookings; after the hold expires the rooms are released automatically.
- **Day close:** Ledger → Day close, at the end of each day. It records the day's collections, charges and expenses; after that, managers can't add expenses dated on or before that day.
- All staff screens refresh every few seconds, so every device sees the same bookings, folios and orders.

## 11. Backups

- Supabase → Project Settings → Database → Backups: check what your plan includes (daily backups on paid plans; point-in-time recovery is an add-on). Turn on what you can.
- On the free plan, take your own backup regularly, e.g. weekly: `pg_dump "$DATABASE_URL" --schema=pms -Fc -f savera-$(date +%F).dump` and store it off-site (Google Drive).
- Every change is also recorded in `pms.audit_log` (who, what, before/after).

## 12. Local development and tests

```bash
cp .env.example .env.local   # fill in DATABASE_URL (a local or test database), SESSION_SECRET, DEFAULT_ADMIN_*
npm run dev
npm run lint && npm run typecheck && npm test
# against a running server and a TEST database only:
DISABLE_RATE_LIMIT=1 npm run dev   # in another terminal
TEST_BASE_URL=http://localhost:3000 TEST_ADMIN_EMAIL=... TEST_ADMIN_PASSWORD=... npm run test:integration
npm run check:pricing -- http://localhost:3000
```

Never point the integration tests or `check:pricing -- --write-test` at the live site: they create and delete test data.

**CI:** `docs/github-actions-ci.yml` runs lint, typecheck, unit tests, the build, the integration tests and the pricing check against a throwaway Postgres. To turn it on, copy it to `.github/workflows/ci.yml` and push.

## 13. If something goes wrong

- The import never changes `data/homestay-store.json`, and device data is only removed when an admin clicks **Remove from this browser** after moving or downloading it.
- To start the import again on a fresh database: drop the `pms` schema (`drop schema pms cascade;`), run step 3 again, then step 4.
- Server errors appear in Vercel → Logs as JSON lines (`"level":"error"`), with the route name.
