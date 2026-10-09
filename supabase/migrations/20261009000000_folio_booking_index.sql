-- October 2026 money fixes: folios are looked up by booking id (never by room number)
-- inside a per-booking lock. This index keeps that lookup fast as the table grows.
-- Additive and safe to run more than once.
create index if not exists records_folio_booking_idx
  on pms.records ((data->>'bookingId'))
  where collection = 'folios';
