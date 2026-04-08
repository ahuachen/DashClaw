export const HIGHLIGHTS_VERSION = '2026-02-15-major-v2';
export const HIGHLIGHTS_DISMISS_KEY = 'dashclaw_capability_highlights_dismissed_version';

export function isHighlightsDismissed(storage = globalThis?.localStorage) {
  try {
    return Boolean(storage) && storage.getItem(HIGHLIGHTS_DISMISS_KEY) === HIGHLIGHTS_VERSION;
  } catch {
    return false;
  }
}

export function dismissHighlights(storage = globalThis?.localStorage) {
  try {
    if (storage) {
      storage.setItem(HIGHLIGHTS_DISMISS_KEY, HIGHLIGHTS_VERSION);
    }
  } catch {
    // ignore storage errors
  }
}
