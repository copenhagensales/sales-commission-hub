import { describe, it, expect } from "vitest";
import { filterUploadedRow, normalizeColumnName } from "./dataImportFilter";

describe("filterUploadedRow", () => {
  const defined = new Set([normalizeColumnName("Phone Number")]);
  const protectedCols = new Set([normalizeColumnName("Employee Name")]);

  it("fjerner udefinerede kolonner", () => {
    const r = filterUploadedRow({ "Phone Number": "1", "Kunde Email": "x" }, defined, protectedCols);
    expect(r.row).toEqual({ "Phone Number": "1" });
    expect(r.dropped).toEqual(["Kunde Email"]);
  });

  it("beholder definerede uanset store bogstaver/mellemrum", () => {
    const r = filterUploadedRow({ " phone  number ": "1" }, defined, protectedCols);
    expect(r.dropped).toEqual([]);
  });

  it("beholder kolonner som matchingen bruger, selv om de ikke er defineret", () => {
    const r = filterUploadedRow({ "Employee Name": "a", Subscription: "b", _product_rows: [] }, new Set(), protectedCols);
    expect(r.dropped).toEqual([]);
  });
});
