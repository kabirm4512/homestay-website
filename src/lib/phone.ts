/** Normalises an Indian mobile number to its last 10 digits (other formats: digits only). */
export function normalizePhone(raw: string | undefined | null): string {
  const digits = (raw || '').replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/** Normalises a booking reference for comparison (case/spacing/punctuation insensitive). */
export function normalizeReference(raw: string | undefined | null): string {
  return (raw || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}
