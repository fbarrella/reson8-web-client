# Phase 1 PRD — Foundation, Connection & Presence Shell

Depends on: master PRD (`00-master-prd.md`)
Depended on by: all subsequent phases

## Goal

Stand up the project (tooling, PWA shell, design system, state architecture) and deliver the first vertically-complete slice: a user can open the web app on any screen size, connect to a real `reson8` server (with password support), see the live channel tree with real-time presence, and reach the always-available Settings surface — with sound alerts and the mobile-first navigation shell all working end to end. No voice or chat send/receive yet (Phases 2/4).

## Scope

### In scope
- Repo/tooling scaffold (Vite, React, TS strict, ESLint+Prettier, Vitest, Playwright skeleton)
- Vendored protocol types (`src/types/reson8-protocol/`)
- Design system foundation: Tailwind config + design tokens, shadcn/ui primitives installed (Dialog, Sheet, Drawer, Tabs, Toast, DropdownMenu, Popover, Slider, Button, Input, Avatar)
- App shell: mobile nav-stack / tablet two-pane / desktop three-pane composition (structure only — chat/voice content panes are placeholders until Phases 2/4)
- Zustand store architecture (`connectionStore`, `channelTreeStore`, `presenceStore`, `settingsStore`)
- Socket.io client service: typed wrapper around `socket.io-client`, connect/disconnect/reconnect lifecycle
- Connect screen: server URL, nickname, password, Remember Me
- Instance identity (`localStorage` UUID)
- `USER_JOIN_SERVER` / `USER_LEAVE_SERVER` flow, error handling (bad password, server unreachable, name taken if applicable)
- Channel tree render (read-only: names, hierarchy, occupant list, type icons) driven by `CHANNEL_TREE_UPDATE` / `PRESENCE_UPDATE`
- Latency + clock-offset measurement (`PING_LATENCY`), status indicator
- Settings sheet/dialog shell with all 7 tabs stubbed (Roles, Emojis, Server, Voice & Shortcuts, Application, Audio, About) — populated progressively in later phases; About tab fully functional this phase (app version, build info)
- Sound alert infrastructure: asset loading, global mute toggle, volume-aware `play()` helper, wired to the subset of events already live this phase (`connected`, `disconnected`)
- Toast system
- PWA manifest + minimal service worker registration (app-shell precache only; full install/update UX is Phase 7 — this phase just ensures the build pipeline produces a valid, installable-in-principle artifact from day one instead of bolting PWA on late)

### Out of scope (later phases)
- Voice join/mute/deafen (Phase 2)
- Chat send/receive (Phase 4)
- Channel CRUD (Phase 3)
- Admin/moderation tab content (Phase 6)
- Full install prompts, update flow, "What's New" modal (Phase 7)

## Detailed Requirements

