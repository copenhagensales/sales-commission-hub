import { useEffect, useRef, useState } from "react";

/**
 * Holder LG webOS' pauseskærm væk på TV-boards: lydløs sort video i loop i fuld
 * skærm bag alt indhold + Screen Wake Lock hvor det findes. Alle fejl ignoreres
 * stille. `?kadebug=1` viser en diagnoseboks.
 */
export function TvKeepAwake() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [debug] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("kadebug") === "1",
  );

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
        if (lock && lock !== l) lock.release().catch(() => undefined);
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
    <>
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
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          objectFit: "cover",
          zIndex: -1,
          backgroundColor: "black",
          pointerEvents: "none",
        }}
      />
      {debug && <KeepAwakeDebug videoRef={videoRef} />}
    </>
  );
}

function KeepAwakeDebug({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement> }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const tick = () => {
      const v = videoRef.current;
      setText(
        v
          ? `paused: ${v.paused}\ncurrentTime: ${v.currentTime.toFixed(1)}\nreadyState: ${v.readyState}\nvideo: ${v.videoWidth}×${v.videoHeight}\nerror: ${v.error ? v.error.code : "ingen"}\nwindow: ${window.innerWidth}×${window.innerHeight}\nUA: ${navigator.userAgent}`
          : "ingen video",
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [videoRef]);
  return (
    <pre
      style={{
        position: "fixed",
        left: 8,
        bottom: 8,
        zIndex: 9999,
        margin: 0,
        padding: 8,
        maxWidth: "60vw",
        whiteSpace: "pre-wrap",
        background: "rgba(0,0,0,0.7)",
        color: "white",
        fontFamily: "monospace",
        fontSize: 14,
        pointerEvents: "none",
      }}
    >
      {text}
    </pre>
  );
}
