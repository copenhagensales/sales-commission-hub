import { describe, expect, it } from "vitest";
import { isDismissed, isIosUserAgent } from "./installState";

const DAY = 24 * 60 * 60 * 1000;

describe("install-banner 'Ikke nu'", () => {
  it("skjuler banneret i 14 dage", () => {
    const now = 1_000 * DAY;
    expect(isDismissed(String(now - 13 * DAY), now)).toBe(true);
    expect(isDismissed(String(now - 14 * DAY), now)).toBe(false);
  });
  it("viser banneret når der ikke er klikket 'Ikke nu'", () => {
    expect(isDismissed(null)).toBe(false);
  });
});

describe("iOS-genkendelse", () => {
  it("genkender iPhone og iPadOS", () => {
    expect(isIosUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIosUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(isIosUserAgent("Mozilla/5.0 (Linux; Android 14)")).toBe(false);
  });
});
