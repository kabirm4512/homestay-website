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
  /** Front desk for in-house guests (concierge, guest portal, check-in). Falls back to `phone`. */
  frontDeskPhone: string;
  /** WhatsApp for in-house guests' requests (orders, transfers, checkout). Falls back to `whatsapp`. */
  frontDeskWhatsapp: string;
}

let cached: SiteContact | null = null;
let pending: Promise<SiteContact> | null = null;

function normalise(c: Partial<SiteContact> | null | undefined): SiteContact {
  const phone = c?.phone?.trim() || CONTACT.phone;
  const whatsapp = (c?.whatsapp || '').replace(/\D/g, '') || CONTACT.whatsapp;
  return {
    phone,
    phoneSecondary: c?.phoneSecondary?.trim() ?? CONTACT.phoneSecondary,
    whatsapp,
    frontDeskPhone: c?.frontDeskPhone?.trim() || phone,
    frontDeskWhatsapp: (c?.frontDeskWhatsapp || '').replace(/\D/g, '') || whatsapp,
  };
}

/** Forget the cached numbers (after an admin saves new ones on this device). */
export function invalidateSiteContact(next?: Partial<SiteContact>) {
  cached = next ? normalise(next) : null;
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
