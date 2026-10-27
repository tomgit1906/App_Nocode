// Garde tous les fichiers de l'application sur le téléphone pour qu'elle marche sans internet.
// Changer VERSION à chaque mise à jour des fichiers.
const VERSION = "memo-insuline-v6";
const LIBS = "memo-insuline-libs"; // bibliothèque d'IA, gardée d'une version à l'autre
const FILES = [
  "./", "index.html", "app.js", "catalogue.js", "photos.js", "ia-worker.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== LIBS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Bibliothèque d'IA (CDN) et police (Google Fonts) : téléchargées une fois puis servies depuis le téléphone.
  // Les fichiers du modèle sont gardés à part par la bibliothèque elle-même.
  if (url.hostname === "cdn.jsdelivr.net" || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(LIBS).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
