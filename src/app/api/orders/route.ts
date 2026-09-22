import { NextResponse } from 'next/server';
import {
  recordOrderOrSpecialRequest,
  getStaffAlerts,
  acknowledgeStaffAlert,
  getFolioForBooking,
  saveExpenseItem,
  getStoreExpenses,
} from '@/lib/data-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. Return unacknowledged staff order alerts (for admin notification chime & flash card)
    if (searchParams.get('alerts') === 'true') {
      const alerts = await getStaffAlerts(true);
      return NextResponse.json({ success: true, alerts });
    }

    // 2. Return expenses list
    if (searchParams.get('expenses') === 'true') {
      const expenses = await getStoreExpenses();
      return NextResponse.json({ success: true, expenses });
    }

    // 3. Return room folio by booking ID or Room Number
    if (searchParams.get('folio') === 'true') {
      const booking = searchParams.get('booking') || '';
      const roomStr = searchParams.get('room');
      const roomNum = roomStr ? Number(roomStr) : undefined;
      const folio = await getFolioForBooking(booking, roomNum);
      return NextResponse.json({ success: true, folio });
    }

    // Default: return all staff alerts
    const alerts = await getStaffAlerts(false);
    return NextResponse.json({ success: true, alerts });
  } catch (error: any) {
    console.error('API Orders GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Handle Quick Manager Expense entry
    if (body.isExpense || body.expense) {
      const expData = body.expense || body;
      if (!expData.amount || !expData.masterCategory) {
        return NextResponse.json(
          { success: false, error: 'Amount and category are required for expenses.' },
          { status: 400 }
        );
      }
      const savedExpense = await saveExpenseItem({
        expenseDate: expData.expenseDate || new Date().toISOString().split('T')[0],
        amount: Number(expData.amount),
        paymentMethod: expData.paymentMethod || 'upi',
        masterCategory: expData.masterCategory,
        subTag: expData.subTag || 'General',
        vendorPayee: expData.vendorPayee || '',
        description: expData.description || expData.subTag || 'Operational expense',
        billReceiptUrl: expData.billReceiptUrl,
        loggedByName: expData.loggedByName || 'Duty Manager',
      });
      return NextResponse.json({ success: true, expense: savedExpense }, { status: 201 });
    }

    // 2. Handle Food Orders and Special Celebration Requests
    if (!body.roomNumber || !body.guestName || !body.totalAmount) {
      return NextResponse.json(
        { success: false, error: 'Missing roomNumber, guestName, or totalAmount.' },
        { status: 400 }
      );
    }

    const result = await recordOrderOrSpecialRequest({
      type: body.type || 'food_order',
      bookingId: body.bookingId,
      bookingReference: body.bookingReference,
      roomNumber: Number(body.roomNumber),
      guestName: body.guestName,
      guestPhone: body.guestPhone,
      items: Array.isArray(body.items) ? body.items : [{ name: body.name || 'Order Item', price: Number(body.totalAmount), quantity: 1 }],
      totalAmount: Number(body.totalAmount),
      notes: body.notes || body.specialNotes,
      chargeCategory: body.chargeCategory,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('API Orders POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    // Acknowledge alert
    if (body.alertId) {
      const acknowledged = await acknowledgeStaffAlert(body.alertId);
      return NextResponse.json({ success: acknowledged });
    }

    return NextResponse.json({ success: false, error: 'Missing alertId' }, { status: 400 });
  } catch (error: any) {
    console.error('API Orders PATCH error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
