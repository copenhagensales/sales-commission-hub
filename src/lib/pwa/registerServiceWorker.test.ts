import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("sonner", () => ({ toast: vi.fn() }));
vi.mock("@/components/mobile/DraftGuard", () => ({ hasUnsentDrafts: () => false, requestSafeReload: vi.fn() }));

import { registerServiceWorker, __resetRegisterServiceWorkerForTests } from "./registerServiceWorker";

let register: ReturnType<typeof vi.fn>;
function setReadyState(v: DocumentReadyState) {
  Object.defineProperty(document, "readyState", { configurable: true, get: () => v });
}

beforeEach(() => {
  vi.stubEnv("PROD", true);
  __resetRegisterServiceWorkerForTests();
  register = vi.fn(async () => ({ update: vi.fn(async () => undefined) }));
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register, controller: null, addEventListener: vi.fn(), getRegistrations: vi.fn(async () => []) },
  });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("registerServiceWorker", () => {
  it("(c) registrerer straks ved readyState 'complete' uden load-event", () => {
    setReadyState("complete");
    registerServiceWorker();
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("venter på load, når siden ikke er færdig", () => {
    setReadyState("loading");
    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("load"));
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("(d) ingen dobbeltregistrering ved gentagne kald og ekstra load", () => {
    setReadyState("complete");
    registerServiceWorker();
    registerServiceWorker();
    window.dispatchEvent(new Event("load"));
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("afviser og registrerer ikke med ?sw=off", () => {
    setReadyState("complete");
    window.history.replaceState(null, "", "/?sw=off");
    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();
    window.history.replaceState(null, "", "/");
  });
});
