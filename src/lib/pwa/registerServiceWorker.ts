import { toast } from "sonner";
import { hasUnsentDrafts, requestSafeReload } from "@/components/mobile/DraftGuard";

/**
 * Eneste sted, Storks service worker registreres.
 * Registreres aldrig i dev, i iframe (Lovable-preview) eller på preview-domæner.
 * `?sw=off` afregistrerer og stopper.
 */
const SW_PATH = "/sw.js";

function isRefusedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterAppWorkers() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) => [r.active, r.waiting, r.installing].some((w) => w?.scriptURL.endsWith(SW_PATH)))
      .map((r) => r.unregister()),
  );
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  if (isRefusedContext()) {
    void unregisterAppWorkers().catch(() => undefined);
    return;
  }

  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Første installation: ingen genindlæsning. Ny version: diskret besked og reload,
    // men aldrig midt i en uafsendt indtastning (så udskydes den til næste sideskift).
    if (!hadController || reloading) return;
    reloading = true;
    if (!hasUnsentDrafts()) toast("Ny version af Stork er klar – opdaterer…");
    requestSafeReload(() => window.location.reload(), 1500);
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(SW_PATH, { scope: "/" })
      .then((reg) => {
        // Tjek for ny udgivelse hver time og når appen kommer i forgrunden.
        window.setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void reg.update().catch(() => undefined);
        });
      })
      .catch(() => undefined);
  });
}
