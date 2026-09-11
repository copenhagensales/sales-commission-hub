import { describe, expect, it } from "vitest";
import {
  DIALER_CALLS_RETENTION_DAYS,
  DIALER_CALL_METADATA_ALLOWLIST,
  hasDisallowedDialerCallMetadata,
  sanitizeDialerCallMetadata,
} from "./dialer-call-privacy.ts";

describe("sanitizeDialerCallMetadata", () => {
  it("keeps only technical keys and drops identity keys", () => {
    const raw = {
      disposition: "ANSWERED",
      hangupCause: "NORMAL",
      callType: "outbound",
      isSale: true,
      number: "+4512345678",
      agentEmail: "seller@copenhagensales.dk",
      customerName: "Some Person",
    };

    expect(sanitizeDialerCallMetadata(raw)).toEqual({
      disposition: "ANSWERED",
      hangupCause: "NORMAL",
      callType: "outbound",
      isSale: true,
    });
  });

  it("returns null when nothing safe is left", () => {
    expect(sanitizeDialerCallMetadata({ number: "+4512345678" })).toBeNull();
    expect(sanitizeDialerCallMetadata(null)).toBeNull();
    expect(sanitizeDialerCallMetadata("string")).toBeNull();
    expect(sanitizeDialerCallMetadata([{ number: "1" }])).toBeNull();
  });

  it("is idempotent", () => {
    const once = sanitizeDialerCallMetadata({ disposition: "BUSY", number: "1" });
    expect(sanitizeDialerCallMetadata(once)).toEqual(once);
    expect(hasDisallowedDialerCallMetadata(once)).toBe(false);
  });
});

describe("hasDisallowedDialerCallMetadata", () => {
  it("detects identity keys", () => {
    expect(hasDisallowedDialerCallMetadata({ disposition: "BUSY" })).toBe(false);
    expect(hasDisallowedDialerCallMetadata({ disposition: "BUSY", number: "1" })).toBe(true);
    expect(hasDisallowedDialerCallMetadata(null)).toBe(false);
  });
});

describe("allowlist", () => {
  it("contains no identity fields", () => {
    for (const forbidden of ["number", "phone", "agentEmail", "email", "name", "leadId"]) {
      expect(DIALER_CALL_METADATA_ALLOWLIST as readonly string[]).not.toContain(forbidden);
    }
  });

  it("uses the agreed 180 day retention window", () => {
    expect(DIALER_CALLS_RETENTION_DAYS).toBe(180);
  });
});
