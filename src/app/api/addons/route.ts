import { NextResponse } from 'next/server';
import { getAddonsData, saveAddonsData } from '@/lib/data-service';

export async function GET() {
  try {
    const data = await getAddonsData();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, payload } = body;
    if (!type || !payload) {
      return NextResponse.json({ success: false, error: 'Type and payload are required' }, { status: 400 });
    }
    const success = await saveAddonsData(type, payload);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to save addon data' }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: 'Addon data saved successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
