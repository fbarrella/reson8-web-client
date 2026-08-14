# Reson8 Web Client — Master PRD

Status: Draft for review
Owner: TBD
Companion project: `reson8` (Electron desktop client + Node/Fastify server), read-only dependency — this repo does not modify it
Scope of this document: product vision, architecture, tech stack, cross-cutting design system, and the phase map. Each phase has its own PRD file in this folder; this document is the contract they all inherit from.

---

## 1. Product Vision

Reson8 today is a self-hosted, TeamSpeak-style voice+text communication platform with a native Electron desktop client. This project builds a **second, independent client** for the same server: a React-based **Progressive Web App**, **mobile-first and fully responsive**, installable on phones, tablets, and desktops via the browser, with **feature parity** against the desktop client wherever the web platform allows it.

This is a *client-only* project. The `reson8` server, its Socket.io protocol (`packages/shared-types`), REST upload routes, and data model are treated as a fixed, external contract. No server-side changes are in scope for this effort (confirmed decision — see §7 Non-Goals).

### 1.1 Why a second client instead of extending the desktop one

The desktop client is vanilla TypeScript/DOM with no framework, no build-time componentization, and a fixed non-responsive 1024×768-minimum layout (confirmed: zero `@media` queries exist in its markup today). Retrofitting mobile-first responsiveness onto that codebase would mean rewriting nearly the entire renderer anyway. A clean React implementation lets the mobile-first layout be a first-class design decision instead of a patch, while reusing the same wire protocol.

### 1.2 Target users

Anyone who already uses (or would use) Reson8 but doesn't want to install a desktop app — primarily **mobile users** joining voice/text from a phone, and desktop-browser users who prefer not to install Electron. Server admins are a secondary audience and get the same moderation/admin surface as the desktop client, adapted for touch.

---

## 2. Guiding Principles

1. **Mobile-first, not mobile-only.** Every screen is designed for a touch, narrow-viewport target first, then progressively enhanced for tablet/desktop widths. Nothing is "desktop-only" in layout terms — the three-pane desktop view is a *wider composition* of the same components used on mobile, not a separate codebase.
2. **Feature parity where the platform allows it.** Every feature in the desktop client's README/feature list is either ported, adapted for touch/web constraints, or explicitly called out as a documented platform limitation (never silently dropped). See §6 for the full parity ledger.
3. **Protocol fidelity.** The existing `ClientToServerEvents`/`ServerToClientEvents` contract, REST upload routes, and Prisma-backed data model are not renegotiated. If a feature is technically impossible without a server change, it's marked out of scope for this project rather than triggering a server PR.
4. **Best-practice React, not desktop-client conventions ported 1:1.** The desktop client is vanilla DOM by original design constraint (Electron renderer, no build tooling beyond `tsc`). This project has no such constraint — it uses component architecture, typed state management, accessible primitives, and automated testing throughout.
5. **Security and accessibility are not phase-7 afterthoughts.** Input sanitization, ARIA semantics, and keyboard operability are baked into the component layer from Phase 1 (via Radix primitives), not retrofitted.
6. **PWA as an installability and app-feel layer, not an offline-data layer.** Reson8 is fundamentally a live, connected, real-time application — a voice channel or chat history is meaningless without a server connection. The service worker's job is app-shell caching, installability, and update delivery, not offline data replay (see §5.4).

---

