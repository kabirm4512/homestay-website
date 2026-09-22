import { NextResponse } from 'next/server';
import { findBookingByQuery, getCRMBookings, updateCheckinSubmission } from '@/lib/data-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.trim();

    if (!query) {
      const all = await getCRMBookings();
      return NextResponse.json({ success: true, bookings: all });
    }

    const booking = await findBookingByQuery(query);

    if (!booking) {
      return NextResponse.json(
        { success: false, notFound: true, message: `Reservation not found for '${query}'.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, booking });
  } catch (error: any) {
    console.error('Checkin GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.guest?.fullName || !body?.guest?.phone) {
      return NextResponse.json(
        { success: false, error: 'Guest full name and phone number are required.' },
        { status: 400 }
      );
    }

    const booking = await updateCheckinSubmission({
      bookingId: body.bookingId,
      bookingReference: body.bookingReference,
      guest: body.guest,
      roomId: body.roomId,
      roomName: body.roomName,
      roomNumber: body.roomNumber,
      checkInDate: body.checkInDate,
      checkOutDate: body.checkOutDate,
      mealPlan: body.mealPlan,
      specialRequests: body.specialRequests,
    });

    return NextResponse.json({
      success: true,
      booking,
      message: 'Digital check-in and ID documents successfully registered!',
    });
  } catch (error: any) {
    console.error('Checkin POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
