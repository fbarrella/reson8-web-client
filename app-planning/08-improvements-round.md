# Reson8 Web Client — Improvements Round PRD

Status: Active
Supersedes: the archived Phase 1–7 PRD set (`app-planning/archive/v7.0.0-phase-prds/`), which remains the historical record of how v7.0.0 was built and stays authoritative for *that* work's rationale — it is not being revised, just superseded as the *current* scope document.
Scope of this document: a focused round of post-launch fixes and small UX improvements identified from real usage of the v7.0.0 client against a live `reson8` server. This is not a new "phase" in the master-PRD sense (no new feature surface, no new architecture) — it's maintenance-and-polish work, tracked the same way every phase was (`/log-progress` per item, `/bump-version` once the round is done).

---

## 1. Why this document exists

Phase 7 shipped a launch-ready client (`v7.0.0`). After using it against a real server, a set of concrete defects and rough edges surfaced — some are outright bugs (sounds playing wrong/never, a confirmation dialog that only fires once), some are missing polish (no logo in the UI, wrong icon affordance), one is a platform-behavior bug (mobile file input forces the camera). None of these require new architecture or new wire-protocol surface; all are fixable within the existing component/service structure documented in `CLAUDE.md`.

Each item below was verified against the actual current source (file/line references included) before being written up — this is not a guess-and-fix list, the root cause is already identified for every item except where explicitly flagged as "needs investigation during implementation."

**One item from the original request was dropped after investigation**: displaying the connected server's registered name in the top bar. The `reson8` server does store a `name` (via the `SERVER_NAME` env var, in the `Server` table, in the `IServer` DTO), but no Socket.io event or ack currently sends it to a connected client (`USER_JOIN_SERVER`'s ack is `{success, serverId?, error?}` only — confirmed against `../reson8/apps/server/src/handlers/connection.handler.ts`). Shipping this would require a server-side protocol change, which conflicts with this repo's non-goal #1 ("no server-side changes" — see the archived master PRD §7 and `CLAUDE.md`). Decision (confirmed with the product owner): dropped for this round, not deferred with a stub — revisit only if a matching server-side change ships independently in `../reson8`.

---

## 2. Working process for this round (binding, same as every prior phase)

