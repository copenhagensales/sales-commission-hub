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
  const diagnostics = useRef({ reloads: 0, lastError: "ingen" });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let disposed = false;
    let attempt = 0;
    let lastReload = -Infinity;
    let lastTime = audio.currentTime;
    let progressed = false;
    let source = "/tv/activity-tone.mp3";
    try {
      if (audio.canPlayType('audio/wav; codecs="1"')) source = "/tv/activity-tone.wav";
      audio.src = source;
    } catch { /* Older TVs can lack format detection. */ }
    const playing = () => {
      if (!disposed) setNeedsInteraction(false);
    };
    const tryPlay = (force = false) => {
      if (disposed) return;
      if (!force && !audio.paused) { playing(); return; }
      const currentAttempt = ++attempt;
      const failed = (error: unknown) => {
        if (disposed || currentAttempt !== attempt) return;
        // Decode/transport failures cannot be fixed by pressing OK.
        const blocked = typeof error === "object" && error !== null && "name" in error && error.name === "NotAllowedError";
        setNeedsInteraction(blocked && !audio.error);
      };
      // Some older TVs throw synchronously or do not return a Promise.
      try {
        const result = audio.play();
        result?.then(() => {
          if (!disposed && !audio.paused) playing();
        }).catch(failed);
      } catch (error) { failed(error); }
    };
    const recover = () => {
      if (disposed) return;
      const now = Date.now();
      diagnostics.current.lastError = new Date(now).toISOString();
      setNeedsInteraction(false);
      if (now - lastReload < 10_000) return;
      lastReload = now;
      diagnostics.current.reloads += 1;
      ++attempt; // Ignore rejection from playback superseded by load().
      try {
        audio.src = `${source}?r=${now}`;
        audio.load();
        audio.volume = 0.05;
        audio.muted = false;
        lastTime = audio.currentTime;
        progressed = false;
        tryPlay(true);
      } catch { /* Recovery must never crash the board. */ }
    };
    const progress = () => {
      if (audio.currentTime > lastTime) progressed = true;
    };
    const checkHealth = () => {
      if (disposed) return;
      try {
        // timeupdate also proves progress across a normal loop wrap.
        if (audio.error || (!audio.paused && !progressed && audio.currentTime <= lastTime)) recover();
        lastTime = audio.currentTime;
        progressed = false;
      } catch { /* Unsupported TV API. */ }
    };
    const resume = () => {
      if (audio.error) recover();
      else tryPlay();
    };
    const visible = () => {
      if (document.visibilityState === "visible") resume();
    };
    const events = ["keydown", "click", "pointerdown"] as const;
    try { audio.volume = 0.05; audio.muted = false; } catch { /* Unsupported TV API. */ }
    audio.addEventListener("playing", playing);
    const faults = ["error", "stalled", "ended"] as const;
    faults.forEach(event => audio.addEventListener(event, recover));
    audio.addEventListener("timeupdate", progress);
    events.forEach(event => window.addEventListener(event, resume, { passive: true }));
    document.addEventListener("visibilitychange", visible);
    const retry = window.setInterval(resume, 30_000);
    const watchdog = window.setInterval(checkHealth, 10_000);
    tryPlay();

    return () => {
      disposed = true;
      window.clearInterval(retry);
      window.clearInterval(watchdog);
      events.forEach(event => window.removeEventListener(event, resume));
      document.removeEventListener("visibilitychange", visible);
      audio.removeEventListener("playing", playing);
      faults.forEach(event => audio.removeEventListener(event, recover));
      audio.removeEventListener("timeupdate", progress);
      try { audio.pause(); } catch { /* Teardown must remain nonfatal. */ }
    };
  }, []);

  useEffect(() => {
    if (!debug) return;
    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;
      try {
        setStatus(`Lyd\npaused: ${audio.paused}\ncurrentTime: ${audio.currentTime.toFixed(1)}\nvolume: ${audio.volume}\nerror: ${audio.error?.code ?? "ingen"}\ngenindlæsninger: ${diagnostics.current.reloads}\nsidste fejl: ${diagnostics.current.lastError}`);
      } catch { setStatus("Lydstatus ikke tilgængelig"); }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [debug]);

  return (
    <>
      <audio ref={audioRef} loop preload="auto" aria-hidden="true" />
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