import { useEffect, useState } from 'react';

/**
 * Savera's contact numbers. The live values come from Website Settings → Site info
 * (phone = primary, phone_secondary = second number, whatsapp = the WhatsApp CTA number).
 * These defaults are used until that loads, and on pages that don't load it themselves.
 */
export const CONTACT = {
  phone: '+91 70046 56698',
  phoneSecondary: '+91 81012 98882',
  whatsapp: '917004656698',
} as const;

export interface SiteContact {
  phone: string;
  phoneSecondary: string;
  whatsapp: string;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** WhatsApp link: digits only, with country code (10-digit Indian numbers get 91). */
export function waHref(number: string, text?: string): string {
  let digits = (number || '').replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

let cached: SiteContact | null = null;
let pending: Promise<SiteContact> | null = null;

function fromSite(site: Partial<{ phone: string; phone_secondary: string; whatsapp: string }> | null | undefined): SiteContact {
  return {
    phone: site?.phone?.trim() || CONTACT.phone,
    phoneSecondary: site?.phone_secondary?.trim() || CONTACT.phoneSecondary,
    whatsapp: (site?.whatsapp || '').replace(/\D/g, '') || CONTACT.whatsapp,
  };
}

/** The current contact numbers from Website Settings (fetched once per page load). */
export function useSiteContact(): SiteContact {
  const [contact, setContact] = useState<SiteContact>(cached || fromSite(null));
  useEffect(() => {
    if (cached) return;
    pending =
      pending ||
      fetch('/api/cms', { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => (cached = fromSite(j?.data?.siteInfo)))
        .catch(() => fromSite(null));
    let alive = true;
    pending.then((c) => alive && setContact(c));
    return () => {
      alive = false;
    };
  }, []);
  return contact;
}
