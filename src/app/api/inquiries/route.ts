import { NextResponse } from 'next/server';
import { getInquiries, createInquiry, updateInquiryStatus } from '@/lib/data-service';

export async function GET() {
  try {
    const inquiries = await getInquiries();
    return NextResponse.json({ success: true, data: inquiries });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.guest_name || !body.phone) {
      return NextResponse.json(
        { success: false, error: 'Guest name and phone number are required.' },
        { status: 400 }
      );
    }

    const result = await createInquiry({
      guest_name: body.guest_name,
      email: body.email || '',
      phone: body.phone,
      check_in: body.check_in || '',
      check_out: body.check_out || '',
      guests_count: Number(body.guests_count) || 2,
      room_id: body.room_id || '',
      room_name: body.room_name || '',
      message: body.message || '',
      source: body.source || 'website_modal',
      internal_notes: ''
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, internal_notes } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'Inquiry ID and status are required' }, { status: 400 });
    }

    const updated = await updateInquiryStatus(id, status, internal_notes);
    return NextResponse.json({ success: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
