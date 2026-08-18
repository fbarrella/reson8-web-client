# Reson8 Web Client

[![Version](https://img.shields.io/badge/version-7.2.0-blue.svg)](#)

A mobile-first, fully responsive Progressive Web App client for [Reson8](../reson8) — a self-hosted voice & text communication server (TeamSpeak-3-style: hierarchical channel tree, SFU voice via mediasoup, persistent text chat, DMs, moderation). Built with React, TypeScript, and Vite. This is an independent client for the existing `reson8` server; it does not modify the server, its database, or its Socket.io protocol.

**Status:** All seven phases are complete — this is a launch-ready client. Phase 7 (PWA platform polish & launch hardening) shipped installability, a service-worker update flow, a "What's New" modal, a zero-violations accessibility audit, a Lighthouse-verified performance budget, a full real-device cross-browser/cross-device testing pass (phone, tablet, and desktop across Chrome, Safari, and Firefox), and deployment documentation. See [`app-planning/progress.txt`](app-planning/progress.txt) for the full build log.

## Quick start

```
npm install
npm run dev
```

Then open the app and connect to a running `reson8` server via the connect screen — there's no server configuration at build time. This client is entirely BYO-server: point it at any `reson8` instance's address, same as the desktop client.

## Development

```
npm run dev             # start the dev server
npm run build            # tsc -b (typecheck) then vite build
npm run preview           # serve the production build locally
npm run typecheck          # tsc -b only, no emit
npm run lint                 # eslint .
npm run format                 # prettier --write .
npm run test                    # vitest (unit/component, jsdom)
npm run test:watch                # vitest in watch mode
npm run test:e2e                    # playwright (multi-browser + mobile viewport emulation)
npm run check:bundle-size             # verifies the initial JS payload against the P7.6 performance budget
```

See [`CLAUDE.md`](CLAUDE.md) for the full architecture breakdown, the Reson8 wire-protocol reference, project conventions, and everything else a contributor (human or agent) needs to work in this repo without also having the sibling `reson8` server repo open.

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md) — covers the recommended static-host + CDN path, a working Docker option for self-hosters who want the client running alongside their `reson8` server, and the mandatory HTTPS/WSS and CSP requirements.

## Planning documents

Start with [`app-planning/00-master-prd.md`](app-planning/00-master-prd.md) for the product vision, tech stack, architecture, and cross-cutting design decisions (mobile-first responsive strategy, PWA scope, identity model, non-goals). It links out to one PRD per implementation phase:

1. `01-phase1-foundation-connection.md` — scaffold, PWA shell, design system, connect flow, channel tree, presence
2. `02-phase2-voice-core.md` — mediasoup voice engine, mute/deafen/PTT, reconnection resilience
3. `03-phase3-advanced-voice-channel-mgmt.md` — noise gate, per-user volume, channel CRUD/reorder
4. `04-phase4-text-chat-messaging.md` — chat, uploads, emoji, custom emoji, pinned messages
5. `05-phase5-direct-messages-social.md` — DMs, online users, Nudge
6. `06-phase6-admin-moderation.md` — roles, emoji approval, kick/ban, server settings
7. `07-phase7-pwa-platform-polish.md` — installability, update flow, accessibility/performance gates, device testing, deployment

Each phase is independently demoable against a real `reson8` server and builds on the ones before it. `app-planning/progress.txt` is the authoritative, task-by-task record of what's actually been built and verified — treat any "status" summary (including this README's) as a snapshot that can lag behind it.