**P1.1 — Project scaffold**
Vite + React + TS (strict: `noImplicitAny`, `strictNullChecks`, etc. all on). ESLint flat config (`@typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` — the last one is a concrete accessibility guardrail, not just a formatter). Prettier for formatting. `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run build`, `npm run dev` all functional from commit one (a deliberate contrast with the desktop repo's broken `npm run lint`).

**P1.2 — Vendored protocol types**
Copy `socket-events.ts` and `models.ts` from the desktop repo's `packages/shared-types/src` into `src/types/reson8-protocol/`, each prefixed with a comment block recording source path and the desktop repo's version/commit at copy time. No modification to the copied files' contents beyond adding that header — divergence should be visible in a diff against the original, not silent.

**P1.3 — Design tokens & primitives**
Tailwind config defines the full color/spacing/radius/typography token set as CSS variables (single dark theme per master PRD §5.2). Install shadcn/ui components needed this phase: `dialog`, `sheet`, `drawer`, `tabs`, `toast`, `dropdown-menu`, `popover`, `slider`, `button`, `input`, `avatar`, `badge`. Every interactive primitive is keyboard-operable and screen-reader-labeled out of the box via Radix — verify with one `axe-core` smoke pass on the connect screen before moving on, as the pattern to repeat every phase.

**P1.4 — App shell & responsive composition**
Implement the three breakpoint compositions described in master PRD §5.1 as a `<AppShell>` layout component: mobile bottom tab bar (Channels/Chat/DMs/Voice, Settings via header icon) + nav-stack routing; `md:` collapsible drawer + content pane; `lg:` fixed three-pane. Use React Router routes (`/connect`, `/app`, `/app/channels/:channelId`, `/app/dms/:partnerId`) so the mobile back button/gesture and desktop URL both behave correctly. Voice mini-bar slot is reserved in the layout (rendered empty/hidden until Phase 2 populates it).

**P1.5 — Connection store & Socket.io service**
A typed `socketService` wraps `socket.io-client`, exposing typed `emit`-with-ack helpers matching `ClientToServerEvents` and a typed `on` subscription helper matching `ServerToClientEvents` (thin wrapper, not a reimplementation — the types from P1.2 drive the typing). `connectionStore` (Zustand) holds `status: 'idle'|'connecting'|'connected'|'reconnecting'|'error'`, `serverId`, `error`, `latencyMs`, `clockOffsetMs`. Reconnection uses Socket.io's built-in reconnection (not a custom loop) with the desktop's retuned timeouts as a reference point (25s ping interval / 20s ping timeout are server-side and already fixed; client just reacts to `connect`/`disconnect`/`reconnect` events).

**P1.6 — Connect screen**
Fields: Server URL (validated as a URL, defaults to `wss://` or `ws://` inference from input), Nickname (required, length-bounded matching server validation), Password (shown/hidden toggle, only submitted if non-empty), Remember Me checkbox. On submit: `USER_JOIN_SERVER` with `{serverId?, nickname, instanceId, password?}`. Error states surfaced inline (wrong password, server unreachable — distinguish a socket connect failure from a join-ack failure so the message is accurate, e.g. "Can't reach that server" vs "Incorrect password"). Remember Me persists `serverUrl`/`nickname`/`password` to `localStorage` under `reson8-*` keys **matching the desktop client's existing key names exactly** (`reson8-remember-me`, `reson8-server-url`, `reson8-nickname`, `reson8-server-password`) — not because of any technical requirement, but as a deliberate consistency choice in case a future feature ever needs to reason about both clients' storage conventions side by side. Mobile-first layout: single centered card, full-width fields, large tap targets; scales to a centered fixed-width card on desktop.

**P1.7 — Instance identity**
`getOrCreateInstanceId()`: reads `localStorage['reson8-instance-id']`, generates via `crypto.randomUUID()` and persists if absent. No dev/packaged distinction (there's no "packaged build" concept on the web) — always persisted, always stable per browser profile. Documented in-app (About tab, "Copy Instance ID" button using `navigator.clipboard.writeText` — no Electron clipboard fallback needed, see master PRD §6).

**P1.8 — Channel tree (read-only render)**
`channelTreeStore` holds the nested tree from `CHANNEL_TREE_UPDATE`; `presenceStore` (or embedded in tree nodes, per `IChannelTreeNode.occupants`) updates from `PRESENCE_UPDATE`. Render: collapsible category nodes, voice-channel rows with occupant avatars/nicknames and presence dot, text-channel rows with an unread-dot placeholder (wired live in Phase 4). No click-to-join yet (Phase 2/4 add the actual navigation actions) — rows are visually complete but their tap targets can be inert or show a "coming soon" toast this phase, developer's call based on how Phase 2 lands.

**P1.9 — Status/latency display**
Ping every 3s (matching desktop cadence) via `PING_LATENCY`, computing `latencyMs` and `clockOffsetMs` using the same NTP-style approximation as desktop Phase 11 (`offset ≈ serverTime - (localSendTime + rtt/2)`). Color-coded latency indicator in the header/status area (green/amber/red thresholds matching desktop's existing bands). `clockOffsetMs` is stored now so Phase 2's session timers can consume it without re-deriving the mechanism.

**P1.10 — Settings shell**
A `<Sheet>` (mobile: full-screen; desktop: side panel or centered dialog) with the same 7 tabs as desktop, tab visibility for Roles/Emojis/Server gated the same way (cached connect-time permission flags, no flicker) even though those tabs render "coming soon" placeholders until Phases 3/6 populate them. About tab is fully functional: app version (from `import.meta.env` build-time injection), a static "Reson8 Web Client" identity block, Copy Instance ID button. Application tab this phase: just the "Mute sound alerts" toggle (tray-related toggles from desktop don't apply — no tray; see Phase 7 for what replaces them).

**P1.11 — Sound alert infrastructure**
Load the same sound-asset set conceptually (new/ported `.mp3` files under `public/sounds/`, sourced from — or newly authored to match — the desktop client's `assets/sound-alerts/` set, reusing exact filenames as the mapping key so later phases can wire events to sounds by referencing the same list from the audit). Global mute toggle (`reson8-mute-alerts`, same key name as desktop) and two volume knobs (`reson8-alert-volume`, `reson8-nudge-volume`) — sliders themselves ship in Phase 3's Audio tab, but the storage keys and `SoundAlert.play(name, volumeCategory)` helper are built now so Phase 1's `connected`/`disconnected` sounds and every later phase's sounds share one implementation. **Audio unlock note**: browsers block autoplay of audio until a user gesture occurs on the page — `SoundAlert` lazily creates/resumes its `AudioContext`/`<audio>` elements on the first user interaction (the connect-screen submit click satisfies this in practice), documented so nobody "discovers" silent alerts on first load and mistakes it for a bug.

**P1.12 — Toast system**
Built on shadcn's `toast` primitive (Radix-based, ARIA `role="status"`/`role="alert"` correct by default) — a direct upgrade over the desktop's hand-rolled `#toast-container` div. Generic `toast({title, description?, variant})` helper used by every later phase.

**P1.13 — PWA baseline**
`vite-plugin-pwa` configured in `generateSW` mode for this phase (switches to `injectManifest` in Phase 7 once custom update-prompt logic is needed — flagged here so Phase 7 doesn't have to fight an already-locked-in strategy). Manifest: name, short_name, icons (192/512/maskable), theme_color/background_color matching the design tokens, `display: "standalone"`. No install-prompt UI yet (Phase 7) — this phase just ensures `npm run build` produces a Lighthouse-installable artifact as a continuously-checked baseline, not a Phase 7 scramble.

## State/Data Additions

- `connectionStore`: status, serverId, instanceId, latencyMs, clockOffsetMs, error
- `channelTreeStore`: tree nodes (nested), keyed lookup map for O(1) node access by id (needed repeatedly in later phases — build the index now)
- `settingsStore`: mute alerts, alert/nudge volume (values only this phase; UI for the latter two ships Phase 3)

## Acceptance Criteria

- On a phone-width viewport (375px), an unauthenticated user can load the app, see the connect screen with no horizontal scroll, and every field/button meets the 44px touch-target minimum.
- Connecting to a real `reson8` dev server (password-protected and not) succeeds, with the channel tree and live presence appearing within one round trip of the ack.
- Disconnecting the server process and reconnecting it is reflected in the UI (reconnecting state shown, then recovered) without a page reload.
- Resizing the same running session from 375px → 1280px re-composes the layout across all three breakpoints with no state loss (Socket.io connection, channel tree data untouched by the layout change).
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` all pass in CI from the first merged commit.
- Lighthouse PWA installability check passes on the built output (checked now, gated formally in Phase 7).
- `axe-core` reports zero violations on the connect screen and the empty app shell.

## Progress Tracking & Versioning

Per master PRD §10: log a `/log-progress` entry for each item in this phase (P1.1–P1.13) as it's completed, not batched at the end. Once every acceptance criterion above is met, run `/bump-version` once for the phase as a whole — this phase stands up the versioning scheme itself (`package.json` starts at `0.1.0` per P1.1), so its own closing bump is the first real classification decision: this phase ships new capabilities throughout (connect flow, channel tree, settings shell, PWA baseline), so expect a MAJOR bump to `1.0.0` under the project's feature/fix/copy policy, absent a reason to classify otherwise.

## Risks / Dependencies

- **Audio autoplay policy** (P1.11) — must be handled from Phase 1 since every later phase's sound cues depend on the same unlock pattern; getting this wrong here means re-touching every phase.
- **Server CORS**: the `reson8` server needs to accept cross-origin Socket.io connections from whatever origin this app is hosted on. This is a **server-side configuration concern** (likely already permissive, but must be verified against a real deployment target) — flagged as a dependency to confirm early, not a code change owned by this project per the no-server-changes non-goal. If the deployed server's CORS policy blocks this app's origin, that's a configuration/deployment coordination item, not a client bug.
