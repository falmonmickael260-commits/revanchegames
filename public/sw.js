// Revanche Games — minimal service worker.
// Scope: install the app shell for faster repeat loads and a friendly
// offline fallback. This does NOT make the app fully offline-capable —
// game data loaded at runtime still needs the network.
const CACHE_VERSION = "rg-v2";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Navigations: try the network first, fall back to the offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  // Same-origin static assets: cache-first, refresh in the background.
  const url = new URL(request.url);
  if (url.origin === self.location.origin && /\/(_next\/static|icons)\//.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});

// ---------------------------------------------------------------------------
// Notifications push
//
// Le contenu affiche est entierement decide par le serveur
// (src/app/api/push/notify/route.ts) : ce fichier ne fait que le presenter.
// Volontairement sobre — un pseudonyme et un nom de jeu, rien de prive.
// ---------------------------------------------------------------------------

self.addEventListener("push", (event) => {
  // Un push sans donnees lisibles ne doit pas faire echouer l'evenement :
  // `userVisibleOnly` nous oblige a afficher *quelque chose*.
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "Revanche Games";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/favicon-32.png",
    // `tag` regroupe : une seconde invitation au meme jeu remplace la
    // precedente au lieu d'empiler les notifications.
    tag: payload.tag || "rg-social",
    renotify: true,
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Reutilise un onglet deja ouvert sur la plateforme plutot que d'en
      // ouvrir un second : la partie en cours y est peut-etre encore vivante.
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }

      await self.clients.openWindow(target);
    })(),
  );
});
