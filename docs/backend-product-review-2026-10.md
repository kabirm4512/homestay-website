# Savera Homestay: back-office product review (October 2026)

Reviewed 9 Oct 2026 against the working tree at `0bd5469`, as a read-only pass. Line numbers refer to that commit. This review builds on `docs/backend-audit.md` (C1–C5, H1–H10, M1–M11, L1–L4, F1–F12). Items from that audit are re-raised only where a fix is incomplete or has regressed, and each such item is tagged with the original ID.

**Update, 9 Oct 2026 (later the same day):** most Critical and High findings are now fixed. See [section 8](#8-implementation-status-9-oct-2026-second-pass) for the status of each ID.

**How the findings were checked.** `npm run lint`, `npm run typecheck` and `npm test` (36 unit tests) all pass. They were run in a scratch copy, because the project's own `node_modules` was installed on Windows and has no `vitest`. `npm run check:pricing` needs a running server and was not run. Every calculation bug marked **[proved]** was reproduced with a throwaway Vitest file outside the repo (`proofs/money.test.ts`, 12 cases P1–P11). Its output is quoted where it is used.

---

## 1. Executive summary

The pricing engine, the GST slab maths and the security layer are in good shape after the October audit. The money is not yet. Today it lives as whole JSON documents (`pms.records`), which every staff device rewrites, and each screen computes revenue its own way. As a result, the owner's numbers cannot be trusted:

- the folio is linked to the wrong guest;
- payments can be silently overwritten;
- website deposits and add-ons never reach the bill;
- three screens report three different "revenue" figures.

The ten things that matter most, in the order to do them:

| # | What | Why it matters | Bugs | Slice |
|---|---|---|---|---|
| 1 | **Link folios, orders and transfers to bookings by `bookingId` only.** | Checkout today can post the payment to the *next* guest's folio in the same room and mark it settled. The bookings list and the invoice show other guests' food bills. | MF-01, BL-01, INV-01 | S1 |
| 2 | **Stop lost updates on folios.** Use server-side folio operations (add charge / add payment / void) with a version check, in place of whole-document upserts. | Two devices, or a guest order arriving while the desk edits, can silently drop a payment or a charge. An admin's stale write can delete a recorded payment without any error. | MF-02, MF-03, SY-01 | S2 |
| 3 | **Fix the folio maths.** Allow negative balances (credit owed), keep pending lines out of the bill, preserve `void`, and freeze each line's tax at posting. | Overpayments vanish, unapproved orders are billed, and changing a GST setting re-taxes old bills. | MF-07, MF-08, MF-10, MF-12, MF-14 | S3 |
| 4 | **Bring website money onto the folio.** Carry deposits as payments and add-ons as charges, and re-home pre-arrival orders when a web request is assigned a room. | Deposits recorded as "deposit_paid" never reach collections. Airport transfers sold online are never billed. Pre-arrival celebrations sit on orphan folios. | MF-04, MF-05, MF-06 | S5 |
| 5 | **One definition per number.** Ledger, day close, bookings list and the admin overview must all read one server summary for a date range. | Today, "revenue" means collections incl. GST in the ledger, booking-time charges in day close, and website quotes in the admin overview. | DB-01, DB-02, EX-03 | S4 |
| 6 | **Make checkout a server transaction with state rules.** | Any booking (future, hold, already checked-out) can be "checked out" from *Inspect folio*, flipping an occupied room to available. Paise balances cannot be submitted. | BK-04, MF-09, UX-01 | S3 |
| 7 | **Inventory integrity at the desk.** Check category availability, link multi-room web requests per room, and use dated maintenance blocks. | The desk can overbook against website holds. Assigning room 1 of a 3-room web request frees the other two. One maintenance flag closes a room for every future date. | BK-01, BK-02, BK-03 | S6 |
| 8 | **Move money to real tables** (`folio_lines`, `folio_payments`, `expenses`, `expense_categories`, `vendors`, `invoices`) with foreign keys and per-line ledger rows. | JSON documents with denormalised totals are the root cause of #2, #3 and #5. Reports are also truncated by state limits (2,000 folios / 5,000 expenses). | DB-04, MF-19 | S7 |
| 9 | **A GST tax invoice the CA will accept:** sequential per financial year, from folio lines, CGST/SGST at the real rate. | The printed "tax invoice" is assembled from booking fields and order lists. It mislabels 18% as 2.5%, always says "Fully Settled", and its lines don't add up to its total. | INV-01–INV-03 | S10 |
| 10 | **Expenses that work on a phone, offline, for managers.** | A manager's expense that fails to send stays on screen as if saved. Managers cannot see what they logged after a reload, so they log it twice. | EX-01, EX-02 | S8, S15 |

**Bug count:** 81 findings: 7 Critical, 24 High, 30 Medium, 20 Low. Section 2 has the full register, and section 6 turns it into PR-sized slices, with money correctness first.

**The leads from the brief.** All six are confirmed; the double-count part of lead 4 is refuted. Evidence is in §3.6.

---

## 2. Bug register

Columns: **ID**, **Sev** (C Critical · H High · M Medium · L Low), **Where** (`file:line`), **What is wrong and how it fails** (with sample numbers), **Fix**, **Test that proves it fixed**. Paths are relative to `src/` unless stated otherwise.

### 2.1 Money and folios

| ID | Sev | Where | What is wrong and how it fails | Fix | Test |
|---|---|---|---|---|---|
| MF-01 | C | `context/CRMContext.tsx:1141`; `components/crm/GuestCheckoutModal.tsx:47-50` | Checkout finds the folio with `f.bookingId === id \|\| f.roomNumber === room`. Folios load newest first (`records.ts:36`, `seq desc`), and every desk booking creates its folio when it is made. **[proved P7]** Guest A (room 3, in-house) checks out on 9 Oct. Guest B was booked into room 3 for 15 Oct on 7 Oct. The ₹8,500 collected from A is posted to B's folio and B's folio is marked settled. A's folio stays open with ₹8,500 due. | Resolve the folio by `bookingId` only, through one shared selector (`lib/folio-links.ts: folioForBooking`). If a booking has no folio, show "No folio – create one" rather than guessing. On the server, `POST /api/folios/:id/checkout` takes the folio id, not the room. | Unit: `folioForBooking` returns `null` for a booking with no folio even when another folio in the same room exists. Integration: create A (in-house) and B (future, same room), check out A, and assert the payment lands on A's folio and B's is untouched. |
| MF-02 | C | `lib/server/crm-sync.ts:158-168`; `lib/server/repos/records.ts:78-85`; `context/CRMContext.tsx:364-376` | Folios are one JSON document, and every device upserts the whole document with no version check. Admins skip `checkFolioChange` (`crm-sync.ts:70`). The 8-second poll can apply a stale snapshot right after a save, because a poll that started before the flush is applied when `pendingOpsRef` is back to 0. Failure: the admin records ₹5,000 cash (P1), and a poll started 1 s earlier lands with the old folio. The admin then records a ₹2,000 UPI payment, which upserts `[P2, …old]`. P1 is deleted with no error. For a manager the same race returns "Recorded payments cannot be changed", and their new charge is lost. | Replace whole-folio upserts with server operations: `POST /api/folios/:id/charges`, `/payments`, `/charges/:lineId/void`, `/discount`. Each runs in a transaction with `select … for update`, and lines are append-only. Until S7 lands, add `version int` to `pms.records` and reject an upsert whose `version` ≠ the stored one (409 → refetch). Drop a poll response whose request started before the last flush. | Integration: two concurrent `POST …/payments` produce two payments. A folio upsert with a stale version gets 409. Unit (client): a poll response started before a flush is ignored. |
| MF-03 | C | `lib/server/guest-services.ts:32-72` | `ensureFolio` and `postCharge` read a folio and then write it, with no lock. Two orders from the guest's phone in the same second each read the same folio and each write back their own copy, so one charge is lost. The orders still say `chargePostedToFolio: true`. Two first orders with no folio yet each create a folio, giving one booking two folios. `findFolioForBooking` also scans up to 5,000 folios on every guest action and creates a duplicate once there are more than that. | Do it in one transaction: `select … from folios where booking_id = $1 for update`, then insert the line. Add a unique index on `folios(booking_id)` (S7). Until then, wrap the work in `withTx` + `pg_advisory_xact_lock(hashtext(bookingId))`. | Integration: 10 parallel `POST /api/orders` produce 10 lines on one folio. |
| MF-04 | C | `app/api/bookings/route.ts:154`; `components/admin/AdminBookings.tsx:45-67,290-296`; `components/crm/ManualBookingModal.tsx:163-180` | A web booking's `payment_status` (`deposit_paid` / `fully_paid`) is a flag with no amount, method or date. Money received for website bookings (UPI before arrival) never becomes a `FolioPayment`. When the request is assigned a room, the advance field starts at ₹0. Collections, day close and cash reconciliation all miss it. The guest is shown the full amount due at checkout and can be charged twice. | Record advances as payments: `POST /api/bookings/:id/payments` (amount, method, reference, date). Before arrival they are held on a booking-level folio. On conversion they move to the room folio (S5). Remove the bare `payment_status` selector, or derive it from payments. | Integration: record a ₹3,000 deposit on a web request, convert it, and assert the folio has a ₹3,000 payment dated the deposit date and the day-close collections for that date include it. |
| MF-05 | H | `app/api/bookings/route.ts:101-103,118-122`; `components/crm/ManualBookingModal.tsx:163-180` | Website add-ons (airport/NJP transfer ₹2,800, bike ₹800/night) are priced into `total_price` with GST, but are stored only as text in `special_requests`. Conversion ignores them. Failure: the guest books 2 nights plus a transfer, with the quote = rooms ₹9,450 + transfer ₹2,940. The folio bills ₹9,450, and the ₹2,940 is never billed. | Store add-ons as structured lines on the web booking (`addons: [{code, qty, unitPrice}]`). On conversion, post them as `transport_transfer` / `vehicle_rental` charges, or create a pending dispatch request. | Integration: a web booking with a transfer, once converted, has a 2,800 + 140 GST transport line. |
| MF-06 | H | `lib/server/guest-services.ts:38-64,155-203,221-255`; `app/api/orders/route.ts:24-28`; `lib/server/repos/bookings.ts:424-453` | A guest signed in to the portal with a *confirmed web request* can order a celebration or a transfer before arrival (`requireInHouse(…, true)`). `ensureFolio` creates a folio keyed to the **web** booking id with `roomNumber: 0`. When the desk assigns a room, `createManualBooking` makes a new folio for the new CRM booking id, and the celebration (₹2,000) stays on the orphan folio. It is never on the guest's bill, and it appears in the ledger as "Room 0". | On conversion, move open lines from any folio with `bookingId = sourceBookingId` to the new folio, recording the transfer in the audit log. Better still, keep one folio per *stay* and link it to both ids (S7: `folios.booking_id` + `bookings.linked_booking_id`). | Integration: place a celebration on a confirmed web booking, convert it, and assert the line is on the new folio and the old folio is empty or voided. |
| MF-07 | H | `lib/folio.ts:35-36` | `balanceDue = max(0, netPayable − totalPaid)`. **[proved P1]** Net ₹10,500, paid ₹12,000 → `balanceDue 0`, status `settled`. The ₹1,500 the property owes the guest is not represented anywhere, and there is no refund type to give it back. | Make `balance = netPayable − totalPaid` signed (negative = credit owed). Add a `refund` payment kind (negative amount, needs a reason, admin or limit-gated). Settled means `balance = 0` exactly. Show "Credit ₹1,500 – refund or carry forward". | Unit: overpaid folio → `balance = −1500`, status `open`, `creditOwed = 1500`. |
| MF-08 | H | `lib/folio.ts:23`; `lib/server/day-close.ts:58` | Only `void` lines are excluded, so `pending` lines (orders awaiting manager approval, transfers awaiting dispatch) are inside `netPayable` and `balanceDue`. **[proved P5]** A ₹800 order placed at 10:55 is not approved before an 11:00 checkout, and the guest pays ₹840 for food the kitchen never made. Day close also counts pending lines as the day's charges. | `netPayable` = posted lines only. Show pending lines separately as "Awaiting confirmation ₹800", and block checkout (or require an explicit void or post) while pending lines exist. | Unit: a folio with one posted and one pending line has `netPayable` = posted + tax only, and `pendingTotal = 800`. |
| MF-09 | M | `context/CRMContext.tsx:1143-1176,695-722` | `completeCheckoutWithSettlement` adds the payment, then sets `status: 'settled'`, `balanceDue − amount` and `totalPaid + amount` again. **[proved P6]** On the device, `totalPaid` shows ₹19,000 when payments sum to ₹10,500. A partial collection is still "settled" locally. The server recomputes this (`P6b` → `open`, ₹7,500), so the screen flips back seconds later. `settleFolio` reads `balanceDue` from a stale closure and stamps "Administrator" / "Duty Manager" as the collector. | Checkout becomes one server call that returns the folio. The client never writes totals. A partial collection leaves the folio `open` and creates a receivable, and the UI says so ("Guest left with ₹7,500 due"). | Integration: collect ₹3,000 of ₹10,500, then folio `open`, `balance 7,500`, booking `checked_out`. |
| MF-10 | H | `lib/folio.ts:36-49`; no caller sets folio `void` or booking `cancelled` | Nothing ever voids a folio, and there is no cancel or no-show action for desk bookings. A cancelled or no-show booking keeps its posted room charges, so it stays in receivables and in ledger revenue. If a `void` folio is ever recalculated with payments ≥ net, it becomes `settled` (**[proved P2]**). | Add cancel and no-show actions (server). These void all unconsumed room-night lines, apply the cancellation-fee policy as a charge, and turn any advance into a refund or a retained fee per the owner's answer to Q4. `recalculate` must never change `void`. | Unit: void folio stays void. Integration: cancel a booking with ₹2,000 advance → room lines void, fee line posted per policy, folio balance = −(2,000 − fee). |
| MF-11 | H | `context/CRMContext.tsx:1398-1445` | Room charges for the whole stay are posted when the booking is created, including holds and stays months ahead. Day close reports them as charges on the *booking date*, and the ledger counts them as revenue immediately. An Oct 1 booking for 20–24 Dec puts ₹18,000 of December revenue into 1 Oct. | Recognise room revenue per night. Either post one line per room-night at night audit (preferred, see feature F-04), or keep the stay lines with a `service_date` per night and report revenue by `service_date`. Day close reports revenue by service date and collections by payment date. | Unit: the revenue report for 1 Oct excludes a December stay booked on 1 Oct. |
| MF-12 | M | `lib/gst.ts:269-270`; `lib/folio.ts:13-14` | A `room_tariff` line without an explicit `taxAmount` is taxed at the *low* rate. Any manual room charge (e.g. a ₹9,000 late check-out or room upgrade, once a charge UI exists) is taxed at 5% instead of 18%. **[proved P3]** ₹450 vs ₹1,620. | Room lines must carry a nightly value. Compute the slab from it (`accommodationRateFor(nightValue)`), or require `taxRate` on every posted line. | Unit: `chargeTax({category:'room_tariff', amount:9000, nights:1})` → 1,620. |
| MF-13 | M | `lib/gst.ts:168-172`; `lib/folio.ts:60-64` | When tariffs include GST, an inclusive night price between ₹7,875 and ₹8,850 fits neither slab. The code picks 18%, which leaves a taxable value *below* ₹7,500. **[proved P4]** ₹8,000 → taxable ₹6,779.66 at 18%. Under the rule's own logic it would then be 5%. | Owner and CA decision (Q2). The practical fix is to forbid inclusive tariffs in that band, with a warning in Rooms & Tariffs, or to define the slab on the declared tariff. | Unit: an inclusive ₹8,000 night is rejected or handled per the chosen rule. |
| MF-14 | M | `lib/folio.ts:11-14`; `lib/server/crm-sync.ts:162-167` | Non-room lines don't store their tax. Every recalculation (on any later edit) applies the *current* GST settings, so changing food GST from 5% to 18% re-taxes every open and past folio the next time it is touched. Invoices already handed to guests no longer match the stored folio. | Freeze `taxRate` and `taxAmount` on every line when it is posted. `recalculate` sums the stored values. | Unit: change the config after posting, and `totalTax` is unchanged. |
| MF-15 | M | `context/CRMContext.tsx:1324-1331` | Itemisation assumes 2 adults included and charges every child. It ignores `baseAdults` and `freeChildUnderAge`. **[proved P10]** Category with 3 adults included, ₹12,000 for 2 nights: the folio shows "Base ₹9,000 + Extra adult ₹3,000" for a guest who owes no extra-adult charge. The total is right but the bill is wrong. | Itemise from the engine result (`DynamicTariffResult.extraAdultsCharge` / `extraChildrenCharge` / `breakdown`), not from re-derived counts. | Unit: `buildStayLines(engineResult)` lines sum to `totalAmount` and match the engine's extras. |
| MF-16 | H | `context/CRMContext.tsx:202-209`; `components/crm/ManualBookingModal.tsx:236-249,172-173` | The desk's tariff call has no `childAges`, so "children stay free under age X" never applies at the desk, and converting a web request drops the ages. Failure: free under 6, family with a 4-year-old. The web quote is ₹9,450 and the desk charges ₹9,450 + ₹630 (extra child + GST). | Pass `childAges` through `calculateDynamicTariff` (the engine already supports it, `tariff-calculator.ts:374`). Collect ages in the modal, and prefill them from `rooms_config[i].child_ages`. | Extend `check:pricing` with a desk-quote case that includes a free child. |
| MF-17 | H | `context/CRMContext.tsx:644` (`addFolioCharge` has no caller); `lib/folio.ts:30` | There is no UI to post laundry, minibar, a damage charge or a misc service, to give a discount, or to void a wrong line. `discountAmount` is always 0. Staff either can't bill these or collect them off the books. | Folio drawer actions (see §4.2): **Add charge** (category, qty × unit, auto tax), **Discount** (amount or %, reason, role limit), **Void line** (reason, role-gated). All are server ops (MF-02). | Integration: each op appears in the folio, the audit log and the day close. |
| MF-18 | M | `lib/server/guest-services.ts:239,252`; `components/crm/OperationsHub.tsx:80-88` | Vendor cost for transfers and rentals is guessed (75% / 65% of price). Confirming a dispatch never asks for the real driver fare, and no vendor payable or expense is created. "Est. Homestay Comm" is fiction, and the transport margin in any report is wrong. | The dispatch confirm form asks for the vendor and the agreed fare. That creates a `vendor_payable` (S13). Paying it creates an expense in category Transport vendor. | Integration: confirm a dispatch with fare ₹2,100 → payable ₹2,100, and margin = price − 2,100. |
| MF-19 | M | `context/CRMContext.tsx:1399`; `lib/server/guest-services.ts:41-49` | There are two folio-number schemes: `FOL-2026-3-AB12` (random) at the desk and `FOL-2026-1001` (counter) on the server. Neither is a gap-free invoice series per financial year. | Keep folio ids internal. Issue invoice numbers from `pms.counters` per FY (`SH/26-27/0001`) when the bill is finalised (S10). | Unit: the counter is gap-free under concurrency. |
| MF-20 | M | `app/concierge/page.tsx:1018`; `app/guest-portal/page.tsx:461,1473,1591` | Guests see menu, celebration and transfer prices with no "+ GST", but the folio adds 5%. Guests see ₹1,000 for a cake and are billed ₹1,050, which is a dispute at checkout. | Show "+ 5% GST" next to prices and "incl. GST" totals in the cart, using the same `rateForChargeCategory`. (Or set menu prices as GST-inclusive, Q3.) | Snapshot/RTL: the cart total equals the folio line + tax. |
| MF-21 | L | `types/crm.ts:293`; `lib/server/guest-services.ts:241-253` | Rental `depositRequired` is shown but never collected, held or returned. | Treat a deposit as a liability payment (`kind: 'deposit'`), released on return. | Integration: deposit in, then out, net 0, shown under "Deposits held". |

### 2.2 Invoices

| ID | Sev | Where | What is wrong and how it fails | Fix | Test |
|---|---|---|---|---|---|
| INV-01 | H | `components/crm/GuestCheckoutModal.tsx:684-740,119-136` | The printed invoice is not the folio. (a) The room line is `nights × roomRatePerNight` (a rounded average). It ignores manual totals and the GST-inclusive reduction. (b) Food lines come from `foodOrders` matched by **room number**, so a previous guest's orders print on this invoice, and pending orders print too. (c) Celebrations print twice: once as an order (they are stored as `foodOrders`) and once from `specialCharges`. (d) Dispatch lines print at quoted price even if pending. The lines do not add up to the printed Subtotal (which *is* from the folio). | Render the invoice only from posted folio lines and payments (S10). | Snapshot: the invoice lines sum to the subtotal, and a previous guest's order in the same room is absent. |
| INV-02 | H | `components/crm/GuestCheckoutModal.tsx:744-775` | The tax block hard-codes "CGST (2.5%) / SGST (2.5%)" for every rate, and rounds each half to whole rupees (**[proved P9]**: ₹1,350.18 printed as ₹1,350). It always prints "Balance Due ₹0.00 (Fully Settled)" even when ₹7,500 is still owed. It labels all payments "Advance Received", omits the discount, has no SAC 996311 or place of supply, and has no field for the guest's GSTIN. | A GST invoice template with a rate-wise table (taxable, CGST, SGST/IGST per rate), real balance, discount, SAC, place of supply, B2B GSTIN and a sequential number. | Snapshot for a mixed 5% / 18% folio, plus a partial-payment case. |
| INV-03 | M | `components/crm/GuestCheckoutModal.tsx:648-653` | GSTIN `19AAAFS8821Q1Z8`, the address "Lava – Rishyap…", the phone and the email are hard-coded. If these are not Savera's real details (Q5), every printed invoice is wrong. | Move them to settings (admin-only, with a GSTIN format check), reusing `pms.settings`. | Unit: the template reads from settings, and there is no literal GSTIN in the bundle. |
| INV-04 | L | `components/crm/GuestCheckoutModal.tsx:94-107` | The `specialCharges` and `miscCharges` filters let *void* celebration and laundry lines through (operator precedence), so voided items are listed on screen. | Filter `chargeStatus === 'posted'` first. | Unit on the filter. |

### 2.3 Bookings and inventory

| ID | Sev | Where | What is wrong and how it fails | Fix | Test |
|---|---|---|---|---|---|
| BK-01 | H | `lib/server/repos/bookings.ts:334-358` | A desk booking only checks for a clash on the *physical room*. It never checks category availability, so pending or confirmed **website** requests (which hold a category, not a room) are ignored. Failure: 1 suite left, a confirmed web request holds it, and the desk books the suite for a walk-in. Two guests now hold one suite. | In `upsertCrmBooking`, when the booking is created or its dates/room change, run `getAvailability(checkIn, checkOut, {excludeBookingId, excludeLinkedWebId: sourceBookingId})` under the same inventory lock. Refuse with "Held by web request SH-2K26…" and offer *Assign that request instead*. | Integration: a confirmed web request for the last suite, then a desk booking for any suite → 409. |
| BK-02 | H | `lib/server/repos/bookings.ts:128,145`; `components/crm/ManualBookingModal.tsx:179` | `linkedWebIds` drops the whole web request from availability as soon as **one** desk booking links to it. Failure: a 3-suite web request, the desk assigns room 1 ("assign the others separately"), and suites 2 and 3 are immediately sellable on the website. | Link per room: `booking_rooms(web_booking_id, index, crm_booking_id)`. Subtract only the linked rooms from the web request's `category_ids` count. Show "1 of 3 assigned" in the requests tray. | Integration: assign 1 of 3, and availability still shows 2 suites held. |
| BK-03 | H | `lib/server/repos/bookings.ts:117-121`; `components/crm/TapeChart.tsx:535-546` | Maintenance is a single *current* room flag. While it is set, `getAvailability` removes the room from inventory for **every date** (the website shows it sold out for December), and the tape chart paints every visible day as "Maintenance – Geyser Repair". This hides real bookings on that room. | Use dated blocks: `room_blocks(room_id, from, to, reason)`. Availability subtracts only overlapping blocks, and the tape chart draws them as bars. The room's current housekeeping state stays separate. | Integration: block room 2 on 10–11 Oct, and availability for 20 Dec is unchanged. |
| BK-04 | H | `components/crm/MasterBookingsList.tsx:492-509`; `components/crm/GuestCheckoutModal.tsx:443`; `lib/server/repos/bookings.ts:319-375` | *Inspect folio* / *View settled folio* opens the full checkout form for any booking. Submitting it on a **future** booking marks that booking `checked_out` and sets the room to `available` while another guest is in-house. On an already checked-out booking it records a second payment and checks out again. The server accepts any status change for desk bookings. | A server state machine: `hold → confirmed → checked_in → checked_out`, plus `cancelled` / `no_show` from hold or confirmed, and admin-only re-open. The checkout form appears only for `checked_in`, and the folio drawer is read-only otherwise. | Integration: `checked_out` on a `confirmed` booking → 409. UI: the folio drawer for a future booking has no checkout button. |
| BK-05 | M | `components/crm/MasterBookingsList.tsx:476-488`; `components/crm/TapeChart.tsx:684` | *Check-In Guest* shows for any booking not checked in, including stays weeks away and holds. One mis-tap on the wrong card checks in a December guest today, which opens their in-room services and marks the room occupied. | Show *Check in* only when `checkInDate ≤ today` (allow early with a confirm) and status ∈ {confirmed, hold}. The server enforces the same rule. | Integration: check-in of a stay starting tomorrow → 409 unless `early=true`. |
| BK-06 | M | `context/CRMContext.tsx:1313` | `rooms.find(…) \|\| rooms[0]`: if the selected room id doesn't match (stale list, deleted room), the booking silently goes to the first room. | Throw, and let the modal show "Pick a room". | Unit. |
| BK-07 | M | `lib/server/repos/bookings.ts:92` | Desk `hold` bookings never expire (only web holds have `hold_expires_at`). A forgotten tentative hold blocks the room forever. | Give desk holds an expiry (default 24 h, editable), with release by the same job and a "Holds expiring today" view. | Integration: an expired desk hold doesn't block availability. |
| BK-08 | M | `lib/server/repos/bookings.ts:406-420` | The in-room QR resolves a booking that arrives *tomorrow* (`check_in <= today+1`) as active, and celebrations and transfers allow `confirmed`. After guest A checks out, whoever is still in the room can scan the QR and order a ₹2,000 candlelight dinner onto guest B's folio. | The QR resolves only `checked_in` bookings for that room. Before check-in, the guest uses the portal (reference + phone). | Integration: QR session after A's checkout and before B's check-in → "Welcome, please see reception". |
| BK-09 | L | `lib/server/repos/bookings.ts:128` | If the desk booking linked to a web request is cancelled, the web request stays excluded from availability while its status is still `confirmed`. Inventory is released while the website shows a confirmed booking. | Count links only from active desk bookings. | Integration. |
| BK-10 | L | `app/api/checkin/route.ts:247-283` | Walk-in self-registrations are stored as `kind: 'web'`, `pending`, `total_price: 0`. They inflate "awaiting confirmation" counts and the AdminOverview booking totals. | Store them as `kind: 'walk_in_request'`, or as inquiries, and show them in the unassigned tray. | Unit on the counts. |

### 2.4 Tape chart

| ID | Sev | Where | What is wrong and how it fails | Fix | Test |
|---|---|---|---|---|---|
| TC-01 | M | `components/crm/TapeChart.tsx:132-137` | `getBookingForRoomDate` doesn't exclude `cancelled` or `checked_out` bookings, and returns only the first match. A guest who left a day early still occupies the room on the chart. A same-day turnover (A out, B in) shows only one of them. | Exclude inactive statuses. Clip early check-outs to `checkedOutAt` (IST date). Render half-cell arrivals and departures so A-out / B-in both show. | Unit on the layout function. |
| TC-02 | M | `components/crm/TapeChart.tsx:514-523` | The room status dropdown lets staff set a room to "In-House", "Confirmed" or "Hold" with no booking. `currentStatus` and bookings then disagree, and "Maintenance" here has the inventory side-effects in BK-03. | The room row shows housekeeping state only (clean / dirty / inspected / out of order). Occupancy is derived from bookings. Blocks are created as dated bars. | Integration: there is no API path to set `checked_in` on a room without a booking. |
| TC-03 | M | `components/crm/TapeChart.tsx:427-431` | The table is `min-w-[950px]` with a sticky first column `w-64`. On a 390 px phone, 256 px goes to the room label and about 1.3 days are visible. | Phone layout per §4.1 (an agenda list per room, or a 7-day compact grid with a 56 px label). | Playwright at 390 × 844: 7 days visible. |
| TC-04 | L | `components/crm/TapeChart.tsx:552` | "Out ↵" never renders: cells cover `[checkIn, checkOut)`, so `checkOutDate === dateKey` is never true. | The bar layout in §4.1 removes per-cell labels. | Unit: the bar layout for a 10→13 Oct stay returns one segment ending at the 13 Oct boundary, labelled with the departure. |
| TC-05 | L | `components/crm/TapeChart.tsx:55-60,100-105,433` | Dates come from the browser's local clock. On a laptop set to another timezone, "today" and the date keys are off by a day around midnight. | Use `todayInIST()` / `addCalendarDays` throughout. | Unit with `TZ=UTC`. |
| TC-06 | L | `components/crm/TapeChart.tsx:543,600-607` | Clicking an empty *past* cell opens a new booking for a past date. Maintenance always reads "Geyser Repair". | Disable past cells (admin back-dating only, with a reason). Show the block's own reason. | UI test: past cells are disabled for a manager; a block created with reason "Roof leak" shows "Roof leak". |

### 2.5 Master bookings list

| ID | Sev | Where | What is wrong and how it fails | Fix | Test |
|---|---|---|---|---|---|
| BL-01 | C | `components/crm/MasterBookingsList.tsx:69,89,114-120` | **Lead 1, confirmed.** The folio, food orders and dispatches are matched by `bookingId \|\| roomNumber`. The folio picked for an in-house guest can be a future guest's (see MF-01). *Every* order ever placed from that room (up to the 1,500 loaded) is counted in the guest's food count and fallback totals. The "Outstanding Dues" tile adds the wrong folio's balance. | Use the same `folioForBooking` / `ordersForBooking` selectors (by id), with server-computed list rows (§4.2). | Unit: a booking with no orders of its own shows 0 food orders even when the room has history. |
| BL-02 | H | `components/crm/MasterBookingsList.tsx:64-75` | "Outstanding Dues" excludes `checked_out` bookings, the only ones where an unpaid balance is a real receivable. It also includes cancelled, hold and future bookings, whose room charges were pre-posted (MF-11). Failure: a guest leaves owing ₹7,500 and the tile drops by ₹7,500. A December booking adds ₹18,900 "due". | Receivables = balance of folios for stays that have **started** (in-house or departed), not void. Future-stay balances show separately as "Due on arrival". | Unit on the summary function. |
| BL-03 | M | `components/crm/MasterBookingsList.tsx:122-127` | **Lead 6, confirmed.** With no folio, the totals fall back to `totalRoomAmount` (pre-GST) + order `totalAmount` + dispatch `quotedPrice` (incl. pending, no GST). The same booking then shows a different total once a folio exists. In practice desk bookings get a folio at creation, so this hits imported legacy bookings, folios beyond the 2,000-row state cap, and the window before sync. | No fallback: "No folio" badge + *Create folio*. | Unit. |
| BL-04 | L | `components/crm/MasterBookingsList.tsx:66 vs 86; 71 vs 91` | The pill counts disagree with the filtered lists. "Arriving today" excludes checked-in guests but the filter includes them. "Pending dues" excludes checked-out guests but the filter doesn't. | One predicate per saved view, used for both the count and the list. | Unit. |
| BL-05 | L | `components/crm/MasterBookingsList.tsx:54,99` | `todayStr` is memoised once, so a tab left open overnight shows yesterday's arrivals. Searching "98320 44556" (with a space) finds nothing. | Recompute today each minute. Normalise digits on both sides for phone search. | Unit. |
| BL-06 | L | `components/crm/MasterBookingsList.tsx:283-500` | Every booking from the last 120 days renders as a 180 px card with no pagination, which is slow and long on a phone. | A dense table with virtualised rows or pages (§4.2). | Playwright: 500 seeded bookings → first page renders 25 rows in < 500 ms; scrolling or paging loads the next 25. |

### 2.6 Expenses and day close

| ID | Sev | Where | What is wrong and how it fails | Fix | Test |
|---|---|---|---|---|---|
| EX-01 | C | `context/CRMContext.tsx:381-424,1045-1060` | `flushOps` removes ops from the queue *before* sending and never re-queues them. Offline, or on a 5xx, the change is dropped with a toast. Admins' screens are reverted by `refreshState`. **Managers can't read expenses**, so their failed expense *stays on screen as if saved*. Failure: the manager logs a ₹1,850 LPG cylinder in a no-signal kitchen and sees it in "Today", but the server never got it. | A durable outbox: IndexedDB queue with idempotency keys, retry with backoff, and a visible "2 waiting to sync" chip (§4.5). The server dedupes on `client_id`. | Integration: a POST with the same `client_id` twice gives one row. Unit: a failed flush leaves the op queued. |
| EX-02 | H | `lib/server/crm-sync.ts:59-66`; `app/expenses/page.tsx:34-37` | Expenses are readable only by admins. The Expense Logger's "Today" list for a manager therefore holds only what was logged *in this page session*. After closing the app it shows "No expenses logged today yet", so managers log the same bill again. | `GET /api/expenses?mine=1&from&to` for managers (their own entries, plus today's for the property if allowed). Keep amounts by other staff admin-only if needed. | Integration: a manager sees their entries after a reload. |
| EX-03 | H | `lib/server/day-close.ts:58-61` | Day-close "tax" sums only explicit `taxAmount` (room lines). Food, transport and misc GST is left out (**[proved P8]**: ₹250 reported vs ₹400 actual), and pending lines are counted as charges. The day-close GST figure understates the liability. | Day close calls the same summary function as the dashboard (§3.2). GST = Σ tax of posted lines by service date. | Unit: the day-close summary equals the dashboard summary for that date. |
| EX-04 | H | `lib/server/day-close.ts:85-89`; `lib/server/crm-sync.ts:137-175` | The "lock" covers only *new non-admin expenses*. (a) Payment `collectedAt` is set by the client device, so a manager can record a payment dated inside a closed day. (b) Admins can edit or delete expenses and payments in closed days with no trace in the snapshot. (c) Closing 9 Oct locks 8 Oct too (`lastClosedDate` is a max), even if 8 Oct was never closed, so it has no snapshot. The snapshot then disagrees with the live numbers. | The server stamps `collected_at`. Every money row has an `accounting_date` that must be > last closed date, unless it is an admin **adjustment** with a reason, dated today and referencing the closed day. Days close in order. | Integration: a payment with `collectedAt` inside a closed day is rejected. Closing 9 Oct with 8 Oct open → 409. |
| EX-05 | M | `components/crm/FinancialLedger.tsx:768` | Deleting an expense is one tap, with no confirm and no reason, and works even in closed days. | Soft-void with a reason, admin only, blocked in closed days (use an adjustment instead). | Integration: `DELETE` of an expense → 405; void without a reason → 400; void in a closed day → 403 for every role. |
| EX-06 | M | `components/crm/FinancialLedger.tsx:138`; `components/crm/QuickExpenseModal.tsx:86-100` | The name on an expense is whatever the client sends: "Admin – Tenzing" is hard-coded in the ledger form, and the quick logger has an editable name field. The server keeps `loggedByName` from the client. | Server-stamped `created_by` from the session. If "paid by" (who paid the cash) differs, record it as a separate field. | Unit on `applySyncOp`. |
| EX-07 | M | `components/crm/QuickExpenseModal.tsx:93-101`; `components/crm/FinancialLedger.tsx:685-688` | The quick logger is always dated today (yesterday's diesel can't be logged) and has no vendor, receipt or note. The ledger form takes a *receipt URL* typed by hand. | §4.5: date chip (Today / Yesterday / pick), vendor, camera receipt (Supabase Storage, private), note. | Integration: an expense dated yesterday with vendor and receipt saves, and the receipt is reachable only through a signed URL. |
| EX-08 | L | `context/CRMContext.tsx:671,1047` | Ids are `pay-${Date.now()}` and `exp-${Date.now()}`. Two devices in the same millisecond collide; for non-admins that is a 403, for admins an overwrite. | `crypto.randomUUID()` (already used elsewhere in the file). | Unit: 10,000 ids generated in the same millisecond are unique. |
| EX-09 | M | `lib/server/day-close.ts:40-42,63-66` | "Open folios / balance due" includes every unsettled folio, including future stays with pre-posted room charges (MF-11). It reads at most 5,000 folios and 5,000 expenses, so older days re-summarised later lose data. | SQL by date with no limits (S7). Receivables per BL-02's definition. | Integration: a seeded future-stay folio is excluded from `balanceDueOpen`; day close for a date with > 5,000 records still matches the SQL total. |
| EX-10 | L | `types/crm.ts:49-57`; `components/crm/QuickExpenseModal.tsx:29-40` | Categories are a hard-coded enum. "Staff Welfare" is filed under payroll, and "Laundry Services" under housekeeping. The owner can't add "Bank charges", "GST paid", "Commission (OTA)" or "Owner drawings". | Admin-editable `expense_categories` + sub-tags (§4.3). | Integration: an admin adds category "Bank charges", a manager can log under it, and an archived category is refused for new entries. |

