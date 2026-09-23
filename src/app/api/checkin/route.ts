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

    const guest = body?.guest;
    if (!guest?.fullName || !guest?.phone) {
      return NextResponse.json(
        { success: false, error: 'Guest full name and phone number are required.' },
        { status: 400 }
      );
    }

    if (!guest?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email)) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required for check-in confirmation & invoice delivery.' },
        { status: 400 }
      );
    }

    if (!guest?.address || guest.address.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'Residential address (as printed in Government ID) is required.' },
        { status: 400 }
      );
    }

    if (!guest?.idNumber || !guest.idNumber.trim()) {
      return NextResponse.json(
        { success: false, error: 'Government ID document number is required.' },
        { status: 400 }
      );
    }

    if (!guest?.idDocumentUrl) {
      return NextResponse.json(
        { success: false, error: 'Government ID front photo upload is required.' },
        { status: 400 }
      );
    }

    if (guest?.idType === 'Aadhaar Card' && !guest?.idDocumentBackUrl) {
      return NextResponse.json(
        { success: false, error: 'Aadhaar Card back photo (with residential address) is required.' },
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
