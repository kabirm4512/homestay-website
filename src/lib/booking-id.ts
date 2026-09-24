/**
 * Universal Booking ID and Indian States Utilities for Savera Homestay
 * Format: SH-2K2609001
 *   - SH-: Savera Homestay prefix
 *   - 2K26: Year (2026 -> 2K26)
 *   - 09: Month (01-12)
 *   - 001: 3-digit serial number
 */

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi (NCT)',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Other / International',
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

/**
 * Format year into 2KYY (e.g. 2026 -> 2K26, 2025 -> 2K25)
 */
export function formatYearCode(year: number): string {
  const yy = String(year).slice(-2);
  return `2K${yy}`;
}

/**
 * Generates a universal booking reference in the strict format:
 * SH-2K2609001 (SH + 2K<YY> + <MM> + <###>)
 */
export function generateUniversalBookingId(
  targetDate?: Date | string,
  existingReferences?: string[]
): string {
  const d = targetDate ? new Date(targetDate) : new Date();
  const yearCode = formatYearCode(d.getFullYear());
  const monthCode = String(d.getMonth() + 1).padStart(2, '0');
  const prefix = `SH-${yearCode}${monthCode}`;

  let maxSeq = 0;

  // 1. Check existing references if provided
  if (Array.isArray(existingReferences)) {
    const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');
    existingReferences.forEach((ref) => {
      const match = ref?.trim().match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    });
  }

  // 2. Check localStorage sequence counter if available in browser
  if (typeof window !== 'undefined') {
    try {
      const storageKey = `savera_booking_seq_${yearCode}${monthCode}`;
      const savedSeq = localStorage.getItem(storageKey);
      if (savedSeq) {
        const num = parseInt(savedSeq, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    } catch {}
  }

  const nextSeq = maxSeq + 1;

  // Persist updated sequence counter
  if (typeof window !== 'undefined') {
    try {
      const storageKey = `savera_booking_seq_${yearCode}${monthCode}`;
      localStorage.setItem(storageKey, String(nextSeq));
    } catch {}
  }

  const seqStr = String(nextSeq).padStart(3, '0');
  return `${prefix}${seqStr}`;
}

/**
 * Check if a reference matches the universal booking ID pattern or legacy pattern
 */
export function isUniversalBookingId(ref: string): boolean {
  if (!ref) return false;
  return /^SH-2K\d{2}\d{2}\d{3,}$/i.test(ref.trim());
}

/**
 * Greeting based on current local time
 */
export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 22) return 'Good Evening';
  return 'Good Evening';
}