- One item = one task. Work items in the order listed below unless told otherwise.
- On completing each item: run `/log-progress` (entry format unchanged — Problem/Solution/Key Files Modified/Verification/Next Step), then `/bump-version` (classify per the existing MAJOR=new capability / MINOR=fix-only / PATCH=cosmetic-only policy — most items here are MINOR, a couple are arguably PATCH; classify each on its own merits at bump time, don't batch), then stage/commit/push the change to the current branch (`improvements-round`).
- **Stop after each item and wait for explicit go-ahead before starting the next one.** Do not chain items in one turn.
- Do not open a PR — that's done manually.
- Final item (after all fixes below are done and confirmed): rework `README.md` for new users/contributors, with stack/status shields and the app logo in the title. This is item **IR10**, listed last.

---

## 3. Improvement items

### IR1 — NSFW confirmation must always prompt, from every entry path

**Problem:** The "this channel is NSFW, continue?" dialog only ever fires once per channel per session, and only when entering via the channel tree. Both are bugs relative to intended behavior: it should fire on *every* entry, from *every* path (channel tree, the Chats tab, and — for completeness, since it's the same underlying route — direct navigation/back-forward to a channel URL).

**Root cause (confirmed):**
- `src/features/channels/ChannelTreePanel.tsx` gates entry on `useChannelTreeStore((s) => s.confirmedNsfwChannelIds.has(node.id))` (line ~40) — once `confirmNsfw(node.id)` runs, that channel is permanently exempted from the prompt for the rest of the session (`handleClick`, lines ~85–92).
- `src/features/chat/ChatRoute.tsx` — the actual destination both the channel tree *and* the Chats tab (`ChatTabPage.tsx`) navigate to (`/app/channels/:channelId`) — has no NSFW gate at all. Its `useEffect` (lines ~30–33) calls `openChannel(channelId)` unconditionally. This is why the Chats tab never prompts: it bypasses the tree panel's gate entirely, and the tree panel's gate isn't reusable from here anyway.

**Fix:**
- Move the gate to `ChatRoute.tsx` — the single point both entry paths converge on — instead of duplicating it in `ChannelTreePanel.tsx`. Render `NsfwConfirmDialog` there; on cancel, navigate back (`/app` or wherever the user came from) rather than rendering the chat; on confirm, render `ChatPane` as normal.
- Remove the "confirmed once" persistence model. `confirmedNsfwChannelIds` (and `confirmNsfw`) in `channelTreeStore.ts` should either be deleted outright or repurposed as a per-mount (not per-session) gate — since the check now happens once, at the single route entry point, on every mount of that route for that channel, "confirmed" no longer needs to survive between visits at all. Prefer deleting the store field over keeping dead state around.
- Remove the now-redundant gate in `ChannelTreePanel.tsx`'s `handleClick` (lines ~85–92) — clicking a text channel there should just navigate; `ChatRoute` handles the prompt.
- Voice channels are unaffected (the existing gate already only applies to `!isVoice` channels; keep it that way — voice-channel NSFW gating, if it exists at all, is out of scope for this item).

**Acceptance:**
- Opening the same NSFW text channel twice in a row (tree → back → tree again) prompts both times.
- Opening an NSFW text channel from the Chats tab prompts, identically to the tree.
- Canceling the dialog does not open the channel (returns to the previous view).
- Non-NSFW channels are never prompted, from either path.

---

### IR2 — NSFW badge must be visible everywhere a channel name is shown in the Chats tab

**Problem:** The "18+" badge (`<Badge variant="destructive">18+</Badge>`, `ChannelTreePanel.tsx` line ~191) only renders in the channel tree. Nowhere a channel's name appears in the Chats tab shows it.

**Root cause (confirmed) — three separate render sites, none of which check `node.isNsfw`:**
- `src/features/chat/ChatTabPage.tsx` (the flat list of open/unread channels) — row markup at lines ~38–52 has no badge.
- `src/features/chat/ChatRoute.tsx` — the mobile full-screen header (lines ~49–60, channel name at line 59) has no badge; the `lg:` tabs strip (lines ~63–98, channel name at line 71) has no badge either.

**Fix:** Add the same `18+` destructive badge (reuse `components/ui/badge`, same variant, for visual consistency with the tree) next to the channel name in all three spots, conditioned on `node.isNsfw`. Keep it small enough not to break the tab strip's `max-w-32 truncate` layout — a compact badge, not full-size, in the tabs-strip case specifically.

**Acceptance:**
- An NSFW channel shows the badge in the Chats-tab list, in the mobile chat header, and in the desktop tabs strip.
- Non-NSFW channels show no badge in any of the three.

---

### IR3 — Custom emoji reactions must render as images, not `:name:` text

**Problem:** A reaction using a standard unicode emoji shows the emoji glyph. A reaction using a custom emoji shows the literal token text (e.g. `:emoji-custom1:`) instead of the approved image.

**Root cause (confirmed):** `src/features/chat/ReactionsRow.tsx` (line 32) renders `<span>{r.emoji}</span>` unconditionally — it never checks whether `r.emoji` is a `:name:`-shaped token referring to a known custom emoji. Compare `src/features/chat/MessageContent.tsx` (lines 45–60), which already does this correctly for emoji tokens in message *body* text: it looks up `useCustomEmojiStore((s) => s.byName)`, and if the token matches an `APPROVED` custom emoji, renders `<img src={resolveMediaUrl(emoji.imageUrl, serverUrl)} .../>`; otherwise falls back to literal text.

**Fix:** Port the same lookup into `ReactionsRow.tsx`: for each reaction, check if `r.emoji` matches the `:name:` token shape and resolves to an `APPROVED` entry in `useCustomEmojiStore`'s `byName` map; if so render a small `<img>` (sized to fit the existing pill, e.g. `size-3.5`, consistent with the row's compact chip style) instead of the raw text. Unicode emoji reactions keep rendering as today (plain glyph text — no lookup needed, they're not tokens).

**Acceptance:**
- A reaction added via a custom emoji shows its approved image in the message's reaction row, not `:name:` text.
- A reaction added via a standard emoji is unaffected (still shows the glyph).
- A reaction referencing a custom emoji that is no longer approved/known falls back to the literal token text (matches `MessageContent.tsx`'s existing degrade behavior — don't invent different fallback behavior here).

---

### IR4 — Replace the reaction/emoji-picker icons with the desktop client's smiley-face icon

**Problem:** Two different, both-wrong icons are used for "open the emoji picker":
1. The "add a reaction to this message" affordance uses a `+` icon (`Plus` from lucide-react) — an odd, non-obvious symbol for "react with an emoji."
2. The composer's "insert emoji" button next to the text input uses a literal `🙂` unicode character rendered as button content — which risks reading as "click to send this exact emoji," not "open a picker."

**Root cause (confirmed) + fix source:** The desktop client's equivalent button (`../reson8/apps/client/src/renderer/index.html`, `#btn-emoji`, line ~2535) uses this inline SVG: a circle + curved smile-mouth path + two eye dots (`viewBox="0 0 24 24" stroke-width="2"`, paths `circle cx=12 cy=12 r=10`, `M8 14s1.5 2 4 2 4-2 4-2`, two `<line>` eyes at x=9/x=15, y=9). This is, stroke-for-stroke, lucide's built-in **`Smile`** icon — already available from `lucide-react`, the icon package this project already depends on (master PRD §3). No new SVG asset needs to be added; import and use `Smile` in place of the two current icons.

**Fix:**
- `src/features/chat/ReactionsRow.tsx` — replace `import { Plus } from "lucide-react"` / `<Plus className="size-3.5" />` (lines 1, 46) with `Smile` from `lucide-react`, same sizing.
- `src/features/chat/Composer.tsx` — replace the `🙂` literal button content (line ~166) with `<Smile className="size-5" />` (matching the sizing convention of the composer's other icon buttons — `Paperclip`, `Send` are `size-5`), and add `Smile` to the existing `lucide-react` import at the top of the file.

**Acceptance:**
- Both the message-reaction "add reaction" button and the composer's "insert emoji" button render the same `Smile` icon.
- No visual regression to button sizing/hit-target (both buttons already meet the 44×44px touch-target minimum via their existing wrapper; only the glyph inside changes).

---

### IR5 — Entering a voice channel must only play "joining channel," not also "user joined your channel"

**Problem:** When you join a voice channel yourself, two sounds fire simultaneously: `joining-channel` (correct — that's you) and `user_joined_channel` (wrong — that sound is meant for *other* users joining a channel you're already in, not for your own join).

**Root cause (confirmed):** `src/services/voiceConnectionService.ts`. `joinVoiceChannel()` resets `previousOccupantIds = new Set()` (line 119) *before* the join completes, then plays `"joining-channel"` (line 134) once the join succeeds. The next `PRESENCE_UPDATE` for that channel — which includes yourself, since you just joined — is handled by `handlePresenceUpdateForVoice()` (lines 355–374). Because `previousOccupantIds` was just reset to empty, your own `userId` reads as a "new" occupant relative to that empty baseline, so `hadJoins` is `true` and `soundAlert.play("user_joined_channel")` fires (line 369) — for yourself, alongside the alert that already correctly announced your own join.

**Fix:** In `handlePresenceUpdateForVoice()`, exclude the local user's own `userId` (`useConnectionStore.getState().selfUserId`) from the join/leave diffing used to decide whether to play `user_joined_channel` / `user_disconnected_from_channel` — those sounds should only reflect *other* occupants changing, never the local user's own presence transitions (which already have their own dedicated sounds via `joining-channel` / `leaving-channel` at the call sites that trigger them directly).

**Acceptance:**
- Joining a voice channel (that has no other occupants) plays `joining-channel` only.
- Joining a voice channel that already has other occupants still plays `joining-channel` only for you — it must **not** additionally fire `user_joined_channel` for yourself, but should still correctly not suppress `user_joined_channel` if someone *else* joins moments later while you're already in the channel.
- A second user joining a channel you're already in still correctly plays `user_joined_channel` (verify this doesn't regress — the self-exclusion must not accidentally suppress real other-user join sounds).

---

### IR6 — Settings → Application → "Disconnect" must play the disconnect sound, not "leaving channel"

**Problem:** Disconnecting from the server via Settings plays `leaving-channel` (the voice-channel-leave sound) instead of a sound that actually communicates "you disconnected from the server."

**Root cause (confirmed):** `src/services/connectionService.ts`, `leaveServer()` (lines 473–489), called by `ApplicationTab.tsx`'s `handleDisconnect()` (line 14). `leaveServer()` unconditionally calls `voiceConnectionService.leaveVoiceChannel()` as its first cleanup step (line 475) — and `leaveVoiceChannel()` (`voiceConnectionService.ts`, lines 150–162) unconditionally plays `soundAlert.play("leaving-channel")` at its end (line 161), **even when the user was never in a voice channel to begin with** (there's no guard on `currentChannelId` around that `play()` call, unlike the `socketService.leaveChannel()` call three lines above it, which *is* correctly guarded). `leaveServer()` itself never plays anything to signal the actual disconnect — the existing `"disconnected"` sound (already a real asset, `public/sounds/disconnected.mp3`) is currently only wired to the *unexpected*-disconnect path (`handleDisconnect` inside `joinServer()`'s socket-lifecycle setup, line 279 — a different function, confusingly similarly named to `ApplicationTab`'s handler; that one fires on unplanned transport loss, not on this intentional user-initiated flow).

**Fix:**
- Give `leaveVoiceChannel()` a `silent` parameter (default `false`): `export function leaveVoiceChannel(silent = false): void`. Guard the existing `soundAlert.play("leaving-channel")` call behind both `!silent` **and** the same `currentChannelId` truthiness already used to guard the `socketService.leaveChannel()` call just above it (fixes the unconditional-even-when-not-in-voice bug in the same pass — see IR7 below, same root fix covers both).
- In `leaveServer()` (`connectionService.ts` line 475), call `voiceConnectionService.leaveVoiceChannel(true)` — silent, since this is cleanup-as-a-side-effect of disconnecting, not the user explicitly leaving a voice channel.
- Add an explicit `soundAlert.play("disconnected")` call in `leaveServer()` itself, so the intentional Settings-initiated disconnect gets the correct, already-existing sound.

**Acceptance:**
- Settings → Disconnect while in a voice channel: plays `disconnected` once; does not play `leaving-channel`.
- Settings → Disconnect while *not* in a voice channel: plays `disconnected` once; still no `leaving-channel` (was already silently over-firing before this fix — see IR7).
- Unplanned/unexpected disconnects (network loss) are unaffected — that path's own existing `disconnected` sound call is untouched.

---

### IR7 — Leaving a voice channel must reliably play "leaving channel"

**Problem:** Explicitly leaving a voice channel (via the voice panel's leave button, the mini-bar's leave button, or the disconnect-voice keyboard shortcut) should play `leaving-channel`, but currently either plays nothing or is unreliable.

**Root cause (confirmed, shared with IR6):** `leaveVoiceChannel()` (`voiceConnectionService.ts`, lines 150–162) calls `soundAlert.play("leaving-channel")` **unconditionally** — with no check on whether `currentChannelId` was actually set — unlike the `socketService.leaveChannel(currentChannelId)` call three lines earlier, which correctly only fires `if (socketService.isConnected() && currentChannelId)`. Any call path that invokes `leaveVoiceChannel()` when the voice store's `currentChannelId` is already `null`/stale (e.g. a redundant double-invocation from rapid button taps, or the function being called from a cleanup path where the store was already reset by something else) still attempts to play the sound, and the intended real leave can end up racing with or being masked by that. This same function is also reused internally as a generic cleanup step by `leaveServer()` (IR6), which further muddies when the sound *should* vs. *does* fire.

**Fix:** Same code change as IR6's fix — introduce the `silent` parameter and gate the `"leaving-channel"` play behind the same `currentChannelId` truthiness check already guarding the socket `leaveChannel` emit, so the sound only ever fires when there was a real voice channel to leave, from the real explicit-leave call sites (`VoicePanel.tsx` line 149, `VoiceMiniBar.tsx` line 78, `voiceShortcutService.ts` line 30), all of which call `leaveVoiceChannel()` with no arguments (i.e. `silent` stays `false` for these, per the default) and should reliably hear the sound now that it's not competing with — or being unconditionally fired during — unrelated cleanup paths.

**Note for implementation:** if the sound still doesn't play reliably after this guard fix, treat it as a second, distinct bug and investigate further (e.g. check the `SoundAlertService`'s gesture-unlock state at the moment the leave button is pressed, and whether the cached `<audio>` element for `leaving-channel` is being interrupted by a near-simultaneous `currentTime = 0` reset from an overlapping call) — don't assume the guard alone is a confirmed complete fix until manually verified against a real voice channel.

