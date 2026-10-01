'use client';

/**
 * Room photo preparation for the admin panel.
 *
 * Photos are stored as data URLs inside the room record, so an untouched phone photo
 * (3–8 MB, ~33% bigger again as base64) made the room save request too large for the
 * server (Vercel rejects bodies over ~4.5 MB) and too large for localStorage, and the
 * failure was silent. Every photo is now resized and re-encoded in the browser first.
 */

export const ROOM_PHOTO_MAX_DIMENSION = 1600; // px, longest side
export const ROOM_PHOTO_TARGET_BYTES = 450 * 1024; // aim per photo after encoding
export const ROOM_SAVE_MAX_PAYLOAD_BYTES = 4 * 1024 * 1024; // stay under serverless body limits

/** Placeholder used when a room has no photo. Local file: never stripped or rewritten by the server. */
export const ROOM_PLACEHOLDER_IMAGE = '/images/hero/deluxe-bedroom-suite.jpg';

/** Legacy placeholder/demo hosts that must never be stored with (or ahead of) real photos. */
export function isPlaceholderImage(url: string): boolean {
  return !url || url.includes('images.unsplash.com') || url === ROOM_PLACEHOLDER_IMAGE;
}

/** Keeps real photos, de-duplicated, in order; falls back to the placeholder if none remain. */
export function normalizeRoomImages(images: string[] | undefined | null): string[] {
  const seen = new Set<string>();
  const real = (images || [])
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter((u) => u && !isPlaceholderImage(u))
    .filter((u) => (seen.has(u) ? false : (seen.add(u), true)));
  return real.length > 0 ? real : [ROOM_PLACEHOLDER_IMAGE];
}

/** Approximate byte size of a data URL's payload. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This file could not be read as an image.'));
    };
    img.src = url;
  });
}

/** Resizes and re-encodes an image file to a compact JPEG data URL. */
export async function compressImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select a valid image file.');
  }
  if (file.size > 30 * 1024 * 1024) {
    throw new Error('This photo is larger than 30 MB. Please choose a smaller one.');
  }

  const img = await loadImage(file);
  return encodeImage(img);
}

function encodeImage(img: HTMLImageElement): string {
  const scale = Math.min(1, ROOM_PHOTO_MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process this photo.');
  ctx.fillStyle = '#ffffff'; // flatten transparent PNGs onto white for JPEG
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.82;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrlBytes(dataUrl) > ROOM_PHOTO_TARGET_BYTES && quality > 0.5) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}

/** Re-compresses an image that is already a data: URL (used when moving old device data). */
export async function compressDataUrl(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:image/') || dataUrlBytes(dataUrl) <= ROOM_PHOTO_TARGET_BYTES * 1.5) return dataUrl;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Image could not be read.'));
    el.src = dataUrl;
  });
  return encodeImage(img);
}

export const DOCUMENT_PDF_MAX_BYTES = 4 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('This file could not be read.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Prepares an ID document (photo or PDF) for upload. Photos are resized/compressed like room
 * photos (a raw phone photo is too large to save); PDFs are kept as-is up to 4 MB.
 * The server stores the result in private storage; it is never kept in the browser.
 */
export async function readDocumentFile(file: File): Promise<string> {
  if (file.type === 'application/pdf') {
    if (file.size > DOCUMENT_PDF_MAX_BYTES) throw new Error('This PDF is larger than 4 MB. Please upload a photo of the ID instead.');
    return readAsDataUrl(file);
  }
  if (!file.type.startsWith('image/')) throw new Error('Please upload a photo (JPG/PNG) or a PDF of the ID.');
  return compressImageFile(file);
}
