# Opus 5 prompt: fix the room pricing sync, then audit the backend

Paste everything below the line into a Claude Code / Opus session opened in the `homestay-website` repo.

---

<goal>
Two outcomes, in this order:

1. **Fix the pricing sync.** Every room category price shown on the public website (rooms section, availability modal, booking modal, room/guest selector suggestions, and any other place a guest sees a rupee amount) must come from the season and off-season tariffs and seasonal date ranges that the admin saves in the backend. Change a tariff or a season date range in admin, reload the public site, and the new price shows up with no redeploy and no code change. Price for a given category, dates, meal plan and guest mix must match the CRM/booking-side calculation to the rupee.
2. **Audit the backend as a senior hospitality-systems engineer**, and write an honest, prioritised report of bugs, security holes, data-integrity risks and the upgrades needed to make this a world-class hotel/homestay backend (PMS, booking engine, rates and inventory, guest ops, payments, reporting).
</goal>

<context>
Savera Homestay website and in-house CRM/PMS. Stack: Next.js 14 App Router, React 18, TypeScript, Tailwind, Supabase (`@supabase/supabase-js`), with a JSON-file fallback store. Owner is a non-developer founder who manages rates from the admin panel; the admin price is the source of truth, and guests seeing a stale or wrong price means lost bookings or undercharging.

