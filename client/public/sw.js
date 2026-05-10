// Service worker: кеш + Web Push + offline-очередь сообщений.

const VERSION = 'v2';
const STATIC_CACHE = `blink-static-${VERSION}`;
const TILES_CACHE = `blink-tiles-${VERSION}`;
const RUNTIME_CACHE = `blink-runtime-${VERSION}`;

const STATIC_ASSETS = ['/', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, TILES_CACHE, RUNTIME_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

const isTileRequest = (url) => /basemaps\.cartocdn\.com|tile\.openstreetmap\.org/.test(url);
const isApiRequest = (url) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/') || url.pathname === '/health';
const isSameOrigin = (url) => url.origin === self.location.origin;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (isApiRequest(url)) return;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  if (isTileRequest(url.href)) {
    event.respondWith(
      caches.open(TILES_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((resp) => { if (resp.ok) cache.put(req, resp.clone()); return resp; })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/') || new Response('Offline', { status: 503 }))
    );
    return;
  }

  if (isSameOrigin(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return resp;
        });
      })
    );
  }
});

// === Web Push ===
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Blink', body: event.data?.text() || '' };
  }
  const title = payload.title || 'Blink';
  const opts = {
    body: payload.body || '',
    icon: payload.icon || '/icon.svg',
    badge: payload.badge || '/icon.svg',
    tag: payload.tag,
    data: payload,
    vibrate: [80, 30, 80],
    silent: false,
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = '/';
  if (data.conversationId) url = `/chat/${data.conversationId}`;
  else if (data.tag && data.tag.startsWith('chat-')) url = '/chats';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// === Offline message queue ===
// Клиент посылает сообщение через postMessage когда офлайн;
// SW складывает в IndexedDB и при появлении сети отправляет в /api/chat/messages.

const DB_NAME = 'blink-offline';
const STORE = 'queue';

const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const queuePut = async (item) => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(item);
    tx.oncomplete = () => resolve(true);
  });
};

const queueAll = async () => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
};

const queueDelete = async (id) => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve(true);
  });
};

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg) return;
  if (msg.type === 'queue-message') {
    event.waitUntil(queuePut({ url: msg.url, body: msg.body, token: msg.token, ts: Date.now() }));
  } else if (msg.type === 'flush-queue') {
    event.waitUntil(flushQueue());
  }
});

const flushQueue = async () => {
  try {
    const items = await queueAll();
    for (const it of items) {
      try {
        const r = await fetch(it.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(it.token ? { 'Authorization': `Bearer ${it.token}` } : {}),
          },
          body: JSON.stringify(it.body),
        });
        if (r.ok) await queueDelete(it.id);
      } catch {}
    }
  } catch (e) { console.warn('flushQueue err', e); }
};

self.addEventListener('online', () => flushQueue());
self.addEventListener('sync', (event) => {
  if (event.tag === 'flush-queue') event.waitUntil(flushQueue());
});
