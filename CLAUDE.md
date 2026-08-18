# CLAUDE.md

Guidance for Claude Code (or any agent) working in this repository. This file is written to make **this repo self-sufficient** — you should not need to open the sibling `../reson8/` repo to understand the wire protocol, data model, or feature scope. `../reson8/` is the existing Electron desktop client + Node server this project builds a second, independent client for; treat it as a read-only reference for historical "why," never a dependency to build against directly.

## Project

Reson8 Web Client is a **mobile-first, fully responsive Progressive Web App** client for Reson8 — a self-hosted voice & text communication server (TeamSpeak-3-style: hierarchical channel tree, SFU voice via mediasoup, persistent text chat, DMs, moderation). Built with React + TypeScript + Vite.

**Current status: Phase 1 in progress.** Read `app-planning/00-master-prd.md` first, then the phase PRD (`app-planning/0N-phase*.md`) relevant to the work at hand, before writing any code. The phase PRDs are sequential and each depends on the ones before it (see the master PRD's Phase Map).

**Current version: 6.1.0** (mid-Phase-7 out-of-band bug-fix batch — MINOR bump per the policy below, fixes only, no new capability; Phase 7 itself is still in progress and will get its own MAJOR bump once P7.7–P7.9 are complete) — see "Versioning" below. Keep this line current as `/bump-version` runs (that's the whole point of it).

This project is **client-only**: it never modifies the `reson8` server, its database schema, or its Socket.io protocol. Confirmed non-goals (see master PRD §7): no server-side changes, no background push notifications, no native app-store wrapper, no offline message queue.

## Commands

Scaffolded in Phase 1 (P1.1): Vite + React + TS strict + ESLint flat config + Prettier + Vitest + Playwright.

- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b` (typecheck) then `vite build`
- `npm run preview` — serve the production build locally (used by Playwright's `webServer`)
- `npm run typecheck` — `tsc -b` only, no emit
- `npm run lint` — ESLint (flat config, `eslint.config.js`)
- `npm run format` — Prettier write
- `npm run test` — Vitest (unit/component, jsdom)
- `npm run test:watch` — Vitest in watch mode
- `npm run test:e2e` — Playwright (multi-browser incl. mobile viewport emulation, config in `playwright.config.ts`)
- `npm run check:bundle-size` — verifies the connect-screen's initial JS payload against the P7.6 performance budget (160KB gzipped); run after `npm run build`

## Architecture (target — see master PRD §4 for the full diagram)

```
reson8-web-client/
├── app-planning/          # PRDs — the authoritative feature/scope spec
├── public/                 # manifest, icons, sound assets
├── src/
│   ├── app/                # routing shell, mobile-first layout composition
│   ├── components/          # shadcn/ui primitives (Radix-based)
│   ├── features/             # connection, channels, voice, chat, emoji, dm, admin, settings
│   ├── stores/                 # Zustand stores
│   ├── services/                 # socket client, voiceService (mediasoup-client), uploadService
│   ├── types/reson8-protocol/      # vendored snapshot of the server's shared-types (see below)
│   ├── hooks/
│   └── lib/                          # sound alerts, formatting, sanitization
├── e2e/                                 # Playwright specs
└── vite.config.ts
```

Tech stack decisions (React, Vite, Zustand, Tailwind + shadcn/ui, socket.io-client, mediasoup-client, vite-plugin-pwa, React Hook Form + Zod, date-fns, Playwright) and the rationale for each are recorded in master PRD §3 — don't re-litigate them without updating that section first.

## The Reson8 Wire Protocol (frozen external contract)

This is the actual, current contract exposed by the `reson8` server as of the audit that informed this project's PRDs. **This section is the canonical reference for this repo until Phase 1 vendors the real type files into `src/types/reson8-protocol/`** (master PRD §3.1) — once that exists, the vendored `.ts` files are the source of truth for exact TypeScript shapes, and this section becomes a human-readable mirror. If the two ever disagree, the vendored files win, and this section should be corrected to match (open a note in this file's own history/PR description when that happens — don't let it silently drift).

Server default port: `9800` (Fastify + Socket.io). Media (mediasoup): UDP/TCP `10000–10100`. All events are Socket.io events (not raw WebSocket messages) — most client→server events are **ack-based** (a callback/Promise resolves with `{success, ...}` or `{success: false, error}`), not fire-and-forget.

### Client → Server events

| Domain | Event | Payload → Ack | Purpose |
|---|---|---|---|
| Connection | `USER_JOIN_SERVER` | `{serverId?, nickname, instanceId, password?}` → `{success, serverId?, error?}` | Join a server instance |
| | `USER_LEAVE_SERVER` | `{serverId}` (no ack) | Leave server |
| | `USER_JOIN_CHANNEL` | `{channelId}` → `{success, error?}` | Enter a channel |
| | `USER_LEAVE_CHANNEL` | `{channelId}` (no ack) | Leave current channel |
| | `PING_LATENCY` | ack `(serverTime: number)` | Latency + clock-offset measurement (server echoes its own timestamp) |
| Channels | `CREATE_CHANNEL` | `{serverId, name, type: TEXT\|VOICE, parentId?, isNsfw?}` → `{success, channelId?, error?}` | Create channel |
| | `DELETE_CHANNEL` | `{channelId}` → `{success, error?}` | Delete channel |
| | `UPDATE_CHANNEL` | `{channelId, name?, position?, isNsfw?}` → `{success, error?}` | Rename/toggle NSFW/reposition |
| | `REORDER_CHANNELS` | `{parentId, orderedChannelIds[]}` → `{success, error?}` | Atomic sibling reorder (`MANAGE_CHANNELS`) |
| | `CHANNEL_MOVED` | `{channelId, newParentId, newPosition}` (no ack) | Legacy/unused — superseded by `REORDER_CHANNELS`, do not build against this |
| Text | `SEND_MESSAGE` | `{channelId, content, attachmentUrl?, attachmentPublicId?}` → `{success, messageId?}` | Send channel message |
| | `FETCH_MESSAGES` | `{channelId, before?, limit?, aroundMessageId?}` → `{success, messages?, pinnedMessage?, error?}` | Paginated history; `aroundMessageId` = window-centered fetch (jump-to-pin); `pinnedMessage` only on initial load |
| | `MARK_CHANNEL_READ` | `{channelId}` → `{success}` | Clear unread cursor |
| | `DELETE_MESSAGE` | `{messageId}` → `{success, error?}` | Hard-delete own message (+ attachment) |
| | `EDIT_MESSAGE` | `{messageId, content}` → `{success, error?}` | Edit own **channel** message, 2-min server-enforced window. **No DM equivalent exists** — DMs are delete-only. |
| DMs | `SEND_DIRECT_MESSAGE` | `{recipientId, content, attachmentUrl?, attachmentPublicId?}` → `{success, messageId?, error?}` | |
| | `FETCH_DIRECT_MESSAGES` | `{partnerId, before?, limit?}` → `{success, messages?, error?}` | |
| | `DELETE_DIRECT_MESSAGE` | `{dmId}` → `{success, error?}` | |
| | `GET_ONLINE_USERS` | ack `{success, users?: IOnlineUser[], error?}` | Includes offline DM partners |
| | `MARK_DMS_READ` | `{partnerId}` → `{success, error?}` | |
| | `GET_UNREAD_DM_PARTNERS` | ack `{success, partners?: {partnerId, partnerNickname, unreadCount}[], error?}` | |
| Admin | `GET_ALL_USERS` | `{serverId}` → `{success, users?: (IUser & {roles})[], error?}` | |
| | `GET_ROLES` | `{serverId}` → `{success, roles?, error?}` | |
| | `ASSIGN_ROLE` | `{userId, roleId, action: add\|remove}` → `{success, error?}` | |
| Moderation | `KICK_USER` | `{userId, channelId}` → `{success, error?}` | Kick from voice channel (rejoinable, not a ban) |
| | `BAN_USER` | `{userId}` → `{success, error?}` | Blacklist by instance ID |
| | `UNBAN_USER` | `{userId}` → `{success, error?}` | |
| | `GET_BANNED_USERS` | ack `{success, users?: IBannedUser[], error?}` | |
| Voice/WebRTC | `GET_ROUTER_CAPABILITIES` | `{channelId}` → `{success, rtpCapabilities?, error?}` | mediasoup handshake step 1 |
| | `CREATE_WEBRTC_TRANSPORT` | `{channelId, direction: send\|recv}` → `{success, transport?: ITransportOptions, iceServers?, error?}` | step 2 |
| | `CONNECT_TRANSPORT` | `{transportId, dtlsParameters}` → `{success, error?}` | step 3 |
| | `PRODUCE` | `{transportId, kind:"audio", rtpParameters}` → `{success, producerId?, error?}` | step 4 |
| | `CONSUME` | `{producerId, rtpCapabilities?}` → `{success, consumer?: IConsumerInfo, error?}` | step 5 |
| | `RESUME_CONSUMER` | `{consumerId}` → `{success, error?}` | step 6 — consumers start paused |
| | `CLOSE_PRODUCER` | `{producerId}` (no ack) | Stop producing |
| | `SET_VOICE_STATE` | `{isMuted, isDeafened}` → `{success}` | Reports own mute/deafen state to other clients |
| Reactions/Emoji | `TOGGLE_REACTION` | `{messageId, emoji, isDm}` → `{success, error?}` | |
| | `CREATE_CUSTOM_EMOJI` | `{name, imageUrl, imagePublicId?}` → `{success, emojiId?, error?}` | Submits a pre-cropped image for review |
| | `GET_APPROVED_EMOJIS` | ack `{success, emojis?: ICustomEmoji[], error?}` | |
| | `GET_PENDING_EMOJIS` | ack `{success, emojis?, error?}` | Requires `MANAGE_EMOJIS` |
| | `REVIEW_CUSTOM_EMOJI` | `{emojiId, decision: APPROVED\|REJECTED}` → `{success, error?}` | Requires `MANAGE_EMOJIS` |
| Pins | `PIN_MESSAGE` | `{channelId, messageId}` → `{success, error?}` | Requires `MANAGE_CHANNELS`; replaces any existing pin |
| | `UNPIN_MESSAGE` | `{channelId}` → `{success, error?}` | Requires `MANAGE_CHANNELS` |
| Nudge | `NUDGE_USER` | `{targetUserId}` → `{success, error?}` | 30s per-(sender,target) server-enforced cooldown |
| | `GET_SERVER_SETTINGS` | ack `{success, nudgeEnabled?, error?}` | |
| | `UPDATE_SERVER_SETTINGS` | `{nudgeEnabled}` → `{success, error?}` | Requires literal `ADMIN` |

### Server → Client events

`USER_JOINED{userId,nickname,serverId}` · `USER_LEFT{userId,serverId}` · `CHANNEL_TREE_UPDATE{serverId,tree:IChannelTreeNode[]}` · `PRESENCE_UPDATE{channelId,occupants:IUserPresence[],sessionStartedAt?}` · `MESSAGE_RECEIVED(IMessage)` · `DIRECT_MESSAGE_RECEIVED(IDirectMessage)` · `MESSAGE_DELETED{channelId,messageId}` · `MESSAGE_EDITED(IMessage)` · `DIRECT_MESSAGE_DELETED{dmId}` · `CHANNEL_CREATED{serverId,channel}` · `CHANNEL_DELETED{serverId,channelId}` · `ERROR{code,message}` · `NEW_PRODUCER{userId,nickname,producerId}` · `PRODUCER_CLOSED{userId,producerId}` · `EXISTING_PRODUCERS{channelId,producers[]}` · `ACTIVE_SPEAKERS{channelId,speakers:string[]}` · `USER_KICKED{channelId}` · `CHANNEL_USER_KICKED{channelId,userId}` · `USER_BANNED{}` · `REACTION_UPDATED{messageId,isDm,reactions[]}` · `CUSTOM_EMOJI_APPROVED{serverId,emoji}` · `NUDGE_RECEIVED{fromUserId,fromNickname}` · `SERVER_SETTINGS_UPDATED{nudgeEnabled}` · `VOICE_SESSION_LOST{channelId,reason}` (mediasoup worker crash recovery — trigger a voice rejoin) · `CHANNEL_PIN_UPDATED{channelId,channelName,pinnedMessage,actedByNickname?}` (no `actedByNickname` = automatic unpin caused by the pinned message being deleted).

### REST endpoints (not Socket.io)

- `POST {serverBaseUrl}/api/upload` — chat attachments. `multipart/form-data`, field `file`. Max **5MB**. MIME allowlist: `image/jpeg, image/png, image/gif, image/webp`. No auth header — relies on the caller already holding a valid session.
- `POST {serverBaseUrl}/api/upload/emoji` — custom emoji images, pre-cropped client-side to 128×128. Max **512KB**.
- Both return `{url: string, publicId?: string}`. `url` may be **relative** (local-disk backend, e.g. `/uploads/...`) or absolute (Cloudinary backend) depending on the server's own configuration — always resolve relative URLs against the connected server's base URL, never assume one or the other.

### Data model (permission flags & DTOs)

`PermissionFlags` (bitwise, `bigint`-backed — aggregate a user's roles via bitwise OR):

```
CONNECT = 1
SPEAK = 2
SEND_MESSAGES = 4
CREATE_CHANNEL = 8
MANAGE_CHANNELS = 16
MANAGE_ROLES = 32
KICK_USER = 64
BAN_USER = 128
ADMIN = 256   // bypasses all other checks
MANAGE_EMOJIS = 512
```

`ChannelType`: `TEXT | VOICE`. `ICustomEmoji.status`: `PENDING | APPROVED`.

Key DTOs (fields as returned over the wire): `IServer{id,name,address,maxClients,nudgeEnabled,createdAt}` · `IChannel{id,serverId,name,type,parentId,position,maxUsers|null,isNsfw,createdAt,pinnedMessage?}` · `IChannelTreeNode extends IChannel{children[],occupants:IUserPresence[],hasUnread?}` (`hasUnread` only reliable on the per-socket join-time tree, not on broadcast-triggered updates — don't cache it as a source of truth, re-derive unread state from `MARK_CHANNEL_READ`/message events per Phase 4) · `IUserPresence{userId,nickname,isMuted,isDeafened,isAway}` · `IRole{id,serverId,name,permissions(string-serialized bigint),powerLevel,color|null,createdAt}` · `IMessage{id,channelId,userId,nickname,content,attachmentUrl?,createdAt,editedAt?,reactions?:{emoji,count,userIds[]}[]}` · `IDirectMessage{id,senderId,senderNickname,receiverId,content,attachmentUrl?,createdAt,readAt?,reactions?}` · `IOnlineUser{userId,nickname,isOnline}` · `IBannedUser{userId,nickname,bannedAt}` · `ICustomEmoji{id,serverId,name,imageUrl,uploadedBy,uploadedByNickname?,status,createdAt}` · `ITransportOptions{id,iceParameters,iceCandidates[],dtlsParameters}` (mediasoup) · `IConsumerInfo{id,producerId,kind:audio|video,rtpParameters}` (mediasoup).

### Identity model (no login — read this before building the connect flow)

Reson8 has no authentication system. A persistent, self-generated instance ID (this project: `crypto.randomUUID()`, stored in `localStorage['reson8-instance-id']`) is sent as `instanceId` on `USER_JOIN_SERVER`; the server upserts a `User` row and assigns the default role from that ID alone. The server's `ADMIN_INSTANCE_ID` env var (server-side, out of this project's control) grants admin to whichever instance ID matches it. Bans are keyed by instance ID too — a user clearing site data gets a new identity, which is a known, accepted circumvention vector inherent to the server's own design (see master PRD §5.3 and the admin phase PRD's P6.5 note), not something fixable from this client.

## Platform limitations (do not silently "fix" these — they're inherent to the web platform, not bugs)

| Desktop capability | Why it has no web equivalent | What this client does instead |
|---|---|---|
| Global OS-level Push-to-Talk (fires while app is unfocused) | Browsers cannot register system-wide hotkeys from a web page | In-tab keydown (focused only) + on-screen press-and-hold PTT button (primary on mobile) |
| System tray / minimize-to-tray | No tray concept on the web | Installed-PWA home-screen/taskbar icon + Badging API for unread counts |
| Taskbar/dock attention flash (Nudge) | No web API for this | Toast + sound + Vibration API + Badging API, foreground/backgrounded-tab only |
| Auto-grant mic permission | Browsers always show a real, per-origin permission prompt | Explicit in-app permission-request UX with a denial-recovery path (Phase 2 P2.3) |
| electron-updater auto-install | No installer concept for a web app | Service worker update-available toast + controlled reload (Phase 7 P7.2) |
| Main-process `fetch()` bypassing CORS (link previews, arbitrary OG scraping) | Browser pages are bound by CORS; there is no "main process" to escape it | Degraded to oEmbed-only previews for a small CORS-open provider allowlist (Phase 4 P4.10) — **this is a real feature gap**, not a nice-to-have; do not attempt a public CORS-proxy workaround, it's a security/reliability anti-pattern excluded by design |
| Background push when the app/browser is fully closed | Requires Web Push + VAPID + server-side subscription storage the `reson8` server doesn't have | Explicitly out of scope (confirmed non-goal) — Nudge/DM alerts only fire while the tab is open (foreground or backgrounded-but-running) |

Full parity ledger (every desktop feature, one row each, disposition + owning phase) lives in master PRD §6 — consult it before assuming any feature is out of scope; only the table above lists *inherent* platform gaps, everything else in the desktop feature list is a planned, in-scope port.

## Conventions worth knowing

- **`localStorage` keys are `reson8-*` prefixed**, and where a direct desktop-client equivalent exists, **the key name is reused verbatim** (e.g. `reson8-remember-me`, `reson8-server-url`, `reson8-nickname`, `reson8-server-password`, `reson8-mute-alerts`, `reson8-nudge-volume`, `reson8-alert-volume`, `reson8-voice-volume`, `reson8-local-volume-{userId}`, `reson8-local-mute-{userId}`, `reson8-last-seen-version`, `reson8-instance-id`) — this is a deliberate consistency choice, not a technical requirement, so grep for `reson8-` before inventing a new key.
- **Touch-first interaction patterns are established once and reused everywhere** (master PRD §5.1): right-click → long-press-opens-a-sheet **plus** an always-visible kebab (⋮) icon (never a hidden-gesture-only affordance); drag-and-drop → an explicit non-drag "Reorder Mode" coexists with drag handles (never drag-only); hover-reveal → always-visible on touch, hover-reveal is a progressive enhancement only. Don't invent a fourth pattern for a new list/action — reuse one of these.
- **Sound alert filenames** (asset key convention, ported from the desktop client's `assets/sound-alerts/`): `channel_created`, `channel_deleted`, `connected`, `disconnected`, `hey_wake_up` (DM notification), `insufficient_perms` (any ack error matching a permission-denied shape), `joining-channel`, `leaving-channel`, `mic_activated`/`mic_muted`, `nudge`, `sound_muted`/`sound_resumed` (deafen toggle), `user_banned_from_server`/`user_unbanned_from_server`, `user_disconnected_from_channel`/`user_joined_channel` (one sound per presence-diff event, never per-user), `user_kicked_from_channel`/`you_were_kicked_from_channel`.
- **Audio autoplay**: browsers block audio until a user gesture occurs on the page. `SoundAlert`'s `AudioContext`/`<audio>` elements must be lazily created/resumed on first user interaction, not at module load — see Phase 1 P1.11.
- **Never `dangerouslySetInnerHTML` on remote/user content** (release notes, message text, link-preview data) — render as text or through a strict allowlist sanitizer. This mirrors a deliberate security choice already validated in the desktop client (its "What's New" modal renders GitHub release notes via `textContent`, never parsed Markdown) — apply the same discipline everywhere in this client, not just that one surface (master PRD §5.6).
- **Remote audio playback**: attach every consumed mediasoup track to a `document.createElement("audio")` element appended to the DOM — a detached `new Audio()` produces no sound (bit the desktop client once) and mobile Safari's autoplay/media-element policies are even stricter, so this matters more here, not less.
- **Vendored protocol types**: once Phase 1 creates `src/types/reson8-protocol/`, each copied file carries a header comment recording its source path and the `reson8` repo's version/commit at copy time. Re-sync manually when the desktop repo's `packages/shared-types` changes in a way that affects the wire contract — there is no build-time coupling between the two repos.

## Project history and required practice

`app-planning/progress.txt` is this repo's build log, in the same entry format `../reson8/app-planning/progress.txt` established (`--- Entry: DD/MM/YYYY ---`, Problem/Solution/Key Files Modified/Verification/Next Step). **This is default behavior for every phase, not an optional nicety**: use `/log-progress` to append an entry for each PRD item as it's completed — task-by-task, as the work happens, not batched at the end of a phase (master PRD §10.1). The file currently just holds the format header; the first real entry should be Phase 1's initial scaffold.

The PRDs under `app-planning/` are the authoritative scope document — if an implementation decision seems to conflict with a PRD, treat that as a signal to update the PRD deliberately (and note why) rather than silently drifting from it.

## Versioning

The web client carries its own `MAJOR.MINOR.PATCH` version, tracked in `package.json` (from Phase 1 onward), mirrored in the README badge and the "Current version" line above, and surfaced in-app on Settings → About (build-time-injected). Use `/bump-version` (`.claude/commands/bump-version.md`) once at the end of every completed phase PRD, once every acceptance criterion for that phase is met — never per-item (that's `/log-progress`'s job).

**This project's bump policy deliberately differs from conventional semver** (MAJOR normally = breaking change to external consumers; this client has none, so the number is repurposed as a build-tracking aid instead): the completed work introduced a new feature/capability → **MAJOR**; fixes only, no new capability → **MINOR**; purely cosmetic (copy/spacing/color, no behavior change) → **PATCH**. Full rationale in master PRD §10.2 — don't "correct" this to standard semver conventions, it's an intentional project decision.
