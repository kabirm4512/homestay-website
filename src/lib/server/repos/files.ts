import crypto from 'crypto';
import { getSql } from '../db';
import { HttpError } from '../http';

/**
 * File storage for room photos (public) and guest ID documents (private).
 *
 * Production: Supabase Storage (buckets 'room-photos' public, 'guest-documents' private)
 * using NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on the server only.
 * Without Storage configured (local development / tests) the bytes are kept in
 * pms.files.content. Private files are only ever served through /api/files/<id>,
 * which checks access.
 */

export const BUCKETS = {
  ROOM_PHOTOS: 'room-photos',
  GUEST_DOCUMENTS: 'guest-documents',
} as const;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
export const MAX_FILE_BYTES = 6 * 1024 * 1024;

export interface FileRow {
  id: string;
  bucket: string;
  path: string;
  visibility: 'public' | 'private';
  content_type: string;
  size_bytes: number;
  owner_kind: string | null;
  owner_id: string | null;
}

function storageConfig(): { url: string; key: string } | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url.startsWith('https://') || key.length < 20 || process.env.FILE_STORAGE === 'database') return null;
  return { url, key };
}

/** Decodes a data: URL into bytes + content type. */
export function decodeDataUrl(dataUrl: string): { bytes: Buffer; contentType: string } {
  const match = /^data:([\w/+.-]+);base64,([\s\S]*)$/.exec(dataUrl || '');
  if (!match) throw new HttpError(400, 'Uploaded file is not a valid image.');
  return { contentType: match[1].toLowerCase(), bytes: Buffer.from(match[2], 'base64') };
}

export async function storeFile(input: {
  bytes: Buffer;
  contentType: string;
  visibility: 'public' | 'private';
  ownerKind?: string;
  ownerId?: string;
  actor: string;
}): Promise<{ id: string; url: string }> {
  const contentType = input.contentType === 'image/jpg' ? 'image/jpeg' : input.contentType;
  if (!ALLOWED_TYPES.includes(contentType)) throw new HttpError(400, 'Only JPEG, PNG, WebP, GIF or PDF files can be uploaded.');
  if (input.bytes.length === 0) throw new HttpError(400, 'The uploaded file is empty.');
  if (input.bytes.length > MAX_FILE_BYTES) throw new HttpError(413, 'The file is too large (max 6 MB). Please use a smaller photo.');

  const id = crypto.randomUUID();
  const bucket = input.visibility === 'public' ? BUCKETS.ROOM_PHOTOS : BUCKETS.GUEST_DOCUMENTS;
  const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
  const path = `${input.ownerKind || 'misc'}/${new Date().toISOString().slice(0, 7)}/${id}.${ext}`;
  const sql = getSql();
  const cfg = storageConfig();

  if (cfg) {
    const res = await fetch(`${cfg.url}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        apikey: cfg.key,
        'Content-Type': contentType,
        'x-upsert': 'false',
        'Cache-Control': 'max-age=31536000',
      },
      body: new Uint8Array(input.bytes),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Supabase Storage upload failed (${res.status}): ${text.slice(0, 200)}`);
    }
  }

  await sql`
    insert into pms.files (id, bucket, path, visibility, content_type, size_bytes, owner_kind, owner_id, content, created_by)
    values (${id}, ${bucket}, ${path}, ${input.visibility}, ${contentType}, ${input.bytes.length},
            ${input.ownerKind || null}, ${input.ownerId || null}, ${cfg ? null : input.bytes}, ${input.actor})`;

  const url = input.visibility === 'public' && cfg ? `${cfg.url}/storage/v1/object/public/${bucket}/${path}` : `/api/files/${id}`;
  return { id, url };
}

/** Converts an inline data: URL into a stored file URL; other values are returned unchanged. */
export async function persistDataUrl(
  value: string | undefined | null,
  opts: { visibility: 'public' | 'private'; ownerKind: string; ownerId?: string; actor: string }
): Promise<string | undefined> {
  if (!value || typeof value !== 'string' || !value.startsWith('data:')) return value || undefined;
  const { bytes, contentType } = decodeDataUrl(value);
  const stored = await storeFile({ bytes, contentType, ...opts });
  return stored.url;
}

export async function getFileRow(id: string): Promise<FileRow | null> {
  const sql = getSql();
  const rows = await sql<FileRow[]>`
    select id, bucket, path, visibility, content_type, size_bytes, owner_kind, owner_id from pms.files where id = ${id}`;
  return rows[0] || null;
}

export async function readFileBytes(row: FileRow): Promise<Buffer> {
  const cfg = storageConfig();
  if (cfg) {
    const res = await fetch(`${cfg.url}/storage/v1/object/${row.bucket}/${row.path}`, {
      headers: { Authorization: `Bearer ${cfg.key}`, apikey: cfg.key },
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }
  const sql = getSql();
  const rows = await sql<{ content: Buffer | null }[]>`select content from pms.files where id = ${row.id}`;
  if (!rows[0]?.content) throw new HttpError(404, 'File not found.');
  return rows[0].content;
}

/** Extracts the file id from a /api/files/<id> URL. */
export function fileIdFromUrl(url: string | undefined | null): string | null {
  const m = /\/api\/files\/([0-9a-f-]{36})/i.exec(url || '');
  return m ? m[1] : null;
}
