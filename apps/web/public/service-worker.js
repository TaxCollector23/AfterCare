// Minimal service worker: no offline caching yet (this app needs a live connection to
// Firebase for auth/data anyway). Registered mainly so the app is installable as a PWA
// for the Android TWA wrapper in apps/android. Safe to extend with real caching later.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