## 3. Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **React 18+ with TypeScript (strict mode)** | Explicitly requested. Strict mode catches the class of bugs the desktop client's own progress log shows cost real debugging time (e.g. clock-skew, stale-cache flicker). |
| Build tool | **Vite** | Fastest dev loop, first-class `vite-plugin-pwa` (Workbox) integration, native TS/ESM support matching the existing monorepo's `"type": "module"` server. |
| Routing | **React Router (v6+)** | A real router (not just Zustand view state) gives correct mobile back-button behavior for the navigation-stack pattern (channel list → chat) — see Phase 1 §UX. Also gives deep-linkable URLs (`/servers/:id/channels/:id`) for a "share this channel" future enhancement. |
| Global state | **Zustand** | The app's state is overwhelmingly socket-event-driven (channel tree, presence, voice state) rather than REST-CRUD-driven, so a lightweight store that any socket handler can imperatively update fits better than Redux Toolkit's action/reducer ceremony or a query-cache library built for HTTP. Split into focused stores (`connectionStore`, `channelTreeStore`, `voiceStore`, `chatStore`, `settingsStore`) rather than one monolith. |
| Server data fetching | **None (no TanStack Query)** | Almost all data arrives via Socket.io acks/broadcasts, not REST polling. The two REST endpoints (file/emoji upload) are simple one-shot `fetch()` calls, not cached queries — a query library would add ceremony without benefit. |
| Styling | **Tailwind CSS v4** | Utility-first CSS is the fastest path to disciplined mobile-first breakpoints (`sm:`/`md:`/`lg:` prefixes map directly to the responsive strategy in §5.1) and keeps bundle size predictable. |
| Component primitives | **shadcn/ui (Radix UI primitives + Tailwind)** | Gives accessible, keyboard-operable Dialog/Sheet/Popover/DropdownMenu/Tabs/Slider/Toast out of the box — a deliberate upgrade over the desktop client's hand-rolled modals (which work but carry no ARIA semantics). Components are copied into the repo (not an npm dependency), so they're fully customizable to Reson8's visual identity. |
| Icons | **lucide-react** | Consistent stroke-style icon set; matches the visual language of the desktop client's inline SVGs without hand-maintaining SVG markup. |
| Real-time transport | **socket.io-client** (same major version family as the server) | Required — the server speaks Socket.io, not raw WebSocket. |
| Voice/WebRTC | **mediasoup-client** (browser build) | Same package the desktop client uses; mediasoup-client is designed for browser SFU consumption, so the 6-step handshake ports directly (see Phase 2). |
| PWA tooling | **vite-plugin-pwa** (Workbox under the hood) | Generates the manifest and service worker from a single Vite config surface; supports the `injectManifest` strategy for the custom update-flow control this app needs (see Phase 7). |
| Forms/validation | **React Hook Form + Zod** | Connect screen, channel-create modal, and settings forms all need validation (server URL format, nickname length, etc.); Zod schemas double as runtime guards on socket ack payloads. |
| Testing | **Vitest + React Testing Library** (unit/component), **Playwright** (E2E, multi-browser incl. mobile viewport emulation) | Playwright's device emulation is the pragmatic way to test "mobile-first" claims without a device lab in early phases; a real device pass is still required before launch (Phase 7). |
| Linting/formatting | **ESLint (flat config) + Prettier** | The desktop repo's `npm run lint` is explicitly broken (eslint referenced but not installed) — this project starts with a working lint setup from commit one, not another broken promise in a README. |
| Date/time | **date-fns** | Session timers, message timestamps, clock-offset math (ports the desktop's NTP-style offset correction from Phase 11 — see Phase 2). |

### 3.1 Shared protocol types

The desktop monorepo's `packages/shared-types` (Socket.io event maps, DTOs, `PermissionFlags`) is the source of truth for the wire protocol, but this is a **separate repository** with no workspace/build relationship to it.

**Decision:** vendor a snapshot of the relevant type files (`socket-events.ts`, `models.ts`) into `src/types/reson8-protocol/` with a header comment recording the source commit/version they were copied from. This is a type-only dependency (no runtime code), so there's no build coupling risk — just a manual-sync discipline. A `scripts/sync-protocol-types.md` note documents the process: when the desktop repo's shared-types change in a way that affects the wire contract, re-copy and re-diff the two files. Revisit this in favor of a published private npm package only if protocol drift becomes a recurring pain point in practice — not a Phase 1 requirement.

---

## 4. Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│  Browser (React PWA)                                         │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────────┐ │
│  │ Zustand stores│◄─┤ Socket.io hook│  │ mediasoup-client  │ │
│  │ (connection,   │  │ layer (typed  │  │ Device/Transports │ │
│  │  channelTree,  │  │ event bus)    │◄─┤ (voiceService)     │ │
│  │  voice, chat,  │  └───────┬───────┘  └─────────┬─────────┘ │
│  │  settings)     │          │                    │           │
│  └───────┬────────┘          │                    │           │
│          │           WebSocket (wss://)   WebRTC (UDP/TCP)    │
│  ┌───────▼────────┐          │                    │           │
│  │ React component │          │                    │           │
│  │ tree (routed,   │          │                    │           │
│  │ mobile-first)   │          │                    │           │
│  └────────────────┘          │                    │           │
│  Service Worker (Workbox) — app shell cache + update lifecycle│
└──────────────────────────────┬────────────────────┬───────────┘
                                │                    │
                    ┌───────────▼───────┐  ┌─────────▼──────────┐
                    │ Reson8 Server      │  │ mediasoup Workers   │
                    │ (Fastify+Socket.io)│  │ (SFU, same server)  │
                    └───────────┬────────┘  └─────────────────────┘
                    ┌───────────▼────────┐
                    │ Postgres + Redis    │
                    └────────────────────┘
```

The right two-thirds of this diagram (server, mediasoup, Postgres, Redis) is the existing `reson8` project, unmodified. This project owns everything left of the `wss://`/WebRTC boundary.

### 4.1 Folder structure (proposed)

```
reson8-web-client/
├── app-planning/              # this PRD set
├── public/                    # static assets, manifest icons
├── src/
│   ├── app/                   # routing shell, layout components (mobile-first shell)
│   ├── components/            # shadcn/ui primitives (generated/copied in)
│   ├── features/
│   │   ├── connection/        # connect screen, remember-me, server session
│   │   ├── channels/          # channel tree, CRUD, reorder, NSFW
│   │   ├── voice/             # voice panel, mediasoup engine, device settings
│   │   ├── chat/              # tabbed text chat, messages, attachments
│   │   ├── emoji/             # picker, reactions, custom emoji + crop tool
│   │   ├── dm/                 # direct messages, online users
│   │   ├── admin/              # roles, bans, server settings
│   │   └── settings/           # settings sheet/dialog, all tabs
│   ├── stores/                 # zustand stores
│   ├── services/                # socket client, voiceService (mediasoup), uploadService
│   ├── types/reson8-protocol/    # vendored shared-types snapshot
│   ├── hooks/
│   └── lib/                      # sound alerts, formatting, sanitization
├── e2e/                          # Playwright specs
└── vite.config.ts
```

Each `features/*` module owns its components, hooks, and local logic; cross-feature state lives in `stores/`. This is a deliberate departure from the desktop client's single 3000+ line `renderer.ts` — feature isolation is a core "best practice" requirement from the brief.

---

## 5. Cross-Cutting Design Decisions

### 5.1 Mobile-first responsive strategy

The desktop client's three-pane layout (channel tree | tabbed content | status bar) does not compress onto a phone screen — there is no responsive precedent to port (confirmed: 0 media queries exist today). The web client instead defines **one component set, three compositions**, using Tailwind's default breakpoints:

| Breakpoint | Width | Layout |
|---|---|---|
| Base (mobile) | < 768px (`base`, no prefix) | **Single-column navigation stack.** One panel visible at a time: Channel List → Chat/Voice → (optionally) a settings/detail sheet. Back navigation via a header back button *and* the browser/OS back gesture (real routes via React Router make this correct for free). Bottom **tab bar** with 4 destinations: Channels, Chat (badge = total unread), DMs (badge = unread), Voice (mini-bar, see below). Settings reached via a header icon, not a tab slot. |
| `md:` | ≥ 768px (tablet) | **Two-pane.** Persistent collapsible channel-tree drawer (toggleable, overlay on portrait tablet / push on landscape) + full-height content pane (chat or voice). |
| `lg:` | ≥ 1024px (desktop browser) | **Three-pane**, closest to the desktop client's composition: fixed channel tree | tabbed content (chat/DMs/log) | persistent voice control bar. This is the *widest* composition of the same components, not a separate build. |

**Persistent voice mini-bar:** when the user is in a voice channel, a slim always-visible bar (channel name, session timer, mute/deafen/leave buttons) is pinned above the mobile tab bar / at the bottom of the desktop layout — modeled on a "now playing" mini-player pattern, so voice never gets buried behind chat navigation the way it would in a naive tab switch. Tapping it expands to the full voice panel (occupant list, per-user controls).

**Touch replacements for desktop mouse interactions** (binding decision carried into every relevant phase PRD):
- Right-click context menus (channel rename/delete/NSFW, occupant volume/mute/kick) → **long-press to open a bottom sheet** on touch, **kebab (⋮) icon button** always available as the discoverable/mouse-accessible equivalent (so functionality never depends on a hidden gesture alone).
- Drag-and-drop channel reordering → **explicit "Reorder" edit mode** (entered via the kebab menu) showing up/down move buttons per channel row, *in addition to* drag handles for pointer/mouse users where the platform supports the Pointer Events / `dnd-kit` touch sensor cleanly. Reordering must never be drag-only.
- Hover-revealed message actions (edit/delete/react/pin buttons on the desktop client) → always-visible on touch (no hover state exists), triggered by tap on a kebab icon per message; hover-reveal is retained as a progressive enhancement on pointer-fine devices.

### 5.2 Design system & visual identity

MVP ships a **single theme** matching the desktop client's dark visual identity (the desktop app has no theme switcher today, so there is no parity gap in shipping one theme first). Design tokens (color, spacing, radius, elevation) are defined once in Tailwind config as CSS variables, structured so a light theme or alternate palette is a token-swap, not a rewrite — this is a "cheap to add later" seam, not a Phase 1 deliverable.

Typography, spacing, and touch-target sizing follow platform accessibility minimums (44×44px minimum touch targets per WCAG 2.5.5 / Apple HIG) — a real constraint the desktop client (mouse-only) never had to satisfy.

### 5.3 Identity model (no login, ported)

Reson8 has no authentication system — identity is a persistent instance ID sent on `USER_JOIN_SERVER`. The web client's equivalent: a `crypto.randomUUID()` generated once and stored in `localStorage` under `reson8-instance-id`, reused on every future visit **from the same browser profile**. This is documented as a platform-inherent limitation, not a bug: clearing site data, using a private/incognito window, or switching browsers/devices produces a new identity, exactly mirroring the desktop client's own dev-mode-regenerates-per-launch behavior, just triggered by different user actions. `ADMIN_INSTANCE_ID`-based admin grant (server-side, unmodified) works identically once the user knows their instance ID — Phase 1 ports the "copy instance ID" affordance from the desktop footer.

### 5.4 PWA scope: installability and app-feel, not offline data

- **Installable**: web manifest + service worker satisfy installability criteria on Chromium (Android/desktop) and Safari (iOS 16.4+ manual "Add to Home Screen" — no `beforeinstallprompt` event exists on iOS, so Phase 7 designs an explicit in-app instructional prompt for Safari users instead of relying on the native install banner).
- **App-shell caching only**: Workbox precaches the built JS/CSS/HTML shell and static icons/sounds so the app *loads* offline into a clear "not connected" state — it does not cache or replay channel/message/presence data, which is meaningless without a live connection to a specific self-hosted server anyway.
- **Update flow**: replaces electron-updater. New service worker versions are detected, the user is prompted via a toast ("Update available — Reload"), and a "What's New" modal (ported from desktop Phase 11, same `reson8-last-seen-version` localStorage marker and GitHub Releases API call, which is CORS-open) shows after the reload if the version changed. Full design in Phase 7.
- **No background push in this phase** (confirmed decision, see §7). Nudge and DM alerts work while the tab/PWA is open (foreground or backgrounded-but-running), via in-page toast + sound + the Badging API + Vibration API on supporting devices — not when the browser/PWA is fully closed.

### 5.5 Accessibility

WCAG 2.1 AA is a working target, not an aspiration, enforced by: Radix primitives (correct ARIA roles/focus trapping/keyboard nav for free), a minimum-contrast-checked color palette, 44px minimum touch targets, visible focus states, and `axe-core` integrated into the Playwright E2E suite (Phase 7 gate, but checked incrementally every phase). This is an explicit upgrade over the desktop client, whose custom modals have no confirmed ARIA semantics.

### 5.6 Security practices

- All user-generated content (messages, nicknames, DM content, link-preview data) is rendered as text (React's default escaping) or through a strict allowlist sanitizer (`DOMPurify` or equivalent) if any rich formatting is introduced — mirrors the desktop client's deliberate `textContent`-not-`innerHTML` choice for the "What's New" modal, applied consistently everywhere, not just that one modal.
- File uploads respect the server's existing size/MIME constraints client-side (fail fast with a clear error) in addition to the server's own enforcement — client-side checks are UX, not a trust boundary.
- No secrets live in client code; the server URL/password are user-supplied per-connection, exactly as today.
- CSP headers configured at the hosting layer (Phase 7 deployment task) restrict script/style/connect-src appropriately for a self-hosted deployment model where the server origin varies per user.

---

## 6. Feature Parity Ledger

Every feature from the desktop README, grouped exactly as the desktop feature list is grouped, with its disposition. "Phase" references the phase PRD that owns implementation.

| Desktop Feature | Web Client Disposition | Phase |
|---|---|---|
| Crystal-clear SFU voice (mediasoup) | Ported directly (same client library, same signaling handshake) | 2 |
| Push-to-Talk + VAD fallback | Ported for in-tab-focused use; **global OS-level PTT (works when app unfocused) has no browser equivalent** — documented platform limitation, on-screen press-and-hold PTT button is the mobile-first primary interaction | 2 |
| Active Speaker Indicator | Ported (same `ACTIVE_SPEAKERS` event) | 2 |
| Audio Device Selection | Ported (`navigator.mediaDevices.enumerateDevices`, note: labels require a prior permission grant — documented) | 2 |
| Mic Sensitivity / Noise Gate | Ported (same AnalyserNode approach, portable Web Audio API) | 3 |
| Voice Session Timers | Ported, including Phase 11's clock-offset correction | 2 |
| Per-User Volume & Local Mute | Ported (same GainNode-per-participant graph); touch UI via long-press/kebab sheet instead of right-click | 3 |
| Self Mute/Deafen Indicators | Ported (`SET_VOICE_STATE`) | 2 |
| Mute/Deafen accumulation logic | Ported 1:1 (same state machine as Phase 10 PRD 10.4) | 2 |
| Audio Settings (Nudge/Alerts/Global Voice volume) | Ported | 3 / 7 |
| Automatic Voice Reconnection | Ported (Socket.io reconnect + WebRTC connection-state monitoring + `VOICE_SESSION_LOST`, same design as desktop Phase 11 PRD 11.1) | 2 |
| Channel Tree (hierarchical) | Ported | 1 |
| Channel Management (create/rename/delete) | Ported, touch-adapted (sheets, kebab menu) | 1 / 3 |
| Drag & Drop Reordering | Ported with a non-drag fallback (explicit reorder mode) for touch | 3 |
| NSFW Channels | Ported | 3 |
| Real-Time Presence | Ported | 1 |
| Tabbed Text Chat | Ported, mobile nav = navigation-stack instead of literal tabs on narrow screens; true tabs on `lg:` | 4 |
| Edit & Delete Messages (2-min window) | Ported | 4 |
| Unread Channel Indicators | Ported | 4 |
| Instant Upload Feedback | Ported, mobile file/camera picker via `<input type=file capture>` | 4 |
| Direct Messages | Ported | 5 |
| Persistent DMs (offline access to history) | Ported | 5 |
| Emoji Picker & Reactions | Ported (same curated set, ~552 emoji) | 4 |
| Custom Emoji (crop tool + approval queue) | Ported, touch-friendly pinch/drag crop | 4 |
| Link Previews (OG scrape + video embeds) | **Degraded**: generic OG-tag scraping requires a server-side fetch to dodge CORS (the desktop client does this via Electron's main process) — out of scope per this project's no-server-changes decision. MVP ships oEmbed-only previews for providers with CORS-open oEmbed endpoints (YouTube confirmed; a small allowlist to be finalized in Phase 4). Bare URLs elsewhere remain clickable hyperlinks with no preview card. Flagged as a candidate for a future companion server-side proxy endpoint, outside this project's scope. | 4 |
| Pinned Messages | Ported | 4 |
| Role-Based Permissions | Ported (client reads the same bitwise flags, same `requirePermission` contract server-side) | 6 |
| Server Password Protection | Ported | 1 |
| Kick & Ban | Ported, touch-adapted | 6 |
| Auto-Updates | Reimagined as service-worker update flow (no installer/electron-updater equivalent needed — the web *is* the install) | 7 |
| "What's New" Modal | Ported (same version-marker logic, GitHub Releases API) | 7 |
| System Tray | **No web equivalent** — documented platform limitation. Closest analogs shipped: installed-PWA home-screen/taskbar icon, Badging API unread count | 7 |
| Remember Me | Ported | 1 |
| Sound Alerts & Connectivity (latency ping) | Ported (same event→sound mapping, same volume sliders) | 1 (infra) / throughout |
| Nudge | Ported for foreground/backgrounded-but-open use (toast + sound + Vibration API + Badging API); **no closed-app push** per confirmed decision | 5 |
| Always-Accessible Settings | Ported | 1 |
| Self-Hosted, one-command server | N/A — this is a server property, already satisfied by the unmodified `reson8` server | — |
| Native right-click context menu (OS text-field cut/copy/paste) | **No web equivalent needed** — browsers provide this natively on any text input/textarea without any app code | — |

Additional Electron-only internals with no web equivalent (confirmed via source audit, not user-facing features but worth recording so nobody re-derives this list later): main-process `fetch()` bypassing CORS for link previews/release notes (release notes are fine — GitHub API is CORS-open; link previews are the actual casualty, handled above), `app.getPath`-persisted instance ID (replaced by localStorage, §5.3), taskbar/dock flash (replaced by Badging API + Vibration API), native OS mic-permission auto-grant (browsers always show a real permission prompt — this is a UX step the web client must design for, not skip), `document.execCommand("copy")` clipboard fallback (unnecessary — `navigator.clipboard` works natively in a browser context, unlike Electron's CSP-restricted renderer).

---

## 7. Non-Goals (this project)

Confirmed with the product owner before phase planning began:

1. **No server-side changes.** This repository does not modify `reson8`'s server, database schema, or Socket.io protocol. Any feature that strictly requires a server change (see link previews above) ships in a degraded form or is deferred, never implemented by silently forking the server.
2. **No background push notifications.** Nudge and DM alerts are foreground/backgrounded-tab-only in this phase set. True closed-app push (Web Push + VAPID + server subscription storage) is a known future companion workstream, not planned here.
3. **No native app-store wrapper.** The target is an installable PWA only (browser "Add to Home Screen" / install prompt). No Capacitor/Trusted Web Activity packaging or app-store submission planning in this phase set — though nothing in the architecture chosen (standard web APIs, no exotic browser-only dependencies) makes that harder later than it would otherwise be.
4. **No offline data/message composition queue.** Reson8 is a live communication tool; there's no product value in queuing a chat message written while offline for later send in v1 (may be reconsidered post-launch based on real usage).
5. **No multi-server "server list" UX beyond what the desktop client has.** The desktop client connects to one server at a time via URL entry; this project matches that scope rather than inventing a Discord-style multi-server switcher.

---

## 8. Phase Map

Each phase below is a separate PRD file in this folder. Phases are ordered so each one is independently demoable against the real `reson8` server, mirroring how the desktop project itself was built incrementally (see its own `app-planning/progress.txt`).

| Phase | File | Focus | Depends on |
|---|---|---|---|
| 1 | `01-phase1-foundation-connection.md` | Project scaffold, PWA shell, design system, state architecture, connect flow, channel tree (read-only), presence, settings shell, sound-alert infra | — |
| 2 | `02-phase2-voice-core.md` | mediasoup-client integration, join/leave voice, mute/deafen, PTT, device selection, active speaker, session timers, reconnect resilience | 1 |
| 3 | `03-phase3-advanced-voice-channel-mgmt.md` | Noise gate, per-user volume/local mute, channel CRUD, NSFW, reorder (touch-adapted) | 1, 2 |
| 4 | `04-phase4-text-chat-messaging.md` | Tabbed/stacked chat, send/edit/delete, uploads, emoji picker + reactions, custom emoji, link previews (degraded), pinned messages, unread indicators | 1 |
| 5 | `05-phase5-direct-messages-social.md` | DMs, persistent history, online users, read receipts, Nudge (foreground) | 1, 4 |
| 6 | `06-phase6-admin-moderation.md` | Roles UI, permission-gated surfaces, emoji approval queue, kick/ban, server password protection, server settings | 1, 3, 4 |
| 7 | `07-phase7-pwa-platform-polish.md` | Installability, update flow, "What's New" modal, Badging/Vibration APIs, accessibility gate, performance budget, cross-device testing, deployment | all prior |

Phases 2 and 4 can, in practice, be developed in parallel by separate workstreams once Phase 1 lands, since voice and text chat share almost no implementation surface beyond the channel tree and shell — noted here for planning purposes, not a requirement.

---

## 9. Open Decisions Deferred to Phase-Level PRDs

These are flagged here so they aren't lost, but are resolved with concrete recommendations in the relevant phase PRD rather than left ambiguous at the master level:

- Exact oEmbed provider allowlist for degraded link previews (Phase 4).
- Whether channel/message rendering supports any markdown subset beyond emoji tokens and plain links (Phase 4) — the audit found no evidence of markdown parsing in the desktop client despite the README's "rich formatting" phrase, so Phase 4 treats this as scoped to emoji tokens + auto-linked URLs + the oEmbed cards above, matching confirmed desktop behavior, not the aspirational README wording.
- Final breakpoint values if user testing in Phase 7 suggests Tailwind's defaults don't fit real device data (Phase 7).
- Hosting/deployment target (static host + CDN vs. containerized alongside the existing `docker-compose.yml`) — Phase 7.

---

## 10. Development Process: Progress Tracking & Versioning

This section defines default working practice for **every** phase (1–7 alike). Each phase PRD reiterates it briefly rather than assuming it's remembered from here — treat it as binding, not optional cleanup.

### 10.1 Progress tracking (`/log-progress`)

Every PRD item, once implemented and verified, gets its own entry appended to `app-planning/progress.txt` via the `/log-progress` slash command (`.claude/commands/log-progress.md`) — **task-by-task, as the work happens, not batched at the end of a phase.** The entry format mirrors the one established in `../reson8/app-planning/progress.txt` (`--- Entry: DD/MM/YYYY ---`, Problem / Solution / Key Files Modified / Verification / Next Step). This is what makes the feature ledger in §6 and the phase acceptance criteria throughout this document actually verifiable after the fact, by this project or a future session, without re-deriving history from diffs.

### 10.2 Versioning (`/bump-version`)

The web client carries its own `MAJOR.MINOR.PATCH` version number, independent of `reson8`'s versioning, tracked in `package.json` (from Phase 1 onward), mirrored in the README's version badge and `CLAUDE.md`'s "Current version" line, and surfaced in-app on the Settings → About tab (Phase 1 P1.10 already wires an About-tab version display from a build-time-injected value — this scheme is that value's source).

**This project's bump policy is a deliberate, documented departure from conventional semver** (where MAJOR conventionally signals a breaking change to external consumers). This client has no external API/consumers to break, so the version number is repurposed as a legible build-tracking aid for future debugging sessions instead — "what shipped in this build" rather than "is this build compatible with that one":

- **MAJOR** — the completed work introduced any new user-facing feature or capability.
- **MINOR** — the completed work was fixes only (no new capability).
- **PATCH** — the completed work was purely cosmetic (copy/text, spacing, color, non-functional UI tweaks) with no behavior change.

Starting version is `0.1.0`, established when Phase 1 scaffolds `package.json` (P1.1). **A version bump is required at the end of every completed phase PRD** (Phase 1 through Phase 7) — run `/bump-version` (`.claude/commands/bump-version.md`) once the phase's acceptance criteria are all met, classifying the bump from that phase's actual `progress.txt` entries per the rule above, not from the phase number. In practice, every phase in this document ships at least one new capability and is expected to land as a MAJOR bump — MINOR/PATCH bumps are the expected shape of *post-launch* maintenance work outside this PRD set's scope, not of the phases themselves, though `/bump-version` may also be run standalone after any significant out-of-phase fix if one occurs mid-project. `/bump-version` also generates `app-planning/releases/v<version>.md` release notes, sourced from the `progress.txt` entries since the previous bump — matching the convention already validated in `../reson8`.

## 11. Glossary

- **SFU** — Selective Forwarding Unit; mediasoup's architecture, server forwards audio streams rather than peers connecting directly (mesh).
- **Instance ID** — the persistent, login-free identity UUID sent on `USER_JOIN_SERVER`.
- **Occupant** — a user present in a specific voice channel.
- **PTT** — Push-to-Talk.
- **VAD** — Voice Activity Detection (the "voice activation" mic mode, as opposed to PTT).
- **Nudge** — the attention-getting ping feature (sound + toast + OS-level flash on desktop).
- **Ack** — Socket.io acknowledgement callback; most client→server events in this protocol are ack-based request/response, not fire-and-forget.
