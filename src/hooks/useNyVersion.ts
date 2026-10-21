import { useEffect } from "react";
import { toast } from "sonner";

const ENTRY_RE = /\/assets\/index-[^"'\s]+\.js/;
const CHECK_MS = 60_000;
const RELOAD_DELAY_MS = 120_000;

/** Genindlæser åbne faner, når en ny version af Stork er publiceret (kun i produktion). */
export function useNyVersion() {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const script = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
    const src = script?.getAttribute("src") ?? "";
    const current = src.match(ENTRY_RE)?.[0];
    if (!current) return;

    let notified = false;
    let reloadTimer: ReturnType<typeof setTimeout> | undefined;
    const reload = () => window.location.reload();

    const check = async () => {
      if (notified) return;
      try {
        const res = await fetch("/", { cache: "no-store" });
        if (!res.ok) return;
        const latest = (await res.text()).match(ENTRY_RE)?.[0];
        if (!latest || latest === current) return;
        if (document.hidden) return reload();
        notified = true;
        toast("Stork er opdateret – siden genindlæses om 2 minutter. Gem dit arbejde.", { duration: Infinity });
        reloadTimer = setTimeout(reload, RELOAD_DELAY_MS);
      } catch {
        // Ingen forbindelse — prøv igen ved næste tjek.
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (notified) reload();
      } else {
        void check();
      }
    };

    const interval = setInterval(() => void check(), CHECK_MS);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      if (reloadTimer) clearTimeout(reloadTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
