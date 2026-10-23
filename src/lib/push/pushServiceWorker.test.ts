import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Kører public/push-sw.js i en simuleret service worker og sender den præcise
// payload, som supabase/functions/_shared/push.ts producerer.
function loadWorker() {
  const listeners: Record<string, (e: unknown) => void> = {};
  const showNotification = vi.fn(() => Promise.resolve());
  const self = {
    addEventListener: (type: string, fn: (e: unknown) => void) => { listeners[type] = fn; },
    registration: { showNotification },
    location: { origin: "https://stork.copenhagensales.dk" },
    clients: { matchAll: vi.fn(async () => []), openWindow: vi.fn(async () => null) },
  };
  const src = readFileSync(resolve(__dirname, "../../../public/push-sw.js"), "utf8");
  new Function("self", src)(self);
  return { listeners, showNotification, self };
}

function pushEvent(data: { json: () => unknown } | null) {
  const waits: Promise<unknown>[] = [];
  return { event: { data, waitUntil: (p: Promise<unknown>) => waits.push(p) }, waits };
}

describe("push-sw.js", () => {
  it("registrerer push og notificationclick på topniveau", () => {
    const { listeners } = loadWorker();
    expect(typeof listeners.push).toBe("function");
    expect(typeof listeners.notificationclick).toBe("function");
  });

  it("viser notifikation med titel og tekst fra send-push-payload", async () => {
    const { listeners, showNotification } = loadWorker();
    const payload = JSON.stringify({ title: "Stork", body: "Testnotifikation fra Stork", url: "/", tag: "test" });
    const { event, waits } = pushEvent({ json: () => JSON.parse(payload) });
    listeners.push(event);
    await Promise.all(waits);
    expect(waits).toHaveLength(1);
    expect(showNotification).toHaveBeenCalledWith("Stork", expect.objectContaining({
      body: "Testnotifikation fra Stork", tag: "test", data: { url: "/" },
    }));
  });

  it("viser stadig en notifikation, hvis payload ikke er JSON", async () => {
    const { listeners, showNotification } = loadWorker();
    const { event } = pushEvent({ json: () => { throw new Error("ikke json"); } });
    listeners.push(event);
    expect(showNotification).toHaveBeenCalledWith("Stork", expect.objectContaining({ body: "" }));
  });

  it("åbner url ved klik", async () => {
    const { listeners, self } = loadWorker();
    const waits: Promise<unknown>[] = [];
    listeners.notificationclick({ notification: { close: vi.fn(), data: { url: "/" } }, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    expect(self.clients.openWindow).toHaveBeenCalledWith("https://stork.copenhagensales.dk/");
  });
});