**Acceptance:**
- Clicking "leave voice" from the voice panel, the mini-bar, or the disconnect shortcut reliably plays `leaving-channel` exactly once per leave.
- No `leaving-channel` sound plays as a side effect of a full server disconnect (covered by IR6's `silent` call) or of being kicked (already correctly excluded — see `handleUserKicked`'s doc comment, `voiceConnectionService.ts` lines 323–331 — no change needed there).

---

### IR8 — Add the Reson8 logo to the app UI (top bar)

**Problem:** The app has no visible branding/logo anywhere in the UI itself, only in the browser tab (favicon) and installed-PWA icon.

**Root cause / available asset (confirmed):** `public/favicon.svg` already *is* the Reson8 logo (a purple abstract wordmark) — the same art `../reson8/logo_512x512.png` and the desktop client's `logo.png` use, already vendored into this repo's `public/` (also present as `public/icons/icon-192.png` / `icon-512.png` / `apple-touch-icon.png` / `icon-maskable-512.png`). No new asset needs to be sourced — this is a rendering gap, not an asset gap.

**Fix:** In `src/app/AppHeader.tsx`, render the logo (`<img src="/favicon.svg" alt="" className="size-6" aria-hidden="true" />`, or import it as a module asset per whatever convention Vite's asset handling already uses elsewhere in this repo — check for precedent before deciding raw-`public/`-path vs. imported-asset) immediately to the left of the existing `<h1>Reson8</h1>` (line 34), inside a flex wrapper so the two sit inline. Keep the `<h1>` text — this is additive, not a replacement.

**Acceptance:**
- The logo renders next to "Reson8" in the top bar at every breakpoint the header is visible at (`AppHeader.tsx` renders unconditionally regardless of breakpoint, per its own doc comment).
- No layout regression to the header's existing flex spacing (back-button, latency indicator, DM icon, settings icon all keep their current positions/sizing).
- Logo has `alt=""`/`aria-hidden` (decorative, since the adjacent text already conveys the app name to assistive tech) — don't introduce a redundant announced label.

---

### IR9 — Mobile attachment picker must allow browsing existing files, not force-open the camera

**Problem:** On phone/tablet, tapping the attach-file button in chat opens the camera directly, with no way to pick an existing photo/file from the device.

**Root cause (confirmed):** `src/features/chat/Composer.tsx`, line 150:
```
<input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" capture="environment" hidden onChange={handleFileChange} />
```
The `capture="environment"` attribute is what forces mobile browsers to launch the camera directly instead of presenting the native "Camera / Photo Library / Files" chooser.

**Fix:** Remove the `capture="environment"` attribute entirely. `accept="image/jpeg,image/png,image/gif,image/webp"` alone is sufficient — mobile browsers present their native picker (which still offers "take photo" as one option, alongside browsing the gallery/files) when `capture` is absent. This is a one-attribute removal; no new UI/second button is needed — the existing single attach button already covers both use cases once `capture` is gone.

**Acceptance:**
- On a mobile device (phone or tablet), tapping "attach file" in chat presents the OS's native file/photo chooser, with the option to browse existing photos/files, not just the live camera.
- Desktop behavior is unaffected (desktop browsers already ignore `capture`; the `accept` MIME filter still applies).
- Upload validation (`validateAttachmentFile`, size/MIME checks) and instant-thumbnail feedback are unaffected — this change only touches which native picker UI opens, not the upload/validation pipeline.

---

### IR10 — README rewrite (final item, after IR1–IR9 are all done)

**Problem:** The current `README.md` is written for a project mid-Phase-7, phase-map-oriented, and doesn't serve either of its two real audiences well: a new user who just wants to know what this is and how to run it, and an aspiring contributor who needs the stack/architecture picture before diving into `CLAUDE.md`.

**Scope:**
- Rewrite `README.md` to properly introduce the project to both audiences — what Reson8 is, what this client is, quick start, how to contribute, where the deeper docs live (`CLAUDE.md`, this PRD, `DEPLOYMENT.md`).
- Add badges (shields.io) summarizing the tech stack and relevant project info — version, license (if one exists; check before asserting one — the archived master PRD explicitly notes no LICENSE was ever established, don't silently invent one now), React/TypeScript/Vite versions, build status if there's a CI workflow to point at (check `.github/workflows` before claiming one), PWA-ness. Don't fabricate a badge for something not actually true of the repo (e.g. no fake "build passing" badge without a real CI check backing it).
- Add the app logo (`public/favicon.svg` — same asset as IR8) to the README title, e.g. as an inline `<img>` alongside the `# Reson8 Web Client` heading (standard GitHub-README pattern: `<img src="..." width="..." align="left"> # Title` or an `<h1>` with an inline `<img>`, whichever renders cleanest on GitHub's Markdown).
- Update the phase-map/planning-docs section to reflect the archive: point to `app-planning/08-improvements-round.md` (this document) as the current scope doc, and `app-planning/archive/v7.0.0-phase-prds/` for the historical Phase 1–7 set, instead of the now-stale direct links to `00-master-prd.md` etc. at the old top-level paths.
- This item runs *after* every other fix in this document is done, so the README can truthfully describe the post-improvements-round state (correct version number, no "known issues" that were just fixed).

**Acceptance:**
- A new user reading the README start-to-finish can get the app running against a `reson8` server without opening any other doc.
- A new contributor reading it understands the stack, where planning docs live now (including the archive), and where to go deeper (`CLAUDE.md`).
- Every badge in it is factually true of the repo at rewrite time.
- Logo renders correctly in GitHub's Markdown preview (verify visually, not just by writing plausible-looking markup).