Places to start (not an exhaustive list, so follow the code wherever it goes):
- `src/lib/tariff-calculator.ts`: `calculateDynamicTariff`, `PHYSICAL_TO_CATEGORY_MAP`, `CATEGORY_CAPACITIES`; defaults `seasonalDateRanges` to `INITIAL_SEASONAL_DATE_RANGES` from `crm-data.ts`.
- `src/lib/crm-data.ts`: `INITIAL_ROOM_SEASONAL_TARIFFS` and `INITIAL_SEASONAL_DATE_RANGES` (hardcoded seed data).
- `src/lib/data-service.ts`: `getRoomTariffs`, `saveRoomTariff`, `getSeasonalDateRanges`, `saveSeasonalDateRanges`; Supabase when configured, otherwise `data/homestay-store.json` with a `/tmp/homestay-store.json` write fallback.
- `src/app/api/tariffs/route.ts`: GET returns `{ tariffs, seasonalDateRanges }`; POST saves them.
- `src/components/RoomsSection.tsx`: initialises state from `INITIAL_ROOM_SEASONAL_TARIFFS`, fetches `/api/tariffs`, merges `json.data.tariffs` over the seed. Check whether it actually uses the fetched `seasonalDateRanges` or silently falls back to the hardcoded ones.
- `AvailabilityModal.tsx`, `BookingModal.tsx`, `RoomGuestSelector.tsx`, `crm/ManualBookingModal.tsx`, `CRMContext.tsx`, and `admin/AdminRooms.tsx`. The latest commit removed static price inputs from the admin room modal, so look for any remaining reads of a static `room.price` / base price field on the public side.
- Schemas: `supabase/schema.sql`, `supabase/schema_crm.sql`, `prisma/schema.prisma` (Prisma isn't in `package.json`, so work out which schema is actually live).
- Recent git history shows earlier attempts at "live dynamic seasonal pricing"; read those diffs so you know what was already tried.

Likely root-cause suspects to confirm or rule out: the frontend using seed seasonal ranges instead of saved ones; a merge that keeps stale seed categories; category ID mismatches between physical rooms (`101`, `room-101`) and categories (`room-cat-1`); date-boundary and timezone handling on season edges (the business runs in IST); the `/tmp` fallback not persisting on serverless hosts; caching on the public page; and more than one pricing code path.
</context>

<scope>
**Part 1, pricing fix: implement it fully.**
- Make one canonical pricing function and one canonical data fetch that every guest-facing price and the CRM booking price both use. Delete or redirect duplicate pricing paths instead of patching each one.
- Hardcoded seed tariffs can stay as a first-run seed for an empty store. They must never override or silently stand in for saved backend data at runtime. If live data fails to load, show a clear "price on request / check availability" state, not a stale number.
- Season boundaries: define inclusive/exclusive behaviour explicitly, evaluate per night in IST, and handle stays that span season and off-season (per-night breakdown).
- Keep the current visual design and component structure. Change markup only where a price is rendered.

**Part 2, audit: report only, no fixes.** Do not implement audit findings, with one exception: if you find something actively exploitable in production (for example unauthenticated writes that let anyone change prices or bookings), fix only that minimal hole and list the fix clearly in the report.

Deliver what was asked, at the scope intended. Make routine judgment calls yourself. If the request seems mistaken or a better approach exists, say so in a sentence and carry on with the task as asked. Don't quietly narrow, widen or transform it. No drive-by refactors, renames, dependency upgrades or style changes outside the pricing path.
</scope>

<audit_brief>
Report every real issue you find, whatever its size. Rank and filter afterwards; don't self-censor to "serious issues only". Cover at least:

- **Security and auth:** admin auth (`/api/admin/auth` issues an unverifiable token with a default passcode fallback), whether any API route checks auth server-side, unauthenticated POSTs (`/api/tariffs`, bookings, rooms, CMS, orders, check-in), service-role key exposure, Supabase RLS, input validation, rate limiting, guest-portal/QR isolation, PII handling (ID documents at check-in).
- **Data layer:** Supabase vs JSON file vs `/tmp` vs Prisma. Which is the source of truth, what happens on serverless, race conditions and lost writes on concurrent saves, schema drift between the three schema files, missing constraints, indexes and foreign keys, money stored as floats, audit trail of rate changes.
- **Booking engine and inventory:** double-booking and overbooking prevention (transactions or locks), availability vs the hardcoded `totalInventory`, holds and expiry, cancellation and modification flows, booking ID generation collisions (`booking-id.ts`), check-in/check-out invariants, timezone correctness.
- **Rates and revenue:** rate plans, meal plans, extra adult/child logic and child-age rules, min-stay, weekend/holiday surcharges, promo codes, GST calculation and invoicing correctness for Indian hotel tariffs, rounding.
- **Operations:** orders/KDS, expenses and ledger integrity, staff roles and permissions, check-in flow, notifications.
- **Reliability and quality:** error handling (raw `error.message` returned to clients), logging and monitoring, backups, tests (there are effectively none), type safety, dead code and mock data leaking into production.
- **World-class roadmap:** what a best-in-class independent hotel/homestay backend has that this lacks. Examples: channel manager / OTA sync (Booking.com, Airbnb, MakeMyTrip, Agoda), payment gateway with deposits and refunds (Razorpay), dynamic pricing rules, housekeeping status, guest CRM and repeat-guest profiles, reviews pipeline, WhatsApp confirmations, reporting (ADR, RevPAR, occupancy, source mix). Tie each item to this codebase and say where it would plug in, not generic advice.

For each finding give: severity (Critical / High / Medium / Low), file and line, what's wrong, a concrete failure scenario, and the recommended fix (with a short code sketch where useful). End with a phased roadmap: fix now / next 30 days / next quarter, with rough effort for each.
</audit_brief>

<effort>
xhigh. This is long-horizon, multi-file work where correctness of money matters.
</effort>

<output>
1. The pricing fix as working code changes, finished end to end, with no stubs or TODOs.
2. `docs/backend-audit.md`: the audit report described above. Make it as long as the findings need, with no filler sections or repeated summaries.
3. A short final message that leads with the outcome: what was broken in pricing and why, what you changed (file list), any production-exploitable hole you patched, and the top 5 audit findings in one line each.

Before your first tool call, say in one sentence what you're about to do. While working, post a brief update only when you find something important or change direction.
</output>

<done>
- `npm run build` and `npm run lint` pass.
- Add a small runnable check (a script under `scripts/` or a lightweight test) that proves, for each room category: a pure off-season stay, a pure season stay, a stay crossing the season boundary, each meal plan (EP/CP/MAP/AP) and an extra-adult + child case all return the same total from the public-site path and from the CRM booking path. It must also prove that after saving a changed tariff and a changed season range through `/api/tariffs`, the public calculation reflects the new values. The check passes.
- No guest-facing component reads a hardcoded tariff or seed season range at runtime.
</done>

<pause_rules>
Proceed autonomously through investigation, the pricing fix and the audit. Stop and ask only before:
- running anything that writes to the live Supabase project, or changing its schema or RLS policies;
- deleting data or overwriting `data/homestay-store.json` content (a temporary copy for testing is fine);
- deciding between Supabase and the JSON store as the permanent source of truth, if the pricing fix truly can't proceed without that decision. Otherwise recommend it in the report.
Don't commit or push unless asked. Leave changes in the working tree.
</pause_rules>

<subagents>
Delegate only if it truly helps: at most one read-only subagent for the wide audit sweep across API routes and schemas, while you do the pricing fix. Don't use subagents to review or re-check your own work.
</subagents>

Keep responses concise.
