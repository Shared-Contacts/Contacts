// The Jotter's own service worker.
//
// It needs one of its own, at its own address, because a service worker can
// only ever look after things at or below its own folder. The main app's one
// sits a level up and could not reach in here.
//
// It caches nothing, deliberately: caching would mean you stop seeing changes
// after they are published.
self.addEventListener('install',  e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',    e => { /* straight to the network */ });
