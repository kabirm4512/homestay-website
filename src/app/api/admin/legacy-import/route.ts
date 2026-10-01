import { z } from 'zod';
import { handler, ok, readJson, clientIp } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { importLegacyData, LegacyPayload } from '@/lib/server/legacy-import';
import { audit } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
  includeContent: z.boolean().default(false),
  includeOperations: z.boolean().default(true),
  dryRun: z.boolean().default(false),
  data: z.record(z.unknown()),
});

/**
 * Admin only: moves data the OLD version kept in this browser (front-desk bookings, folios,
 * orders, expenses; optionally website content and tariffs) into the database. Merges:
 * records the server already has are kept; folios on both sides have their charges and
 * payments united. Sent in several smaller requests by the admin panel.
 */
export const POST = handler('admin.legacy_import', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.ADMIN);
  const body = await readJson(request, Body);
  const actor = `staff:${staff.id}`;
  const report = await importLegacyData(body.data as LegacyPayload, {
    mode: 'merge',
    includeContent: body.includeContent === true,
    includeOperations: body.includeOperations !== false,
    dryRun: body.dryRun,
    actor,
  });
  if (!body.dryRun) {
    await audit({ actor, action: 'legacy_device_import', entity: 'system', after: { added: report.added, updated: report.updated }, ip: clientIp(request) });
  }
  return ok({ report });
});
