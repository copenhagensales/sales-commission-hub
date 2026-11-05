import { describe, it, expect } from "vitest";
import { straksbetalingSynlig } from "./straksbetalingSynlighed";
describe("straksbetalingSynlig", () => {
  it("se-alle-rettighed giver fanen uden United-tilknytning", () => expect(straksbetalingSynlig(false, true, false)).toBe(true));
  it("United-sælger med fanerettighed ser altid fanen", () => expect(straksbetalingSynlig(true, false, true)).toBe(true));
  it("sælger uden United-tilknytning ser ikke fanen", () => expect(straksbetalingSynlig(true, false, false)).toBe(false));
  it("United-sælger uden fanerettighed ser ikke fanen", () => expect(straksbetalingSynlig(false, false, true)).toBe(false));
});
