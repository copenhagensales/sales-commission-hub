import { useCallback, useEffect, useState } from "react";
import { INSTALL_DISMISS_KEY, isDismissed, isIosUserAgent, isMobileUserAgent } from "@/lib/pwa/installState";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((l) => l());
  });
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

/** Installationsstatus for Stork som app på telefonen. UI-præference i localStorage. */
export function useInstallStork() {
  const [, force] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<string | null>(() => {
    try { return localStorage.getItem(INSTALL_DISMISS_KEY); } catch { return null; }
  });

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const ua = navigator.userAgent;
  const touch = navigator.maxTouchPoints ?? 0;
  const ios = isIosUserAgent(ua, touch);
  const mobile = isMobileUserAgent(ua, touch);
  const standalone = isStandalone();

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => undefined);
    deferredPrompt = null;
    force((n) => n + 1);
  }, []);

  const dismiss = useCallback(() => {
    const v = String(Date.now());
    try { localStorage.setItem(INSTALL_DISMISS_KEY, v); } catch { /* ignore */ }
    setDismissedAt(v);
  }, []);

  return {
    ios,
    mobile,
    standalone,
    canPrompt: !!deferredPrompt,
    dismissed: isDismissed(dismissedAt),
    install,
    dismiss,
  };
}
