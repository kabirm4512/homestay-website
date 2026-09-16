import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { passcode } = body;

    const correctCode = process.env.ADMIN_ACCESS_CODE || 'homestay2025';

    if (passcode === correctCode) {
      return NextResponse.json({
        success: true,
        token: 'auth_' + Buffer.from(passcode + Date.now()).toString('base64'),
        user: { name: 'Homestay Administrator', role: 'owner' }
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid access code. Please try again.' },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
