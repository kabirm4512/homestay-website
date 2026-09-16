import { NextResponse } from 'next/server';
import { getRooms, saveRoom, deleteRoom } from '@/lib/data-service';

export async function GET() {
  try {
    const rooms = await getRooms();
    return NextResponse.json({ success: true, data: rooms });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || !body.price_per_night) {
      return NextResponse.json(
        { success: false, error: 'Room name and price per night are required' },
        { status: 400 }
      );
    }
    const saved = await saveRoom(body);
    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Room ID is required' }, { status: 400 });
    }
    await deleteRoom(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
