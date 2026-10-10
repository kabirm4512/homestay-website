// Savera service worker: offline shell for the site and the Expense Logger app, plus
// background sending of expenses saved offline (Background Sync, Android/Chrome).
const CACHE_NAME = 'savera-v4';
const STATIC_ASSETS = ['/', '/manifest.json', '/expenses', '/expenses.webmanifest', '/icons/icon-192x192.png', '/icons/icon-512x512.png', '/icons/expenses-96.png', '/icons/expenses-192.png', '/icons/expenses-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(STATIC_ASSETS.map((url) => cache.add(url).catch(() => console.warn('SW: could not pre-cache', url))))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : undefined))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // API and data calls are never cached: prices, bills and expenses are always live.
  if (req.method !== 'GET' || req.url.includes('/api/')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: network first (a new release and new prices show at once); cache only when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const exact = await caches.match(req, { ignoreSearch: true });
          if (exact) return exact;
          // The Expense Logger opens offline from its own shell
          if (url.pathname.startsWith('/expenses')) {
            const shell = await caches.match('/expenses');
            if (shell) return shell;
          }
          return caches.match('/');
        })
    );
    return;
  }

  // Static assets (hashed JS/CSS, images, fonts): cached copy at once, refreshed in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// ---------------------------------------------------------------- expense outbox
// Same database/store as src/lib/expense-outbox.ts
const OUTBOX_DB = 'savera-expenses';
const OUTBOX_STORE = 'outbox';

function idb() {
  return new Promise((resolve) => {
    const req = indexedDB.open(OUTBOX_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(OUTBOX_STORE)) req.result.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function storeOp(db, mode, fn) {
  return new Promise((resolve) => {
    const tx = db.transaction(OUTBOX_STORE, mode);
    const r = fn(tx.objectStore(OUTBOX_STORE));
    tx.oncomplete = () => resolve(r ? r.result : undefined);
    tx.onerror = () => resolve(undefined);
  });
}

async function sendOutbox() {
  const db = await idb();
  if (!db) return;
  const items = (await storeOp(db, 'readonly', (s) => s.getAll())) || [];
  let sent = 0;
  for (const item of items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (item.status === 'failed') continue;
    let res;
    try {
      res = await fetch('/api/expenses', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });
    } catch (e) {
      throw e; // offline: let the browser retry the sync later
    }
    if (res.ok) {
      await storeOp(db, 'readwrite', (s) => s.delete(item.id));
      sent += 1;
    } else if (res.status >= 400 && res.status < 500 && ![401, 408, 429].includes(res.status)) {
      const body = await res.json().catch(() => null);
      await storeOp(db, 'readwrite', (s) =>
        s.put({ ...item, status: 'failed', attempts: (item.attempts || 0) + 1, lastError: (body && body.error) || 'Could not be saved.' })
      );
    }
  }
  db.close();
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((c) => c.postMessage({ type: 'expense-outbox-synced', sent }));
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'expense-outbox') event.waitUntil(sendOutbox());
});
