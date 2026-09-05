// Deliberately does no caching.
// Its only job is to make the page installable as an app, so it opens
// in its own window instead of a new Chrome tab each time.
// Caching here would mean you stop seeing updates after you upload them,
// which has already caused enough confusion.
self.addEventListener('install',  e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',    e => { /* straight to the network */ });
