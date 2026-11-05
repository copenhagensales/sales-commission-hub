import { describe, it, expect } from "vitest";
import { straksbetalingSynlig } from "./straksbetalingSynlighed";
describe("straksbetalingSynlig", () => {
  it("se-alle-rettighed giver fanen uden egne salg", () => expect(straksbetalingSynlig(false, true, false)).toBe(true));
  it("sælger uden egne salg ser ikke fanen", () => expect(straksbetalingSynlig(true, false, false)).toBe(false));
  it("sælger med egne salg ser fanen", () => expect(straksbetalingSynlig(true, false, true)).toBe(true));
});
