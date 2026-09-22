import { NextResponse } from 'next/server';
import { getRoomTariffs, saveRoomTariff, getSeasonalDateRanges, saveSeasonalDateRanges } from '@/lib/data-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const tariffs = await getRoomTariffs();
    const seasonalDateRanges = await getSeasonalDateRanges();
    return NextResponse.json(
      { success: true, data: { tariffs, seasonalDateRanges } },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.type === 'seasonal_ranges' && Array.isArray(body.ranges)) {
      await saveSeasonalDateRanges(body.ranges);
      return NextResponse.json({ success: true, message: 'Seasonal date ranges saved successfully' });
    }
    if (body.roomId && body.tariffs) {
      await saveRoomTariff(body.roomId, body.tariffs);
      return NextResponse.json({ success: true, message: 'Room tariffs saved successfully' });
    }
    return NextResponse.json({ success: false, error: 'Invalid request payload' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
