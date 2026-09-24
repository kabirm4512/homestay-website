import { NextResponse } from 'next/server';
import { getBookings, createBooking, updateBookingStatus } from '@/lib/data-service';

export async function GET() {
  try {
    const bookings = await getBookings();
    return NextResponse.json({ success: true, data: bookings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.guest_name || !body.phone || !body.check_in || !body.check_out || !body.room_name) {
      return NextResponse.json(
        { success: false, error: 'Missing required booking details (guest_name, phone, dates, room_name).' },
        { status: 400 }
      );
    }

    const checkInDate = new Date(body.check_in);
    const checkOutDate = new Date(body.check_out);
    const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
    const calculatedNights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const nights = body.nights || calculatedNights;
    const totalPrice = body.total_price || (nights * (body.price_per_night || 5000));

    const result = await createBooking({
      guest_name: body.guest_name,
      email: body.email || '',
      phone: body.phone,
      room_id: body.room_id || '',
      room_name: body.room_name,
      check_in: body.check_in,
      check_out: body.check_out,
      nights: Number(nights),
      rooms_count: body.rooms_count ? Number(body.rooms_count) : 1,
      adults_count: body.adults_count !== undefined ? Number(body.adults_count) : undefined,
      children_count: body.children_count !== undefined ? Number(body.children_count) : undefined,
      extra_adults_count: body.extra_adults_count !== undefined ? Number(body.extra_adults_count) : undefined,
      extra_children_count: body.extra_children_count !== undefined ? Number(body.extra_children_count) : undefined,
      extra_charges_total: body.extra_charges_total !== undefined ? Number(body.extra_charges_total) : undefined,
      total_price: Number(totalPrice),
      special_requests: body.special_requests || ''
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, payment_status } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'Booking ID and status are required' }, { status: 400 });
    }

    const updated = await updateBookingStatus(id, status, payment_status);
    return NextResponse.json({ success: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
