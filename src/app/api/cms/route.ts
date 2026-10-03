import { z } from 'zod';
import { handler, ok, readJson, clientIp, PUBLIC_SHORT_CACHE } from '@/lib/server/http';
import { requireStaff, ROLES } from '@/lib/server/auth/staff-session';
import { getCmsContent, putSetting, getSetting, SETTINGS } from '@/lib/server/repos/settings';
import { persistDataUrl } from '@/lib/server/repos/files';
import { audit } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

/** Public: website copy (hero slides, about, site info, reviews). */
export const GET = handler('cms.get', async () => ok({ data: await getCmsContent() }, { headers: PUBLIC_SHORT_CACHE }));

const Body = z.object({
  type: z.enum(['hero_carousel', 'about_section', 'site_info', 'reviews']),
  payload: z.unknown(),
});

/** Admin / manager: edit website copy. */
export const POST = handler('cms.save', async (request: Request) => {
  const staff = await requireStaff(request, ROLES.MANAGERS);
  const actor = `staff:${staff.id}`;
  const { type, payload } = await readJson(request, Body);
  const keyFor = { hero_carousel: SETTINGS.CMS_HERO, about_section: SETTINGS.CMS_ABOUT, site_info: SETTINGS.CMS_SITE, reviews: SETTINGS.CMS_REVIEWS } as const;
  const key = keyFor[type];

  let value: unknown = payload;
  if (type === 'hero_carousel') {
    const slides = z.array(z.object({ id: z.string(), image: z.string() }).passthrough()).max(20).parse(payload);
    const stored = await Promise.all(
      slides.map(async (s) => ({ ...s, image: (await persistDataUrl(s.image, { visibility: 'public', ownerKind: 'cms', actor })) || s.image }))
    );
    value = { slides: stored };
  } else if (type === 'reviews') {
    value = { reviews: z.array(z.object({ id: z.string() }).passthrough()).max(200).parse(payload) };
  } else {
    value = z.object({}).passthrough().parse(payload);
  }

  const before = await getSetting(key);
  await putSetting(key, value, actor);
  await audit({ actor, action: 'update', entity: 'cms', entityId: key, before, after: value, ip: clientIp(request) });
  return ok({ message: 'CMS updated successfully' });
});
