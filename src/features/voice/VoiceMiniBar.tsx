/**
 * Reserved slot for the persistent voice mini-bar (master PRD §5.1) — renders
 * nothing until Phase 2 adds voice join state. Kept as its own component so
 * AppShell's layout doesn't change shape when Phase 2 populates it.
 */
export function VoiceMiniBar() {
  return null;
}
