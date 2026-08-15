export type ShortcutSlot = "ptt" | "mute" | "deafen" | "disconnect";

export interface ShortcutCombo {
  keys: string[];
  display: string;
}

/** event.code labels, matching the desktop client's shortcut recorder. */
const KEY_LABELS: Record<string, string> = {
  ControlLeft: "L-Ctrl",
  ControlRight: "R-Ctrl",
  ShiftLeft: "L-Shift",
  ShiftRight: "R-Shift",
  AltLeft: "L-Alt",
  AltRight: "R-Alt",
  MetaLeft: "L-Meta",
  MetaRight: "R-Meta",
  Space: "Space",
  Backquote: "`",
};

export function keyCodeToLabel(code: string): string {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}

export function comboToDisplay(keys: Iterable<string>): string {
  return [...keys].map(keyCodeToLabel).join(" + ");
}

function storageKey(slot: ShortcutSlot): string {
  return `reson8-shortcut-${slot}`;
}

export function loadShortcut(slot: ShortcutSlot): ShortcutCombo | null {
  const saved = localStorage.getItem(storageKey(slot));
  if (!saved) return null;
  try {
    const keys = JSON.parse(saved) as string[];
    return { keys, display: comboToDisplay(keys) };
  } catch {
    return null;
  }
}

export function saveShortcut(slot: ShortcutSlot, keys: string[]): ShortcutCombo {
  localStorage.setItem(storageKey(slot), JSON.stringify(keys));
  return { keys, display: comboToDisplay(keys) };
}

export function clearShortcut(slot: ShortcutSlot): void {
  localStorage.removeItem(storageKey(slot));
}

/** True when exactly the combo's keys (no more, no fewer) are currently held. */
export function comboMatches(combo: ShortcutCombo | null, heldKeys: ReadonlySet<string>): boolean {
  if (!combo) return false;
  if (combo.keys.length !== heldKeys.size) return false;
  return combo.keys.every((k) => heldKeys.has(k));
}
