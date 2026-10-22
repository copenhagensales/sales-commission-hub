import { describe, expect, it } from "vitest";
import { REACTIONS, reactionKeyForEmoji } from "./feedReactions";

describe("feed reaction mapping", () => {
  it("has exactly the 5 allowed reactions", () => {
    expect(REACTIONS.map((r) => r.emoji)).toEqual(["👏", "🎉", "❤️", "💪", "😄"]);
  });
  it("groups party emojis under Tillykke", () => {
    for (const e of ["🎉", "🥳", "🎂", "🙌"]) expect(reactionKeyForEmoji(e)).toBe("congrats");
  });
  it("groups star/trophy under Godt gået", () => {
    for (const e of ["👏", "⭐", "🏆"]) expect(reactionKeyForEmoji(e)).toBe("clap");
  });
  it("groups fire/rocket under Stærkt", () => {
    for (const e of ["💪", "🔥", "🚀"]) expect(reactionKeyForEmoji(e)).toBe("strong");
  });
  it("maps heart and smile", () => {
    expect(reactionKeyForEmoji("❤️")).toBe("love");
    expect(reactionKeyForEmoji("😄")).toBe("funny");
  });
  it("counts unknown emojis as Godt gået", () => {
    expect(reactionKeyForEmoji("🦄")).toBe("clap");
  });
});
