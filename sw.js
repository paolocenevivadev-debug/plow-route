/* Plow Route offline cache. The app shell is stored on the phone so it opens with no signal. */
const VERSION = "plow-v1.0.1";
const SHELL = [
  "./", "index.html", "app.css", "core.js", "ui.js", "manifest.webmanifest",
  "leaflet.js", "leaflet.css",
  "barlow-latin-400-normal.woff2", "barlow-latin-500-normal.woff2",
  "barlow-latin-600-normal.woff2", "barlow-latin-700-normal.woff2",
  "barlow-condensed-latin-600-normal.woff2", "barlow-condensed-latin-700-normal.woff2",
  "icon-180.png", "icon-192.png", "icon-512.png"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: "reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // forecast, map tiles, lookups go straight to the network
  e.respondWith(
    caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => req.mode === "navigate" ? caches.match("index.html") : Response.error()))
  );
});
