import { handler, ok, HttpError } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { getAvailability } from '@/lib/server/repos/bookings';
import { isCalendarDate } from '@/lib/tariff-calculator';

export const dynamic = 'force-dynamic';

/** Public: rooms available per category for a stay. Counts only, never guest data. */
export const GET = handler('availability.get', async (request: Request) => {
  await rateLimit(request, 'availability', 120, 60);
  const params = new URL(request.url).searchParams;
  const checkIn = params.get('checkIn') || '';
  const checkOut = params.get('checkOut') || '';
  if (!isCalendarDate(checkIn) || !isCalendarDate(checkOut)) throw new HttpError(400, 'checkIn and checkOut must be YYYY-MM-DD dates.');
  const availability = await getAvailability(checkIn, checkOut);
  return ok({ data: { checkIn, checkOut, categories: availability } });
});
