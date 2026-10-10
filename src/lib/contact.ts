import { useEffect, useState } from 'react';
import { CONTACT_DEFAULTS, telHref, waHref } from './contact-format';

export { telHref, waHref };

/**
 * Savera's contact numbers. The live values are set by an admin in
 * Website Settings → Contact numbers. These defaults are used until they load.
 */
export const CONTACT = CONTACT_DEFAULTS;

export interface SiteContact {
  phone: string;
  phoneSecondary: string;
  whatsapp: string;
}

let cached: SiteContact | null = null;
let pending: Promise<SiteContact> | null = null;

function normalise(c: Partial<SiteContact> | null | undefined): SiteContact {
  return {
    phone: c?.phone?.trim() || CONTACT.phone,
    phoneSecondary: c?.phoneSecondary?.trim() ?? CONTACT.phoneSecondary,
    whatsapp: (c?.whatsapp || '').replace(/\D/g, '') || CONTACT.whatsapp,
  };
}

/** Forget the cached numbers (after an admin saves new ones on this device). */
export function invalidateSiteContact(next?: SiteContact) {
  cached = next || null;
  pending = null;
}

/** The current contact numbers (fetched once per page load). */
export function useSiteContact(): SiteContact {
  const [contact, setContact] = useState<SiteContact>(cached || normalise(null));
  useEffect(() => {
    if (cached) {
      setContact(cached);
      return;
    }
    pending =
      pending ||
      fetch('/api/contact', { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => (cached = normalise(j?.contact)))
        .catch(() => normalise(null));
    let alive = true;
    pending.then((c) => alive && setContact(c));
    return () => {
      alive = false;
    };
  }, []);
  return contact;
}
