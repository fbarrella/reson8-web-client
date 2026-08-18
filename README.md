<div align="center">

<img src="public/favicon.svg" alt="" width="72" height="72">

# Reson8 Web Client

[![Version](https://img.shields.io/badge/version-7.7.1-blue.svg)](app-planning/progress.txt)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

A mobile-first, fully responsive Progressive Web App client for **Reson8** — a self-hosted, TeamSpeak-3-style voice & text communication server.

</div>

## What is this?

[Reson8](../reson8) is a self-hosted voice-and-text communication platform: a hierarchical channel tree, SFU voice via [mediasoup](https://mediasoup.org), persistent text chat, direct messages, and role-based moderation — think a self-hosted TeamSpeak/Discord alternative. It ships as an Electron desktop client plus a Node/Fastify server.

**This repository is a second, independent client for that same server** — a React + TypeScript + Vite Progressive Web App, installable on phones, tablets, and desktops straight from the browser, with feature parity against the desktop client wherever the web platform allows it. It's **client-only**: it never modifies the `reson8` server, its database, or its Socket.io protocol, and it's entirely **BYO-server** — there's no bundled backend or account system. Point it at any running `reson8` instance's address and you're in, the same way the desktop client works.

If you're just here to use it: skip to [Quick start](#quick-start). If you're evaluating or extending it: skip to [Tech stack](#tech-stack) and [Contributing](#contributing).

## Status

**v7.7.1.** The original seven-phase build-out is complete and shipped as v7.0.0 — foundation, voice, advanced voice/channel management, text chat, DMs/social, admin/moderation, and PWA platform polish (installability, a service-worker update flow, a "What's New" modal, a zero-violations accessibility audit, a Lighthouse-verified performance budget, a full real-device cross-browser/cross-device testing pass, and deployment docs). Since then, a post-launch **improvements round** — a set of fixes and small polish items found from real usage — has landed in full (see [`app-planning/08-improvements-round.md`](app-planning/08-improvements-round.md)). See [`app-planning/progress.txt`](app-planning/progress.txt) for the full, authoritative build log; treat any status summary here (this one included) as a snapshot that can lag behind it.

## Quick start

```
npm install
npm run dev
```

Then open the app and connect to a running `reson8` server via the connect screen — there's no server configuration at build time.

## Tech stack

| | |
|---|---|
| Framework | React 19 + TypeScript (strict mode) |
| Build tool | Vite |
| Routing | React Router |
| State | Zustand |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix UI primitives) |
| Real-time transport | socket.io-client |
| Voice/WebRTC | mediasoup-client |
| PWA | vite-plugin-pwa (Workbox) |
| Forms/validation | React Hook Form + Zod |
| Testing | Vitest + React Testing Library (unit/component), Playwright (E2E, multi-browser incl. mobile viewport emulation) |

Full rationale for each choice lives in the archived master PRD's tech-stack section — see [Planning documents](#planning-documents) below.

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
npm run check:bundle-size             # verifies the initial JS payload against the performance budget
```

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md) — covers the recommended static-host + CDN path, a working Docker option for self-hosters who want the client running alongside their `reson8` server, and the mandatory HTTPS/WSS and CSP requirements.

## Contributing

Start with [`CLAUDE.md`](CLAUDE.md) — it's written to make this repo self-sufficient for a new contributor (human or agent), covering the full architecture, the frozen Reson8 wire-protocol reference, project conventions (touch-interaction patterns, sound-alert naming, `localStorage` key conventions, security practices), and everything else needed to work here without also having the sibling `reson8` server repo open.

For current scope and in-flight work, see [Planning documents](#planning-documents) below, and check [`app-planning/progress.txt`](app-planning/progress.txt) — the task-by-task record of what's actually been built and verified — before starting anything new.

## Planning documents

- [`app-planning/08-improvements-round.md`](app-planning/08-improvements-round.md) — the **current** active scope document: a set of post-launch fixes and polish items found from real usage of v7.0.0.
- [`app-planning/archive/v7.0.0-phase-prds/`](app-planning/archive/v7.0.0-phase-prds/) — the original seven-phase PRD set (plus the master PRD) that built v7.0.0, preserved as the historical record of the "why" behind the initial architecture and scope decisions. Start with `00-master-prd.md` there for the product vision, tech stack rationale, and cross-cutting design decisions (mobile-first responsive strategy, PWA scope, identity model, non-goals).
- [`app-planning/progress.txt`](app-planning/progress.txt) — the authoritative, task-by-task build log across both the original phases and the improvements round. This is the single most reliable source of "what's actually done" in this repo.
- [`app-planning/releases/`](app-planning/releases/) — generated release notes, one file per version bump.
