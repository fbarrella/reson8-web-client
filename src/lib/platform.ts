/**
 * Install-prompt platform detection (Phase 7 P7.1). Chromium exposes
 * `beforeinstallprompt`; iOS Safari never fires it (no such event exists
 * there), so the iOS install affordance has to be reached by UA/feature
 * sniffing instead of a capability check.
 */

export function isStandaloneDisplayMode(): boolean {
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari's pre-standard flag — still the only signal on iOS today.
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as "MacIntel" with touch support — the standard
  // way to distinguish it from a real Mac.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function isIOSSafari(): boolean {
  if (!isIOS()) return false;
  const ua = navigator.userAgent;
  // Other iOS browsers (Chrome, Firefox, Edge) also include "Safari" in
  // their UA string but add their own token too — exclude those.
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}
