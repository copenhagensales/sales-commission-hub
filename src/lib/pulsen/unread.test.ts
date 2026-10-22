import { describe, expect, it } from "vitest";
import { formatUnread } from "@/hooks/usePulsen";

describe("Pulsen ulæst-badge", () => {
  it("viser aldrig mere end 9+", () => {
    expect(formatUnread(9)).toBe("9");
    expect(formatUnread(10)).toBe("9+");
    expect(formatUnread(250)).toBe("9+");
  });
});
