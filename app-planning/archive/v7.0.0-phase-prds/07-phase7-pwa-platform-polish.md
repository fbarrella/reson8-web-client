# Phase 7 PRD — PWA Platform Features, Accessibility & Launch Hardening

Depends on: all prior phases (this is the launch-readiness gate, not a feature-building phase in the same sense as 1–6)
Depended on by: none — final phase before general availability

## Goal

Turn the functionally-complete app from Phases 1–6 into a real, installable, self-updating PWA that has been verified — not assumed — to work across the device/browser matrix that actually matters for a mobile-first product, with accessibility and performance treated as launch gates rather than best-effort.

## Scope

### In scope
- Installability: manifest finalization, install-prompt UX (Chromium `beforeinstallprompt` + iOS Safari manual-instructions fallback)
- Service worker update flow (replaces electron-updater conceptually): update-available toast, controlled reload
- "What's New" modal (ported from desktop, GitHub Releases API)
- Badging API (unread counts on the installed icon — Phase 5 already calls this API; this phase owns its lifecycle/edge cases, e.g. clearing on app close/all-read)
- Vibration API integration audit (already introduced in Phase 5 for Nudge; this phase checks for other reasonable uses, e.g. incoming call-equivalent alerts, without inventing new product features)
- Accessibility gate: WCAG 2.1 AA verification pass across all phases' surfaces
- Performance budget: Lighthouse PWA/Performance scoring, bundle-size and code-splitting review
- Cross-browser/cross-device testing matrix execution (real devices, not just emulation)
- Deployment: hosting decision, HTTPS/WSS requirements, CSP configuration
- Documentation: this repo's own README/CLAUDE.md-equivalent for future contributors (mirroring the desktop repo's documentation discipline)

### Out of scope
- Any new user-facing feature not already specified in Phases 1–6 — this phase is about making existing features installable, updatable, accessible, fast, and verified, not about adding scope

## Detailed Requirements

**P7.1 — Manifest & installability**
Finalize `manifest.webmanifest`: name/short_name, full icon set (192/512/maskable, plus any additional sizes Lighthouse/platform tooling flags), `display: "standalone"`, `orientation` left unset/`any` (a communication app should rotate freely, unlike a game), theme/background colors matching design tokens. On Chromium-based browsers, capture the `beforeinstallprompt` event and surface it as a deliberate, dismissible in-app "Install Reson8" affordance (not an unsolicited native banner interruption) — timed to appear after a successful connection (a working session is a better install-conversion moment than the connect screen). **iOS Safari has no `beforeinstallprompt`** — ship an explicit in-app instructional panel ("Tap Share → Add to Home Screen") triggered by the same moment, detected via user-agent/feature-sniffing, since this is the only way iOS users discover PWA installability at all.

**P7.2 — Service worker update flow**
Switch `vite-plugin-pwa` from Phase 1's `generateSW` baseline to `injectManifest` mode, giving the custom service worker logic needed for a controlled update UX: on detecting a new service worker in the `waiting` state, show a persistent (not auto-dismissing) toast — "A new version is available" with a Reload action — rather than silently auto-updating (which would risk interrupting an active voice/chat session) or silently doing nothing (which is how most default Workbox setups behave, and would mean users never get fixes without manually hard-refreshing). Reload triggers `skipWaiting()` + `clients.claim()` + a page reload. This is the direct conceptual replacement for electron-updater's check/download/install flow, minus any installer/binary distribution concern that doesn't apply to the web.

