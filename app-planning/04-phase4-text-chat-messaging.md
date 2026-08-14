# Phase 4 PRD — Text Chat & Messaging

Depends on: Phase 1 (shell, channel tree, connection)
Depended on by: Phase 5 (DMs reuse the message/composer/emoji components), Phase 6 (pin/delete permission gating patterns)

## Goal

Full per-channel text chat: send/receive/edit/delete, file attachments with instant feedback, the complete emoji system (curated picker + reactions + custom emoji with an approval queue), pinned messages, and unread indicators — composed mobile-first, with the desktop's literal "tabs" reinterpreted as a navigation-stack on narrow screens and true tabs on wide ones.

## Scope

### In scope
- Per-channel message list (paginated history, `FETCH_MESSAGES`)
- Composer: send, file attachment (upload with instant local preview + progress + retry), emoji insertion
- Edit (2-min window) & delete own messages
- Unread channel indicators (`MARK_CHANNEL_READ`, unread-dot on channel tree rows)
- Emoji picker: 9 built-in categories + search, ~552 curated emoji
- Emoji reactions (persistent, tallied, toggleable)
- Custom emoji: upload + touch-friendly crop tool + admin approval queue (approval UI itself lives in Settings → Emojis tab, gated in Phase 6, but the submission flow and the `:name:` token rendering are this phase's responsibility)
- Link previews: **degraded scope** per master PRD §6 — oEmbed-only for a small allowlisted set of providers, plain clickable hyperlinks otherwise
- Pinned messages (pin/unpin, pinned bar, jump-to-pin with `aroundMessageId` fallback fetch)

### Out of scope
- Direct messages (structurally similar but Phase 5 — this phase's message/composer components are built to be reused there, not duplicated)
- Emoji approval queue UI itself (submission flow only here; review UI is Phase 6, gated by `MANAGE_EMOJIS`)

## Detailed Requirements

**P4.1 — Chat navigation composition**
Mobile (`base`): tapping a text channel in the Channels tab pushes a full-screen chat route (`/app/channels/:id`) onto the nav stack — this *is* "the tab" on mobile, one at a time, back button returns to the channel list. Tablet/desktop (`md:`/`lg:`): a real `<Tabs>` strip (shadcn Tabs) across the top of the content pane lets multiple channels stay open simultaneously, matching the desktop client's literal tabbed-chat model, with each tab showing an unread-dot badge. Both compositions share the same `<ChatPane channelId>` component — per master PRD's "one component set" principle, this is not two implementations.

**P4.2 — Message list & pagination**
`FETCH_MESSAGES({channelId, before?, limit, aroundMessageId?})` on channel open (initial page) and on scroll-to-top (load older, cursor = oldest loaded message's timestamp/id, matching the server's existing cursor contract). Virtualization (e.g. `@tanstack/react-virtual`) is recommended once real-world channel history sizes are known to matter for scroll performance on lower-end mobile devices — not a hard Phase 4 requirement if initial page sizes keep the DOM small enough, but the message-list component should be built assuming virtualization may be inserted later without a full rewrite (i.e., keyed, stable list items).

**P4.3 — Composer**
Text input (auto-growing textarea, `Enter` sends / `Shift+Enter` newlines on hardware-keyboard devices; mobile virtual keyboards get an explicit Send button as the primary action since `Enter` behavior on mobile IMEs is unreliable), attach button (native file picker via `<input type="file" accept="image/*">`; on mobile this natively surfaces the OS's camera/gallery/file chooser via `capture` attribute support — no custom camera UI needed), emoji-picker trigger button.

**P4.4 — Upload feedback**
The moment a file is picked/pasted/dropped, render a local thumbnail (via `URL.createObjectURL`, revoked on cleanup) and a progress indicator in the composer immediately — before the network request resolves — ported directly from desktop's "instant upload feedback" requirement (their exact phrasing: local thumbnail + spinner appear the moment the file is picked). On upload failure, an inline retry action; on success, the message send proceeds with the returned `attachmentUrl`/`attachmentPublicId`. Client-side pre-checks (file size ≤ server's 5MB cap, MIME allowlist matching the server's `image/jpeg|png|gif|webp`) fail fast with a clear message rather than waiting for a server rejection — UX only, the server remains the real enforcement boundary (master PRD §5.6).

**P4.5 — Edit & delete**
Own messages only, edit window = 2 minutes from `createdAt` (server-enforced; client hides/disables the edit action once the window has visibly elapsed, but the source of truth for whether an edit is *accepted* is always the server ack, matching desktop's design). Delete is a hard delete (message + attachment, server-side `deleteAttachment()` cleanup already exists and needs no client involvement beyond calling `DELETE_MESSAGE`) behind a confirmation dialog. **Touch UI**: message actions (edit/delete/react/pin) are never hover-only (no hover state exists on touch) — each message has an always-reachable kebab icon (visible on tap-and-hold or a persistent low-opacity affordance, developer's call on exact visual treatment) opening an action sheet; pointer/mouse users additionally get the desktop-style hover-reveal as a progressive enhancement, per master PRD §5.1.

**P4.6 — Unread indicators**
`MARK_CHANNEL_READ` fires when a channel's chat pane becomes the active view (mobile: nav-stack push; desktop: tab focus) — mirrors the server's `ChannelRead` cursor table usage, no new server behavior needed. Unread-dot on channel tree rows and on desktop chat tabs; cleared live, and correctly excludes the current user's own messages from counting as unread (port the desktop bugfix from Phase 10 PRD 10.5 directly — this was a real bug there, worth avoiding by design here rather than re-discovering).

**P4.7 — Emoji picker**
Reuse the desktop's curated ~552-emoji dataset (categories: Smileys & Emotion, People & Body, Animals & Nature, Food & Drink, Activities, Travel & Places, Objects, Symbols, Flags) as a static data module, ported verbatim (no reason to re-curate). Category tabs + search-by-name/keyword. **Layout note carried forward from a real desktop bug** (Phase 11 PRD 11.3): the custom-emoji tab must live in its own fixed, always-visible slot outside any horizontally-scrolling category row — build it that way from the start rather than porting the original scrollable-row-with-a-hidden-10th-tab layout and re-fixing it later. On mobile, the picker opens as a bottom sheet (full-width grid, large tap targets); on desktop, a popover anchored to the composer's emoji button.

**P4.8 — Reactions**
`TOGGLE_REACTION({messageId, emoji, isDm: false})`; render as tallied pills below a message, live-updated via `REACTION_UPDATED`. Tapping a pill toggles the current user's own reaction; tapping the "add reaction" affordance opens the same emoji picker component from P4.7 in a reaction-targeting mode.

**P4.9 — Custom emoji upload**
Touch-adapted crop tool: file picker (≤500KB pre-crop, matching server pre-crop expectations) → crop step with pan (pointer-drag, also supporting single-finger touch-drag) + pinch-to-zoom (in addition to a zoom slider for pointer users) on a fixed viewport, cover-fit base scale computed the same way as desktop, outputting a 128×128 cropped image → `POST /api/upload/emoji` → `CREATE_CUSTOM_EMOJI` → PENDING status. Submitter sees their pending emoji in a visibly-pending state in their own picker (grayed/labeled "pending approval") — a UX addition beyond desktop's confirmed behavior, worth including since it closes an obvious "did this even work?" gap; not a hard requirement if it complicates the data model unexpectedly, but the default assumption going into implementation. Live `CUSTOM_EMOJI_APPROVED` broadcast updates every connected picker instance app-wide, matching desktop.

`:name:` token rendering: messages/reactions render known-approved custom emoji names as inline images, unknown `:name:` tokens render as literal escaped text (matches desktop's Discord/Slack-convention choice) — implemented via a small parsing pass over message text at render time (React components, not string-concatenated HTML — avoids any injection surface by construction, a stronger guarantee than the desktop's manual escape-or-render branch).

**P4.10 — Link previews (degraded)**
Bare URLs in message text are always auto-linked as plain clickable hyperlinks (`rel="noopener noreferrer"`, opens in a new tab — the direct web equivalent of desktop's `shell.openExternal` interception). For a small allowlist of providers with CORS-open oEmbed endpoints (YouTube's `https://www.youtube.com/oembed` confirmed CORS-open; finalize 2–4 more during implementation, e.g. Vimeo — verify each candidate's CORS headers before committing to it, since oEmbed spec doesn't guarantee CORS support per-provider), fetch and render an inline embed card (thumbnail, title, and for video providers a click-to-expand embed player, mirroring desktop's lightbox pattern for the subset that supports it). All other URLs remain plain links with no preview card — this is the explicitly accepted scope reduction from master PRD §6, not a bug to "eventually fix" within this project's boundaries; revisiting it requires a server-side proxy endpoint, which is out of scope.

**P4.11 — Pinned messages**
Pin/unpin via message action sheet (`MANAGE_CHANNELS`-gated server-side; UI shows the action to everyone and lets the server reject unauthorized attempts, exactly matching desktop's documented convention — not a client-side permission hide for this specific action). Pinning over an existing pin shows a replace-confirmation dialog. A pinned bar sits above the message list per open channel, cropped preview (~100 chars), tap-to-jump: scrolls directly if the message is already loaded, otherwise calls `FETCH_MESSAGES` with `aroundMessageId` to fetch a centered window, replaces the rendered list, scrolls, and applies a brief highlight animation — ported 1:1 from desktop Phase 11 PRD 11.5. `CHANNEL_PIN_UPDATED` (including the no-`actedByNickname` auto-unpin-on-delete case) keeps the bar and per-message pin-button state live.

## State/Data Additions

- `chatStore`: per-channel `{messages[], hasMoreOlder, pinnedMessage, unreadCount}` map, oldest-loaded cursor per channel
- Local component state for composer draft text/attachment-in-progress (not global — no product need to persist an unsent draft across navigation in v1, unlike Phase 1's connection fields which explicitly need persistence)

## Acceptance Criteria

- Sending, receiving, editing, and deleting a message reflects correctly across two connected clients in real time.
- A 5.1MB or wrong-MIME file is rejected client-side with a clear message before any network request fires.
- The custom-emoji tab remains visible regardless of scroll position in the category row, at any viewport width.
- A submitted custom emoji reaches PENDING state, and — once approved via Settings → Emojis (Phase 6) on a second admin client — becomes usable and renders correctly in the original submitter's picker without a page reload.
- Pinning, replacing a pin, unpinning, and auto-unpin-on-delete all update the pinned bar and message button states live on a second connected client.
- Jump-to-pin works both when the target message is already scrolled into the loaded DOM and when it requires the `aroundMessageId` fallback fetch.
- A YouTube link renders an inline oEmbed card; an arbitrary non-allowlisted URL renders as a plain link with no broken/error preview card.
- Unread dots clear correctly on channel open and never reappear from the sender's own messages.

## Progress Tracking & Versioning

Per master PRD §10: log a `/log-progress` entry for each item in this phase (P4.1–P4.11) as it's completed, not batched at the end. Once every acceptance criterion above is met, run `/bump-version` once for the phase as a whole — this phase ships new capabilities (chat, uploads, emoji, pins), so expect a MAJOR bump under the project's feature/fix/copy policy, absent a reason to classify otherwise.

## Risks / Dependencies

- The oEmbed provider allowlist must be verified for actual CORS support (not assumed from spec) before implementation — treat as a short research spike at the start of P4.10, not a given.
- Message-list virtualization is a "watch this" item, not a committed requirement — flag for a decision once real channel history volumes are observable against a staging server.
