# Phase 2 PRD — Voice Core

Depends on: Phase 1 (app shell, connection, channel tree, sound infra)
Depended on by: Phase 3 (advanced voice controls), Phase 6 (kick from voice)

## Goal

A user can tap a voice channel, hear and be heard by other occupants via the same mediasoup SFU the desktop client uses, mute/deafen themselves, use push-to-talk, see who's speaking, see a session timer, and survive a network blip without being silently ejected — all through touch-first controls, with the voice mini-bar (reserved in Phase 1's shell) fully live.

## Scope

### In scope
- `voiceService`: mediasoup-client `Device`/transport/producer/consumer lifecycle, ported from the desktop's `voice.service.ts` design
- Full 6-step handshake: `GET_ROUTER_CAPABILITIES → CREATE_WEBRTC_TRANSPORT → CONNECT_TRANSPORT → PRODUCE → CONSUME → RESUME_CONSUMER`
- Join/leave voice channel (tap-to-join on mobile and desktop)
- `getUserMedia` permission flow (browser-native prompt — no auto-grant possible, unlike Electron)
- Mute / Deafen with the exact accumulation state machine from desktop Phase 10 (deafen auto-mutes and remembers, undeafen restores prior mute, PTT blocked while deafened)
- Push-to-Talk: in-tab keyboard (desktop browsers) + on-screen press-and-hold button (primary on touch); Voice Activation (VAD) as the alternative mode, mode toggle ported from desktop
- Audio device selection (input), `enumerateDevices`-based
- Active Speaker Indicator (`ACTIVE_SPEAKERS`)
- Voice session timer with clock-offset correction
- Automatic voice reconnection (Socket.io reconnect replay, WebRTC connection-state monitoring, `VOICE_SESSION_LOST` handling)
- Voice mini-bar (persistent, all breakpoints) + full voice panel (occupant list, controls)
- Self mute/deafen status icons on occupants
- Sound cues: joining/leaving channel, mic mute/unmute, sound muted/resumed (deafen), user joined/left channel, connected/disconnected (already stubbed Phase 1)

