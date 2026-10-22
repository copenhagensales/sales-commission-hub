/** Ren logik for "Vil du have notifikationer?"-prompten (testbar). */
export const PUSH_PROMPT_DISMISS_KEY = "stork-push-prompt-dismissed-at";
export const PUSH_PROMPT_DISMISS_DAYS = 14;

export function shouldShowPushPrompt(o: {
  loggedIn: boolean;
  standalone: boolean;
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  dismissedAt: string | null;
  now?: number;
}): boolean {
  if (!o.loggedIn || !o.standalone || !o.supported || o.subscribed) return false;
  if (o.permission !== "default") return false;
  if (o.dismissedAt) {
    const t = Number(o.dismissedAt);
    if (Number.isFinite(t) && (o.now ?? Date.now()) - t < PUSH_PROMPT_DISMISS_DAYS * 86400000) return false;
  }
  return true;
}

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
