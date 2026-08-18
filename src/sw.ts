/// <reference lib="webworker" />

// Custom service worker (Phase 7 P7.2 — `injectManifest` mode, replacing
// Phase 1's `generateSW` baseline now that a controlled update UX is
// needed). App-shell precaching only, per master PRD §5.4 — no runtime
// caching/offline data replay, since a channel/message/presence view is
// meaningless without a live connection to a specific self-hosted server.

import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// New versions sit in the "waiting" state until the client explicitly asks
// to activate — see src/services/swUpdateService.ts's persistent
// "update available" toast. Never auto-skip on install; that could yank a
// service worker out from under an active voice/chat session.
function isSkipWaitingMessage(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as { type?: unknown }).type === "SKIP_WAITING";
}

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (isSkipWaitingMessage(event.data)) {
    void self.skipWaiting();
  }
});

self.addEventListener("activate", () => {
  void clientsClaim();
});
