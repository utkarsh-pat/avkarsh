/* This worker deliberately avoids caching authenticated pages and API responses. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

