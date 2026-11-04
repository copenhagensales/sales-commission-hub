import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TvActivityBanner } from "./TvActivityBanner";

const logo = vi.hoisted(() => vi.fn(() => ({ data: null })));
vi.mock("@/hooks/useTvActivityLogo", () => ({ useTvActivityLogo: logo }));

let paused = true;
let currentTime = 0;
let mediaError: MediaError | null = null;
const mount = (search = "?aktivitet=1") => render(
  <MemoryRouter initialEntries={[`/tv/hiper${search}`]}><TvActivityBanner /></MemoryRouter>,
);

describe("TV activity audio", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    paused = true;
    currentTime = 0;
    mediaError = null;
    logo.mockClear();
    vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(() => paused);
    vi.spyOn(HTMLMediaElement.prototype, "currentTime", "get").mockImplementation(() => currentTime);
    Object.defineProperty(HTMLMediaElement.prototype, "error", { configurable: true, get: () => mediaError });
    vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("probably");
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => { mediaError = null; currentTime = 0; });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => { paused = true; });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => { paused = false; });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it.each(["", "?aktivitet=0", "?aktivitet=10", "?kadebug=1"])("does not load logo or play audio without aktivitet=1 (%s)", search => {
    mount(search);
    expect(logo).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses looping HTML audio at volume 0.05", async () => {
    const { container } = mount();
    await act(async () => {});
    const audio = container.querySelector("audio");
    expect(audio).toBeInstanceOf(HTMLAudioElement);
    expect(audio?.loop).toBe(true);
    expect(audio?.volume).toBe(0.05);
    expect(audio?.muted).toBe(false);
    expect(audio?.getAttribute("src")).toBe("/tv/activity-tone.wav");
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it.each(["keydown", "click", "pointerdown"])("retries rejected autoplay directly on %s", async event => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
    const view = mount();
    await act(async () => {});
    expect(view.queryByRole("status")).not.toBeNull();
    await act(async () => { window.dispatchEvent(new Event(event)); });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    expect(paused).toBe(false);
    expect(view.queryByRole("status")).toBeNull();
  });

  it("retries paused audio at 30 seconds, not earlier, and on visibility", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new Error("blocked"));
    mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(29_999); });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    await act(async () => { fireEvent(document, new Event("visibilitychange")); });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(3);
  });

  it("does not restart playing audio on the periodic retry", async () => {
    const view = mount();
    for (let tick = 0; tick < 3; tick += 1) {
      currentTime += 5;
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    }
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(view.queryByRole("status")).toBeNull();
  });

  it("tolerates synchronous play errors and stops timers/listeners on unmount", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(() => { throw new Error("TV decoder"); });
    const view = mount("?aktivitet=1&kadebug=1");
    await act(async () => {});
    expect(view.queryByRole("status")).toBeNull();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    window.dispatchEvent(new Event("keydown"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
  });

  it("falls back to the existing MP3 only when WAV is unsupported", () => {
    vi.mocked(HTMLMediaElement.prototype.canPlayType).mockReturnValue("");
    const view = mount();
    expect(view.container.querySelector("audio")?.getAttribute("src")).toBe("/tv/activity-tone.mp3");
  });

  it.each(["error", "stalled", "ended"])("reloads on %s even when paused is false, at most once per 10 seconds", async event => {
    const view = mount();
    await act(async () => {});
    const audio = view.container.querySelector("audio");
    if (!audio) throw new Error("Audio missing");
    mediaError = { code: 3 } as MediaError;
    await act(async () => { fireEvent(audio, new Event(event)); });
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    expect(audio.getAttribute("src")).toMatch(/^\/tv\/activity-tone.wav\?r=\d+$/);
    expect(audio.volume).toBe(0.05);
    expect(view.queryByRole("status")).toBeNull();
    await act(async () => {
      fireEvent(audio, new Event(event));
      await vi.advanceTimersByTimeAsync(9_999);
      fireEvent(audio, new Event(event));
    });
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(2);
  });

  it("detects decode errors without an error event on the 10-second watchdog", async () => {
    mount();
    mediaError = { code: 3 } as MediaError;
    currentTime = 5;
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
    expect(mediaError).toBeNull();
  });

  it("reloads frozen unpaused playback and exposes reload count and last failure time", async () => {
    const view = mount("?aktivitet=1&kadebug=1");
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector("pre")?.textContent).toContain("genindlæsninger: 1");
    expect(view.container.querySelector("pre")?.textContent).toContain(`sidste fejl: ${new Date(Date.now()).toISOString()}`);
  });

  it("does not mistake normal looping with timeupdate progress for frozen playback", async () => {
    const view = mount();
    const audio = view.container.querySelector("audio");
    if (!audio) throw new Error("Audio missing");
    currentTime = 15;
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    currentTime = 19;
    fireEvent(audio, new Event("timeupdate"));
    currentTime = 5;
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
  });

  it("never shows the OK prompt for decode rejection and cleans up recovery listeners", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new DOMException("decode", "NotSupportedError"));
    const view = mount();
    await act(async () => {});
    expect(view.queryByRole("status")).toBeNull();
    const audio = view.container.querySelector("audio");
    if (!audio) throw new Error("Audio missing");
    view.unmount();
    for (const event of ["error", "stalled", "ended"]) fireEvent(audio, new Event(event));
    expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});