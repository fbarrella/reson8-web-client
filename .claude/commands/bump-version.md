---
description: Bump the web client's version per this project's feature/fix/copy policy, and generate release notes
argument-hint: [new-version | major|minor|patch]
---

Bump `reson8-web-client`'s version number, update every file that references it, and generate a release-notes file — run this once at the end of a completed phase PRD (or after any significant standalone piece of work outside a phase), never per individual PRD item (that's what `/log-progress` is for).

## 1. Determine the new version

- If `$ARGUMENTS` is a full semver (`X.Y.Z`), use it directly — skip classification.
- If `$ARGUMENTS` is literally `major`, `minor`, or `patch`, apply that bump to the current version from `package.json` — skip classification.
- Otherwise, **auto-classify** by reading every `app-planning/progress.txt` entry since the last version bump:
  1. Find the most recent `=== Version bumped to X.Y.Z ===` marker line in `progress.txt` (see step 4 below — every prior bump leaves one). If none exists yet, use every entry from the start of the "ONGOING LOG" section.
  2. Read those entries' Problem/Solution text and classify the batch as a whole, per this project's **deliberately non-standard** versioning policy (documented in `CLAUDE.md` → Versioning and master PRD §10.2 — MAJOR here does not mean "breaking change," don't second-guess the rule against conventional semver):
     - **MAJOR** — any entry shipped a new user-facing feature/capability.
     - **MINOR** — every entry was a fix only, no new capability introduced.
     - **PATCH** — every entry was purely cosmetic (copy/text, spacing, color, non-functional UI tweaks) with no behavior change.
  3. Compute the resulting version from the current `package.json` version and report the classification + resulting version to the user for confirmation before proceeding (a wrong auto-classification is cheap to correct here, expensive to unwind after files are already edited).

Read the current version from the root `package.json`'s `"version"` field first (if `package.json` doesn't exist yet, this command can't run — Phase 1 must scaffold the project first; tell the user this and stop).

## 2. Update the version number in these files

- `package.json` — `"version"` field
- `README.md` — the version badge
- `CLAUDE.md` — the "Current version: X" line near the top. **Do not** touch any other version mention elsewhere in that file.

## 3. Catch-all sweep

Grep the repo (excluding `node_modules`, `dist`, `.git`) for the *old* version string to catch anything not listed above — new files sometimes appear between releases. Files under `app-planning/` referencing an old version as history (`progress.txt` entries, `releases/*.md`) are historical record, not live pointers — leave those alone.

## 4. Regenerate the lockfile and verify

- `npm install --package-lock-only` (never hand-edit the lockfile).
- `npm run typecheck` (once the project has one) to confirm nothing broke from the version-string edits alone.

## 5. Mark the bump point in `progress.txt`

Append a single delimiter line at the end of `app-planning/progress.txt`:

```
=== Version bumped to X.Y.Z (DD/MM/YYYY) — classification: MAJOR|MINOR|PATCH ===
```

This is what lets the next `/bump-version` run find "everything since the last bump" without re-reading the whole file's history.

## 6. Generate `app-planning/releases/v<version>.md`

- `# 📦 Reson8 Web Client v<version> Release Notes`
- A 1–2 sentence intro summarizing the release's overall theme (e.g. "Phase 2 complete: voice channels are now fully functional.")
- `## ✨ New Features & Improvements` — bullet list, one line per shipped item, sourced from the `progress.txt` entries since the last bump. Omit if this was a MINOR/PATCH-only bump with nothing feature-shaped to list.
- `## 🐛 Bug Fixes` — same bullet style, omit entirely if there were none.
- **Do not invent or embellish** anything not backed by an actual `progress.txt` entry.

## 7. Report

Summarize every file changed, the classification reasoning, and the path to the new release notes file. Do not run `git commit` or `git push` — leave that to the user.
