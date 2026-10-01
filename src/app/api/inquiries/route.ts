import { z } from 'zod';
import { handler, ok, readJson, clientIp } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { createInquiry, listInquiries, updateInquiry } from '@/lib/server/repos/inquiries';
import { audit } from '@/lib/server/audit';
import { raiseStaffAlert } from '@/lib/server/alerts';

export const dynamic = 'force-dynamic';

/** Admin / manager: all inquiries (guest contact details). */
export const GET = handler('inquiries.list', async (request: Request) => {
  await requireStaff(request, ROLES.MANAGERS);
  return ok({ data: await listInquiries() });
});

const NewInquiry = z.object({
  guest_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(20),
  email: z.union([z.string().trim().email().max(200), z.literal('')]).optional(),
  check_in: z.string().max(10).optional(),
  check_out: z.string().max(10).optional(),
  guests_count: z.coerce.number().int().min(1).max(50).optional(),
  room_id: z.string().max(100).optional(),
  room_name: z.string().max(300).optional(),
  message: z.string().max(3000).optional(),
  source: z.string().max(50).optional(),
});

/** Public: website enquiry form. */
export const POST = handler('inquiries.create', async (request: Request) => {
  await rateLimit(request, 'inquiry', 5, 10 * 60);
  const body = await readJson(request, NewInquiry);
  const inquiry = await createInquiry({
    guest_name: body.guest_name,
    email: body.email || '',
    phone: body.phone,
    check_in: body.check_in || '',
    check_out: body.check_out || '',
    guests_count: body.guests_count || 2,
    room_id: body.room_id || '',
    room_name: body.room_name || '',
    message: body.message || '',
    source: body.source || 'website_modal',
    internal_notes: '',
  });
  await audit({ actor: 'guest:web', action: 'create', entity: 'inquiry', entityId: inquiry.id, ip: clientIp(request) });
  await raiseStaffAlert({
    type: 'inquiry',
    roomNumber: 0,
    guestName: inquiry.guest_name,
    orderDetails: `✉️ New enquiry${inquiry.room_name ? ` for ${inquiry.room_name}` : ''}${inquiry.check_in ? ` · ${inquiry.check_in} → ${inquiry.check_out}` : ''}`,
    totalAmount: 0,
  });
  return ok({ data: inquiry }, { status: 201 });
});

const Patch = z.object({
  id: z.string().min(1),
  status: z.enum(['pending', 'contacted', 'confirmed', 'cancelled']),
  internal_notes: z.string().max(3000).optional(),
});

export const PATCH = handler('inquiries.update', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.MANAGERS);
  const body = await readJson(request, Patch);
  const { before, after } = await updateInquiry(body.id, { status: body.status, internal_notes: body.internal_notes });
  await audit({ actor: `staff:${staff.id}`, action: 'update', entity: 'inquiry', entityId: body.id, before, after, ip: clientIp(request) });
  return ok({ data: after });
});
