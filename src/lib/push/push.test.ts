import { describe, expect, it } from "vitest";
import { PUSH_TEXT } from "./pushText";
import { filterOpstartRecipients } from "./pushText";
import { shouldShowPushPrompt } from "./pushPrompt";
import { readFileSync } from "node:fs";

const base = { loggedIn: true, standalone: true, supported: true, permission: "default" as const, subscribed: false, dismissedAt: null };

describe("push", () => {
  it("tekster indeholder ingen tal (beløb) eller kr – kun begrebet 1-1 er tilladt", () => {
    for (const t of Object.values(PUSH_TEXT)) {
      const s = `${t.title} ${t.body}`.replace(/1-1/g, "");
      expect(s).not.toMatch(/\d/);
      expect(s).not.toMatch(/\bkr\b/i);
    }
  });
  it("edge-tekster er identiske med frontend-spejlet", () => {
    const edge = readFileSync("supabase/functions/_shared/pushText.ts", "utf8");
    for (const t of Object.values(PUSH_TEXT)) {
      expect(edge).toContain(t.title);
      expect(edge).toContain(t.body);
    }
  });
  it("sælger modtager aldrig sit eget opstartsflag", () => {
    expect(filterOpstartRecipients(["leder", "saelger"], ["saelger"])).toEqual(["leder"]);
  });
  it("prompt vises kun i installeret app, logget ind, ikke afvist inden for 14 dage", () => {
    expect(shouldShowPushPrompt(base)).toBe(true);
    expect(shouldShowPushPrompt({ ...base, standalone: false })).toBe(false);
    expect(shouldShowPushPrompt({ ...base, loggedIn: false })).toBe(false);
    expect(shouldShowPushPrompt({ ...base, permission: "denied" })).toBe(false);
    const now = Date.now();
    expect(shouldShowPushPrompt({ ...base, dismissedAt: String(now - 13 * 86400000), now })).toBe(false);
    expect(shouldShowPushPrompt({ ...base, dismissedAt: String(now - 15 * 86400000), now })).toBe(true);
  });
  it("410/404 deaktiverer abonnementet i den fælles sender", () => {
    const src = readFileSync("supabase/functions/_shared/push.ts", "utf8");
    expect(src).toMatch(/code === 404 \|\| code === 410/);
    expect(src).toMatch(/is_active: false/);
  });
  it("præferencer respekteres før afsendelse", () => {
    const src = readFileSync("supabase/functions/_shared/push.ts", "utf8");
    expect(src).toMatch(/skipped_pref/);
  });
});
