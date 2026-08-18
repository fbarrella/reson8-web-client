# Phase 3 PRD — Advanced Voice Controls & Channel Management

Depends on: Phase 1 (shell, channel tree render), Phase 2 (voice engine, mini-bar/panel)
Depended on by: Phase 6 (permission-gated channel actions reuse this phase's CRUD/reorder UI)

## Goal

Round out voice with the fine-grained controls power users rely on (noise gate, per-user volume/local mute, global voice volume), and give admins full channel lifecycle management (create/rename/delete/NSFW/reorder) — all through touch-first affordances, since these are exactly the interactions the desktop client handles via right-click and mouse-drag, neither of which exists on a phone.

## Scope

### In scope
- Mic Sensitivity / Noise Gate (AnalyserNode-based, with live meter, preview mode)
- Per-user local volume (0–200%) & local mute (client-only, GainNode graph)
- Global Voice Chat Volume slider (master attenuator) — completes the Audio settings tab started conceptually in Phase 1
- Channel CRUD: create, rename, delete
- NSFW text-channel flag + confirmation modal
- Channel reordering (touch-adapted, non-drag-only)
- The touch interaction pattern this phase establishes (long-press sheet + kebab menu) is the template Phase 4 reuses for message actions and Phase 6 reuses for occupant/user admin actions

### Out of scope
- Kick from channel (Phase 6 — this phase's occupant sheet/kebab menu reserves the slot, Phase 6 fills it in)

## Detailed Requirements

**P3.1 — Noise Gate / Mic Sensitivity**
Port the desktop's exact approach: clone the raw mic track into a separate `AnalyserNode` (`fftSize: 2048`) so gate-driven `track.enabled = false` never blinds the analysis; 50ms polling computes RMS→dB; toggles `track.enabled` based on a configurable threshold (-60 to 0 dB slider, matching desktop's range). Never overrides an explicit manual mute (same `_isManuallyMuted`-equivalent guard). Live meter component reused in two contexts: (a) inside an active voice session, (b) a **preview mode** reachable from Settings without being in any voice channel (separate short-lived `getUserMedia` call, torn down on close or on real voice join) — ported directly since this exact preview-outside-a-call requirement was a specific desktop Phase 8 fix, not a nice-to-have. Toggle + threshold + meter live in the Voice & Shortcuts settings tab; hidden entirely when PTT mode is active (matches desktop — the two features are mutually exclusive in the UI since a held PTT key already gates transmission).

**P3.2 — Per-user local volume & local mute**
One shared `AudioContext` (already established by `voiceService` in Phase 2) with a per-consumer `MediaElementAudioSourceNode → GainNode → destination` chain. `gain.value = muted ? 0 : (volumePercent / 100) * globalVoiceVolume`. Overrides are **client-local only, never transmitted to the server** (exactly matching desktop's privacy-preserving design — this is a "just for you" control, not a moderation action) — persisted to `localStorage` keyed by `userId` (`reson8-local-volume-{userId}`, `reson8-local-mute-{userId}`, same key shape as desktop) so overrides survive both a page reload and the other user's own reconnects (since a fresh consumer for the same user re-applies the stored override on creation, exactly as desktop does).

Touch UI (replacing desktop's right-click-on-occupant menu): tapping the kebab icon on an occupant row in the voice panel opens a bottom sheet (mobile) / popover (desktop pointer) containing a volume slider (0–200%, step 5) and a Mute Locally / Unmute Locally toggle. This sheet is the same one Phase 6 later adds a "Kick from Channel" admin action to — build it now with that extension point in mind (a simple conditionally-rendered action list, not a hardcoded two-item layout).

**P3.3 — Global Voice Chat Volume**
0–100% slider (step 5) in the Audio settings tab, multiplying into every per-user gain as a master attenuator — same formula as desktop Phase 10 PRD 10.2. Applies live to all currently-consumed participants on change (no "save" step needed here, unlike device selection — matches desktop's live-apply behavior for this specific slider). Persisted as `reson8-voice-volume`.

**P3.4 — Channel CRUD**
Create Channel: a sheet/dialog (mobile: full-screen sheet; desktop: dialog) with name, type (Text/Voice — Radio group or segmented control), optional parent category, NSFW toggle (text channels only, disabled/hidden for voice). Validated client-side (non-empty name, length bound matching server expectations) before calling `CREATE_CHANNEL`; server-side `MANAGE_CHANNELS`/`CREATE_CHANNEL` permission errors surface as a toast (`insufficient_perms` sound cue, ported from desktop's ack-error pattern — any ack error matching a permission-denied shape triggers this specific sound, matching desktop's regex-based detection).

Rename: reachable via the channel row's kebab menu / long-press sheet → inline rename (a text field replacing the row label, or a small dialog — implementation detail) → `UPDATE_CHANNEL`.

Delete: kebab menu action → confirmation dialog (destructive-styled, matching shadcn's alert-dialog pattern) → `DELETE_CHANNEL`. Never a bare `confirm()` — matches desktop's own custom-modal-only convention, now backed by an accessible Radix alert dialog instead of a hand-rolled div.

**P3.5 — NSFW channels**
Toggle in the channel create/edit sheet (`UPDATE_CHANNEL` with `isNsfw`). On the member side: tapping/clicking into an NSFW text channel for the first time in a session shows a confirmation modal (ported from desktop) before the chat content renders; once confirmed for that channel this session, no repeat prompt (match desktop's per-session, not per-message, confirmation scope).

**P3.6 — Channel reordering**
Two coexisting mechanisms, per master PRD §5.1's "never drag-only" rule:
1. **Explicit Reorder Mode** (primary, universally accessible): a kebab-menu action ("Reorder Channels") on a category enters an edit state showing up/down move buttons on each sibling channel row; changes are staged and committed via a "Done" action, calling `REORDER_CHANNELS` once with the final `orderedChannelIds` array (atomic, matching the server's existing contract — not one call per move).
2. **Drag handles** (progressive enhancement for pointer/mouse users, and touch users who prefer it): implemented with a touch-and-pointer-aware DnD library (e.g. `dnd-kit`, which has first-class touch sensor support unlike native HTML5 DnD) rather than native `draggable` (which has poor/inconsistent mobile browser support) — this is the concrete reason to pick `dnd-kit` specifically over a native-DnD implementation, called out here so the choice isn't re-litigated during implementation.
Both mechanisms are `MANAGE_CHANNELS`-gated at the UI level (hidden entirely for non-admins, matching desktop's admin-only drag affordance) in addition to the server's own permission enforcement.

## State/Data Additions

- `voiceStore` additions: `noiseGateEnabled`, `noiseGateThresholdDb`, `micLevelDb` (live meter value), per-user `{volume, muted}` map (hydrated from localStorage on connect)
- `settingsStore` additions: `globalVoiceVolume`
- `channelTreeStore`: reorder-mode local staging state (not persisted — ephemeral UI state during an edit session)

## Acceptance Criteria

- Setting a noise-gate threshold and speaking below it visibly suppresses transmission (verified via the other test client's received-audio/active-speaker state), without ever silencing a manually-held PTT press or an explicit manual mute.
- Per-user volume/mute overrides persist across a page reload and across the target user leaving/rejoining voice.
- Creating, renaming, deleting, and reordering channels as an admin reflects live on a second connected client within one broadcast round trip.
- A non-admin account never sees create/rename/delete/reorder affordances, and a direct (e.g. dev-tools-forced) attempt is still rejected by the server with the same `insufficient_perms` UX path as any other denied action.
- Reorder Mode's up/down buttons alone (no drag) are sufficient to fully reorder a category's channels — verified by completing the flow with drag interactions disabled/unavailable.
- NSFW confirmation appears once per channel per session, not on every message load.

## Progress Tracking & Versioning

Per master PRD §10: log a `/log-progress` entry for each item in this phase (P3.1–P3.6) as it's completed, not batched at the end. Once every acceptance criterion above is met, run `/bump-version` once for the phase as a whole — this phase ships new capabilities (noise gate, per-user volume, channel CRUD/reorder), so expect a MAJOR bump under the project's feature/fix/copy policy, absent a reason to classify otherwise.

## Risks / Dependencies

- `dnd-kit` (or equivalent) touch-sensor behavior needs real-device verification, not just emulator testing — mobile drag gestures are a common source of "works in Chrome DevTools device mode, breaks on a real phone" bugs.
- Per-user volume's `GainNode` graph depends entirely on Phase 2's `voiceService` audio-element/AudioContext architecture being in place first — do not start this phase before Phase 2 is functionally complete.
