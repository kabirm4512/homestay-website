'use client';

import type { Expense } from '@/types/crm';
import { NewExpenseInput, newId, postExpense } from './expense-client';

/**
 * Offline-first queue for expenses (the Expense Logger app and the desk's quick logger).
 *
 * Save → the entry is written to IndexedDB FIRST, then sent. If the phone has no signal or
 * the server is slow, it stays queued and is sent automatically when the app is open and
 * online (every 20 s, on focus, on 'online') and, on Android/Chrome, by the service worker
 * even after the app is closed (Background Sync). The server never records the same entry
 * twice (idempotent on id), so retries are always safe.
 *
 * The database/store names are shared with public/sw.js; keep them in step.
 */

export const OUTBOX_DB = 'savera-expenses';
export const OUTBOX_STORE = 'outbox';
export const OUTBOX_SYNC_TAG = 'expense-outbox';

export interface OutboxItem {
  id: string;
  payload: NewExpenseInput & { id: string };
  status: 'queued' | 'sending' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: string;
}

type Listener = (items: OutboxItem[]) => void;
const listeners = new Set<Listener>();
let memoryFallback: OutboxItem[] = []; // when IndexedDB is unavailable (private mode)

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(OUTBOX_DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(OUTBOX_STORE)) req.result.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    const t = db.transaction(OUTBOX_STORE, mode);
    const req = fn(t.objectStore(OUTBOX_STORE));
    t.oncomplete = () => {
      resolve(req ? (req as IDBRequest<T>).result : undefined);
      db.close();
    };
    t.onerror = () => {
      resolve(undefined);
      db.close();
    };
  });
}

export async function listOutbox(): Promise<OutboxItem[]> {
  const items = await tx<OutboxItem[]>('readonly', (s) => s.getAll());
  const all = items ?? memoryFallback;
  return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function put(item: OutboxItem) {
  const ok = await tx('readwrite', (s) => s.put(item));
  if (ok === undefined && !(await openDb())) memoryFallback = [item, ...memoryFallback.filter((x) => x.id !== item.id)];
}

async function remove(id: string) {
  await tx('readwrite', (s) => s.delete(id));
  memoryFallback = memoryFallback.filter((x) => x.id !== id);
}

async function notify() {
  const items = await listOutbox();
  listeners.forEach((fn) => fn(items));
}

export function subscribeOutbox(fn: Listener): () => void {
  listeners.add(fn);
  void listOutbox().then(fn);
  startAutoFlush();
  return () => {
    listeners.delete(fn);
  };
}

/** Saves an expense locally, then tries to send it. Returns the queued id. */
export async function enqueueExpense(input: NewExpenseInput): Promise<string> {
  const id = `exp-${newId()}`;
  await put({ id, payload: { ...input, id }, status: 'queued', attempts: 0, createdAt: new Date().toISOString() });
  await notify();
  requestBackgroundSync();
  void flushOutbox();
  return id;
}

type SavedListener = (e: Expense) => void;
const savedListeners = new Set<SavedListener>();
/** Called with the server's copy each time a queued expense is saved. */
export function onExpenseSaved(fn: SavedListener): () => void {
  savedListeners.add(fn);
  return () => {
    savedListeners.delete(fn);
  };
}

let flushing: Promise<void> | null = null;

/** Sends everything queued, oldest first. Safe to call any time. */
export function flushOutbox(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      const items = (await listOutbox()).filter((i) => i.status !== 'failed').reverse();
      for (const item of items) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
        await put({ ...item, status: 'sending' });
        await notify();
        const res = await postExpense(item.payload);
        if (res.ok) {
          await remove(item.id);
          savedListeners.forEach((fn) => fn(res.expense));
        } else if (res.retryable) {
          await put({ ...item, status: 'queued', attempts: item.attempts + 1, lastError: res.error });
          if (res.status === 0) break; // offline: stop for now
        } else if (res.status === 401) {
          // Signed out: keep it queued; it is sent after signing in again
          await put({ ...item, status: 'queued', attempts: item.attempts + 1, lastError: 'Please sign in again to send this.' });
          break;
        } else {
          await put({ ...item, status: 'failed', attempts: item.attempts + 1, lastError: res.error });
        }
        await notify();
      }
    } finally {
      flushing = null;
      await notify();
    }
  })();
  return flushing;
}

/** Puts a failed entry back in the queue (after the reason was fixed) or discards it. */
export async function retryOutboxItem(id: string) {
  const item = (await listOutbox()).find((i) => i.id === id);
  if (!item) return;
  await put({ ...item, status: 'queued', lastError: undefined });
  await notify();
  void flushOutbox();
}

export async function discardOutboxItem(id: string) {
  await remove(id);
  await notify();
}

function requestBackgroundSync() {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.ready.then((reg) => {
      const sync = (reg as unknown as { sync?: { register: (tag: string) => Promise<void> } }).sync;
      return sync?.register(OUTBOX_SYNC_TAG);
    }).catch(() => {});
  } catch {}
}

let autoStarted = false;
function startAutoFlush() {
  if (autoStarted || typeof window === 'undefined') return;
  autoStarted = true;
  window.addEventListener('online', () => void flushOutbox());
  window.addEventListener('focus', () => void flushOutbox());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void flushOutbox());
  setInterval(() => void flushOutbox(), 20_000);
  // The service worker tells open pages when it sent queued entries in the background
  try {
    navigator.serviceWorker?.addEventListener('message', (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type === 'expense-outbox-synced') void notify();
    });
  } catch {}
  void flushOutbox();
}
