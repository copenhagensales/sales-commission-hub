/** Ren logik for installations-banneret (testbar). */
export const INSTALL_DISMISS_KEY = "stork-install-banner-dismissed-at";
export const INSTALL_DISMISS_DAYS = 14;

export function isDismissed(dismissedAt: string | null, now: number = Date.now()): boolean {
  if (!dismissedAt) return false;
  const t = Number(dismissedAt);
  if (!Number.isFinite(t)) return false;
  return now - t < INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function isIosUserAgent(ua: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ melder sig som Mac.
  return /Macintosh/i.test(ua) && maxTouchPoints > 1;
}

export function isMobileUserAgent(ua: string, maxTouchPoints = 0): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || isIosUserAgent(ua, maxTouchPoints);
}
