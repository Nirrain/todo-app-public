import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: "app-shell",
  }),
);

registerRoute(
  ({ url }) =>
    url.pathname.endsWith("/data/tasks.json") ||
    url.pathname.endsWith("/data/config.json"),
  new NetworkFirst({
    cacheName: "task-data",
  }),
);

registerRoute(
  ({ request }) =>
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "worker",
  new StaleWhileRevalidate({
    cacheName: "static-assets",
  }),
);

