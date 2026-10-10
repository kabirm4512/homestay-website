import { z } from 'zod';
import { handler, ok, readJson, HttpError, clientIp } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { getSetting, putSetting, SETTINGS } from '@/lib/server/repos/settings';
import { audit } from '@/lib/server/audit';
import { CONTACT_DEFAULTS, formatPhone, phoneProblem, toE164Digits } from '@/lib/contact-format';
import type { SiteInfo } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * Savera's contact numbers (stored in the site info): the primary number (call buttons,
 * footer, guest pages, QR standees), an optional second number, and the WhatsApp number
 * used by every WhatsApp button.
 */
function contactOf(site: Partial<SiteInfo> | null) {
  return {
    phone: site?.phone || CONTACT_DEFAULTS.phone,
    phoneSecondary: site?.phone_secondary ?? '',
    whatsapp: toE164Digits(site?.whatsapp || '') || CONTACT_DEFAULTS.whatsapp,
  };
}

/** Public: the numbers the website shows. */
export const GET = handler('contact.get', async () => {
  const site = await getSetting<SiteInfo>(SETTINGS.CMS_SITE);
  return ok({ contact: contactOf(site) });
});

const Body = z.object({
  phone: z.string().trim().max(30),
  phoneSecondary: z.string().trim().max(30).optional().default(''),
  whatsapp: z.string().trim().max(30),
});

/** Admin: change the numbers. Takes effect on the website at once. */
export const PUT = handler('contact.update', async (request: Request) => {
  const admin = await requireStaff(request, ROLES.ADMIN);
  const body = await readJson(request, Body);
  const secondary = body.phoneSecondary || '';
  const checks: [string, string | null][] = [
    ['Primary number', phoneProblem(body.phone)],
    ['Second number', phoneProblem(secondary, { required: false })],
    ['WhatsApp number', phoneProblem(body.whatsapp)],
  ];
  const problems = checks.filter(([, p]) => p);
  if (problems.length) throw new HttpError(400, problems.map(([f, p]) => `${f}: ${p}`).join(' '));

  const before = await getSetting<SiteInfo>(SETTINGS.CMS_SITE);
  const after = {
    ...(before || {}),
    phone: formatPhone(body.phone),
    phone_secondary: secondary ? formatPhone(secondary) : '',
    whatsapp: toE164Digits(body.whatsapp),
  };
  await putSetting(SETTINGS.CMS_SITE, after, `staff:${admin.id}`);
  await audit({
    actor: `staff:${admin.id}`,
    action: 'update_contact_numbers',
    entity: 'cms',
    entityId: SETTINGS.CMS_SITE,
    before: contactOf(before),
    after: contactOf(after as SiteInfo),
    ip: clientIp(request),
  });
  return ok({ contact: contactOf(after as SiteInfo) });
});
