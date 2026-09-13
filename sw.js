// Service worker for Contacts.
//
// Two jobs:
//   1. make the page installable as an app
//   2. receive push reminders and show them on the lock screen
//
// It deliberately caches nothing. Caching would mean you stop seeing
// updates after you upload them.

self.addEventListener('install',  e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',    e => { /* straight to the network */ });

self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = {}; }
  const title = d.title || 'Reminder';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || '',
      tag: d.tag || 'contacts',
      renotify: true,
      requireInteraction: true,
      badge: 'icon-192.png',
      icon: 'icon-192.png',
      data: { url: d.url || '/', itemId: d.itemId || null }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes('/Contacts')) { await c.focus(); return; }
    }
    await self.clients.openWindow(target);
  })());
});