**P7.3 — "What's New" modal**
Port desktop Phase 11's design exactly: on the post-reload load, compare the running build's version against `localStorage['reson8-last-seen-version']`; unset **and** no prior instance-id-equivalent history (mirror the desktop's `hasExistingInstanceId()` fix from the "silently skipped on upgrade" bug — the web equivalent check is "does `reson8-instance-id` already exist," i.e. is this actually a returning visitor vs. a truly first-ever load) → first-ever load, silently record, no modal; differs on a returning visitor → fetch release notes from the GitHub Releases API (`api.github.com/repos/.../releases/tags/v{version}` — confirmed CORS-open, unlike the generic link-preview scraping problem in Phase 4) and show the modal; matches → no-op. Render release-note body as plain text (`textContent`-equivalent, i.e. never `dangerouslySetInnerHTML` on remote content) — same deliberate security-over-polish tradeoff as desktop, and consistent with master PRD §5.6's sanitization stance applied project-wide, not just here.

**P7.4 — Badging & Vibration API lifecycle**
Audit every call site introduced in Phase 5: badge count reflects the sum of unread DMs + pending nudges-not-yet-acknowledged, cleared when all are viewed or the tab regains focus with nothing unread (exact clearing rule is an implementation detail; the requirement is that the badge never gets "stuck" showing a stale nonzero count). Both APIs remain feature-detected and silently degrade — this phase's job is closing edge cases (e.g., badge not clearing on logout/disconnect), not introducing new call sites beyond what Phase 5 already specified.

**P7.5 — Accessibility gate**
Full `axe-core`-driven audit (automated, via Playwright + `@axe-core/playwright`) across every route/major surface: connect screen, app shell at all three breakpoints, every settings tab, every modal/sheet, the voice panel, the chat composer and emoji picker, admin surfaces. Manual verification supplements automated scanning for what it can't catch: full keyboard-only navigation of the entire app (no mouse), screen reader smoke test (VoiceOver on iOS/macOS at minimum, TalkBack on Android recommended) of the connect flow and sending a message, color-contrast spot-check against the final design tokens. **Zero automated violations is the launch gate** — not a target, a blocker, consistent with master PRD §5.5 treating this as a working requirement from Phase 1 onward rather than a late audit that discovers systemic problems too late to fix cheaply.

**P7.6 — Performance budget**
Lighthouse CI (or equivalent) run against a production build, targeting: Performance ≥ 90, PWA installability = pass, Accessibility ≥ 95 (backstopping P7.5's zero-violations gate with a holistic score), Best Practices ≥ 95. Concrete tactics: route-based code splitting (React Router's lazy route loading — e.g. the admin/settings surfaces need not be in the initial bundle), the ~552-entry emoji dataset and custom-emoji crop tooling deferred/lazy-loaded rather than bundled into the initial connect-screen load, image/icon assets appropriately sized and compressed. Bundle-size budget (a specific number, e.g. initial JS ≤ 250KB gzipped) to be set once Phase 1's baseline scaffold gives a real starting measurement — don't guess a number now with zero code written.

**Bundle-size budget, set at P7.6 (17/08/2026):** initial JS for the
connect-screen load (the app's actual entry point) **≤ 160KB gzipped**.
Pre-code-splitting this session, the single bundle was 260.67KB gzipped;
post-splitting (lazy `/app` route tree, lazy Settings admin tabs, lazy
emoji picker/dataset, dynamic-imported `mediasoup-client`) it measures
~139.2KB gzipped (432.5KB index chunk + the small always-needed
`createLucideIcon`/`rolldown-runtime`/`workbox-window` chunks). 160KB
leaves headroom for incidental growth while still catching a real
regression (e.g. a new eager dependency, or a lazy boundary accidentally
becoming unconditionally-mounted — see the P7.6 progress.txt entry for a
real instance of that exact mistake and its fix).

**P7.7 — Cross-device/cross-browser testing matrix**
Minimum real-device (not purely emulated) pass before launch:

| Platform | Browser | Priority | Notes |
|---|---|---|---|
| Android phone | Chrome | P0 | Primary mobile target; full voice + install flow |
| iOS phone | Safari | P0 | Distinct WebRTC/PWA-install/autoplay/Vibration-API constraints from every other row — cannot be skipped or assumed-equivalent to Chrome testing |
| Desktop | Chrome/Edge (Chromium) | P0 | Primary desktop target; `beforeinstallprompt`, `setSinkId` |
| Desktop | Firefox | P1 | No `setSinkId`; verify graceful degradation (Phase 2 P2.7) |
| macOS | Safari | P1 | Shares some iOS Safari constraints (autoplay, no Badging API prior to certain versions) |
| Android tablet / iPad | Chrome / Safari | P2 | Validates the `md:` two-pane composition specifically, not just phone/desktop extremes |

This matrix exists specifically because Phase 2's voice reconnection resilience (mobile backgrounding) and Phase 2/7's install/autoplay flows are the two areas of this entire project with genuine, unavoidable cross-platform behavioral differences — every other phase's features are comparatively platform-uniform once they work in one modern browser.

**P7.8 — Deployment**
Decide and document: static-host + CDN (e.g. the built SPA served from any static host, pointed at a user-supplied `reson8` server per the existing connect-screen model — this app has no backend of its own, so this is the natural default) vs. containerizing alongside the existing `docker-compose.yml` stack for self-hosters who want to serve the web client from the same box as their `reson8` server. Either way: **HTTPS is mandatory** — `getUserMedia`, service workers, and the Badging/Vibration APIs are all restricted to secure contexts (`localhost` excepted for dev). Document the WSS requirement for the Socket.io connection to a production `reson8` server (matching the existing server's own TLS/reverse-proxy expectations, unmodified). CSP headers configured at the hosting layer per master PRD §5.6, accounting for the variable, user-supplied server origin this client connects to (`connect-src` cannot be a single hardcoded origin — document the resulting CSP tradeoff explicitly rather than shipping an overly permissive wildcard silently).

**P7.9 — Project documentation**
A `README.md` and `CLAUDE.md` (or equivalent AI-agent-guidance doc, matching the desktop repo's own documentation convention) for this repo, covering: setup/dev commands, architecture summary, the vendored-protocol-types sync process (master PRD §3.1), and a pointer back to this `app-planning/` PRD set as the authoritative feature spec — mirroring the desktop repo's own `progress.txt`-driven documentation discipline so this project is maintainable by someone (human or agent) who wasn't in this planning session.

## Acceptance Criteria

- A fresh install on both an Android Chrome and iOS Safari device succeeds via each platform's respective install path, and the installed app launches to `display: standalone` with no browser chrome.
- Deploying a new build produces the update-available toast on already-open clients within one reasonable polling/check interval, and the "What's New" modal appears exactly once per version bump for returning visitors, never for a genuinely first-ever visitor.
- Zero `axe-core` violations across the full audited surface list in P7.5.
- Lighthouse scores meet the P7.6 targets on a production build.
- The full P7.7 device matrix has been manually exercised at least once end-to-end (connect → voice → chat → DM → admin action where applicable) with results recorded, not just "should work" reasoning.
- Production deployment is served over HTTPS/WSS with a documented CSP.

## Progress Tracking & Versioning

Per master PRD §10: log a `/log-progress` entry for each item in this phase (P7.1–P7.9) as it's completed, not batched at the end. Once every acceptance criterion above is met, run `/bump-version` once for the phase as a whole — this phase ships new capabilities (installability, update flow, "What's New" modal), so expect a MAJOR bump under the project's feature/fix/copy policy, absent a reason to classify otherwise. This is the launch-gating phase, so its closing bump is also a reasonable point to consider tagging as this project's first public release.

## Risks / Dependencies

- iOS Safari is the single highest-risk platform in this entire project (weakest PWA API support, most restrictive autoplay/WebRTC-background behavior, no `beforeinstallprompt`) — do not treat "works on Android Chrome" as sufficient evidence the mobile-first goal has been met; budget real iOS device time specifically.
- This phase assumes Phases 1–6 are functionally stable; starting P7.7's device matrix against a still-changing feature set produces unreliable results — sequence accordingly rather than parallelizing heavily with late Phase 6 work.
