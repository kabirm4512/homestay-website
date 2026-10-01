import { describe, expect, it } from 'vitest';
import { createToken, verifyToken } from '@/lib/server/auth/tokens';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/server/auth/password';
import { normalizePhone, normalizeReference } from '@/lib/phone';
import { rentalRate, transferRate } from '@/lib/transport-pricing';
import type { RentalVehicle, SeasonalDateRange, TransferRoute } from '@/types/crm';

describe('session tokens', () => {
  it('round-trips signed claims', () => {
    const t = createToken({ sub: 'staff-1', sv: 2 }, 60);
    expect(verifyToken<{ sub: string; sv: number }>(t)?.sub).toBe('staff-1');
  });
  it('rejects tampered and expired tokens', () => {
    const t = createToken({ sub: 'staff-1' }, 60);
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9999999999 })).toString('base64url');
    expect(verifyToken(`${forged}.${sig}`)).toBeNull();
    expect(verifyToken(`${body}.${sig.split("").reverse().join("")}`)).toBeNull();
    expect(verifyToken(createToken({ sub: 'x' }, -10))).toBeNull();
    expect(verifyToken('garbage')).toBeNull();
  });
});

describe('passwords', () => {
  it('hashes with a salt and verifies', async () => {
    const a = await hashPassword('correct horse');
    const b = await hashPassword('correct horse');
    expect(a).not.toBe(b);
    expect(await verifyPassword('correct horse', a)).toBe(true);
    expect(await verifyPassword('wrong horse', a)).toBe(false);
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
  });
  it('requires at least 8 characters', () => {
    expect(passwordProblem('short')).toBeTruthy();
    expect(passwordProblem('long enough')).toBeNull();
  });
});

describe('guest identity helpers', () => {
  it('compares mobile numbers on the last 10 digits', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('9876543210');
    expect(normalizePhone('09876543210')).toBe('9876543210');
  });
  it('normalizes booking references', () => {
    expect(normalizeReference(' sh-2k2610001 ')).toBe(normalizeReference('SH2K2610001'));
  });
});

describe('transport pricing', () => {
  const ranges: SeasonalDateRange[] = [{ id: 's', name: 'Peak', seasonType: 'season', startDate: '2026-10-10', endDate: '2026-10-20' }];
  const route = { id: 'r', title: 'IXB', priceWagonR: 2800, priceSedan: 3200, priceSUV: 4200, modifiers: [] } as unknown as TransferRoute;
  const vehicle = { id: 'v', vehicleName: 'Scooty', ratePerDay: 800 } as unknown as RentalVehicle;
  it('applies the season surge to transfers', () => {
    expect(transferRate(route, '2026-09-01', 'sedan', ranges).rate).toBe(3200);
    expect(transferRate(route, '2026-10-12', 'sedan', ranges).rate).toBe(3840);
  });
  it('prices rentals day by day', () => {
    const r = rentalRate(vehicle, '2026-10-09', '2026-10-11', ranges);
    expect(r.days).toBe(2);
    expect(r.totalRate).toBe(800 + 960);
  });
});
