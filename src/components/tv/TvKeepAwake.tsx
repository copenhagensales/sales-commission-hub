import { useEffect, useRef } from "react";

/**
 * Holder LG webOS' pauseskærm væk på TV-boards: lydløs, usynlig video i loop
 * + Screen Wake Lock hvor det findes. Alle fejl ignoreres stille.
 */
export function TvKeepAwake() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const tryPlay = () => {
      const v = videoRef.current;
      if (v && v.paused) v.play().catch(() => undefined);
    };

    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const requestLock = () => {
      const wl = (navigator as Navigator & {
        wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
      }).wakeLock;
      if (!wl || document.visibilityState !== "visible") return;
      wl.request("screen").then((l) => {
        if (cancelled) { l.release().catch(() => undefined); return; }
        lock = l;
      }).catch(() => undefined);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        tryPlay();
        requestLock();
      }
    };

    tryPlay();
    requestLock();
    const interval = window.setInterval(tryPlay, 30_000);
    const events = ["pointerdown", "keydown", "touchstart", "click"] as const;
    events.forEach((e) => window.addEventListener(e, tryPlay, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, tryPlay));
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => undefined);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      src="/tv/keep-awake.mp4?v=2"
      muted
      loop
      autoPlay
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
      style={{
        position: "fixed",
        right: 0,
        bottom: 0,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: "none",
      }}
    />
  );
}
