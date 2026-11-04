import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TvActivityBanner } from "./TvActivityBanner";

const logo = vi.hoisted(() => vi.fn(() => ({ data: null })));
vi.mock("@/hooks/useTvActivityLogo", () => ({ useTvActivityLogo: logo }));

let paused = true;
const mount = (search = "?aktivitet=1") => render(
  <MemoryRouter initialEntries={[`/tv/hiper${search}`]}><TvActivityBanner /></MemoryRouter>,
);

describe("TV activity audio", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    paused = true;
    logo.mockClear();
    vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(() => paused);
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
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it.each(["keydown", "click", "pointerdown"])("retries rejected autoplay directly on %s", async event => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error("blocked"));
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
    mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it("tolerates synchronous play errors and stops timers/listeners on unmount", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(() => { throw new Error("TV decoder"); });
    const view = mount("?aktivitet=1&kadebug=1");
    await act(async () => {});
    expect(view.queryByRole("status")).not.toBeNull();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    window.dispatchEvent(new Event("keydown"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
  });
});