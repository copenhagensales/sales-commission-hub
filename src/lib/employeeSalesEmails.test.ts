import { describe, it, expect } from "vitest";
import { resolveEmployeeSalesEmails } from "./employeeSalesEmails";

describe("resolveEmployeeSalesEmails", () => {
  it("bruger mappede agent-mails når de findes", () => {
    expect(resolveEmployeeSalesEmails(["A@x.dk"], "w@x.dk")).toEqual(["a@x.dk"]);
  });
  it("falder tilbage til arbejdsmail uden mapping", () => {
    expect(resolveEmployeeSalesEmails([], "Fasc@copenhagensales.dk")).toEqual(["fasc@copenhagensales.dk"]);
  });
  it("returnerer tom liste uden mapping og arbejdsmail", () => {
    expect(resolveEmployeeSalesEmails([], null)).toEqual([]);
  });
});
