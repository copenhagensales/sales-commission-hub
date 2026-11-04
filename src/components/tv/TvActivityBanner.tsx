import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTvActivityLogo } from "@/hooks/useTvActivityLogo";
import "./TvActivityBanner.css";

export function TvActivityBanner() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  // No mounted audio, query, timers or listeners unless explicitly requested.
  if (params.get("aktivitet") !== "1") return null;
  return <ActiveBanner debug={params.get("kadebug") === "1"} />;
}

function ActiveBanner({ debug }: { debug: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { data: logoUrl } = useTvActivityLogo();
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let disposed = false;
    let attempt = 0;
    const playing = () => {
      if (!disposed) setNeedsInteraction(false);
    };
    const tryPlay = () => {
      if (disposed) return;
      if (!audio.paused) { playing(); return; }
      const currentAttempt = ++attempt;
      const failed = () => {
        if (!disposed && currentAttempt === attempt && audio.paused) setNeedsInteraction(true);
      };
      // Some older TVs throw synchronously or do not return a Promise.
      try {
        const result = audio.play();
        result?.then(() => {
          if (!disposed && !audio.paused) playing();
        }).catch(failed);
      } catch { failed(); }
    };
    const visible = () => {
      if (document.visibilityState === "visible") tryPlay();
    };
    const events = ["keydown", "click", "pointerdown"] as const;
    try { audio.volume = 0.05; audio.muted = false; } catch { /* Unsupported TV API. */ }
    audio.addEventListener("playing", playing);
    events.forEach(event => window.addEventListener(event, tryPlay, { passive: true }));
    document.addEventListener("visibilitychange", visible);
    const retry = window.setInterval(tryPlay, 30_000);
    tryPlay();

    return () => {
      disposed = true;
      window.clearInterval(retry);
      events.forEach(event => window.removeEventListener(event, tryPlay));
      document.removeEventListener("visibilitychange", visible);
      audio.removeEventListener("playing", playing);
      try { audio.pause(); } catch { /* Teardown must remain nonfatal. */ }
    };
  }, []);

  useEffect(() => {
    if (!debug) return;
    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;
      try {
        setStatus(`Lyd\npaused: ${audio.paused}\ncurrentTime: ${audio.currentTime.toFixed(1)}\nvolume: ${audio.volume}\nerror: ${audio.error?.code ?? "ingen"}`);
      } catch { setStatus("Lydstatus ikke tilgængelig"); }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [debug]);

  return (
    <>
      <audio ref={audioRef} src="/tv/activity-tone.mp3" loop preload="auto" aria-hidden="true" />
      <div className="pointer-events-none fixed top-2 left-1/2 -translate-x-1/2 z-[10000]" aria-hidden="true">
        <div className="tv-activity-logo flex h-12 w-32 items-center justify-center rounded bg-background/95">
          {logoUrl && failedLogo !== logoUrl ? (
            <img src={logoUrl} alt="Hiper" className="h-12 max-w-full object-contain" onError={() => setFailedLogo(logoUrl)} />
          ) : <span className="rounded bg-background/90 px-3 py-1 text-2xl font-bold text-foreground">Hiper</span>}
        </div>
      </div>
      <div className="pointer-events-none fixed bottom-2 right-2 z-[10000] flex max-w-[min(320px,calc(100vw-16px))] flex-col items-end gap-2">
        {debug && <pre className="m-0 rounded border border-border bg-popover/95 p-2 text-sm text-popover-foreground whitespace-pre-wrap">{status}</pre>}
        {needsInteraction && <div role="status" className="rounded border border-border bg-popover/95 px-3 py-2 text-sm text-popover-foreground">Tryk OK på fjernbetjeningen for at aktivere lyd</div>}
      </div>
    </>
  );
}