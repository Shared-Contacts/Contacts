// Service worker for It's MY life.
//
// Two jobs:
//   1. make the page installable as an app
//   2. receive push reminders and show them on the lock screen,
//      with buttons to put one off for a while
//
// It deliberately caches nothing. Caching would mean you stop seeing
// updates after you upload them.

self.addEventListener('install',  e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',    e => { /* straight to the network */ });

const SNOOZE = [
  { action: 'snooze-1',  title: '1 hour'  },
  { action: 'snooze-8',  title: '8 hours' },
  { action: 'snooze-24', title: 'Tomorrow' }
];

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
      badge: 'icon-192-v2.png',
      icon: 'icon-192-v2.png',
      // Android shows these as buttons under the message. Some phones only
      // show the first two, which is why "1 hour" comes first.
      actions: d.itemId ? SNOOZE : [],
      data: { url: d.url || '/', itemId: d.itemId || null }
    })
  );
});

self.addEventListener('notificationclick', event => {
  const data = event.notification.data || {};
  const hours = /^snooze-(\d+)$/.exec(event.action || '');
  event.notification.close();

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    // Putting it off: tell the app, which does the rescheduling, because
    // only the app is signed in as you.
    if (hours && data.itemId) {
      const msg = { snooze: { itemId: data.itemId, hours: Number(hours[1]) } };
      for (const c of all) {
        if (c.url.includes('/Contacts')) { c.postMessage(msg); await c.focus(); return; }
      }
      // Nothing open, so hand it over in the address instead and let the
      // app pick it up as it starts.
      const url = (data.url || '/') + '#snooze=' + data.itemId + '-' + hours[1];
      await self.clients.openWindow(url);
      return;
    }

    for (const c of all) {
      if (c.url.includes('/Contacts')) { await c.focus(); return; }
    }
    await self.clients.openWindow(data.url || '/');
  })());
});
