# Phase 6 PRD — Administration & Moderation

Depends on: Phase 1 (settings shell, permission-flag-gated tab visibility pattern), Phase 3 (channel action-sheet pattern reused for occupant actions), Phase 4 (custom emoji submission flow this phase's approval queue reviews)
Depended on by: none (leaf phase)

## Goal

Give server admins the same control surface the desktop client offers: role management, custom-emoji approval, kick/ban/unban, server-wide settings (Nudge toggle), and server password protection on the connect side — fully touch-adapted, all permission-gated identically to the server's existing bitwise `PermissionFlags` contract with no new server-side logic required.

## Scope

### In scope
- Settings → Roles tab: view users, toggle role assignment
- Settings → Emojis tab: pending custom-emoji review queue (Approve/Reject)
- Settings → Server tab: Nudge enabled/disabled toggle
- Kick from voice channel (fills the action-sheet slot Phase 3 reserved)
- Ban from server / Unban, banned-users list
- Server password protection on the Phase 1 connect flow (this phase verifies/completes the error-messaging UX for it, since the field itself shipped in Phase 1)

### Out of scope
- Any new permission flags or server-side role logic — this project only ever reads/writes the existing `PermissionFlags` bitwise contract via the existing events

## Detailed Requirements

**P6.1 — Roles tab**
`GET_ALL_USERS`/`GET_ROLES` populate a list of server users with their current role badges. Tapping a user (or a kebab menu on their row) opens role-toggle controls; `ASSIGN_ROLE({userId, roleId, action: 'add'|'remove'})` per toggle. **Self-demotion guard**: port the desktop's specific rule — a user cannot remove their own Admin-equivalent role (desktop matches by role name `"Server Admin"`; replicate the same name-match approach unless/until the protocol exposes a more structural "is this the last-resort admin role" signal, since inventing a different mechanism client-side would diverge from the server's actual enforcement and could produce a client UI that allows an action the server then rejects, or vice versa) — disable that specific toggle in the UI, with a tooltip/inline note explaining why, rather than letting the action fail server-side with a generic error.

**P6.2 — Emoji approval queue**
`GET_PENDING_EMOJIS` (requires `MANAGE_EMOJIS`) lists submissions from Phase 4's upload flow with submitter nickname and a preview of the cropped image; Approve/Reject buttons call `REVIEW_CUSTOM_EMOJI({emojiId, decision})`. Approval triggers the existing `CUSTOM_EMOJI_APPROVED` broadcast (already consumed by Phase 4's picker — no new client-side plumbing needed beyond this queue UI itself). Rejection likely triggers the server's existing `deleteAttachment()` cleanup path — purely a server-side concern, nothing for the client to do beyond calling the event and removing the item from the queue view on success.

**P6.3 — Server settings tab**
Single toggle: Nudge enabled/disabled server-wide, `GET_SERVER_SETTINGS`/`UPDATE_SERVER_SETTINGS`, requires literal `ADMIN` (not just `MANAGE_CHANNELS` or other flags — matches desktop's specific gating choice, verify this exact flag requirement against `permissions.middleware.ts`'s actual gate for this event during implementation rather than assuming). Live-broadcasts `SERVER_SETTINGS_UPDATED` to all clients (Phase 5 already consumes this to hide/show the Nudge action).

**P6.4 — Kick from voice channel**
Fills the action slot reserved in Phase 3's per-occupant action sheet (P3.2): an admin-only "Kick from Channel" entry, hidden for the admin's own row, calling `KICK_USER({userId, channelId})`. The kicked user's client handles `USER_KICKED`/`CHANNEL_USER_KICKED` — shows a toast + `you_were_kicked_from_channel`/`user_kicked_from_channel` sound cue (self vs. others, matching desktop's two-sound distinction) and cleanly leaves the voice session via the same teardown path Phase 2's voice service already uses for a normal leave (kick is rejoinable — the user isn't banned, just removed from that channel this instant, matching desktop's documented behavior).

**P6.5 — Ban / Unban**
Reachable from the Online Users sheet (Phase 5) or a dedicated Banned Users list within the admin surface — a "Ban User" action (confirmation dialog, destructive styling) calls `BAN_USER({userId})` (blacklists by instance ID, matching the server's identity model from master PRD §5.3 — note for admins in the UI copy that banning is tied to a browser-persisted instance ID, so a banned user clearing site data and reconnecting is a known circumvention vector inherent to the existing server-side design, not something this client can close). `GET_BANNED_USERS` populates a list view with an Unban action per entry (`UNBAN_USER`). Sound cues: `user_banned_from_server`/`user_unbanned_from_server`.

**P6.6 — Server password protection (connect-flow completion)**
Phase 1 already ships the password field; this phase is responsible for verifying/polishing the specific error path: a join attempt against a password-protected server with a missing/incorrect password must produce a distinguishable, accurate error state ("This server requires a password" vs "Incorrect password") rather than a generic connection-failure message — this was called out as a UX gap worth getting right in Phase 1's spec and is formally verified here once the rest of the permission/error-handling patterns in this phase exist to test it against consistently.

**P6.7 — Touch-adapted admin surfaces, consistently**
Every list in this phase (users, pending emoji, banned users) uses the same kebab-menu/action-sheet pattern established in Phase 3 (channel actions) and Phase 4 (message actions) — no new interaction pattern is introduced in this phase; it is purely an application of the already-established one, which is worth stating explicitly so implementation doesn't invent a fourth UI convention for admin lists specifically.

## State/Data Additions

- `adminStore`: user list + roles (cache from `GET_ALL_USERS`/`GET_ROLES`, refetched on tab open — no need for a persistent live subscription beyond what's already broadcast elsewhere), pending emoji queue, banned users list

## Acceptance Criteria

- A non-admin account never sees the Roles/Emojis/Server settings tabs, kick/ban actions, or the reorder affordance (cross-checked against Phase 1's tab-visibility gating and Phase 3's channel-action gating, not reimplemented separately here).
- An admin cannot remove their own admin-equivalent role via the UI; the toggle is disabled with an explanatory affordance rather than silently failing.
- Approving a pending custom emoji makes it immediately usable in a second connected (non-admin) client's picker with no reload.
- Kicking a user from a voice channel removes them from that channel live on their own client (toast + correct sound) and they can immediately rejoin (not banned).
- Banning a user prevents their next `USER_JOIN_SERVER` attempt (from the same browser/instance ID) and Unban reverses it — verified end to end against a real server.
- Connecting to a password-protected server with the wrong password shows a specific "incorrect password" message, distinguishable from a network-unreachable error.

## Progress Tracking & Versioning

Per master PRD §10: log a `/log-progress` entry for each item in this phase (P6.1–P6.7) as it's completed, not batched at the end. Once every acceptance criterion above is met, run `/bump-version` once for the phase as a whole — this phase ships new capabilities (roles UI, emoji approval, kick/ban), so expect a MAJOR bump under the project's feature/fix/copy policy, absent a reason to classify otherwise.

## Risks / Dependencies

- This phase is entirely additive UI over existing, unmodified server behavior — the main risk is gating precision (matching each action's actual required `PermissionFlags` bit exactly, not approximating "admin-ish"), which should be verified against `apps/server/src/middleware/permissions.middleware.ts`'s real per-event gates during implementation, not assumed from this document's summaries.
