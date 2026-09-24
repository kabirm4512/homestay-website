import { NextResponse } from 'next/server';
import {
  findBookingByQuery,
  getCRMBookings,
  updateCheckinSubmission,
  saveCRMBooking,
  getPhysicalRooms,
  savePhysicalRooms,
  updatePhysicalRoom,
  checkInRoomServer,
  checkOutRoomServer,
} from '@/lib/data-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomParam = searchParams.get('room')?.trim();
    const query = searchParams.get('query')?.trim() || searchParams.get('booking')?.trim();
    const phone = searchParams.get('phone')?.trim();

    // 1. Direct query by room number (e.g. from QR scan: /api/checkin?room=101)
    if (roomParam) {
      const roomNum = parseInt(roomParam, 10);
      const physicalRooms = await getPhysicalRooms();
      const targetRoom = physicalRooms.find(
        (r) => r.roomNumber === roomNum || r.id === roomParam || r.id === `room-${roomNum}`
      );

      const allBookings = await getCRMBookings();
      // Look for active booking in this room, prioritizing checked_in over confirmed
      const matchingBookings = allBookings.filter(
        (b) =>
          b.roomNumber === roomNum ||
          b.roomId === targetRoom?.id ||
          b.roomId === `room-${roomNum}` ||
          (targetRoom?.name && b.roomName?.toLowerCase() === targetRoom.name.toLowerCase())
      );

      const activeBooking =
        matchingBookings.find((b) => b.tapeStatus === 'checked_in' || b.bookingStatus === 'checked_in') ||
        matchingBookings.find((b) => b.tapeStatus === 'confirmed' || b.bookingStatus === 'confirmed') ||
        null;

      const isCheckedIn =
        targetRoom?.currentStatus === 'checked_in' ||
        activeBooking?.tapeStatus === 'checked_in' ||
        activeBooking?.bookingStatus === 'checked_in';

      return NextResponse.json(
        {
          success: true,
          room: targetRoom,
          booking: activeBooking,
          isCheckedIn,
          status: isCheckedIn ? 'checked_in' : (targetRoom?.currentStatus || 'available'),
        },
        { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
      );
    }

    // 2. Query by phone or booking reference
    if (query || phone) {
      const booking = await findBookingByQuery(query || phone || '', phone);
      if (!booking) {
        return NextResponse.json(
          { success: false, notFound: true, message: `Reservation not found for '${query || phone}'.` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: true, booking },
        { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
      );
    }

    // 3. Return all bookings and physical rooms
    const all = await getCRMBookings();
    const rooms = await getPhysicalRooms();
    return NextResponse.json(
      { success: true, bookings: all, rooms },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    );
  } catch (error: any) {
    console.error('Checkin GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Direct Manager Check-In Action
    if (body?.action === 'check_in') {
      const result = await checkInRoomServer({
        bookingId: body.bookingId,
        roomId: body.roomId,
        roomNumber: body.roomNumber,
        managerInfo: body.managerInfo,
      });
      return NextResponse.json(result);
    }

    // 2. Direct Manager Check-Out Action
    if (body?.action === 'check_out') {
      const result = await checkOutRoomServer({
        bookingId: body.bookingId,
        roomId: body.roomId,
        roomNumber: body.roomNumber,
      });
      return NextResponse.json(result);
    }

    // 3. Update Room Tape Status
    if (body?.action === 'update_room_status') {
      const room = await updatePhysicalRoom(body.roomId, {
        currentStatus: body.status,
        housekeeping: body.housekeeping,
      });
      return NextResponse.json({ success: true, room });
    }

    // 4. Bulk sync physical rooms from client
    if (Array.isArray(body?.syncRooms) && body.syncRooms.length > 0) {
      await savePhysicalRooms(body.syncRooms);
      return NextResponse.json({ success: true, count: body.syncRooms.length });
    }

    // 5. Bulk sync bookings from manager client
    if (Array.isArray(body?.syncBookings) && body.syncBookings.length > 0) {
      for (const b of body.syncBookings) {
        if (b && (b.id || b.bookingReference)) {
          await saveCRMBooking(b);
        }
      }
      return NextResponse.json({ success: true, count: body.syncBookings.length });
    }

    // 6. Direct single booking sync from CRM manager
    if (body?.crmBooking && (body.crmBooking.id || body.crmBooking.bookingReference)) {
      const saved = await saveCRMBooking(body.crmBooking);
      return NextResponse.json({ success: true, booking: saved });
    }

    // 7. Digital check-in submission from Guest Portal / checkin page
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
