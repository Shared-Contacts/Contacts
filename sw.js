// Service worker for It's MY life.
//
// Three jobs:
//   1. make the page installable as an app
//   2. receive push reminders and show them on the lock screen,
//      with buttons to put one off for a while
//   3. take in whatever is shared to the app from another app's Share list
//      (see below)
//
// It deliberately caches nothing. Caching would mean you stop seeing
// updates after you upload them.

self.addEventListener('install',  e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

/* ---------- Something shared to the app (9 Nov 2026, ML226) ----------
   A picture (a screenshot, say) can only be shared to an app by POSTing it,
   so since then manifest.json's share target is a POST to
   index.html?share-target. GitHub Pages cannot take a POST, so it is caught
   here. The words (a web page's address and title) go on in the address, as
   they always have, and the app files a link as before. Any pictures are kept
   here, in memory only and never in a cache, until the page asks for them
   (the 'shared' message below), and the address says how many there are.
   The worker stays awake until then, or for a minute at most. */
let SHARED = null;              // {files, give} until the page collects them

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'POST' || !new URL(r.url).searchParams.has('share-target')) return;  // straight to the network
  let give;
  const taken = new Promise(res => { give = res; });
  e.waitUntil(taken);
  e.respondWith((async () => {
    let form;
    try { form = await r.formData(); } catch (err) { form = new FormData(); }
    const q = new URLSearchParams();
    for (const k of ['share_title', 'share_text', 'share_url']) {
      const v = form.get(k);
      if (typeof v === 'string' && v.trim()) q.set(k, v);
    }
    const files = form.getAll('share_files').filter(f => f && typeof f === 'object' && f.size);
    if (files.length) {
      q.set('share_pics', String(files.length));
      SHARED = { files, give };
      setTimeout(give, 60000);
    } else give();
    const s = q.toString();
    return Response.redirect('./index.html' + (s ? '?' + s : ''), 303);
  })());
});

self.addEventListener('message', e => {
  if (!e.data || e.data.want !== 'shared') return;
  const s = SHARED;
  SHARED = null;
  if (e.source) e.source.postMessage({ shared: s ? s.files : [] });
  if (s) s.give();
});

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
