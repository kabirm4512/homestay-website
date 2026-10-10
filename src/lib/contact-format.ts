/**
 * Pure helpers for contact numbers (used by the browser and the server).
 * Indian 10-digit mobiles are stored as "+91 70046 56698" (display) and "917004656698" (WhatsApp).
 */

export const CONTACT_DEFAULTS = {
  phone: '+91 70046 56698',
  phoneSecondary: '+91 81012 98882',
  whatsapp: '917004656698',
} as const;

/** Digits with the country code, e.g. "7004656698" or "+91 70046-56698" → "917004656698". */
export function toE164Digits(input: string): string {
  let d = (input || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1); // 07004656698
  if (d.length === 10) d = `91${d}`;
  return d;
}

/** "917004656698" → "+91 70046 56698"; other countries → "+<digits>". */
export function formatPhone(input: string): string {
  const d = toE164Digits(input);
  if (!d) return '';
  if (d.length === 12 && d.startsWith('91')) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return `+${d}`;
}

/** A problem with the number, or null when it is usable. */
export function phoneProblem(input: string, { required = true } = {}): string | null {
  const d = toE164Digits(input);
  if (!d) return required ? 'Enter a phone number.' : null;
  if (d.startsWith('91')) {
    if (d.length !== 12) return 'An Indian mobile number has 10 digits.';
    if (!/^[6-9]/.test(d.slice(2))) return 'An Indian mobile number starts with 6, 7, 8 or 9.';
    return null;
  }
  if (d.length < 10) return 'Enter a 10-digit mobile number.';
  if (d.length > 15) return 'That number is too long.';
  return null;
}

export function telHref(phone: string): string {
  const d = toE164Digits(phone);
  return d ? `tel:+${d}` : 'tel:';
}

/** WhatsApp link: digits only, with country code. */
export function waHref(number: string, text?: string): string {
  return `https://wa.me/${toE164Digits(number)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