### 2.7 Dashboards

| ID | Sev | Where | What is wrong and how it fails | Fix | Test |
|---|---|---|---|---|---|
| DB-01 | C | `components/crm/FinancialLedger.tsx:100-118` | **Lead 2, confirmed.** There is no date range: the totals cover every folio and expense currently loaded. Cancelled-stay folios and future stays are counted. "Total Revenue Collected" is payments (incl. GST). "Net Profit" = collections − expenses (**[proved P11]**: ₹6,500 shown vs ₹6,000 actual on a ₹10,000 + ₹500 GST stay with ₹4,000 expenses). The GST, a liability, is counted as profit. The room / F&B / add-on bars come from charges (accrual) while the headline is cash, so the two halves of the screen don't reconcile. | Replace with the dashboard in §4.4, built on `GET /api/reports/summary` and the definitions in §3.2. | Integration: summary for a range = Σ lines and payments in that range, and the dashboard tiles equal the summary. |
| DB-02 | H | `components/admin/AdminOverview.tsx:36-38,45` | **Lead 3, confirmed.** "Confirmed Revenue" = Σ `total_price` of confirmed/completed **website** requests: quotes incl. GST and add-ons, all time, excluding every desk booking and all F&B/transport. "Room Inventory a/b" shows a hand-edited `available_inventory` counter, not real availability. | Show the same KPI tiles as §4.4 (today and MTD), with real availability from `getAvailability(today, tomorrow)`. | Unit: the overview tiles equal the summary endpoint for the same range. |
| DB-03 | M | `components/crm/FinancialLedger.tsx:99-104`; `lib/folio.ts:27` | **Lead 5, confirmed.** Celebrations post as `miscellaneous` and fall into "Add-on" revenue together with transfers, rentals and laundry. There is no celebrations stream anywhere. The comment says "posted charges", but pending lines are included. | Add a `celebration` charge category, or a `stream` dimension on lines (§3.1). | Unit. |
| DB-04 | M | `lib/server/crm-sync.ts:237-245` | The ledger and bookings list compute from the CRM working set: folios capped at 2,000, expenses at 5,000, bookings at the last 120 days. "All-time" totals quietly shrink as data grows. | Reports are computed in SQL on the server and never from client state. | Integration: seed 2,500 folios; the summary for all time equals the SQL sum, not the 2,000-row working set. |
| DB-05 | M | `app/admin/page.tsx:231` | The orders badge counts status `pending`, but new orders are created `pending_manager_approval`. The badge stays at 0 while orders wait for approval. | Count `pending_manager_approval` + `pending`. | Unit. |
| DB-06 | L | `components/crm/FinancialLedger.tsx:490-500` | Folio amounts print raw (`₹1350.18`, `₹10500`) with no grouping. | Use one `formatINR` helper everywhere. | Unit: `formatINR(1350.18)` → "₹1,350.18"; `formatINR(10500)` → "₹10,500". |

