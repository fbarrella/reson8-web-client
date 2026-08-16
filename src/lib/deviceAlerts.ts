/**
 * Best-effort mobile-equivalent attention cues for Nudge (Phase 5 PRD P5.6,
 * CLAUDE.md platform-limitations table). Both APIs are inconsistently
 * supported (iOS Safari lacks both) — every call is feature-detected and
 * fails silently, never surfacing a "not supported" error for what is
 * explicitly a best-effort enhancement.
 */

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(pattern);
}

interface BadgeNavigator {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
}

export function setAppBadge(count: number): void {
  const nav = navigator as BadgeNavigator;
  if (typeof nav.setAppBadge !== "function") return;
  void nav.setAppBadge(count).catch(() => {
    // Not user-actionable — best-effort only.
  });
}

export function clearAppBadge(): void {
  const nav = navigator as BadgeNavigator;
  if (typeof nav.clearAppBadge !== "function") return;
  void nav.clearAppBadge().catch(() => {
    // Not user-actionable — best-effort only.
  });
}