### Out of scope (later phases)
- Noise gate, per-user volume/local mute, global voice volume slider (Phase 3)
- Kick from voice channel (Phase 6, though the underlying `USER_KICKED` handling for the local user leaving is convenient to stub here — developer's call on exact split)

## Detailed Requirements

**P2.1 — voiceService architecture**
A framework-agnostic TS class/module (not React-coupled — same separation the desktop client uses, so it's independently testable), holding: `Device` instance, send/recv `Transport`s, active `Producer`, map of `Consumer`s by producer/user id, cleanup lifecycle. Exposes an event-emitter-style API (`onConnectionLost`, `onError`, `onActiveSpeakersChanged`) that a thin React hook (`useVoiceService`) bridges into `voiceStore` (Zustand). This mirrors the desktop's callback-based design closely enough that its Phase 11 reconnection logic ports with only browser-API substitutions, not a redesign.

**P2.2 — Handshake**
Implemented 1:1 against the existing protocol (no server changes): request router capabilities on join, create send+recv `WebRtcTransport`s, connect both, produce the local mic track, consume each existing/new remote producer, resume each consumer post-creation. `EXISTING_PRODUCERS` on join and `NEW_PRODUCER`/`PRODUCER_CLOSED` live updates drive the consumer set.

**P2.3 — getUserMedia & permission UX**
Unlike Electron (which auto-grants mic permission via `setPermissionRequestHandler`), the browser always shows its own native permission prompt on first `getUserMedia` call per origin. Design requirement: **never call `getUserMedia` speculatively** — only in direct response to the user tapping "Join Voice" (calling it earlier, e.g. on page load, both fails silently on some browsers and is a dark pattern). If permission is denied, show a clear in-app explanation with a link to the browser's own site-settings mic-permission UI (exact path is browser-specific; ship a short "how to fix this" panel covering Chrome/Safari/Firefox desktop + Android Chrome + iOS Safari, since this is the single most likely first-run failure mode on mobile). Constraints requested: `{ echoCancellation: true, noiseSuppression: true, autoGainControl: true, deviceId: selectedDeviceId ? {exact} : undefined }` — same as desktop.

**P2.4 — Audio playback**
Each remote consumer's track is attached to a `document.createElement("audio")` element appended to the DOM (not a detached `new Audio()`) — same requirement as the desktop client's own documented gotcha, and additionally required by mobile Safari's autoplay/media-element policies. Audio elements are muted-then-unmuted or use `element.play()` inside/immediately after the user's join gesture to satisfy autoplay policy on first join; subsequent consumers joining later reuse the already-unlocked audio context/gesture state.

**P2.5 — Mute / Deafen**
Port the desktop's exact state machine (Phase 10 PRD 10.4): toggling Deafene while unmuted auto-mutes and remembers it did so (`_deafenAutoMuted`); undeafening restores exactly the prior mute state; clicking Mute while deafened auto-undeafens first, then applies a normal toggle; PTT is fully inert while deafened. Every state change reports through `SET_VOICE_STATE` so other occupants' presence icons update. Deafen mutes local playback via `audio.muted = true` on every remote `<audio>` element (not gain-zeroing — gain is reserved for the per-user volume feature in Phase 3, keep the two mechanisms independent exactly as desktop does).

**P2.6 — Push-to-Talk vs Voice Activation**
Two mic input modes, mirroring desktop's Settings → Voice & Shortcuts toggle (this phase adds the toggle to that tab, previously a placeholder from Phase 1).
- **Voice Activation (default)**: mic always live (subject to Phase 3's noise gate once it lands); no key/button gates it.
- **Push-to-Talk**: mic only transmits while held.
  - **Desktop browsers**: a configurable key (reuse the desktop's `keydown`/`keyup` `event.code`-based single-key or chord capture UI in Settings, stored as `reson8-shortcut-ptt` — same key name/shape as desktop for consistency) fires while the tab has focus. **Explicitly documented platform limitation**: there is no browser API for a truly global OS-level hotkey that fires while the tab is unfocused/backgrounded — the desktop client's `globalShortcut` has no web equivalent. State this plainly in the Settings UI copy near the shortcut recorder, not just in this doc.
  - **Mobile/touch (primary interaction)**: a large, thumb-reachable press-and-hold PTT button in the voice mini-bar/panel, using pointer events (`pointerdown`/`pointerup`/`pointercancel` — not just `touchstart`/`touchend`, so it also works correctly with a mouse on a touchscreen laptop) with `touch-action: none` to prevent scroll interference.
  - Consider (implementation detail, not a hard requirement) exposing a PTT action handler via the **Media Session API** (`navigator.mediaSession.setActionHandler`) so a Bluetooth headset/earbud button can trigger it on supporting platforms — evaluate feasibility during implementation; not a launch blocker if browser support proves inconsistent.

**P2.7 — Device selection**
`navigator.mediaDevices.enumerateDevices()` filtered to `audioinput`/`audiooutput`. **Documented constraint**: device *labels* are empty strings until a permission grant has occurred at least once for the origin (browser privacy behavior) — the Settings UI must handle "Microphone 1 / Microphone 2" fallback labels gracefully pre-permission rather than showing blank dropdown entries. Output device selection (`setSinkId`) is **Chromium-only** (no Safari/Firefox support as of this writing) — ship it as a progressively-enhanced control that hides itself on browsers without `HTMLMediaElement.setSinkId`, rather than showing a broken control. Staged "Save" button pattern ported from desktop (device changes apply on explicit save, not live per-selection).

**P2.8 — Active Speaker Indicator**
Subscribe to `ACTIVE_SPEAKERS` (server-computed via mediasoup `AudioLevelObserver` — no client-side audio analysis needed for this feature, unlike the noise gate in Phase 3). Render as a pulsing ring/halo on the occupant's avatar in both the channel tree and the voice panel, matching the desktop's visual treatment in spirit (exact CSS reimplemented as a Tailwind/CSS animation, not copied verbatim from the desktop's plain CSS).

**P2.9 — Session timer**
`sessionStartedAt` arrives via `PRESENCE_UPDATE`. Elapsed time = `(correctedNow() - new Date(sessionStartedAt).getTime())`, where `correctedNow()` = `Date.now() + clockOffsetMs` (from Phase 1's `connectionStore`, ported directly from desktop Phase 11's fix). Render synchronously at mount/update (not waiting for the next tick) to avoid the blank-on-toggle flicker desktop Phase 10 had to fix — apply that lesson from day one instead of re-discovering it. Clamp to minimum 0 as defense-in-depth.

**P2.10 — Reconnection resilience**
Port the desktop Phase 11 PRD 11.1 design faithfully:
- `voiceService` listens for `connectionstatechange` on both send/recv transports; `"failed"` reports loss immediately, `"disconnected"` waits a 4s grace period (mirrors server-side ICE grace period) before reporting, `"connected"/"completed"` clears any pending grace timer.
- On Socket.io `"connect"` after a prior successful voice join (tracked via a `lastVoiceChannelId`-equivalent in `voiceStore`, persisted only in memory/session — no need for localStorage persistence across full page reloads, since a page reload is a legitimate "start fresh" action on the web that Electron's long-lived process didn't have to consider), replay the full join handshake, retrying up to 3 times ~1.5s apart before giving up and clearing the tracked channel.
- Listen for the server's `VOICE_SESSION_LOST` event (mediasoup worker crash recovery case) and trigger the same rejoin path.
- UI states: "reconnecting…" treatment on the voice mini-bar/panel (pulsing amber indicator, matching desktop's visual language in spirit) while any of the above is in flight; falls back to a clean "left voice" state if all rejoin attempts fail, with a toast explaining what happened.
- **Mobile-specific addition beyond desktop's scope** (flagged as a real risk, not a nice-to-have): mobile browsers aggressively suspend background tabs/throttle timers and may tear down `AudioContext`/WebRTC connections when the browser is backgrounded or the OS reclaims memory, more aggressively than a desktop Electron process ever would be. The reconnection logic must also trigger on the Page Visibility API's `visibilitychange` → `visible` transition (in addition to the existing Socket.io/WebRTC-state triggers), attempting the same rejoin sequence, since a backgrounded mobile tab may silently lose its connection without ever firing a clean `disconnect` event first. Document in this PRD (and re-surface in Phase 7's device-testing pass) that voice continuity while backgrounded on mobile is a **best-effort**, not a guarantee — this is a genuine mobile-web platform constraint the desktop app never faced, and should be communicated to users via UI copy ("Voice may disconnect if you leave the app - reopen to reconnect") rather than promised as seamless.

**P2.11 — Voice mini-bar & panel**
Mini-bar (all breakpoints, per Phase 1's reserved shell slot): channel name, session timer, active-speaker glance, Mute/Deafen/Leave buttons, tap-to-expand. Full panel (expanded sheet on mobile, persistent pane on `lg:`): occupant list with presence dots, mute/deafen icons, active-speaker halos; PTT button (mobile) or VAD/PTT mode indicator; device-agnostic — the same component renders in both compositions per master PRD's "one component set" principle.

**P2.12 — Sound cues**
Wire the events already asset-loaded in Phase 1 that are now meaningful: `joining-channel`, `leaving-channel`, `mic_activated`/`mic_muted`, `sound_muted`/`sound_resumed`, `user_joined_channel`/`user_disconnected_from_channel` (one sound per presence-diff event, not per-user, matching desktop's exact behavior — avoids a sound storm when many users are already in a channel on join).

## State/Data Additions

- `voiceStore`: `status: 'idle'|'joining'|'connected'|'reconnecting'|'leaving'`, `currentChannelId`, `sessionStartedAt`, `isMuted`, `isDeafened`, `pttMode: boolean`, `activeSpeakerUserIds: Set<string>`, `lastVoiceChannelId` (in-memory only), `selectedInputDeviceId`, `selectedOutputDeviceId` (staged + applied variants per P2.7's save pattern)

## Acceptance Criteria

- Two browser tabs (or a phone + a desktop browser) can join the same voice channel and hear each other with acceptable latency on a local/LAN test server.
- Mute/Deafen accumulation behaves identically to the documented desktop state machine across all four interaction orderings (mute→deafen→undeafen, deafen→mute-while-deafened, etc.).
- Denying the mic permission prompt produces a clear, non-dead-end UI state (retry path + browser-specific guidance), never a silent failure.
- Killing and restarting the local dev server's mediasoup process (or simulating a worker crash) results in the client showing "reconnecting" and recovering voice without a page reload, on both desktop and mobile viewport builds.
- Backgrounding the mobile browser tab for 30s and returning triggers a visibility-driven reconnection attempt if the connection was in fact lost (verified via real device testing, not just emulation — flagged again in Phase 7).
- PTT works via keyboard on desktop and via press-and-hold on a touch device; VAD mode requires no key/button interaction.
- Session timer never displays a negative value under artificially skewed client clocks.

## Progress Tracking & Versioning

Per master PRD §10: log a `/log-progress` entry for each item in this phase (P2.1–P2.12) as it's completed, not batched at the end. Once every acceptance criterion above is met, run `/bump-version` once for the phase as a whole — this phase ships new capabilities (voice join, PTT, reconnection resilience, etc.), so expect a MAJOR bump under the project's feature/fix/copy policy, absent a reason to classify otherwise.

## Risks / Dependencies

- **Mobile background audio/connection stability** is a platform risk with no full mitigation — scope the UI copy and QA expectations accordingly rather than treating it as a bug to eventually fix to 100%.
- **`setSinkId` browser support gap** (Safari/Firefox) — output device selection is inherently partial; do not block launch on full cross-browser parity for this one sub-feature.
- Requires a reachable `reson8` dev/staging server with mediasoup correctly configured (`MEDIASOUP_ANNOUNCED_IP` etc.) for any real voice testing — coordinate server availability before starting this phase's implementation.
