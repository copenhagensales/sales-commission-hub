import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn(async () => ({ data: { publicKey: "AAAA" }, error: null })) },
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    from: vi.fn(() => ({ upsert: vi.fn(async () => ({ error: null })), delete: () => ({ eq: vi.fn(async () => ({})) }) })),
  },
}));
vi.mock("@/lib/push/pushPrompt", () => ({ urlBase64ToUint8Array: () => new Uint8Array([1]) }));

import { usePushNotifications, PUSH_NOT_READY_MESSAGE, SW_READY_TIMEOUT_MS } from "./usePushNotifications";

function setup(readyPromise: Promise<unknown>) {
  const subscribe = vi.fn(async () => ({ endpoint: "e", toJSON: () => ({ keys: { p256dh: "p", auth: "a" } }) }));
  const reg = { pushManager: { getSubscription: vi.fn(async () => null), subscribe } };
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration: vi.fn(async () => reg), ready: readyPromise } });
  Object.defineProperty(window, "PushManager", { configurable: true, value: function PM() {} });
  Object.defineProperty(window, "Notification", { configurable: true, value: { permission: "default", requestPermission: vi.fn(async () => "granted") } });
  return { reg, subscribe };
}

describe("usePushNotifications.subscribe", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("(a) venter på ready og kalder først subscribe, når active findes", async () => {
    let resolveReady!: (r: unknown) => void;
    const ready = new Promise((r) => { resolveReady = r; });
    const { reg, subscribe } = setup(ready);
    const { result } = renderHook(() => usePushNotifications());
    let p!: Promise<void>;
    await act(async () => { p = result.current.subscribe(); await Promise.resolve(); await vi.advanceTimersByTimeAsync(100); });
    expect(subscribe).not.toHaveBeenCalled();
    await act(async () => { resolveReady({ ...reg, active: {} }); await p; });
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("(b) timeout giver dansk besked og intet subscribe-kald", async () => {
    const { subscribe } = setup(new Promise(() => undefined));
    const { result } = renderHook(() => usePushNotifications());
    let err: unknown;
    await act(async () => {
      const p = result.current.subscribe().catch((e) => { err = e; });
      await vi.advanceTimersByTimeAsync(SW_READY_TIMEOUT_MS + 10);
      await p;
    });
    expect((err as Error).message).toBe(PUSH_NOT_READY_MESSAGE);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("browserfejl fra subscribe vises som dansk besked, ikke rå tekst", async () => {
    const { reg, subscribe } = setup(Promise.resolve(null));
    subscribe.mockRejectedValueOnce(new Error("Subscribing for push requires an active service worker"));
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration: vi.fn(async () => reg), ready: Promise.resolve({ ...reg, active: {} }) } });
    const { result } = renderHook(() => usePushNotifications());
    await act(async () => { await expect(result.current.subscribe()).rejects.toThrow(PUSH_NOT_READY_MESSAGE); });
  });
});
