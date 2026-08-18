# Phase 5 PRD — Direct Messages & Social Features

Depends on: Phase 1 (shell, connection), Phase 4 (message list/composer/emoji components, reused not rebuilt)
Depended on by: none (leaf phase)

## Goal

1-on-1 direct messaging with persistent history, an online-users directory, read receipts, and the Nudge attention-getting feature — scoped to foreground/backgrounded-but-open use per the confirmed no-background-push decision.

## Scope

### In scope
- DM conversation list + individual conversation view (reusing Phase 4's message/composer/emoji components)
- Persistent DM history (accessible with an offline partner; first contact still requires both online, matching desktop)
- Online Users modal/sheet
- Unread DM indicators, auto-opening unread conversations on connect
- Read receipts
- Nudge (foreground/open-tab scope): sound + toast + Vibration API + Badging API

### Out of scope
- Background/closed-app push notifications (confirmed non-goal, master PRD §7)
- Group DMs / multi-party messaging (not a desktop feature either — no parity gap)

## Detailed Requirements

**P5.1 — DM navigation composition**
Mirrors Phase 4's chat composition exactly: mobile nav-stack (`DMs` tab → conversation list → individual conversation, `/app/dms/:partnerId`), desktop tabs alongside channel tabs or a separate DM tab strip (implementation detail — evaluate during build whether mixing channel and DM tabs in one strip or keeping them visually separate reads better; either satisfies parity, no desktop precedent constrains this since the desktop's DM tabs already coexist with channel tabs in one tab bar — default to matching that unless it tests poorly).

**P5.2 — Conversation list & online users**
`GET_ONLINE_USERS` populates an Online Users sheet/modal (includes offline DM partners per the existing `IOnlineUser` contract, matching desktop's "shows offline DM partners too" behavior) — tapping a user opens/creates a DM conversation. `GET_UNREAD_DM_PARTNERS` on connect auto-opens (desktop: auto-opens the tab; mobile equivalent: surfaces a badge on the DMs tab bar icon with the count, and/or auto-navigates to the conversation only if there's exactly one unread partner — avoid auto-pushing multiple nav-stack entries on mobile connect, which would be a confusing UX the desktop's multi-tab model doesn't have to worry about; default to badge-only on mobile, auto-open-tab on desktop, matching each platform's own navigation idiom rather than forcing one behavior everywhere).

**P5.3 — Messaging**
`SEND_DIRECT_MESSAGE`/`FETCH_DIRECT_MESSAGES`/`DELETE_DIRECT_MESSAGE`, reusing Phase 4's `<ChatPane>`-family components in a DM mode (same attachment upload, same emoji picker/reactions via `TOGGLE_REACTION({..., isDm: true})`, same edit-window logic if the server supports DM edits — confirm against the protocol; the audit found `DELETE_DIRECT_MESSAGE` but no `EDIT` DM event, so **DM messages are delete-only, no edit**, matching the actual protocol contract rather than assuming parity with channel messages).

**P5.4 — Persistent DM access**
Conversation history remains browsable via `FETCH_DIRECT_MESSAGES` even when the partner is offline (their nickname/avatar rendered from last-known data) — first-ever contact with a user who has never been online in this session still requires both parties online at least once, matching desktop's documented constraint (this is a server/data-model property, not something the client can change).

**P5.5 — Read receipts & unread**
`MARK_DMS_READ` fires on conversation-view mount (mobile nav-stack push / desktop tab focus), matching Phase 4's channel pattern. Read receipt indicator (checkmark or "Read" label under the last sent message once the recipient's read cursor has passed it) — exact visual treatment is an implementation detail; the requirement is that sent-but-unread and sent-and-read are visibly distinguishable, matching the desktop's read-receipt feature claim.

**P5.6 — Nudge**
`NUDGE_USER({targetUserId})`, server-enforced 30s per-(sender,target) cooldown (client should also disable the nudge action locally for that window as a UX nicety, not as the actual enforcement — server ack failure on cooldown is the real guard). On `NUDGE_RECEIVED`:
- Toast (per master PRD's toast system) + `nudge.mp3` sound cue (respecting mute/volume settings from Phase 1/3).
- **Vibration API** (`navigator.vibrate(...)`, feature-detected — iOS Safari does not support it, degrade silently) as the mobile equivalent of a physical attention cue.
- **Badging API** (`navigator.setAppBadge`/`clearAppBadge`, feature-detected) increments the installed PWA's home-screen/taskbar icon badge count when the nudge (or any unread DM) arrives while the tab is backgrounded-but-open — cleared when the relevant content is viewed. This is the closest available analog to desktop's taskbar/dock flash, explicitly scoped to "tab still running in the background," not "app fully closed" (that would require push, out of scope).
- Server's `nudgeEnabled` setting (server-wide admin toggle) is read via `GET_SERVER_SETTINGS`/`SERVER_SETTINGS_UPDATED` and hides the Nudge action entirely when disabled, matching desktop.

## State/Data Additions

- `dmStore`: conversation list (partner id/nickname/online status/unread count), per-conversation message cache (same shape as `chatStore`'s per-channel cache from Phase 4 — consider a shared underlying message-cache module between the two stores rather than duplicating pagination/cursor logic)
- `settingsStore`: `nudgeEnabled` (server-scoped, not user-scoped — read-only for non-admins, writable in Phase 6's admin surface)

## Acceptance Criteria

- Sending a DM to an online user delivers in real time to a second connected client; sending to an offline (but previously-contacted) user succeeds and is visible to them on next connect.
- DM history remains fully readable while a partner is offline.
- Read receipts update live when the recipient views the conversation.
- A Nudge sent while the recipient's tab is open-but-backgrounded produces a toast, sound, and (where supported) a vibration and an app-icon badge — all three degrade gracefully (no error, just silently skipped) on platforms lacking the relevant API.
- The 30-second cooldown is enforced (verified via the server ack rejection, not just the client-side disabled state).
- Disabling Nudge server-wide (Settings → Server, Phase 6) hides the nudge action for all connected clients live.

## Progress Tracking & Versioning

Per master PRD §10: log a `/log-progress` entry for each item in this phase (P5.1–P5.6) as it's completed, not batched at the end. Once every acceptance criterion above is met, run `/bump-version` once for the phase as a whole — this phase ships new capabilities (DMs, online users, Nudge), so expect a MAJOR bump under the project's feature/fix/copy policy, absent a reason to classify otherwise.

## Risks / Dependencies

- Badging API and Vibration API support are inconsistent across browsers (notably iOS Safari lacks both as of this writing) — every call site must feature-detect and degrade silently, never surface a "not supported" error to the user for what is explicitly a best-effort enhancement.
- Depends on Phase 4's message/composer/emoji components being built in a reusable (not channel-hardcoded) shape — if Phase 4 hardcodes channel-specific assumptions, this phase's estimate should be revisited rather than duplicating those components wholesale.
