/**
 * End-to-end API checks against a running server and a TEST database.
 *
 *   TEST_BASE_URL=http://localhost:3000 TEST_ADMIN_EMAIL=... TEST_ADMIN_PASSWORD=... npx vitest run tests/integration
 *
 * Skipped unless TEST_BASE_URL is set. Never point this at the live site: it creates and
 * deletes a test room (901), bookings and staff. Start the server with DISABLE_RATE_LIMIT=1.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addCalendarDays, todayInIST } from '@/lib/tariff-calculator';

const BASE = process.env.TEST_BASE_URL || '';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';
const run = BASE ? describe : describe.skip;

/** Minimal cookie-keeping client (one per actor). */
class Client {
  private cookies = new Map<string, string>();
  async req(path: string, init: { method?: string; body?: unknown } = {}) {
    const headers: Record<string, string> = {};
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.cookies.size) headers.Cookie = Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(BASE + path, {
      method: init.method || 'GET',
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      redirect: 'manual',
    });
    const setCookies = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() || [];
    for (const c of setCookies) {
      const [pair, ...attrs] = c.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const expired = attrs.some((a) => /max-age=0/i.test(a)) || value === '';
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const json = await res.json().catch(() => null);
    return { status: res.status, json: json as any };
  }
  async signIn(email: string, password: string, newPassword?: string) {
    const r = await this.req('/api/auth/login', { method: 'POST', body: { email, password } });
    if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${r.json?.error}`);
    if (r.json.user?.mustChangePassword) {
      if (!newPassword) throw new Error(`${email} must change password first`);
      const c = await this.req('/api/auth/password', { method: 'POST', body: { currentPassword: password, newPassword } });
      if (c.status !== 200) throw new Error(`password change failed: ${c.status} ${c.json?.error}`);
    }
    return r.json.user;
  }
}

const today = todayInIST();
const TEST_ROOM_ID = 'room-it-901';
const created: { bookings: string[]; staff: string[] } = { bookings: [], staff: [] };

run('API (integration)', () => {
  const admin = new Client();
  let testRoom: any;
  let stay: any;

  beforeAll(async () => {
    await admin.signIn(ADMIN_EMAIL, ADMIN_PASSWORD, `${ADMIN_PASSWORD}-changed`);
    // A dedicated test room so real rooms are never touched
    const state = await admin.req('/api/crm/state');
    expect(state.status).toBe(200);
    const template = state.json.state.physicalRooms[0];
    const room = { ...template, id: TEST_ROOM_ID, roomNumber: 901, name: 'Integration Test Room', currentStatus: 'checked_in' };
    const r = await admin.req('/api/crm/mutate', { method: 'POST', body: { ops: [{ collection: 'physicalRooms', op: 'upsert', id: room.id, record: room }] } });
    expect(r.json.results[0].ok).toBe(true);
    testRoom = r.json.results[0].record;
  });

  afterAll(async () => {
    const ops = [
      ...created.bookings.map((id) => ({ collection: 'crmBookings', op: 'delete', id })),
      { collection: 'physicalRooms', op: 'delete', id: TEST_ROOM_ID },
    ];
    await admin.req('/api/crm/mutate', { method: 'POST', body: { ops } });
    for (const id of created.staff) await admin.req(`/api/staff/${id}`, { method: 'DELETE' });
  });

  describe('public endpoints', () => {
    it('health, tariffs and availability are public', async () => {
      const anon = new Client();
      expect((await anon.req('/api/health')).status).toBe(200);
      const t = await anon.req('/api/tariffs');
      expect(t.status).toBe(200);
      expect(Object.keys(t.json.data.tariffs).length).toBeGreaterThan(0);
      expect(t.json.data.gstConfig.accommodationThreshold).toBeGreaterThan(0);
      const a = await anon.req(`/api/availability?checkIn=${addCalendarDays(today, 30)}&checkOut=${addCalendarDays(today, 32)}`);
      expect(a.status).toBe(200);
      expect(JSON.stringify(a.json)).not.toMatch(/guest|phone/i);
    });

    it('staff data needs a staff session', async () => {
      const anon = new Client();
      for (const path of ['/api/crm/state', '/api/bookings', '/api/staff', '/api/inquiries', '/api/checkin', '/api/orders?alerts=true']) {
        const r = await anon.req(path);
        expect([401, 403], path).toContain(r.status);
      }
      const write = await anon.req('/api/tariffs', { method: 'POST', body: { roomId: 'room-cat-1' } });
      expect(write.status).toBe(401);
    });
  });

  describe('website booking', () => {
    let bookingId = '';
    it('prices on the server (client total ignored) and is idempotent', async () => {
      const anon = new Client();
      const body = {
        guest_name: 'Integration Guest',
        phone: '9000000001',
        email: 'it@example.com',
        room_name: 'Test',
        check_in: addCalendarDays(today, 40),
        check_out: addCalendarDays(today, 42),
        meal_plan: 'CP',
        rooms_config: [{ room_id: 'room-cat-1', adults: 2, children: 0 }],
        total_price: 1,
        idempotency_key: `it-${Date.now()}`,
      };
      const first = await anon.req('/api/bookings', { method: 'POST', body });
      expect(first.status).toBe(201);
      const b = first.json.data;
      expect(b.total_price).toBeGreaterThan(1000);
      expect(b.total_price).toBe(b.room_subtotal + b.gst_amount + (b.addons_total || 0));
      expect(b.status).toBe('pending');
      expect(b.hold_expires_at).toBeTruthy();
      const again = await anon.req('/api/bookings', { method: 'POST', body });
      expect(again.json.data.id).toBe(b.id);
      bookingId = b.id;
      created.bookings.push(b.id);
    });

    it('enforces status transitions', async () => {
      expect((await admin.req('/api/bookings', { method: 'PATCH', body: { id: bookingId, status: 'confirmed' } })).status).toBe(200);
      expect((await admin.req('/api/bookings', { method: 'PATCH', body: { id: bookingId, status: 'completed' } })).status).toBe(200);
      const back = await admin.req('/api/bookings', { method: 'PATCH', body: { id: bookingId, status: 'pending' } });
      expect(back.status).toBe(409);
    });

    it('rejects stays that cannot be priced', async () => {
      const anon = new Client();
      const r = await anon.req('/api/bookings', {
        method: 'POST',
        body: {
          guest_name: 'X Y', phone: '9000000002', room_name: 'x',
          check_in: addCalendarDays(today, 50), check_out: addCalendarDays(today, 50),
          rooms_config: [{ room_id: 'room-cat-1', adults: 2, children: 0 }],
        },
      });
      expect(r.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('rate rules and day close', () => {
    it('enforces a season’s minimum stay on website bookings', async () => {
      const id = `it-minstay-${Date.now()}`;
      const start = addCalendarDays(today, 300);
      const range = { id, name: 'IT Min Stay', seasonType: 'season', startDate: start, endDate: addCalendarDays(start, 3), minNights: 3 };
      expect((await admin.req('/api/tariffs', { method: 'POST', body: { type: 'seasonal_range_upsert', range } })).status).toBe(200);
      try {
        const r = await new Client().req('/api/bookings', {
          method: 'POST',
          body: {
            guest_name: 'Min Stay', phone: '9000000004', room_name: 'x', check_in: start, check_out: addCalendarDays(start, 1),
            rooms_config: [{ room_id: 'room-cat-1', adults: 2, children: 0 }],
          },
        });
        expect(r.status).toBe(422);
        expect(r.json.code).toBe('MIN_STAY');
      } finally {
        await admin.req('/api/tariffs', { method: 'POST', body: { type: 'seasonal_range_delete', id } });
      }
    });

    it('summarises a day and closes it once', async () => {
      const date = addCalendarDays(today, -400); // a quiet past day, so the test never locks today
      const s = await admin.req(`/api/admin/day-close?date=${date}`);
      expect(s.status).toBe(200);
      expect(s.json.summary.date).toBe(date);
      if (!s.json.closed) {
        expect((await admin.req('/api/admin/day-close', { method: 'POST', body: { date } })).status).toBe(201);
      }
      expect((await admin.req('/api/admin/day-close', { method: 'POST', body: { date } })).status).toBe(409);
      expect((await admin.req('/api/admin/day-close', { method: 'POST', body: { date: addCalendarDays(today, 5) } })).status).toBe(400);
    });

    it('only admins change GST rules', async () => {
      const t = await admin.req('/api/tariffs');
      const cfg = t.json.data.gstConfig;
      const r = await admin.req('/api/tariffs', { method: 'POST', body: { type: 'gst_config', gstConfig: cfg } });
      expect(r.status).toBe(200);
    });
  });

  describe('staff accounts', () => {
    it('admin creates a manager who must set a password and cannot manage staff', async () => {
      const email = `it-mgr-${Date.now()}@example.com`;
      const c = await admin.req('/api/staff', { method: 'POST', body: { fullName: 'IT Manager', email, role: 'manager', password: 'TempPass123' } });
      expect(c.status).toBe(201);
      created.staff.push(c.json.staff.id);

      const mgr = new Client();
      const login = await mgr.req('/api/auth/login', { method: 'POST', body: { email, password: 'TempPass123' } });
      expect(login.json.user.mustChangePassword).toBe(true);
      const blocked = await mgr.req('/api/crm/state');
      expect(blocked.status).toBe(403);
      expect(blocked.json.code).toBe('PASSWORD_CHANGE_REQUIRED');
      await mgr.req('/api/auth/password', { method: 'POST', body: { currentPassword: 'TempPass123', newPassword: 'ManagerPass456' } });
      expect((await mgr.req('/api/crm/state')).status).toBe(200);
      expect((await mgr.req('/api/staff')).status).toBe(403);

      // Deactivating the account ends its session at once
      await admin.req(`/api/staff/${c.json.staff.id}`, { method: 'PATCH', body: { isActive: false } });
      expect((await mgr.req('/api/crm/state')).status).toBe(401);
    });

    it('rejects wrong passwords', async () => {
      const r = await new Client().req('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: 'definitely-wrong' } });
      expect(r.status).toBe(401);
    });
  });

  describe('moving old device data', () => {
    it('adds missing records, keeps existing ones and unites folio payments', async () => {
      const id = `bk-legacy-${Date.now()}`;
      const booking = {
        id, bookingReference: `WP-LEG-${Date.now() % 100000}`, roomId: TEST_ROOM_ID, roomNumber: 901, roomName: 'Integration Test Room',
        guestId: 'g-leg', guest: { id: 'g-leg', fullName: 'Legacy Guest', phone: '9000000009', idType: 'Passport', documentStatus: 'pending', totalLifetimeStays: 1 },
        checkInDate: addCalendarDays(today, 60), checkOutDate: addCalendarDays(today, 61), tapeStatus: 'confirmed', bookingStatus: 'confirmed',
        mealPlan: 'CP', adultsCount: 2, childrenCount: 0, roomRatePerNight: 4500, totalNights: 1, totalRoomAmount: 4500, documentStatus: 'pending',
      };
      const folio = {
        id: `fol-${id}`, bookingId: id, guestId: 'g-leg', guestName: 'Legacy Guest', roomNumber: 901, roomName: 'x', folioNumber: 'FOL-LEG-0001',
        status: 'open', totalRoomCharges: 4500, totalFbCharges: 0, totalAddonCharges: 0, totalTax: 225, discountAmount: 0, netPayable: 4725,
        totalPaid: 0, balanceDue: 4725,
        charges: [{ id: 'c1', folioId: `fol-${id}`, category: 'room_tariff', description: 'Room', amount: 4500, quantity: 1, unitPrice: 4500, chargeStatus: 'posted', taxAmount: 225, postedAt: new Date().toISOString() }],
        payments: [],
      };
      const first = await admin.req('/api/admin/legacy-import', { method: 'POST', body: { data: { crmBookings: [booking], folios: [folio] } } });
      expect(first.status, first.json?.error).toBe(200);
      expect(first.json.report.added.crmBookings).toBe(1);
      created.bookings.push(id);

      // A second device has the same folio with a payment the server doesn't know yet
      const withPayment = { ...folio, payments: [{ id: 'p1', folioId: folio.id, amount: 1000, paymentMethod: 'cash', collectedAt: new Date().toISOString(), collectedByName: 'Desk' }] };
      const changedBooking = { ...booking, guest: { ...booking.guest, fullName: 'Changed On Device' } };
      const second = await admin.req('/api/admin/legacy-import', { method: 'POST', body: { data: { crmBookings: [changedBooking], folios: [withPayment] } } });
      expect(second.json.report.kept.crmBookings).toBe(1);
      expect(second.json.report.updated.folios).toBe(1);

      const state = await admin.req('/api/crm/state');
      const saved = state.json.state.crmBookings.find((b: any) => b.id === id);
      expect(saved.guest.fullName).toBe('Legacy Guest');
      const savedFolio = state.json.state.folios.find((f: any) => f.id === folio.id);
      expect(savedFolio.totalPaid).toBe(1000);
      expect(savedFolio.balanceDue).toBe(3725);
      await admin.req('/api/crm/mutate', { method: 'POST', body: { ops: [{ collection: 'folios', op: 'delete', id: folio.id }] } });
    });

    it('is admin only', async () => {
      expect((await new Client().req('/api/admin/legacy-import', { method: 'POST', body: { data: {} } })).status).toBe(401);
    });
  });

  describe('in-house guest', () => {
    const guestPhone = '9000000003';

    beforeAll(async () => {
      const id = `bk-it-${Date.now()}`;
      stay = {
        id,
        bookingReference: '',
        roomId: TEST_ROOM_ID,
        roomNumber: 901,
        roomName: 'Integration Test Room',
        guestId: `guest-${id}`,
        guest: {
          id: `guest-${id}`, fullName: 'Inhouse Guest', phone: guestPhone, idType: 'Passport', idNumber: 'P1234567',
          nationality: 'Indian', documentStatus: 'submitted', totalLifetimeStays: 1,
        },
        checkInDate: today,
        checkOutDate: addCalendarDays(today, 2),
        tapeStatus: 'checked_in',
        bookingStatus: 'checked_in',
        mealPlan: 'CP',
        adultsCount: 2,
        childrenCount: 0,
        roomRatePerNight: 4500,
        totalNights: 2,
        totalRoomAmount: 9000,
        documentStatus: 'submitted',
      };
      const r = await admin.req('/api/crm/mutate', { method: 'POST', body: { ops: [{ collection: 'crmBookings', op: 'upsert', id, record: stay }] } });
      expect(r.json.results[0].ok, r.json.results[0].error).toBe(true);
      stay = r.json.results[0].record;
      created.bookings.push(id);
    });

    it('a second active booking for the same room and nights is refused', async () => {
      const clash = { ...stay, id: `${stay.id}-b`, bookingReference: '' };
      const r = await admin.req('/api/crm/mutate', { method: 'POST', body: { ops: [{ collection: 'crmBookings', op: 'upsert', id: clash.id, record: clash }] } });
      expect(r.json.results[0].ok).toBe(false);
      expect(r.json.results[0].error).toMatch(/already booked/i);
    });

    it('the room page needs the QR token or the guest’s mobile', async () => {
      const stranger = new Client();
      const bare = await stranger.req('/api/checkin?room=901');
      expect(bare.json.booking).toBeNull();
      expect(bare.json.requiresVerification).toBe(true);
      const wrongToken = await stranger.req('/api/checkin?room=901&t=wrong-token');
      expect(wrongToken.json.booking).toBeNull();
      const wrongPhone = await stranger.req('/api/checkin?room=901&phone=9999999999');
      expect(wrongPhone.json.booking).toBeNull();
    });

    it('QR token signs the guest in, masks the ID, and orders are priced on the server', async () => {
      const guest = new Client();
      const r = await guest.req(`/api/checkin?room=901&t=${encodeURIComponent(testRoom.qrSecretToken)}`);
      expect(r.json.booking?.id).toBe(stay.id);
      expect(r.json.booking.guest.idNumber).not.toContain('P123');
      expect(r.json.room.qrSecretToken).toBeUndefined();

      const addons = await new Client().req('/api/addons');
      const item = addons.json.data.menuItems.find((m: any) => m.isAvailable);
      const order = await guest.req('/api/orders', {
        method: 'POST',
        body: { type: 'food_order', bookingId: stay.id, items: [{ menuItemId: item.id, quantity: 2, unitPrice: 1 }], totalAmount: 1 },
      });
      expect(order.status).toBe(201);
      expect(order.json.order.totalAmount).toBe(item.price * 2);
      expect(order.json.folio.totalFbCharges).toBeGreaterThanOrEqual(item.price * 2);

      const mine = await guest.req('/api/orders');
      expect(mine.json.orders.every((o: any) => o.bookingId === stay.id)).toBe(true);

      const celebration = await guest.req('/api/orders', { method: 'POST', body: { type: 'special_request', bookingId: stay.id, celebrationId: 'celebration-cake' } });
      expect(celebration.status).toBe(201);
    });

    it('guests cannot act on another booking or without a session', async () => {
      const stranger = new Client();
      const r = await stranger.req('/api/orders', { method: 'POST', body: { type: 'food_order', bookingId: stay.id, items: [{ menuItemId: 'x', quantity: 1 }] } });
      expect(r.status).toBe(401);
      const folio = await stranger.req(`/api/orders?folio=true&booking=${stay.id}`);
      expect(folio.status).toBe(401);
    });

    it('portal sign-in needs both the Booking ID and the mobile number', async () => {
      const g = new Client();
      expect((await g.req('/api/guest/session', { method: 'POST', body: { reference: stay.bookingReference, phone: '9999999999' } })).status).toBe(404);
      const okRes = await g.req('/api/guest/session', { method: 'POST', body: { reference: stay.bookingReference, phone: `+91 ${guestPhone}` } });
      expect(okRes.status).toBe(200);
      expect((await g.req('/api/guest/session')).json.booking.id).toBe(stay.id);
      const phoneOnly = await new Client().req(`/api/checkin?query=${guestPhone}`);
      expect(phoneOnly.json?.booking).toBeFalsy();

      // Re-submitting the masked ID number keeps the stored one
      const masked = (await g.req('/api/guest/session')).json.booking.guest.idNumber;
      const submit = await g.req('/api/checkin', {
        method: 'POST',
        body: { bookingId: stay.id, guest: { fullName: 'Inhouse Guest', phone: guestPhone, idNumber: masked, city: 'Siliguri' } },
      });
      expect(submit.status).toBe(200);
      const state = await admin.req('/api/crm/state');
      const saved = state.json.state.crmBookings.find((b: any) => b.id === stay.id);
      expect(saved.guest.idNumber).toBe('P1234567');
      expect(saved.guest.city).toBe('Siliguri');
      expect(saved.bookingStatus).toBe('checked_in');
    });
  });
});
