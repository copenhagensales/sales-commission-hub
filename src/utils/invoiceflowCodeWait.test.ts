import { describe, it, expect } from "vitest";
import { decideCodeWait, waitForLogin, CODE_WAIT_TIMEOUT_MS } from "../../supabase/functions/_shared/invoiceflowCodeWait";

describe("InvoiceFlow: vent på engangskode", () => {
  it("kode-side væk → fortsæt", () => {
    expect(decideCodeWait("logged_in", 0, 60_000)).toBe("continue");
  });
  it("kode-side stadig vist inden 15 min → vent", () => {
    expect(decideCodeWait("code", 0, CODE_WAIT_TIMEOUT_MS - 1)).toBe("wait");
  });
  it("15 minutter uden kode → timeout (PORTAL_CODE_TIMEOUT)", () => {
    expect(decideCodeWait("code", 0, CODE_WAIT_TIMEOUT_MS)).toBe("timeout");
  });

  const clock = (start: number) => { let t = start; return { now: () => t, sleep: async (ms: number) => { t += ms; } }; };

  it("poller hvert 3. sek. og fortsætter, når login er gennemført", async () => {
    const c = clock(0); let calls = 0;
    const r = await waitForLogin(async () => (++calls >= 4 ? "logged_in" : "code"), { startedAtMs: 0, budgetMs: 100_000, ...c });
    expect(r).toBe("continue");
    expect(calls).toBe(4);
    expect(c.now()).toBe(9_000);
  });
  it("timeout efter 15 min, selv midt i en opfølgning", async () => {
    const c = clock(CODE_WAIT_TIMEOUT_MS - 6_000);
    const r = await waitForLogin(async () => "code", { startedAtMs: 0, budgetMs: 100_000, ...c });
    expect(r).toBe("timeout");
  });
  it("brugt kørselsbudget → overlad til næste opfølgning", async () => {
    const c = clock(0);
    const r = await waitForLogin(async () => "code", { startedAtMs: 0, budgetMs: 10_000, ...c });
    expect(r).toBe("still_waiting");
  });
});