### 2.8 Sync and state

| ID | Sev | Where | What is wrong and how it fails | Fix | Test |
|---|---|---|---|---|---|
| SY-01 | H | `context/CRMContext.tsx:759`; `lib/server/crm-sync.ts:49,237-244` | The activity log is loaded capped at 200, and `logManagerActivity` keeps `[new, …prev].slice(0,200)`. The diff therefore queues a **delete** of the oldest entry on every new action. For managers that delete is forbidden, so every check-in, approval or checkout after the 200th log shows "Your account does not have permission for this change." For admins it **permanently deletes** the oldest activity record. | Never derive deletes from a capped list: activity logs are append-only, written by the server as a side-effect of the action. Remove the client slice. | Unit: `queueSync` for activity logs never emits deletes. Integration: the 201st action by a manager succeeds silently. |
| SY-02 | M | `lib/server/crm-sync.ts:158-168` | Client timestamps are trusted: `collectedAt`, `postedAt`, `createdAt`, `checkedInAt`. A device clock that is 1 day slow puts today's cash into yesterday's (closed) day close. | Server stamps all event times. Client-supplied times are kept only as `client_at` for audit. | Integration: a payment posted with `collectedAt` = yesterday is stored with today's server `received_at` and `accounting_date`. |
| SY-03 | M | `lib/server/repos/bookings.ts:319-375` | Desk bookings are accepted with any `totalRoomAmount`, `roomRatePerNight`, `gstAmount` and `advancePaid`, unchecked. Booking amounts and folio lines are two copies that drift (editing `advancePaid` doesn't change the folio). | The booking keeps only stay facts. Money lives on the folio. Manual rates are posted as folio lines with `isManualRate` + reason + role check. | Integration: a booking upsert that changes `totalRoomAmount` without a folio op is refused, or leaves the folio unchanged. |
| SY-04 | L | `app/api/orders/route.ts:111-132` | `PATCH /api/orders` changes order status but skips `syncLinkedFolioCharge`, so a cancel through this path leaves the charge pending (and billed, MF-08). No UI calls it today. | Route all status changes through one server function. | Integration. |
| SY-05 | L | `context/CRMContext.tsx:364-376` | The whole working set (all folios with all lines, 1,500 orders) is fetched every 8 s per device. That is slow on hill-station mobile data and grows without bound. | Delta sync: `GET /api/crm/state?since=<cursor>` using `updated_at`, plus an ETag. | Integration: `GET /api/crm/state?since=<cursor>` returns only records updated after the cursor; payload < 20 KB when nothing changed. |

### 2.9 Expense PWA

| ID | Sev | Where | What is wrong and how it fails | Fix | Test |
|---|---|---|---|---|---|
| PW-01 | H | `public/sw.js:33-36`; `context/CRMContext.tsx:381-424` | "Offline" isn't supported: the service worker passes every `/api/` call through, and there is no outbox or background sync. See EX-01 for the data-loss consequence. | §4.5: IndexedDB outbox + `sync` event (Android) + retry on focus/online (iOS). | Playwright offline test. |
| PW-02 | M | `public/sw.js:1-5,39-52`; `app/expenses/layout.tsx` | The service worker pre-caches only `/` and `/manifest.json`. `/expenses` and its JS chunks are cached only after an online visit. A fresh install opened offline shows the site's home page (the navigate fallback is `/`). | Pre-cache the `/expenses` shell and its build chunks (Next build manifest), with an offline fallback for `/expenses`. | Lighthouse PWA "works offline". |
| PW-03 | M | `components/crm/QuickExpenseModal.tsx:29-40,80-110` | There is no receipt capture, no compression and no recent vendors, so logging a typical bill takes about 25–40 s and 6+ taps (open modal → category → amount → method → name → save). | §4.5 target: under 15 s, 3 taps. | Usability timing in acceptance criteria. |
| PW-04 | L | `public/expenses.webmanifest:12-23,24-29` | Icons declare `"purpose": "any maskable"` together, which crops the logo on Android. `related_applications` points at the manifest itself. | Separate `any` and `maskable` icons, and drop `related_applications`. | Lighthouse PWA audit: "maskable icon" passes; the manifest has no self-referencing `related_applications`. |

### 2.10 Permissions

| ID | Sev | Where | What is wrong and how it fails | Fix | Test |
|---|---|---|---|---|---|
| PM-01 | H | `lib/server/crm-sync.ts:69-84,163-166`; `components/crm/GuestCheckoutModal.tsx:56-69` | Non-admin folio rules cover only "don't change existing payments or posted amounts". A manager **can**: void any line, including the room charge, with no reason; set `discountAmount` to anything; change a line's category or `taxAmount`; create a brand-new folio with arbitrary payments; add a negative payment; and attribute a payment or checkout to another staff member (`collectedById` from the client is kept, and the checkout modal lets you pick any manager). Failure: void a ₹6,000 room line, collect cash, pocket it, and the audit names someone else. | Server ops with role limits (§5, F-12): voids and discounts need a reason. Managers have limits (e.g. discount ≤ 10% or ₹1,000, void only own lines within 30 min); above that, admin approval. The server stamps the actor. Payment amounts > 0, and refunds are a separate admin op. | Integration matrix per role. |
| PM-02 | M | `components/crm/FinancialLedger.tsx:88`; `context/CRMContext.tsx:554-557` | "Switch to Admin Role to View Financials" calls `setRole('admin')` for **any** signed-in user, bypassing the lock in `RoleSwitcher`. A manager then sees "Net Profit" computed with zero expenses (expenses are admin-only on the server), which is a misleading number. | `setRole` refuses roles above the signed-in account's. Remove the button for non-admins. | Unit. |
| PM-03 | L | `lib/server/crm-sync.ts:119-131` | Managers can rewrite an existing physical room's record, including `categoryId` and `qrSecretToken`. Changing the category changes inventory counts on the website. | Managers may change housekeeping fields only. Category and QR are admin-only. | Integration. |

### 2.11 UI and UX defects

| ID | Sev | Where | What is wrong and how it fails | Fix | Test |
|---|---|---|---|---|---|
| UX-01 | H | `components/crm/GuestCheckoutModal.tsx:489-496` | The "Amount to collect" `<input type="number">` has no `step`, so the default step is 1. A balance with paise, which is normal with 18% GST (e.g. ₹8,851.18), fails browser validation ("nearest valid values are 8851 and 8852"), and checkout cannot be submitted with the default amount. | `step="0.01"` `inputMode="decimal"`. Better, round folio totals to whole rupees with a "round-off" line, which is standard on Indian hotel bills (Q6). | Playwright: check out a paise balance. |
| UX-02 | H | `components/crm/FinancialLedger.tsx:880-886` | The "Record payment" field *displays* the balance (`value={paymentAmount \|\| balanceDue}`) while the state is empty, so pressing **Record Payment** without typing gives "Please enter a valid payment amount". `max={balanceDue}` blocks recording an overpayment, and step 1 blocks paise. | Initialise the state from the balance, `step="0.01"`, and no `max` (overpayment → credit, MF-07). | Playwright. |
| UX-03 | M | `components/crm/OperationsHub.tsx:73-78`; `context/CRMContext.tsx:1222` | Demo data is prefilled in production: the driver "Pemba Sherpa", phone +91 98320 44556 and plate "WB 74 D 4419" on every dispatch, and every turnover task assigned to "Dawa Lepcha". Staff confirm dispatches with a fake driver, and guests get a wrong number. | Empty fields plus recent drivers from a `vendors` list. Assign housekeeping from staff. | UI test: the dispatch form opens with empty driver fields; a turnover task is assigned to a real staff member or left unassigned. |
| UX-04 | L | `components/crm/GuestCheckoutModal.tsx:157-171` | Native `alert` / `confirm` calls block the UI and look like phishing on mobile browsers. | Inline confirm step. | Playwright: zero-collection checkout shows an inline confirm with a required reason; no `window.confirm` call (spy). |
| UX-05 | L | `components/crm/TapeChart.tsx:556-560,600-612` | Status is shown by colour only, and cell buttons have only a `title` (not read on touch or by screen readers). | Text or icon status in the bar, plus `aria-label` "Room 3, 12 Oct, Tashi, confirmed". | axe check. |
| UX-06 | L | `components/crm/TapeChart.tsx:405-407`; `components/crm/FinancialLedger.tsx:236-252` | The copy says one thing and means another: "Confirmed / Paid" for a status that says nothing about payment, and "Total Revenue Collected" for payments. | Use the §3.2 vocabulary everywhere. | Copy review against §3.2: no screen uses "revenue" for payments or "Paid" for a booking status (grep test over `src/components`). |

---

## 3. Money model and reconciliation

### 3.1 Money map (today)

How each rupee is created, where it lands, and which numbers include it. ✗ marks a gap or a double count.

**Money in**

| Money event | Created by | Category posted | Folio field | Ledger (`FinancialLedger`) | Day close (`day-close.ts`) | Bookings list | Admin overview |
|---|---|---|---|---|---|---|---|
| Room stay (desk booking) | `CRMContext.createManualBooking` `:1404-1470` | `room_tariff`, posted at **booking time**, tax via `apportionTax` | `totalRoomCharges` | Room bar (all time) ✗ includes future/cancelled stays | Charges on booking date ✗ (MF-11); tax ✓ | Net bill / dues ✗ wrong folio (BL-01) | ✗ not counted |
| Extra adult / child | same `:1423-1446` | `room_tariff` | `totalRoomCharges` | Room bar | as above | as above | ✗ |
| Website room request | `api/bookings` POST → `pms.bookings` kind `web` | none until converted | none | ✗ | ✗ | ✗ | **"Revenue"** = `total_price` incl. GST + add-ons ✗ (DB-02) |
| Website add-on (transfer, bike) | `api/bookings/route.ts:101-103` | none: text in `special_requests` ✗ | none ✗ | ✗ | ✗ | ✗ | inside `total_price` |
| Website deposit | `AdminBookings` `payment_status` flag | none ✗ (MF-04) | none | ✗ | ✗ | ✗ | ✗ |
| Desk advance | `createManualBooking:1450-1461` | `FolioPayment` (+ copy in `booking.advancePaid`) | `totalPaid` | Collections by method | Payments by `collectedAt` (client clock, SY-02) | Paid | ✗ |
| Dine-in order | `guest-services.placeFoodOrder` (QR, portal, staff) | `food_beverage` **pending** → posted on `accepted_kitchen` (`crm-sync.ts:194-214`) | `totalFbCharges` (pending included ✗ MF-08) | F&B bar (pending incl.) | Charges (pending incl.); **tax omitted** ✗ (EX-03) | Food count by room ✗ | ✗ |
| Celebration / special request | `guest-services.placeCelebration` | `miscellaneous` pending; stored as a `foodOrders` record `CEL-…` | `totalAddonCharges` | "Add-on" bar ✗ no own stream (DB-03) | Charges; tax omitted ✗ | ✗ | ✗ |
| Pre-arrival celebration / transfer on a web booking | same, with web booking id | on an **orphan folio**, room 0 ✗ (MF-06) | orphan | Counted (room 0) | Counted | ✗ never on the guest's bill | ✗ |
| Transfer | `guest-services.requestTransport` | `transport_transfer` pending → posted on dispatch | `totalAddonCharges` | Add-on bar | Charges; tax omitted ✗ | Dispatch count by room ✗ | ✗ |
| Vehicle rental | same | `vehicle_rental` | `totalAddonCharges` | Add-on bar | as above | as above | ✗ |
| Rental deposit | none ✗ (MF-21) | — | — | — | — | — | — |
| Laundry, minibar, damage, misc | **no code path** ✗ (MF-17) | (`laundry` / `miscellaneous` exist in the type) | — | — | — | — | — |
| Discount | **no UI** ✗ | `folio.discountAmount` (always 0) | reduces tax pro rata | — | ✗ not reported | — | — |
| Payment at checkout | `completeCheckoutWithSettlement:1144-1170` | `FolioPayment` | `totalPaid` (client double-count, MF-09) | Collections | Payments | Paid | ✗ |
| Payment from ledger | `addFolioPayment`, `settleFolio` | `FolioPayment` | `totalPaid` | Collections | Payments | Paid | ✗ |
| Refund / credit | **none** ✗ (MF-07) | — | clamped away | — | — | — | — |
| GST (output) | `folio.ts:31-32` per line | — | `totalTax` | ✗ folded into "collected" and into profit | Room tax only ✗ | in net bill | inside `total_price` |

**Money out**

| Money event | Created by | Category | Where it lands | Ledger | Day close | Dashboards |
|---|---|---|---|---|---|---|
| Expense (ledger form) | `FinancialLedger.handleCreateExpense` | `ExpenseMasterCategory` enum | `pms.records` `expenses` | `totalExpenses` (all time) | By `expenseDate`, by method | ✗ no category breakdown anywhere |
| Expense (quick modal, Expense app) | `QuickExpenseModal` → `addExpense` | fixed tag → enum | same | same | same | ✗ |
| Transport vendor fare | **none** ✗ (MF-18); a guessed `vendorCost` is stored on the dispatch only | — | — | — | — | "Est. commission" (fiction) |
| Refund to guest | **none** ✗ | — | — | — | — | — |

**Where the same figure is computed two or more ways**

| Figure | Ways it is computed today | Problem |
|---|---|---|
| Revenue | (1) Ledger: Σ folio charge totals, all time, pending included. (2) Day close: Σ non-void lines by *posting* date. (3) Admin overview: Σ web `total_price` (incl. GST, add-ons). (4) Bookings list "Net bill": folio `netPayable` or a GST-less fallback. | Four numbers, none of which is accrual revenue net of GST by service date. |
| Money collected | Ledger: Σ payments (all time). Day close: Σ payments by IST date of `collectedAt`. | The ledger has no range, and day close trusts the device clock. |
| GST | Folio: Σ tax of every line, discount-prorated. Day close: Σ `taxAmount` of room lines only. Invoice: `round(totalTax/2)` × 2, labelled 2.5%. | Three different GST numbers for the same day. |
| Amount due | Folio `balanceDue` (clamped ≥ 0). Bookings-list fallback `totalRoomAmount − advancePaid` (no GST). Day close `balanceDueOpen` (any non-settled folio, future stays included). | Receivables are overstated by future stays and understated by departed guests (BL-02). |
| Paid so far | Folio `totalPaid`. Invoice "Advance received" = `totalPaid \|\| booking.advancePaid`. | Same number, wrong label; `advancePaid` can drift from the folio. |
| Profit | Ledger: collections (incl. GST) − expenses. | Mixes cash basis with accrual-basis bars, and counts GST owed as profit. |

### 3.2 Definitions (one per term)

Every screen uses these words with exactly these meanings, and every figure is computed by **one** server function, `summarize(from, to)` in `lib/server/reports.ts`, over the tables in §3.4. "Posted line" means a folio line with status `posted` (not `pending`, not `void`). Dates are IST calendar dates.

| Term | Definition | Basis and date used | Shown on |
|---|---|---|---|
| **Revenue** (net of GST) | Σ taxable value of posted lines (amount − allocated discount), by stream. Excludes GST, advances, deposits and refunds. | Accrual, by line `service_date` (room nights: the night; F&B: order date; transfers: pickup date) | Dashboard KPI and stream chart; day close; folio drawer (per folio); owner digest |
| **Revenue streams** | `rooms` (room tariff + extra persons + meal plan), `dine_in`, `transport` (transfers), `rentals`, `celebrations` (incl. other special requests), `laundry`, `other` (misc, damages, late check-out fees go to rooms) | as above | Dashboard "Revenue by stream" |
| **GST collected** (output liability) | Σ `tax_amount` of posted lines, split by rate and into CGST/SGST (or IGST for an inter-state B2B buyer) | Accrual, by `service_date` | Dashboard KPI; day close; invoice; monthly GST report |
| **Billed** | Revenue + GST collected | Accrual | Folio total, invoice total |
| **Collections** | Σ payments of kind `payment` or `deposit` received, by method (cash / UPI / bank / card), **including** GST and advances | Cash basis, by `accounting_date` (server-stamped) | Dashboard KPI and by-method chart; day close; cashier shift |
| **Refunds** | Σ payments of kind `refund` (stored as positive amounts, subtracted) | Cash basis, by `accounting_date` | Dashboard (under Collections); day close |
| **Net collections** | Collections − Refunds | Cash | Day close "money in" |
| **Advances held** | Σ max(0, payments − billed) on folios whose stay has **not** started, plus rental deposits held | Balance as at end of range | Dashboard tile; bookings list "Advance" column |
| **Outstanding receivables** | Σ max(0, balance) on non-void folios whose stay **has** started (in-house or departed) | Balance as at end of range | Dashboard KPI; "Top outstanding folios"; bookings list "Balance due" saved view |
| **Credit owed to guests** | Σ max(0, −balance) on non-void folios | Balance as at end of range | Dashboard warning row; folio drawer |
| **Expenses** | Σ amount of approved, non-void expenses, by category (incl. input GST paid to vendors). Excludes owner drawings and GST paid to government (separate non-operating categories). | Cash basis, by `expense_date` | Dashboard KPI and category chart; expense manager; day close |
| **Net operating profit** | Revenue − Expenses (operating categories only) | Revenue accrual, expenses by date (stated in the tile's info tip) | Dashboard KPI |
| **Net cash flow** | Net collections − Expenses paid | Cash | Day close, cashier view |
| **Room-nights available** | Σ over nights of (active physical rooms − rooms with a block that night) | by night | Occupancy, RevPAR |
| **Room-nights sold** | Count of (room, night) on bookings `checked_in` / `checked_out`, plus confirmed for future reporting; complimentary stays counted separately | by night | Occupancy, ADR |
| **Occupancy** | Room-nights sold ÷ room-nights available | by night | Dashboard KPI; tape chart footer |
| **ADR** | Rooms revenue ÷ paid room-nights sold | by night | Dashboard KPI |
| **RevPAR** | Rooms revenue ÷ room-nights available (= ADR × occupancy) | by night | Dashboard KPI |

Folio-level terms: **net payable** = Σ posted line amounts − discount + Σ tax; **paid** = Σ payments − Σ refunds; **balance** = net payable − paid (signed: negative is credit owed); **pending** = Σ pending lines (shown separately, never in the balance). The website quote for a web request is called a **quote**, never "revenue".

### 3.3 Reconciliation identities

Each identity becomes a unit or integration test, and a nightly check (`GET /api/admin/reconcile`, admin-only) lists any violation on the dashboard.

| # | Identity | Enforced by |
|---|---|---|
| R1 | Line: `amount = round2(qty × unit_price)`; `tax_amount = round2((amount − line_discount) × tax_rate / 100)`; rate frozen at posting | DB check constraint + `lib/folio.ts` unit tests |
| R2 | Folio: `net_payable = Σ posted amount − discount + Σ posted tax` | Computed in SQL view `v_folio_totals`; no stored totals |
| R3 | Folio: `balance = net_payable − Σ payments(payment, deposit) + Σ refunds`; `status = settled ⇔ balance = 0 ∧ stay ended`; `void` is never changed by recalculation | Unit test + DB trigger on status |
| R4 | Every order, celebration and dispatch with a charge has exactly one folio line with `source_id` = its id; order cancelled ⇔ line void | Unique index `(source_type, source_id)` on lines + integration test |
| R5 | Σ revenue by stream = revenue; Σ collections by method = collections | Unit test on `summarize` |
| R6 | Day close for date d = `summarize(d, d)` at close time; afterwards only *adjustment* rows (with `adjusts_date = d`) may change d's numbers | Server rule + test that closed-date inserts are refused |
| R7 | Dashboard, ledger, owner digest and day close for the same range return identical figures | All call `summarize`; snapshot test compares endpoints |
| R8 | Balance roll-forward: Σ balances(end) = Σ balances(start) + billed(range) − net collections(range) | Integration test over a seeded month |
| R9 | Cash: opening float + cash collections − cash refunds − cash expenses − cash banked = expected drawer; counted − expected = variance | Cashier shift close (F-07) |
| R10 | Invoice total = folio net payable at finalisation; invoice numbers gap-free within a financial year | Counter in the same transaction + test |
| R11 | Web quote = desk folio billed on conversion (same rooms, nights, plan, ages, add-ons) unless a manual rate with a reason is recorded | `check:pricing` desk case |

### 3.4 Target data model

**Is `pms.records` JSON the source of the inconsistencies?** Yes, for money. Folios store their own totals beside the lines (denormalised), any device can rewrite the whole document (MF-02), there are no foreign keys from orders, dispatches or bookings to folios (so screens join by room number, BL-01), there is no per-line row to date, sum or lock, and reports have to load documents into the browser (DB-04). Bookings, rooms and staff already have real tables. Money should too. Catalogues (menu, routes, vehicles), housekeeping and alerts can stay in `pms.records`.

```sql
-- supabase/migrations/2026110100_money_tables.sql (sketch)
create table pms.folios (
  id text primary key,
  booking_id text not null references pms.bookings(id),
  kind text not null default 'primary' check (kind in ('primary','split','master','booking_advance')),
  parent_folio_id text references pms.folios(id),          -- group/master folio
  status text not null check (status in ('open','settled','void')),
  bill_to_name text, bill_to_gstin text, bill_to_state text, -- B2B invoice
  discount_amount numeric(12,2) not null default 0,
  version int not null default 1,
  opened_at timestamptz not null default now(), closed_at timestamptz,
  created_by text not null
);
create unique index folios_one_primary on pms.folios(booking_id) where kind = 'primary';

create table pms.folio_lines (
  id text primary key,
  folio_id text not null references pms.folios(id),
  stream text not null check (stream in ('rooms','dine_in','transport','rentals','celebrations','laundry','other')),
  description text not null,
  qty numeric(10,2) not null default 1, unit_price numeric(12,2) not null,
  amount numeric(12,2) not null,
  tax_rate numeric(5,2) not null, tax_amount numeric(12,2) not null, sac_hsn text,
  service_date date not null,                                -- revenue date
  status text not null check (status in ('pending','posted','void')),
  source_type text, source_id text,                          -- food_order | celebration | transport | booking_night | manual
  reverses_line_id text references pms.folio_lines(id),
  posted_at timestamptz not null default now(), posted_by text not null,
  void_reason text, voided_by text, voided_at timestamptz,
  accounting_date date not null                              -- server: IST date of posting; > last closed day
);
create unique index folio_lines_source on pms.folio_lines(source_type, source_id) where source_type <> 'manual';
create index folio_lines_service on pms.folio_lines(service_date) where status = 'posted';

create table pms.folio_payments (
  id text primary key,
  folio_id text not null references pms.folios(id),
  kind text not null check (kind in ('payment','deposit','deposit_release','refund')),
  method text not null check (method in ('cash','upi','bank_transfer','card','payment_link')),
  amount numeric(12,2) not null check (amount > 0),
  reference text, note text,
  received_at timestamptz not null default now(), accounting_date date not null,
  received_by text not null, shift_id text, client_id text unique
);

create table pms.expense_categories (id text primary key, name text not null, parent_id text references pms.expense_categories(id),
  is_operating boolean not null default true, monthly_budget numeric(12,2), sort int not null default 0, is_active boolean not null default true);
create table pms.vendors (id text primary key, name text not null, phone text, gstin text, upi_id text,
  default_category_id text references pms.expense_categories(id), is_active boolean not null default true);
create table pms.expenses (
  id text primary key, expense_date date not null, accounting_date date not null,
  category_id text not null references pms.expense_categories(id), sub_tag text,
  vendor_id text references pms.vendors(id), amount numeric(12,2) not null check (amount > 0), input_tax numeric(12,2) default 0,
  method text not null, paid_by text, note text, receipt_file_id text references pms.files(id),
  status text not null default 'approved' check (status in ('pending_approval','approved','rejected','void')),
  approved_by text, recurring_id text, payable_id text, client_id text unique,
  created_by text not null, created_at timestamptz not null default now(), void_reason text);
create table pms.recurring_expenses (id text primary key, category_id text not null references pms.expense_categories(id), vendor_id text references pms.vendors(id),
  amount numeric(12,2) not null, day_of_month int not null check (day_of_month between 1 and 28), method text, note text, active boolean default true, next_due date not null);
create table pms.budgets (category_id text references pms.expense_categories(id), month date, amount numeric(12,2) not null, primary key (category_id, month));
create table pms.vendor_payables (id text primary key, vendor_id text not null references pms.vendors(id), source_type text, source_id text,
  amount numeric(12,2) not null, due_date date, status text not null check (status in ('open','paid','void')), expense_id text references pms.expenses(id));
create table pms.invoices (id text primary key, number text not null unique, fy text not null, folio_id text not null references pms.folios(id),
  issued_at timestamptz not null default now(), issued_by text not null, buyer jsonb, totals jsonb not null, cancelled_by_invoice_id text);
create table pms.day_closes (date date primary key, snapshot jsonb not null, closed_by text not null, closed_at timestamptz not null default now());
create table pms.room_blocks (id text primary key, physical_room_id text not null references pms.physical_rooms(id),
  from_date date not null, to_date date not null, reason text not null, created_by text not null, check (to_date > from_date));
create table pms.booking_rooms (web_booking_id text references pms.bookings(id), room_index int, crm_booking_id text references pms.bookings(id),
  primary key (web_booking_id, room_index));
```

Room nights are posted one line per night (by the night-audit job, or upfront with future `service_date`s and status `posted`; both work with `service_date` reporting). Food orders, celebrations and transport requests can stay in `pms.records` for now, because lines link to them by `source_id`. Moving them to tables is a later, separate slice.

**Migration and back-fill (slice S7)**

1. **Create the tables** (idempotent migration). Seed `expense_categories` from the current enum and quick tags, mapping "Staff Welfare" → Staff welfare and "Laundry Services" → Laundry (vendor).
2. **Back-fill script** `scripts/backfill-money.ts`, dry-run by default, `--apply` to write, idempotent with `on conflict do nothing`:
   - **Folios.** Each folio record becomes a `folios` row. Orphan folios whose `bookingId` is a web booking are re-pointed to the linked desk booking where one exists, otherwise kept and listed in the report.
   - **Charge lines.** Each charge becomes a `folio_lines` row with stream mapped from category. Celebrations are detected by `sourceReferenceId` starting `ord-cel-`. Tax uses the stored `taxAmount`, else the rate from the GST config at migration time, with the rate written to the line. Room lines are split into per-night rows using the booking's dates and the engine's nightly breakdown, with `service_date` = night. `accounting_date` = IST date of `postedAt`.
   - **Payments.** Each payment becomes a `folio_payments` row with `accounting_date` = IST date of `collectedAt`, and `received_by` from `collectedById`.
   - **Expenses.** Each expense becomes an `expenses` row with the category mapped and `created_by` from `loggedById`, else the name.
   - **Report.** For every folio, old `netPayable` vs new `v_folio_totals.net_payable`. For every closed day, the old snapshot vs `summarize(d, d)`. Every mismatch is listed with its reason (pending lines, clamped balances, tax re-rate). Mismatches are expected because of the bugs above; the owner signs off the list.
3. **Read path first.** `/api/crm/state` composes the old `GuestFolio` JSON shape from the tables (an adapter), so the existing screens keep working.
4. **Write path cutover.** New folio ops (MF-02) write only to the tables. `crm/mutate` refuses `folios` and `expenses` upserts with 409 "Please refresh". Do the cutover in a quiet morning slot right after day close.
5. **Keep the old JSON.** Leave the `pms.records` folios and expenses read-only for 30 days, then archive them to a `pms.records_archive` table.

### 3.5 Assumptions used where the code cannot decide

These assumptions shape the model above. Each one is listed as a question for the owner in §7.

- Room tariffs are entered **excluding** GST (the default `tariffsIncludeGst: false`). Menu, celebration and transport prices are also excluding GST (the folio adds GST today). Q2, Q3.
- Transfers and rentals are sold **as principal**: the guest pays Savera, Savera pays the driver, revenue is the full fare and the driver's fare is an expense. Q7.
- Advances are **refundable less a cancellation fee** set by policy. Until the policy exists, a cancellation leaves the advance as a credit for an admin to refund or retain. Q4.
- Meal-plan components (CP/MAP/AP) are part of the room supply (rooms stream, accommodation GST slab), as the engine taxes them today. Q8.
- Savera is a regular GST-registered taxpayer (not composition), so it charges GST on invoices. Q1.

### 3.6 Leads from the brief: verdicts

| Lead | Verdict | Evidence |
|---|---|---|
| 1. `getBookingBreakdown` attaches other guests' folios and orders by room number | **Confirmed**, and worse than stated: the same OR-match is in **checkout** itself, so payments move to the wrong folio | `MasterBookingsList.tsx:69,89,114-120`; `GuestCheckoutModal.tsx:47-50,123,133`; `CRMContext.tsx:1141`; P7 |
| 2. `FinancialLedger` has no date range, includes void folios, and profit mixes collections incl. GST with expenses | **Confirmed.** No folio is ever set `void` today; cancelled stays are simply never voided (MF-10), so they are always included | `FinancialLedger.tsx:100-118`; P11 |
| 3. `AdminOverview` revenue = website quotes | **Confirmed** (incl. GST and add-ons, web only, all time) | `AdminOverview.tsx:36-38` |
| 4. `balanceDue` clamped at 0; `advancePaid` double count | **Clamp confirmed** (P1). **Double count refuted:** the desk advance becomes exactly one `FolioPayment` (`CRMContext.tsx:1450-1461`). Screens fall back to `booking.advancePaid` only when there is no folio, and never add the two. Two real problems remain: the copy on the booking can drift from the folio (SY-03), and website deposits never become payments at all (MF-04). | `folio.ts:35`; `GuestCheckoutModal.tsx:407,765`; `MasterBookingsList.tsx:126` |
| 5. Celebrations' category and whether they appear in any breakdown | **Confirmed.** They post as `miscellaneous`, are hidden inside "Add-on revenue", print twice on the invoice, and get orphaned before arrival | `guest-services.ts:184`; `folio.ts:27`; DB-03, INV-01, MF-06 |
| 6. Bookings list falls back to quoted order/dispatch prices before a folio exists | **Confirmed in code.** It is rare in practice, because desk bookings open a folio at creation; it shows for imported legacy bookings and folios beyond the 2,000-row state cap | `MasterBookingsList.tsx:122-127`; BL-03 |

---

## 4. Redesigns

Shared conventions for all five surfaces:

- **Stack and look.** Tailwind with the existing tokens (`forest-*`, `sand-*`, `#C5A059` gold, `#C85A32` terracotta), lucide icons, and the existing toast.
- **Data.** Every money figure comes from the server (`summarize`, folio views). The browser never adds money up.
- **Actions.** Every action is a server op, not a document upsert.
- **Phone.** Every surface is designed for a 390 px phone first. Tap targets are at least 44 px, and primary actions sit in the bottom thumb zone.

Two direction notes:

- **Expense manager and Expense PWA.** These should be **one module with two layouts** (desktop table and phone logger) over the same `expenses` API, rather than two products. The two designs are given separately below as asked.
- **Ledger.** The current Ledger's "Unified folios" tab should be **retired into the bookings list drawer**, and its analytics tab replaced by the dashboard. Otherwise the same money is shown in three places again.

### 4.1 Tape chart

**Who, where, top jobs.**

- **Users.** Front-desk managers on the shared desk laptop (all day) and on their phones (on the floor). The owner checks it on his phone.
- **Jobs:**
  1. See who is where tonight and the next 2 weeks, and spot free rooms.
  2. Put a website request or a walk-in into a room, or move or extend a stay.
  3. Check guests in or out and block a room for repairs.

**What is wrong today:**

- It is a 10-day per-night cell grid with no bars, no occupancy row, no zoom and no drag (`TapeChart.tsx:90-98,524-627`).
- Website requests are not on the chart, so they can't be assigned from it.
- Maintenance paints every day and hides bookings (BK-03).
- Cancelled and checked-out stays still occupy cells (TC-01).
- Room status can be set by hand, independent of bookings (TC-02).
- It is unusable at 390 px (TC-03).
- It uses browser-local dates (TC-05).

**Desktop (≥ 1024 px), 14-day zoom**

```
┌ Tape chart ─────────────────────────────────────────────────────────────────────────────────────────┐
│ ◀  Today  ▶   9 Oct – 22 Oct 2026      Zoom [7][14][30]   Category [All ▾]   Search guest/ref…   + New │
├──────────────┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┤ ┌ Unassigned (3) ──────────┐
│ Room         │Fr9│Sa10│Su11│Mo12│Tu13│We14│Th15│Fr16│Sa17│Su18│Mo19│Tu20│We21│Th22│ │ SH-2K26 10014  web·pending│
│              │ ▼ today                                                     │ │ Deluxe ×1 · 12–14 Oct    │
├──────────────┼─────────────────────────────────────────────────────────────┤ │ Riya S · ₹9,450 quote    │
│ 101 Deluxe ● │███ Tashi D · CP ██████▶│◀██ Ankit (in 10) ███│              │ │ hold expires 18:40  ⠿drag │
│   clean      │  in-house · ₹2,100 due  │  confirmed · adv ₹3k │              │ ├──────────────────────────┤
│ 102 Deluxe ● │        ░░ HOLD Mehta ░░│                      │▒▒ BLOCK ▒▒▒│ │ SH-2K26 10015  web·conf  │
│   dirty      │        exp. today 18:00│                      │ geyser     │ │ Suite ×3 · 1 of 3 assigned│
│ 201 Suite  ● │                         │███ Rao ×4 · MAP ███████████████│ │ Walk-in · Kumar · tonight│
│ …            │                                                             │ └──────────────────────────┘
├──────────────┼─────────────────────────────────────────────────────────────┤
│ Occupancy    │ 71% 86% 100% 57% 43% 43% 57% 71% 86% 100% 29% 14% 14% 29%    │  Legend: ███ in-house  ███ confirmed
│ Free rooms   │  2   1   0    3   4   4   3   2   1   0    5   6   6   5     │          ░░ hold  ▒▒ block  ● housekeeping
└──────────────┴─────────────────────────────────────────────────────────────┘
```

**Phone (390 px): "Rooms" agenda (default) with a 7-day strip**

```
┌──────────────────────────────┐
│ Tape chart        Fri 9 Oct ▾│
│ [Today][7d][14d]   ⚑ 3 unassigned
│ M T W T F S S   ← swipe →    │
│ ▇ ▇ █ ▅ ▃ ▃ ▅  occupancy      │
├──────────────────────────────┤
│ 101 Deluxe        ● clean    │
│ ▌Tashi D  in-house · out 10  │
│   ₹2,100 due        [Check out]
│ ▌Ankit    arrives 10 → 13    │
├──────────────────────────────┤
│ 102 Deluxe        ● dirty    │
│ ░ Hold Mehta · expires 18:00 │
│   [Confirm] [Release]        │
│ ▒ Block 16–18 Oct · geyser   │
├──────────────────────────────┤
│ 201 Suite         ● clean    │
│   Free tonight     [+ Book]  │
└──────────────────────────────┘
│  Chart   Bookings  Orders  ₹ │  ← existing BottomNav
```

On the phone, the 7d/14d toggle switches to a compact grid: a 56 px room label column, days 40 px wide, bars without text, and a tap opens the drawer.

**Information hierarchy**

1. Today line and tonight's state.
2. Bars by status: in-house dark forest; confirmed emerald; hold amber, striped; block rose, hatched; departed grey outline for the past only.
3. Balance due badge on in-house bars.
4. Occupancy and free-rooms footer.
5. Unassigned tray.

**Key interactions**

- **Click an empty cell** (today or later) to open the new booking modal, prefilled with the room and date. Drag across cells to set the dates.
- **Drag a bar body** to another room (same dates). **Drag the bar's right edge** to extend or shorten. On drop:
  - the client calls `POST /api/bookings/:id/move` with `dryRun=true`;
  - the server checks room clash + category availability + blocks + minimum stay, and re-prices;
  - a confirm sheet shows "Move Ankit 101 → 102, 10–13 Oct. Price unchanged" or "+₹1,800 (season night) – keep old rate / apply new rate";
  - **Confirm** commits the move and posts or voids the room-night lines.
- **Drag a request** from the Unassigned tray onto a room row to open the conversion modal (MF-04/05/06 conversion, carrying the deposit, add-ons and child ages). For multi-room requests, the tray card stays with "2 of 3 left".
- **Block a room:** select cells with the modifier (desktop) or long-press (phone), then "Block for repairs", reason required. This creates a `room_blocks` row.
- **Keyboard:** ← → move by a day, T today, 7/1/3 zoom, / search, N new.
- **Phone:** long-press a bar for Move/Extend (a sheet with date and room pickers instead of dragging). Swipe to change the week.

**States**

- **Loading:** skeleton rows sized to the room count.
- **Empty (no rooms):** "Add rooms in Settings → Rooms".
- **Error:** a banner "Couldn't refresh – showing data from 10:42" + Retry. The chart stays usable read-only.
- **Conflict on drop:** the bar snaps back, and a toast names the clashing guest.

**Roles**

- **Admin:** everything, including back-dated changes with a reason.
- **Manager:** everything except past-date edits and deleting blocks created by an admin.
- **Kitchen:** no tape chart. They get a read-only "Rooms in-house" list with guest first name and dietary notes.

**Data and API**

- `GET /api/tapechart?from&to` returns rows `{room, housekeeping, segments[{type: booking|hold|block, id, from, to, label, status, balanceDue}], occupancyByNight[], unassigned[]}`, computed on the server from `bookings`, `room_blocks`, `booking_rooms` and `v_folio_totals`. It supports ETag polling every 15 s.
- `POST /api/bookings/:id/move {roomId, checkIn, checkOut, dryRun, rateChoice}`
- `POST /api/room-blocks`, `DELETE /api/room-blocks/:id`
- `POST /api/web-bookings/:id/assign {roomIndex, roomId}` (conversion, S5)

**Acceptance criteria**

- [ ] The 7/14/30-day zooms render 7 rooms × 30 days in < 300 ms on the desk laptop. On a 390 px phone, 7 days are visible without horizontal page scroll.
- [ ] Cancelled and no-show stays never appear. An early departure ends on its actual check-out date. Same-day turnovers show both guests.
- [ ] A room blocked 16–18 Oct shows the block only on those nights, and `/api/availability` for 20 Dec is unchanged.
- [ ] Dragging a stay onto an occupied room is refused before commit, naming the other guest. A move that changes the price shows the difference and requires a choice.
- [ ] A 3-room web request shows in the tray until all 3 are assigned, and availability counts unassigned rooms as held.
- [ ] The footer occupancy for a night = sold ÷ available, as defined in §3.2, and equals the dashboard's occupancy for that night.
- [ ] Every bar has an accessible label, and status is shown by text or icon as well as colour.

### 4.2 Master bookings list and booking drawer

**Who, where, top jobs.**

- **Users.** Managers at the desk; the owner on his phone.
- **Jobs:**
  1. Find a booking by name, phone or reference and see what they owe.
  2. Work today's arrivals and departures.
  3. Chase balances due and pending website requests.

**What is wrong today:**

- Folios, orders and transfers are linked by room number (BL-01).
- Dues exclude departed guests and include future stays (BL-02).
- Counts disagree with the filters (BL-04).
- There are tall cards with no pagination (BL-06).
- *Inspect folio* opens a live checkout form for any booking (BK-04).
- Check-in is offered for future stays (BK-05).
- There is no audit history, no source column and no bulk actions.

**Desktop**

```
┌ Bookings ─────────────────────────────────────────────────────────────────────────────────────────┐
│ Saved views: [Arriving today 3] [In-house 5] [Departing today 2] [Balance due 4 · ₹18,250]          │
│              [Web requests 2] [Holds expiring 1] [All]                         + New booking        │
│ 🔍 name / phone / SH-ref / room      Dates [Stay overlaps ▾ 1–31 Oct]  Source [All ▾] Status [▾]    │
├───┬──────────────┬──────────────────┬──────┬────────────┬─────────┬────────┬─────────┬──────────────┤
│ ☐ │ Ref          │ Guest            │ Room │ Stay       │ Status  │ Source │ Billed  │ Balance      │
├───┼──────────────┼──────────────────┼──────┼────────────┼─────────┼────────┼─────────┼──────────────┤
│ ☐ │ SH-2K2610031 │ Tashi Dorjee  📱 │ 101  │ 7→10 Oct 3n│ In-house│ Desk   │ ₹11,340 │ ₹2,100 due ▸ │
│ ☐ │ SH-2K2610034 │ Ankit Rao     📱 │ 101  │10→13 Oct 3n│ Arriving│ Web    │  ₹9,450 │ adv ₹3,000   │
│ ☐ │ SH-2K2610029 │ P. Mehta         │ 102  │ 9→11 Oct   │ Hold ⏱18│ Phone  │  ₹6,300 │ —            │
│ ☐ │ SH-2K2609102 │ S. Ghosh         │ 201  │ 2→5 Oct    │ Departed│ OTA    │ ₹23,600 │ ₹7,500 due ⚠ │
└───┴──────────────┴──────────────────┴──────┴────────────┴─────────┴────────┴─────────┴──────────────┘
  2 selected: [Send WhatsApp reminder] [Export CSV] [Mark no-show]                        1–25 of 132 ›
```

**Booking drawer** (right side on desktop, full screen on phone), opened by clicking a row:

```
┌ Tashi Dorjee · SH-2K2610031 ───────────────────────────── ✕ ┐
│ Room 101 Deluxe · 7 → 10 Oct (3n) · CP · 2A 1C(4y free)       │
│ In-house · checked in 7 Oct 13:05 by Pema                     │
│ [Check out] [Add charge] [Take payment] [Move/extend] [⋯]     │
├ Folio FOL-… ─────────────────────────────────────────────────┤
│ Rooms     7 Oct  Deluxe CP            4,500   GST 5%   225    │
│           8 Oct  Deluxe CP            4,500   GST 5%   225    │
│           9 Oct  Deluxe CP (season)   5,400   GST 5%   270    │
│ Dine-in   8 Oct  ORD-1042 2× thali      700   GST 5%    35    │
│ Celebr.   9 Oct  Cake (CEL-1007)      1,000   GST 5%    50    │
│ Pending   9 Oct  ORD-1049 momos  ⏳     260   (not billed)     │
│ ───────────────────────────────────────────────────────────── │
│ Subtotal 16,100 · Discount −0 · GST 805 · Total 16,905        │
│ Paid  UPI 7 Oct 3,000 · Cash 9 Oct 11,805   Balance ₹2,100    │
├ Timeline ────────────────────────────────────────────────────┤
│ 9 Oct 21:14 Order ORD-1049 placed via room QR (pending)       │
│ 9 Oct 19:02 Cash ₹11,805 received by Pema                     │
│ 7 Oct 13:05 Checked in by Pema · ID verified                  │
│ 5 Oct 10:20 Web request SH-2K… assigned to 101 by Sonam       │
├ Guest ─ phone, ID (masked), preferences, 2nd stay ★ ─────────┤
└───────────────────────────────────────────────────────────────┘
```

**Phone list**

```
┌──────────────────────────────┐
│ Bookings              + New  │
│ 🔍 name, phone, ref          │
│ [Arriving 3][In-house 5][Due 4]→
├──────────────────────────────┤
│ Tashi Dorjee        101      │
│ 7→10 Oct · In-house          │
│ ₹2,100 due           ›       │
├──────────────────────────────┤
│ Ankit Rao           101      │
│ 10→13 Oct · Arriving · Web   │
│ Advance ₹3,000       ›       │
├──────────────────────────────┤
│ S. Ghosh            201  ⚠   │
│ Departed 5 Oct · ₹7,500 due  │
│ [WhatsApp reminder]          │
└──────────────────────────────┘
```

**Information hierarchy.** Status and balance are the two things scanned first. Billed and balance are server figures from `v_folio_totals` (§3.2 *billed*, *balance*). The source (Web, Desk, Phone, OTA, Walk-in) is a column, because the owner asks "where do guests come from".

**Saved views** (one predicate each, used for both the count and the list):

- *Arriving today*: check-in = today, status confirmed or hold.
- *In-house*: checked_in.
- *Departing today*: check-out = today, checked_in.
- *Balance due*: stay started, balance > 0, folio not void. This is the §3.2 receivables definition.
- *Web requests*: unassigned web bookings, pending or confirmed.
- *Holds expiring*: hold expiry within 24 h.
- *All*.

**Interactions**

- Search matches name (diacritics-insensitive), phone (digits only, last 10) and reference (ignore dashes).
- Filters persist in the URL.
- **Bulk actions:**
  - WhatsApp payment reminder, which opens `wa.me` links one by one until F-09 ships;
  - export CSV;
  - mark no-show (admin, with confirm).
- **Drawer actions** depend on state:
  - *Check in* only on arrival day (early with a confirm);
  - *Check out* only when in-house;
  - *Take payment* any time;
  - *Add charge*, *Discount* and *Void line* are role-limited (PM-01);
  - *Cancel* / *No-show* only before check-in.

**States**

- **Loading:** a skeleton table.
- **Empty view:** a friendly line plus a link to *All*.
- **Error:** a banner + Retry.
- **Stale data** (older than 60 s): a grey "Updated 10:42" chip.

**Roles**

- **Admin:** all.
- **Manager:** all except void or discount above limits, refunds, and re-opening a checked-out booking.
- **Kitchen:** none.

**Data and API**

- `GET /api/bookings/list?view&q&from&to&source&status&cursor` returns rows with `billed`, `paid`, `balance`, `pending`, `source`, `flags`. It is one SQL query joining `bookings` × `v_folio_totals`, paginated 25 at a time.
- `GET /api/bookings/:id` returns the drawer: booking, folio lines, payments, timeline (from `audit_log` and activity), and guest profile.
- Folio ops from MF-02.
- `POST /api/bookings/:id/checkin`, `/checkout`, `/cancel`, `/no-show` (state machine, BK-04).

**Acceptance criteria**

- [ ] For every booking, the drawer's folio lines are exactly the lines whose `folio.booking_id` = the booking. A previous guest's order in the same room never appears.
- [ ] The view counts equal the number of rows in each view.
- [ ] The "Balance due" total equals the dashboard's *Outstanding receivables* for the same as-of date.
- [ ] The checkout button is absent unless the booking is in-house. Submitting a paise balance works.
- [ ] Search "98320 44556", "9832044556" and "+91-98320-44556" all find the guest.
- [ ] 500 bookings paginate, and the first page renders in < 500 ms on the desk laptop.

### 4.3 Expense manager (desktop, admin)

**Who, where, top jobs.**

- **Users.** The owner (admin) on laptop or phone, weekly and at month end. The accountant receives a CSV.
- **Jobs:**
  1. See what was spent this month by category against budget.
  2. Approve, correct or void entries and attach receipts.
  3. Manage categories, vendors and recurring costs (salaries, electricity, internet), and export for the accountant.

**What is wrong today:**

- Expenses are a tab inside the ledger with a fixed enum (EX-10) and a typed receipt URL (EX-07).
- Deletion is one tap (EX-05).
- There are no vendors, budgets, recurring entries, approvals or export.
- Day-close locks are bypassed by admins (EX-04).
- Managers can't see their own entries (EX-02).

**Desktop**

```
┌ Expenses ─ October 2026 ◀ ▶ ────────────────────────── [+ Expense] [Recurring] [Categories] [Export CSV] ┐
│ Spent ₹1,84,300 of ₹2,10,000 budget (88%) · Due this week: Electricity ₹6,200 (12 Oct), Driver Raju ₹4,200│
├ By category ───────────────────────────────────────┬ Needs attention ─────────────────────────────────────┤
│ Groceries      ██████████████░░  48,200 / 55,000   │ ⏳ 2 awaiting approval (₹14,500)  [Review]           │
│ Staff payroll  ████████████████  72,000 / 72,000   │ 📎 5 without receipt (₹6,840)                       │
│ Utilities      ████████░░░░░░░░  18,600 / 30,000   │ 🔁 Internet (₹1,499) due 15 Oct – not yet logged    │
│ Maintenance    ██████████████▲▲  21,400 / 15,000 ⚠ │                                                     │
│ Transport vendor ███████░░░░░░░  14,100 / 20,000   │                                                     │
├────────────────────────────────────────────────────┴─────────────────────────────────────────────────────┤
│ Date ▾ │ Category › sub-tag      │ Vendor          │ Note            │ Method │ Amount  │ 📎 │ By    │ ⋯ │
│ 9 Oct  │ Groceries › Vegetables  │ Kalimpong Haat  │ weekly veg      │ Cash   │  2,350  │ 📎 │ Pema  │ ⋯ │
│ 9 Oct  │ Utilities › LPG         │ Indane – Lava   │ 2 cylinders     │ UPI    │  1,850  │ —  │ Pema  │ ⋯ │
│ 8 Oct  │ Maintenance › Plumbing  │ Bikash (plumber)│ geyser 102      │ Cash   │ 12,000 ⏳│ 📎 │ Sonam │ Approve│
│ 🔒 7 Oct closed                                                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Phone (admin review)**

```
┌──────────────────────────────┐
│ Expenses  Oct ▾    [+]       │
│ ₹1,84,300 / ₹2,10,000  88%   │
│ ⏳ 2 to approve  📎 5 no bill │
├ By category ─────────────────┤
│ Payroll     ████████ 72,000  │
│ Groceries   ██████▌  48,200  │
│ Maintenance ███████⚠ 21,400  │
├ 9 Oct ───────────────────────┤
│ Vegetables · Haat   ₹2,350 📎│
│ LPG · Indane        ₹1,850   │
├ 8 Oct ───────────────────────┤
│ Plumbing · Bikash ₹12,000 ⏳ │
│        [Reject]  [Approve]   │
└──────────────────────────────┘
```

**Information hierarchy.** Month total vs budget, then the "needs attention" items, then category bars (actual vs budget, over-budget in terracotta), then the entry table grouped by day. Closed days carry a lock row.

**Interactions**

- *+ Expense* opens the same form as the PWA: amount, category chip, vendor, date, method, receipt, note.
- Row ⋯ menu: Edit (admin), Void with a reason (soft delete), View receipt, and View audit.
- In a closed day, edits and voids create an **adjustment** dated today that references the closed date (EX-04).
- **Categories** (admin only): add, rename, archive, parent/sub-tags, `is_operating` flag, default monthly budget, and a per-month override in **Budgets**.
- **Vendors:** name, phone, UPI id, GSTIN, default category. Created on the fly from the logger.
- **Recurring:** amount, day of month, category and vendor. On the due date it creates a *draft* in "Needs attention" with "Log ₹6,200 electricity?". Logging still requires a tap, because amounts vary.
- **Approval:** entries above a threshold (default ₹5,000, Q9) by non-admins are `pending_approval`. They are excluded from totals until approved, and the logger sees "Waiting for approval".
- **CSV export** (month or custom range): `date, voucher_no, category, sub_tag, vendor, vendor_gstin, description, method, amount, input_gst, receipt_url (signed, 7 days), created_by, approved_by, status`. Plus a second sheet-ready CSV of totals by category.

**States**

- **Empty month:** "No expenses yet – log the first one".
- **Loading:** skeleton bars.
- **Error:** a banner.
- **Receipt upload failure:** keep the entry, and flag "receipt not uploaded – retry".

**Roles**

- **Admin:** everything.
- **Manager:** log, see their own entries for the current month, and edit their own entries for 30 minutes if the day is not closed. No budgets, categories admin or export.
- **Kitchen:** log only, if the owner wants that (Q9).

**Data and API**

- `GET /api/expenses?from&to&category&vendor&status&mine`
- `POST /api/expenses` (idempotent on `client_id`)
- `PATCH /api/expenses/:id` and `POST /api/expenses/:id/void` (admin)
- `POST /api/expenses/:id/approve|reject`
- `GET|POST /api/expense-categories`, `/api/vendors`, `/api/recurring-expenses`, `/api/budgets`
- `GET /api/expenses/export.csv?from&to`
- Receipts go to the private `guest-documents`-style bucket `expense-receipts` through `persistDataUrl` (already supports private files).

**Acceptance criteria**

- [ ] A category added by the admin appears in the phone logger within one refresh, and an archived category disappears there but stays on historical rows.
- [ ] Month total = Σ approved, non-void expenses dated in that month, and equals the dashboard's *Expenses* tile for the same range.
- [ ] A manager cannot create, edit or void an expense dated on or before the last closed day. An admin's correction there creates an adjustment row and leaves the day-close snapshot unchanged.
- [ ] The CSV opens cleanly in Excel (UTF-8 BOM, ₹-free numeric amounts, ISO dates), and its totals equal the screen.
- [ ] A recurring item due today appears in "Needs attention" and is logged with one tap.

### 4.4 Collections and expenses dashboard

**Who, where, top jobs.**

- **Users.** The owner on his phone each evening and at month end; the admin on the laptop.
- **Jobs:**
  1. "How did we do?": money in, money out and profit for a period vs the previous one.
  2. "Where did it come from?": revenue by stream, collections by method, and expenses by category.
  3. "Who owes us?": the top outstanding folios and credits owed.

This screen replaces the ledger's analytics tab (DB-01) and the "Confirmed Revenue" and "Room Inventory" tiles on `AdminOverview` (DB-02). The admin overview keeps inquiries and pending web bookings.

**Desktop**

```
┌ Dashboard ─ [Today][MTD][Last month][Custom 1–9 Oct] vs previous period ☑ ──────── Updated 21:40 ↻ ┐
├────────────┬────────────┬────────────┬────────────┬────────────┬────────────┬────────────┬──────────┤
│Collections │Revenue     │GST         │Expenses    │Net op.     │Occupancy   │ADR         │RevPAR    │
│₹2,41,800   │(net of GST)│collected   │₹1,84,300   │profit      │68%         │₹5,120      │₹3,482    │
│▲12% vs Sep │₹2,28,400   │₹12,610     │▲4%         │₹44,100     │▼3 pts      │▲₹240       │▲₹70      │
│ⓘ cash basis│ⓘ accrual   │ⓘ liability │ⓘ by date   │ⓘ rev − exp │ⓘ sold/avail│ⓘ rooms/sold│ⓘ rm/avail│
├────────────┴────────────┴────────────┴────────────┴────────────┴────────────┴────────────┴──────────┤
│ Outstanding receivables ₹18,250 (4 folios) · Advances held ₹27,000 · Credit owed to guests ₹1,500 ⚠ │
├ Revenue by stream (net of GST) ──────────────┬ Collections by method ────────┬ Expenses by category ─┤
│ Rooms        ███████████████████ 1,71,200 75%│ UPI    ████████████ 1,52,300  │ Payroll   72,000  39% │
│ Dine-in      ████▌                 31,600 14%│ Cash   █████▌         68,500  │ Groceries 48,200  26% │
│ Transport    ██                    14,100  6%│ Bank   █▌             16,000  │ Maint.    21,400  12% │
│ Celebrations █                      7,000  3%│ Card   ▏               5,000  │ Utilities 18,600  10% │
│ Rentals      ▌                      3,200  1%│ Refunds            −1,000     │ Transport 14,100   8% │
│ Laundry/other▏                      1,300  1%│                               │ Other     10,000   5% │
├ Daily trend (revenue bars, collections line, expenses line) ─────────────────────────────────────────┤
│  ▁▃▅▂▇▆▃▄█   1 Oct … 9 Oct                                                                           │
├ Top outstanding folios ──────────────────────────────────────────────────────────────────────────────┤
│ S. Ghosh · 201 · departed 5 Oct · ₹7,500 · [WhatsApp] [Open] │ Tashi D · 101 · in-house · ₹2,100 …   │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Phone**

```
┌──────────────────────────────┐
│ Dashboard        MTD ▾  ↻    │
│ vs Sep 1–9 ☑                 │
├──────────────┬───────────────┤
│Collections   │Net op. profit │
│₹2,41,800 ▲12%│₹44,100   ▲8%  │
├──────────────┼───────────────┤
│Revenue ex-GST│Expenses       │
│₹2,28,400     │₹1,84,300 ▲4%  │
├──────────────┼───────────────┤
│Occupancy 68% │ADR ₹5,120     │
│RevPAR ₹3,482 │GST ₹12,610    │
├──────────────┴───────────────┤
│ Owed to us ₹18,250 (4) ›     │
│ Advances held ₹27,000        │
├ Revenue by stream ───────────┤
│ Rooms     ████████ 75%       │
│ Dine-in   █▌ 14%  …          │
├ Collections by method ───────┤
│ UPI 63% · Cash 28% · Bank 7% │
├ Expenses by category ────────┤
│ Payroll 39% · Groceries 26%… │
└──────────────────────────────┘
```

**Tile → definition map.** Every tile carries an ⓘ that shows this definition.

| Tile | §3.2 definition |
|---|---|
| Collections | Collections (cash basis, by accounting date), net of refunds shown beneath |
| Revenue (net of GST) | Revenue |
| GST collected | GST collected (output liability) |
| Expenses | Expenses (approved, non-void, operating + non-operating shown separately on tap) |
| Net operating profit | Revenue − operating expenses |
| Occupancy, ADR, RevPAR | as defined, using room-nights available after blocks |
| Outstanding receivables | Outstanding receivables, as of the range end |
| Advances held | Advances held, as of the range end |
| Credit owed to guests | Credit owed to guests |
| Revenue by stream | Revenue streams |
| Collections by method | Collections by method, plus refunds |
| Expenses by category | Expenses by category |
| Daily trend | Revenue, collections and expenses per day (same functions, daily buckets) |
| Top outstanding folios | Receivables, per folio, sorted by amount then age |

**Interactions**

- The date-range picker reuses `DateRangePicker.tsx`. Presets: Today, Yesterday, MTD, Last month, FY to date, Custom. The comparison is the same-length previous period (or the same days last month for MTD).
- Tapping any tile, bar or segment drills down to the filtered list: payments list, bookings "Balance due" view, or expense manager filtered by category.
- A "Share" button produces the owner digest text (F-10) for WhatsApp.

**Charts.** No new dependency. Three small components built with inline SVG and Tailwind: `BarList` (horizontal bars), `StackedBar`, and `Sparkline`/`TrendChart` (bars + 2 lines). They add about 4 KB. Recharts would add about 100 KB gzipped for three simple charts and isn't worth it here. Reconsider only if interactive zoomable charts are wanted later.

**States**

- **Loading:** tile skeletons. The previous figures stay visible on refresh.
- **Empty range:** "No activity in this period".
- **Error:** a banner, plus the last-loaded timestamp.
- **Reconciliation warning:** if `GET /api/admin/reconcile` reports a violation, a slim amber bar "2 bills don't add up – review", linking to the list.

**Roles**

- **Admin:** full.
- **Manager:** today only. Collections by method and outstanding folios (for chasing). No profit, expenses or GST.
- **Kitchen:** none.

**Data and API**

- `GET /api/reports/summary?from&to&compare=1` returns `{collections{total,byMethod,refunds}, revenue{total,byStream}, gst{total,byRate}, expenses{total,byCategory,operating}, profit, occupancy, adr, revpar, receivables, advancesHeld, creditOwed, daily[], topOutstanding[], previous{…}}`.
- It is computed in SQL over `folio_lines`, `folio_payments`, `expenses`, `bookings` and `room_blocks` in one round trip. It is cached 30 s per range and invalidated on any money op.
- Day close, the ledger and the owner digest call the same function (R7).

**Acceptance criteria**

- [ ] For a seeded month, every tile equals the reconciliation fixture to the paisa, and each tile's ⓘ text names its §3.2 definition.
- [ ] Today's Collections tile = the day-close payments total for today (R6/R7). MTD Expenses = the expense manager's month total.
- [ ] Revenue by stream sums to Revenue. Collections by method minus refunds sums to net collections.
- [ ] A celebration appears under *Celebrations*, not *Other*. A transfer appears under *Transport*.
- [ ] A stay booked on 1 Oct for 20–24 Dec contributes nothing to October revenue, but its advance appears in *Advances held* and its deposit in October *Collections*.
- [ ] The phone layout fits the KPI grid in one screen at 390 × 844, and loads in < 1.5 s on a 4G profile.

### 4.5 Expense PWA (phone logger)

**Who, where, top jobs.**

- **Users.** Managers and kitchen leads, one-handed, often in the market or the kitchen with weak signal.
- **Jobs:**
  1. Log a cash or UPI expense in under 15 seconds.
  2. Snap the bill.
  3. See today's entries and whether they have synced.

**What is wrong today:**

- There is no offline support (PW-01, EX-01).
- Managers see an empty list after a reload (EX-02).
- There is no receipt, vendor, date or note (EX-07, PW-03).
- The editable "logged by" name (EX-06).
- The service worker doesn't pre-cache the `/expenses` shell (PW-02).

**Phone: home and the 3-tap log flow**

```
┌──────────────────────────────┐   ┌──────────────────────────────┐
│ Expenses   Pema · Manager  ⟳ │   │ ✕  New expense       Today ▾ │
│ ● All synced                 │   │                              │
│ Today ₹4,200 · 3 entries     │   │        ₹ 1,850               │  ← big numeric keypad, autofocus
├──────────────────────────────┤   │                              │
│ LPG · Indane       ₹1,850 ✓  │   │ Recent:                      │
│ Vegetables · Haat  ₹2,350 ✓📎│   │ [LPG Indane 1,850] [Milk 640]│  ← one tap fills category+vendor+amount
│ Milk · Gwala         ₹640 ⏳ │   │ [Veg Haat 2,350] [Diesel …]  │
│   waiting for signal         │   │ Category: [LPG ▾] Vendor:[Indane▾]
├──────────────────────────────┤   │ Paid: (UPI) Cash  Card  Bank │
│ Yesterday ₹6,900 ›           │   │ [📷 Add bill]   [Note…]       │
│                              │   │                              │
│                              │   │                              │
│   ┌──────────────────────┐   │   │   ┌──────────────────────┐   │
│   │   ＋ Log expense      │   │   │   │  Save ₹1,850          │   │
│   └──────────────────────┘   │   │   └──────────────────────┘   │
└──────────────────────────────┘   └──────────────────────────────┘
```

**Target flow.** Log button → tap a "Recent" chip (fills category, vendor and last amount) → adjust the amount on the keypad → Save. That is 3–4 taps and under 15 s. The camera is optional, and the bill can be attached later from the list ("📎 add bill").

**Information hierarchy.**

1. Sync state.
2. Today's total.
3. Today's entries, each with a status icon:
   - ✓ synced;
   - ⏳ queued;
   - ⚠ failed, tap to retry or see the reason;
   - 🔒 awaiting approval.
4. Yesterday, collapsed.

**Interactions and technology**

- **Outbox.** IndexedDB store `outbox` holding `{client_id (uuid), payload, receiptBlob?, attempts, lastError}`. Save writes to the outbox first, then shows the entry with ⏳, then tries `POST /api/expenses`.
- **Retry.** On `online`, on `visibilitychange` and every 30 s while visible. On Android/Chrome the service worker `sync` event (`registration.sync.register('expenses')`) sends the queue even after the app is closed. iOS has no Background Sync, so it retries on next open; this is stated in the UI ("Open the app once you have signal").
- **Idempotency.** The server dedupes on `client_id` (unique), so a retry after a timeout never creates two expenses.
- **Receipt.**
  - Capture with `<input type="file" accept="image/*" capture="environment">`.
  - Compress in the browser with canvas: longest side 1600 px, JPEG quality 0.7, target ≤ 300 KB. The same approach is already used for room photos (F10) and ID docs (M1).
  - Store it as a blob in the outbox.
  - Upload it as part of the POST (multipart) or with a follow-up `POST /api/expenses/:id/receipt`.
- **Recent vendors and amounts.** `GET /api/expenses/recent?mine=1` returns the last 30 distinct (category, vendor, amount). It is cached in IndexedDB for offline use.
- **Date chip:** Today / Yesterday / pick. Dates on or before the last closed day are disabled for non-admins, with "Day closed – ask the owner".
- **Install prompt.** Reuse `PWAInstaller` (`app="expenses"`). Show it after the second successful save, not on first load, and hide it once installed (already implemented).
- **Session and roles.** Same staff session cookie. Kitchen accounts see the logger only if the owner allows it (Q9). An expired session queues the entries and asks to sign in, then sends them. The sign-in screen must not clear the outbox.
- **Service worker.** Add an `/expenses` app-shell pre-cache list generated at build (`next build` manifest → `public/sw-expenses-assets.json`), a navigation fallback for `/expenses` to the cached shell, and `/api/expenses*` network-only (the outbox handles failures). Bump `CACHE_NAME` per release.

**States**

| State | What the screen shows |
|---|---|
| Offline | Grey bar "Offline – entries will send when you're back online"; saves go to the outbox |
| Failed | Red ⚠ on the row with the reason, e.g. "Day closed" (needs an admin, so this one is not retried) or "Session expired" (sign-in prompt); otherwise retried automatically |
| Pending approval | 🔒 "Waiting for approval" |
| Empty | "Nothing logged today. Tap Log expense." |

**Roles.** Managers log and see their own entries and today's total of their own entries. Admins also see everyone's today. Kitchen accounts can log only, when the owner enables it.

**Data and API**

- `POST /api/expenses` (multipart or JSON) `{client_id, expense_date, amount, category_id, vendor_id|vendor_name, method, note, receipt?}`. It returns the row, or 200 with the existing row on a duplicate `client_id`.
- `GET /api/expenses?mine=1&from&to`
- `GET /api/expenses/recent?mine=1`
- `GET /api/expense-categories?active=1`
- `GET /api/vendors?active=1`

**Acceptance criteria**

- [ ] On a mid-range Android phone, a repeat expense (a recent chip) is saved in ≤ 15 s and ≤ 4 taps from app open. Timed in a usability check with two staff members.
- [ ] Airplane mode: log 3 expenses with photos, close the app, and reopen it online. All 3 sync once, with receipts, and no duplicates even if the network drops mid-request.
- [ ] After a reload, a manager sees their own entries for today with the correct sync state.
- [ ] Receipts upload at ≤ 300 KB each and are only viewable by admins and the logger (private bucket, signed URL).
- [ ] The app installs from Chrome Android and Safari iOS (Add to Home Screen), opens offline to the logger shell, and passes Lighthouse PWA "installable" and "works offline".
- [ ] A saved entry's "logged by" is the signed-in user, whatever the client sends.

---

## 5. Feature recommendations

These are prioritised for a 7-room Indian homestay where the owner checks the numbers on his phone and most payments are UPI or cash. None of them is shipped per `docs/backend-audit.md`. That audit left payments, WhatsApp and the channel manager on the roadmap, and these features build on those items without repeating them.

Impact: **H** changes money or daily work materially; **M** is useful; **L** is nice to have. Effort for one developer: **S** ≤ 2 days, **M** 3–5 days, **L** > 1 week.

| # | Feature | What it does / why | Impact | Effort | Depends on | Where it plugs in |
|---|---|---|---|---|---|---|
| F-01 | **Role permissions for discounts, voids, refunds and manual rates** | Per-role limits, e.g. a manager can discount ≤ 10% or ₹1,000 and void only lines they posted in the last 30 minutes. Anything above a limit becomes an approval request the owner approves on his phone. Every action needs a reason. This closes the fraud path in PM-01. | H | M | S2 folio ops | `lib/server/folio-ops.ts`; `staff_users.limits jsonb`; `pms.approvals`; drawer actions (§4.2) |
| F-02 | **GST tax invoices** | Sequential numbers per financial year (`SH/26-27/0001`), generated on finalise. Rate-wise CGST/SGST, or IGST for inter-state B2B. SAC 996311 (accommodation) and 996331 (food and room service). B2B buyer GSTIN with name and state. Credit notes for post-invoice corrections. Printable/PDF. | H | M | S7 lines; Q1, Q5 | `pms.invoices`, `pms.counters`; `components/crm/InvoiceView.tsx` replacing the print block in `GuestCheckoutModal` |
| F-03 | **UPI QR and payment link on the folio** | Step 1 (S): a dynamic UPI QR on the drawer and invoice (`upi://pay?pa=<vpa>&am=<balance>&tn=<folio>`), with zero fees and no integration. The guest scans and staff confirm the UTR. Step 2 (M): Razorpay payment links with a signed webhook that records the payment automatically (from the audit roadmap). | H | S → M | VPA in settings | Drawer "Take payment"; guest portal "Pay now"; `api/payments/webhook` |
| F-04 | **Night audit** | A nightly job (Vercel Cron, 23:30 IST) that: posts tonight's room-night lines; flags arrivals not checked in as possible no-shows; expires desk holds; lists pending orders; runs `reconcile`; and prompts the admin to close the day. Revenue then lands on the right night (MF-11). | H | M | S7 | `app/api/cron/night-audit`; `lib/server/day-close.ts` |
| F-05 | **Refunds and cancellation policy** | A policy table (e.g. > 7 days 100%, 3–7 days 50%, < 3 days 0%; no-show = first night). Cancelling applies it as a fee line and turns the rest of the advance into a refund (admin approves the method). Refunds become a payment `kind`. | H | M | MF-07, MF-10; Q4 | `folio_payments.kind='refund'`; `POST /api/bookings/:id/cancel` |
| F-06 | **Group / master folio and bill splitting** | A multi-room web request gets a master folio for rooms, with each room's extras on its own folio. Lines can be routed between folios ("room 2 pays own food"). Split a bill by amount or by lines across payers. | M | L | S7 (`folios.kind`, `parent_folio_id`) | Drawer "Split / Route"; `booking_rooms` |
| F-07 | **Cashier shifts with cash-drawer count** | Open a shift with a float. All cash payments, refunds and cash expenses attach to the shift. Close by counting notes (₹500 × n…), the system shows the variance, and the owner gets "Pema's shift closed, ₹200 short". Day close requires every shift closed. | H | M | S7 (`shift_id`) | `pms.cash_shifts`; Day close card; phone sheet |
| F-08 | **Housekeeping board** | Per-room dirty/clean/inspected state with tasks generated automatically at checkout (turnover) and daily (stay-over). A phone checklist for housekeeping staff, assignment to real staff (UX-03), and maintenance as dated blocks (BK-03). | M | M | S6 `room_blocks` | Existing `housekeepingTasks` collection; `OperationsHub` |
| F-09 | **WhatsApp bill and receipt sharing** | Now (S): a `wa.me` deep link with a summary and a signed 7-day invoice PDF link, from the drawer and checkout. Later (M): WhatsApp Cloud API templates for confirmations, payment reminders and receipts, using the notification queue from audit M9. | H | S → M | F-02 for the PDF | Drawer, checkout success screen, bookings list bulk action |
| F-10 | **Owner's daily digest** | At 21:30, a message with: today's collections by method, revenue by stream, expenses, cash expected in the drawer, tomorrow's arrivals and departures, receivables over 3 days old, and any reconciliation warnings. Sent in-app plus email, or WhatsApp once F-09 ships. | H | S | S4 `summarize` | `app/api/cron/owner-digest`; dashboard "Share" |
| F-11 | **Guest profiles and repeat-guest recognition** | `pms.guests` keyed by normalised phone, holding stays, lifetime spend, preferences (dietary is already captured), ID on file and notes. A "★ 3rd stay" badge on booking and check-in, and pre-filled details for returning guests. | M | M | — | New table; `ManualBookingModal` phone lookup; drawer "Guest" tab |
| F-12 | **Vendor payables** | Driver fares (from dispatch confirm, MF-18), grocery credit and the plumber's bill as payables with due dates. "Pay" creates the expense. Ageing view: "Raju driver ₹4,200, 6 days". | M | M | S13 | `pms.vendor_payables`; Expense manager tab |
| F-13 | **Pre-arrival deposit request** | Confirming a web request sends a UPI link or QR for the deposit. Payment is recorded on the booking-advance folio and carried over on room assignment (MF-04). | H | S | F-03, S5 | `AdminBookings` confirm action |
| F-14 | **Monthly GST summary export** | Rate-wise taxable and tax by month, B2B invoice list (GSTR-1 shaped) and a credit-note list, as CSV for the CA. | H | S | F-02 | `GET /api/reports/gst.csv` |
| F-15 | **Booking source and OTA commission** | A `source` on every booking (web, walk-in, phone, OTA name, agent). Commission is recorded as an expense or payable when the stay completes, and the dashboard shows "revenue by source" and net ADR. | M | S | S7 | `bookings.data.source`; dashboard filter |
| F-16 | **Money audit viewer** | Per-folio and per-day history of who posted, voided, discounted or collected what, with before/after, from `pms.audit_log`. The owner's answer to "who changed this?". | M | S | — | Drawer "Timeline"; admin page |
| F-17 | **Quick-post extras** | One-tap buttons in the drawer for laundry per piece, minibar items, late check-out fee, extra bed per night and bonfire, priced from settings. | M | S | MF-17 ops | Drawer "Add charge" presets in `pms.settings` |
| F-18 | **Bank/UPI statement match** | Upload the bank or UPI CSV and the system matches UTRs to folio payments, flagging unmatched UPI credits (often guests who paid but weren't recorded). | L | M | F-03 | Admin tool |

---

## 6. Implementation plan

Order: money correctness on the current storage first (S1–S6), then the data model (S7), then the remaining money rules (S8–S10), then the screens (S11–S15), then features. Each slice is one PR with its own tests and can ship independently. The effort is for one developer who knows the codebase. Every slice must leave `npm run lint`, `typecheck`, `test` and `check:pricing` green.

| Slice | What | Fixes | Main files | Migration | Tests to add | Effort |
|---|---|---|---|---|---|---|
| **S1** | Link everything to a booking by id. One selector module; no room-number matching anywhere; the invoice uses the selector | MF-01, BL-01, BL-03, INV-01 (orders part) | new `lib/folio-links.ts`; `MasterBookingsList.tsx`; `GuestCheckoutModal.tsx`; `CRMContext.tsx` | — | Unit: selector with same-room past/future folios; integration: checkout posts to the right folio | 1 d |
| **S2** | Stop lost writes. `version` on `pms.records` with 409 on mismatch; server folio ops (`/api/folios/:id/charges|payments|void|discount`) in a transaction with a row lock; guest services in the same transaction; drop stale poll responses; failed ops stay queued (interim for EX-01); activity log written by the server, append-only; UUID ids | MF-02, MF-03, SY-01, EX-08, EX-01 (interim) | `repos/records.ts`; `crm-sync.ts`; `guest-services.ts`; `app/api/folios/[id]/*`; `CRMContext.tsx` | `alter table pms.records add column version int not null default 1` | Integration: 10 parallel orders → 10 lines; concurrent payments; stale-version 409; manager's 201st action → no error | 3 d |
| **S3** | Folio maths and state rules. Signed balance; pending excluded; `void` preserved; tax rate frozen per line; room slab from the night value; server check-in/checkout with a state machine; server timestamps; `step=0.01` inputs; ledger payment form fix; guests see "+GST" | MF-07, MF-08, MF-09, MF-12, MF-13 (per Q2), MF-14, MF-20, BK-04, BK-05, INV-04, SY-02, SY-04, UX-01, UX-02 | `lib/folio.ts`; `lib/gst.ts`; `app/api/bookings/[id]/checkin|checkout`; `GuestCheckoutModal.tsx`; `FinancialLedger.tsx`; concierge and portal price labels | — | Unit P1–P10 inverted into regression tests; integration: state-machine matrix | 3 d |
| **S4** | One summary function on the current data (interim SQL over `pms.records` JSON with `jsonb_array_elements`). Ledger gets a date range and new labels; day close uses it (GST fixed, receivables definition); AdminOverview tiles; orders badge; role-switch fix | DB-01, DB-02, DB-03 (label), DB-05, EX-03, EX-09, BL-02, PM-02, UX-06 | new `lib/server/reports.ts`; `app/api/reports/summary`; `day-close.ts`; `FinancialLedger.tsx`; `AdminOverview.tsx`; `admin/page.tsx` | — | Fixture month: summary = hand-computed numbers; R5, R6, R7 | 2.5 d |
| **S5** | Web → desk conversion carries the money. Structured add-ons on web bookings; deposits recorded as payments; child ages to the desk engine; orphan folios re-homed; per-room links for multi-room requests | MF-04, MF-05, MF-06, MF-16, BK-02, BK-09 | `api/bookings/route.ts`; `repos/bookings.ts`; `AdminBookings.tsx`; `ManualBookingModal.tsx`; `CRMContext.calculateDynamicTariff`; `guest-services.ts` | `pms.booking_rooms`; web booking `data.addons[]` (back-fill by parsing `special_requests` tags) | Integration: deposit + add-on + child under free age converted → folio equals quote (R11); `check:pricing` desk case | 3 d |
| **S6** | Inventory integrity. Desk bookings check category availability; dated `room_blocks`; desk holds expire; in-room QR resolves only in-house bookings; cancel and no-show actions void unconsumed lines; no rooms[0] fallback | BK-01, BK-03, BK-06, BK-07, BK-08, BK-10, MF-10, TC-02 | `repos/bookings.ts`; `crm-sync.ts`; `api/room-blocks`; `api/bookings/[id]/cancel|no-show`; `TapeChart.tsx` (minimal) | `pms.room_blocks`; `bookings.hold_expires_at` for desk holds | Integration: overbooking refused; block affects only its nights; cancel → lines void | 3 d |
| **S7** | **Money tables.** Create the tables in §3.4; back-fill script with a reconciliation report; folio JSON adapter for `/api/crm/state`; cutover of writes; per-night room lines with `service_date`; itemisation from the engine result; `summarize` switched to tables; delta sync for state | MF-11, MF-15, DB-04, SY-03, SY-05 (and foundations for MF-19, F-02, F-04, F-06, F-07) | `supabase/migrations/2026110100_money_tables.sql`; `scripts/backfill-money.ts`; `lib/server/repos/folios.ts`, `expenses.ts`; `crm-sync.ts`; `reports.ts` | Yes (see §3.4 steps 1–5) | Back-fill dry-run on a copy of production data (owner signs off the mismatch list); R1–R4, R8 | 6 d |
| **S8** | Expenses API and rules. Endpoints; managers read their own; server-stamped `created_by`; `client_id` idempotency; closed-day adjustments; days close in order; soft void with a reason; editable categories | EX-02, EX-04, EX-05, EX-06, EX-10 | `app/api/expenses/*`; `day-close.ts`; `crm-sync.ts` (remove expenses from sync) | `expense_categories` seed | Integration: closed-day rules; idempotent POST; manager visibility | 3 d |
| **S9** | Permission limits and folio actions UI. Add charge / discount / void with a reason and role limits; approval requests; managers may only change housekeeping on rooms | PM-01, PM-03, MF-17, F-01, F-17 | `lib/server/folio-ops.ts`; `pms.approvals`; drawer components | `staff_users.limits`, `pms.approvals` | Role matrix integration tests | 3 d |
| **S10** | GST invoice. Invoice from folio lines; FY counter; settings for GSTIN, address and SAC; credit notes; guest-facing GST labels | INV-01, INV-02, INV-03, MF-19, F-02 | `components/crm/InvoiceView.tsx`; `app/api/invoices`; `AdminTaxSettings` | `pms.invoices` | Snapshot invoices (mixed rates, partial payment, B2B IGST); gap-free counter under concurrency | 3 d |
| **S11** | Tape chart redesign (§4.1) | TC-01, TC-03, TC-04, TC-05, TC-06, UX-05 | `components/crm/tape/*` (split from `TapeChart.tsx`); `app/api/tapechart` | — | Layout unit tests; Playwright at 390 px and 1280 px; drag-move dry-run | 5 d |
| **S12** | Bookings list and drawer (§4.2) | BL-04, BL-05, BL-06, UX-04 | `components/crm/bookings/*`; `app/api/bookings/list`; `app/api/bookings/[id]` | — | View-count = row-count; search normalisation; drawer lines = folio lines | 4 d |
| **S13** | Expense manager (§4.3) with vendors, budgets, recurring, approvals and CSV; dispatch confirm asks for the vendor fare and creates a payable | MF-18, UX-03, F-12 | `components/crm/expenses/*`; `app/api/vendors|budgets|recurring-expenses`; `OperationsHub.tsx` | `vendors`, `budgets`, `recurring_expenses`, `vendor_payables` | CSV totals = screen; recurring draft generation; approval threshold | 5 d |
| **S14** | Collections and expenses dashboard (§4.4); retire the ledger analytics tab and AdminOverview money tiles | DB-06 (and replaces DB-01/DB-02 surfaces) | `components/crm/dashboard/*` (SVG charts); `reports.ts` compare | — | Tile = fixture; R7 across dashboard, day close and digest | 3 d |
| **S15** | Expense PWA (§4.5): outbox, receipts, service-worker shell, recent chips | EX-01, EX-07, PW-01, PW-02, PW-03, PW-04 | `app/expenses/*`; `lib/outbox.ts`; `public/sw.js`; `public/expenses.webmanifest`; `app/api/expenses/[id]/receipt` | storage bucket `expense-receipts` (private) | Playwright offline → online sync, no duplicates; Lighthouse PWA | 4 d |
| S16 | Night audit and owner digest | F-04, F-10 | `app/api/cron/*`; `vercel.json` crons | — | Cron handler unit tests with a fixed clock | 2 d |
| S17 | UPI QR / payment link on the folio and WhatsApp sharing; pre-arrival deposit | F-03 (step 1), F-09 (step 1), F-13 | drawer, portal, `AdminBookings` | VPA setting | QR payload test; deep-link text | 2 d |
| S18 | Refunds, cancellation policy, rental deposits | F-05, MF-21 | `folio-ops.ts`; settings | `folio_payments.kind` already in S7 | Policy matrix tests | 2 d |
| S19 | Cashier shifts | F-07 | `pms.cash_shifts`; Day close | yes | R9 | 3 d |
| S20 | Housekeeping board | F-08 | `OperationsHub` split | — | — | 3 d |
| S21 | Guest profiles | F-11 | `pms.guests`; booking modal | yes (back-fill from bookings by phone) | Dedupe by phone | 3 d |
| S22 | Group/master folios and split bills | F-06 | `folio-ops.ts`; drawer | uses S7 columns | Routing and split tests | 4 d |
| later | GST export, source/OTA commission, audit viewer, bank match | F-14, F-15, F-16, F-18 | — | — | — | 1–3 d each |

**Totals.** Money correctness S1–S6 is about 15.5 days, the data model and money rules S7–S10 about 15 days, and the screens S11–S15 about 21 days. That is roughly 10–11 weeks for one developer to reach "numbers the owner can trust on redesigned screens", with features after that.

**Suggested checkpoints with the owner:**

- after S4, compare one closed week against the bank and UPI statements;
- after the S7 dry-run, sign off the back-fill mismatch list;
- after S14, run the dashboard and Day close side by side for a week.

---

## 7. Open questions for the owner

Each answer changes the money model. The assumption in the right-hand column was used throughout this review and is easy to change in one place.

| # | Question | Why it matters | Assumption used |
|---|---|---|---|
| Q1 | Is Savera registered for GST as a **regular** taxpayer (not composition), under which legal name? | Composition dealers can't charge GST on invoices. The whole GST layer and invoice depend on this. | Regular registration |
| Q2 | Are room tariffs entered **including or excluding** GST? If including, how should a night priced between ₹7,875 and ₹8,850 be taxed (MF-13)? | Changes every room line, the slab choice and the website total | Excluding GST (current default); the inclusive band is blocked with a warning |
| Q3 | Are menu, celebration and transfer prices including or excluding GST? | Today the folio adds 5% that guests don't see (MF-20) | Excluding; guest screens will show "+ GST" |
| Q4 | Are advances refundable? What is the cancellation policy (days before arrival → % refunded), and what is charged for a no-show? | Decides what happens to the advance on cancel (MF-10, F-05), and whether advances are a liability or forfeitable | Refundable less a policy fee; until a policy exists, a cancellation leaves a credit for the admin to decide |
| Q5 | Are the GSTIN `19AAAFS8821Q1Z8`, the address "Lava – Rishyap Hilltop Ridge, Kalimpong 734319", the phone +91 98320 44556 and `reservations@saverahomestay.in` printed on the invoice correct? | They are hard-coded (INV-03). If they are placeholders, every invoice issued so far is wrong. | Placeholders; moved to settings |
| Q6 | Should bills be **rounded to whole rupees** with a round-off line? | Removes paise from cash collection and the UX-01 class of problems | Yes, with the round-off shown on the invoice |
| Q7 | Are transfers and rentals sold **by Savera** (principal: full fare is revenue, driver fare an expense) or **on behalf of drivers** (agent: only the commission is revenue)? | Changes revenue, margin and GST on transport (MF-18) | Principal |
| Q8 | Should meal plans (CP/MAP/AP) be treated as part of the room (one accommodation supply at the room slab), or split into room + food lines? | GST rate and the revenue stream for meals | Part of the room, as today |
| Q9 | Which expenses need owner approval (above what amount?), and may kitchen staff log expenses? | Approval workflow and PWA roles (§4.3, §4.5) | Above ₹5,000 by non-admins; kitchen may log, not view |
| Q10 | When should room revenue count, per night stayed or at checkout? And what time should night audit run? | Revenue by date on every report (MF-11, F-04) | Per night stayed; night audit at 23:30 IST |
| Q11 | Who may close a day (managers can today), and must days be closed in order? | Day-close integrity (EX-04) | Managers may close; days close in order; only admins can post adjustments to closed days |
| Q12 | If a food order is still awaiting approval at checkout, should it be billed, voided, or block the checkout? | MF-08 | Block the checkout until it is approved or voided |
| Q13 | What discount and void limits should a manager have without asking you? | F-01, PM-01 | Discount ≤ 10% or ₹1,000 per folio; void own lines within 30 minutes |
| Q14 | Which GST rate applies to celebrations (cake, decoration, candlelight dinner)? | Today they use the "other" rate (5%). Decor services may be 18%. | Configurable per celebration item; 5% until your CA confirms |

---

## 8. Implementation status (9 Oct 2026, second pass)

The owner chose **"Money fixes + key rules"**: every Critical and High item, plus the money rules, with no new money tables and no full screen redesigns. This section records what changed in the code. Sections 1 to 7 above are left as written on 9 Oct, so they still describe the code as it was before the fixes.

**Database.** No table changes. Room blocks and the new booking and folio fields are stored in the existing JSON columns (`pms.records.data` and `pms.bookings.data`). One additive index was added: `supabase/migrations/20261009000000_folio_booking_index.sql`, which looks up a folio by booking id. It was applied to production on 9 Oct 2026.

**Checks.** `tsc` passes, `next lint` passes, `vitest` gives 64 passed (17 integration tests skipped) and `next build` passes. New unit tests are in `tests/unit/money-model.test.ts` (14 cases) and `tests/unit/gst-off-and-money-rules.test.ts`.

### 8.1 Status by finding

**Done** means fixed as the Fix column describes, or by an equivalent route given below. **Partial** names the part still outstanding. **Open** means not started; most open items need S7 (folio tables), the owner's answer to a section 7 question, or a redesign from section 4.

#### Money and folios

| ID | Status | What changed |
|---|---|---|
| MF-01 | Done | Folios, orders and dispatches are found by booking id only (`lib/folio-links.ts`), never by room number. |
| MF-02 | Done (interim) | Every folio write from a device goes through `saveFolioFromDevice` (`lib/server/folio-store.ts`). It takes a per-booking advisory lock and merges the device's copy into the stored one. Stored payments and lines are never dropped, a stale copy cannot delete them, and the rules are checked against the stored copy. On the client, a poll that started before the last save is ignored. The per-operation endpoints and the `version` column wait for S7. |
| MF-03 | Done | Guest orders, celebrations and transfers post to the folio inside the same per-booking lock, so there are no lost lines and no duplicate folios. A booking's folio is found with one indexed query (`records_folio_booking_idx`), not a 5,000-row scan. |
| MF-04 | Done | Admin → Web bookings → **+ Record advance**: a manager-signed payment (amount, method, reference) held on an `ADV-<ref>` folio, and the request is marked deposit paid. When the request is given a room, the advance moves to the room folio, keeping its original date. The bare payment-status dropdown is gone. |
| MF-05 | Done | Website add-ons are stored as structured `addons` on the booking. On conversion they are posted as transfer and rental lines. Older bookings fall back to the tags in special requests. |
| MF-06 | Done | On conversion, lines and payments on the web booking's folio (celebrations, transfers, advances) move to the room folio. The move is recorded in the audit log. |
| MF-07 | Done | The folio now has `creditOwed`. Settled means nothing is due and no credit is owed. A **Refund** payment kind exists; it is manager-signed and cannot exceed the credit owed. |
| MF-08 | Done | Only posted lines are billed. Pending lines show as "Awaiting confirmation" (`pendingTotal`), and checkout is blocked until each one is posted or voided. Guest bills leave them out. |
| MF-09 | Done | The device recomputes the folio after a checkout collection instead of forcing it to "settled". A part collection leaves the folio open with the balance shown as due. |
| MF-10 | Done | **Cancel** and **No-show** actions (managers and admins, reason required) in the bookings list. They void the room lines with the reason, release the room and keep any advance as credit owed. A void folio stays void when recalculated. The cancellation-fee policy is still Q4. |
| MF-11 | Done (reports) | Reports recognise room revenue per night by service date (`lib/reports-core.ts: summarizeMoney`). Lines are still posted at booking time; night-audit posting is F-04. |
| MF-12 | Done | A room line is taxed on its nightly value (`chargeTax`). |
| MF-13 | Open | Needs Q2. While GST is off this has no effect. |
| MF-14 | Done | When GST is on, each posted line freezes its rate and tax. Recalculation sums the stored values. |
| MF-15 | Done | Desk bookings itemise from the tariff engine's own extras (`pricedExtras`). |
| MF-16 | Done | Child ages are collected in the desk booking form, prefilled from the web request, and passed to the tariff engine. |
| MF-17 | Done | New bill panel (`FolioLinesPanel`) on checkout: **Add charge**, **Void line** (reason required), **Discount** (reason required) and **Refund credit**. Limits are in 8.2. |
| MF-18 | Partial | Confirming a dispatch asks for the real driver or vendor fare (`vendorCost`). Vendor payables need S13. |
| MF-19 | Open | The invoice series needs S10. |
| MF-20 | Done | With GST off, the prices shown are the prices billed. The "+ GST" note appears automatically if GST is switched back on. |
| MF-21 | Open | Rental deposits. |

#### Bookings and inventory

| ID | Status | What changed |
|---|---|---|
| BK-01 | Done | A desk booking is refused (SOLD_OUT) when the category is held by website requests for those dates. |
| BK-02 | Done | A partly converted web request keeps holding its rooms that are not yet assigned. |
| BK-03 | Done | A dated **room block** (Tape chart → *Block dates*, reason required) takes a room out of inventory for those dates only. The old maintenance flag now means "out tonight" only. |
| BK-04 | Done | Checkout runs only for an in-house guest and is blocked while pending lines exist. |
| BK-05 | Done | A server-side state machine for booking status. Check-in is refused before the arrival date (TOO_EARLY), and the check-in button only shows from the arrival date. An admin can reopen a booking. |
| BK-06 | Done | No fallback to the first room. The form asks for a room. |
| BK-07 | Open | Expiry for desk holds. |
| BK-08 | Done | The room QR opens only for an in-house guest or today's arrival. |
| BK-09 | Done | Cancelling the linked desk booking releases it from the web request's link. |
| BK-10 | Open | Walk-in self-registrations are still stored as web requests. |

#### Tape chart

| ID | Status | What changed |
|---|---|---|
| TC-01 | Done | Cancelled stays are hidden, and an early checkout ends the bar on the day the guest left. |
| TC-02 | Done | The room dropdown offers only *In service* or *Out tonight*. Booking status comes from bookings. |
| TC-05 | Partial | Stay end dates use IST. The header dates still use the browser clock. |
| TC-06 | Partial | A block shows its own reason, and check-in is date-gated. Past empty cells still open the new-booking form. |
| TC-03, TC-04 | Open | Phone layout and bar layout (section 4.1 redesign). |

#### Master bookings list

| ID | Status | What changed |
|---|---|---|
| BL-01 | Done | Linked by booking id. |
| BL-02 | Done | Dues are for started stays only. Cancelled, hold and future bookings are not counted. |
| BL-03 | Done | No fallback totals: a booking with no folio says so. |
| BL-04 | Done | Each pill uses the same rule as its filter. |
| BL-05 | Done | "Today" refreshes, and phone search ignores spaces and symbols. |
| BL-06 | Open | Dense table (section 4.2). |

#### Expenses and day close

| ID | Status | What changed |
|---|---|---|
| EX-01 | Done | Changes that do not reach the server (offline, timeout, server error) stay queued on the device. They retry every 15 seconds and at once when the connection returns, and the browser warns before the tab is closed. Changes the server refuses on a rule are still rolled back with the reason. The Expense Logger has its own offline outbox. |
| EX-02 | Done | Managers can read their own expenses. |
| EX-03 | Done | Day close uses the shared money summary: tax on every posted line, pending lines excluded. |
| EX-04 | Done | Money is server-stamped (a back-dated collection is impossible), and days must be closed in order (CLOSE_IN_ORDER). |
| EX-05 | Done | Expenses are voided with a reason (admin); no hard delete. |
| EX-06 | Done | The name and time come from the signed-in account. |
| EX-08 | Done | Collections and expenses use random ids. |
| EX-09 | Done | Receivables are for started stays only, and are computed on the server in date ranges. |
| EX-07, EX-10 | Open | Expense categories and full vendor and receipt fields (section 4.3). |

#### Dashboards

| ID | Status | What changed |
|---|---|---|
| DB-01 | Done | New **Dashboard** tab (Ledger) built on `GET /api/reports/summary`, admin only. It has a date range, revenue by service date, streams, collections net of refunds, receivables, advances held, occupancy, ADR and RevPAR, with a comparison period. |
| DB-02 | Done | The Admin overview shows month-to-date revenue and collections from the same summary, and free rooms tonight from the live availability. |
| DB-03 | Done | Celebrations are their own revenue stream. |
| DB-04 | Done | Reports are computed on the server for the period asked, not from the device's working set. |
| DB-05 | Done | The orders badge counts orders awaiting the manager. |
| DB-06 | Open | One shared money formatter. |

#### Sync, PWA, permissions and UI

| ID | Status | What changed |
|---|---|---|
| SY-02 | Done | The server stamps money times and names. |
| SY-04 | Done | `PATCH /api/orders` updates the linked folio line. |
| SY-01, SY-03, SY-05 | Open | Activity-log trimming, desk booking amount validation and delta sync. |
| PW-01 to PW-04 | Done | Fixed in the first pass: outbox, Background Sync, pre-cached `/expenses`, separate icons. |
| PM-01 | Done | Folio rules are now enforced on the server (8.2). |
| PM-02 | Done | Only an admin account can switch back to the admin view. |
| PM-03 | Done | Managers can change a room's status, housekeeping and notes, but not its number, category or QR token. |
| UX-01 | Done | Amount fields accept paise. |
| UX-03 | Done | No demo driver or housekeeper defaults. |
| UX-02, UX-04 to UX-06 | Open | Copy and accessibility pass (section 4). |

### 8.2 Money rules now enforced by the server

- **Who records money.** Collections, advances, refunds and expenses are recorded only by a manager account with the confirmation ticked. The server signs each entry with that account and the server time. Admins review and void.
- **Bill lines are never deleted.** A line only moves pending → posted → void. A void needs a reason. A manager may void only a line they posted themselves, within 30 minutes; an admin may void any line.
- **Discounts.** A discount needs a reason. A manager may give up to 10% of the billed amount or ₹1,000, whichever is lower; above that needs an admin.
- **Refunds.** A refund can be at most the credit owed to the guest.
- **Settled.** A folio is settled only when nothing is due and no credit is owed. Checkout is blocked while any line is pending.
- **Day close.** Days are closed in date order. After a close, managers cannot add expenses dated on or before it.

### 8.3 Still open, in priority order

1. S7 folio tables with per-operation endpoints (makes MF-02 final).
2. Night-audit posting of room nights (F-04).
3. Invoice numbering per financial year (MF-19 / S10).
4. Vendor payables (MF-18 / S13).
5. Desk hold expiry (BK-07).
6. The section 4 redesigns: tape chart, bookings table and expense manager.
7. Owner decisions: Q2 (inclusive-tariff GST band) and Q4 (cancellation fee).
