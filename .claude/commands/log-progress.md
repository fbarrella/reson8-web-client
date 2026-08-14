---
description: Append a progress.txt entry for the work just completed, in this project's established format
argument-hint: [feature/fix name]
---

Append a new entry to `app-planning/progress.txt` documenting the work just completed in this session, following the exact format already used throughout that file (mirrors the convention established in the sibling `reson8` desktop-client project — read a few recent entries first if unsure, or the file's header if this is the first-ever entry).

Format:

```
--- Entry: DD/MM/YYYY ---

Feature/Fix: <name>

  Problem: <what was broken or missing, 1-3 sentences>

  Solution: <what was implemented/changed, with enough technical detail that
  a future session can understand the approach without re-reading the diff>

  <Optional subsections as needed — e.g. "State/Store Changes:",
  "Component Changes:", "Service Changes:", "PWA/Service Worker Changes:",
  "localStorage Keys:", "Edge Cases Handled:", "Platform-Specific Notes:"
  (call out anything mobile/touch/browser-specific that a future session
  should know about)>

  Key Files Modified:
    path/to/file.ts
    path/to/other/file.ts (NEW) — for newly created files

  Verification:
    <how it was checked — typically `npm run typecheck`, `npm run lint`,
    `npm run test`, and/or `npm run test:e2e`, plus any manual
    cross-browser/device verification actually performed. Never claim a
    device/browser was tested if it wasn't.>

  Next Step: <the next PRD item or phase item, or omit if this was standalone>
```

Steps:
1. Determine today's date and what was actually changed this session — check `git status`/`git diff` if needed to be precise about which files were touched.
2. If the user passed a name via $ARGUMENTS, use it as the Feature/Fix name; otherwise infer a concise one from the work done, ideally referencing the PRD item it corresponds to (e.g. "Phase 2 — P2.5: Mute/Deafen accumulation state machine").
3. Read the last ~50 lines of `app-planning/progress.txt` to match current formatting conventions exactly (indentation, section headers used, phrasing style).
4. Append the new entry at the end of the file — do not rewrite or reformat existing content.
5. Do not fabricate verification steps that weren't actually run — only report what was genuinely checked. If a device/browser from the Phase 7 testing matrix wasn't actually exercised, say so explicitly rather than omitting it silently.
6. If this entry closes out the last item in a phase PRD, note that in "Next Step" (e.g. "Phase 2 complete — begin Phase 3") so the log stays useful as a phase-tracking tool, not just a changelog.
