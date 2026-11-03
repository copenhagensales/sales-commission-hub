import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { tilSessionDto } from "./enreach-hook-map.ts";

Deno.test("hook: PostJson-payload → SessionDto (samme felter som polling), data ignoreres", () => {
  const d = tilSessionDto({ uniqueId: "L1", campaignId: "CAMP1", closure: "Success", status: "UserProcessed", firstProcessedByUser: "a@cs.dk", firstProcessedTime: "2026-10-30T10:00:00Z", lastModifiedTime: "2026-10-30T10:05:00Z", data: { Telefon1: "123" } }, "tryg");
  assertEquals(d?.externalId, "L1"); assertEquals(d?.leadExternalId, "L1"); assertEquals(d?.campaignExternalId, "CAMP1"); assertEquals(d?.status, "success");
  assertEquals(d?.agentExternalId, "a@cs.dk"); assertEquals(d?.sessionSeconds, 300); assertEquals(d?.startTime, "2026-10-30T10:00:00.000Z"); assertEquals(d?.metadata, { closure: "Success", via: "hook" });
  assertEquals(JSON.stringify(d).includes("123"), false);
});
Deno.test("hook: bruger som objekt, kampagne som objekt, tom closure → unknown; uden uniqueId → null", () => {
  const d = tilSessionDto({ UniqueId: "L2", campaign: { uniqueId: "CAMP2", code: "Tryg Bil" }, closure: "", firstProcessedByUser: { orgCode: "T123", name: "X" } }, "alka");
  assertEquals(d?.campaignExternalId, "CAMP2"); assertEquals(d?.agentExternalId, "T123"); assertEquals(d?.status, "unknown"); assertEquals(d?.metadata?.campaignName, "Tryg Bil");
  assertEquals(tilSessionDto({ closure: "Success" }, "tryg"), null); assertEquals(tilSessionDto("x", "tryg"), null);
});
Deno.test("hook: ugyldige felter kasseres (tid, id-tegn, closure med injektion) og registreres; uniqueId med ulovlige tegn → null", () => {
  const v = { ok: true, kasseret: [] as string[] };
  const d = tilSessionDto({ uniqueId: "L3", campaignId: "CAMP3", closure: "Success'; drop table x; --", firstProcessedByUser: "a@cs.dk", firstProcessedTime: "ikke-en-tid", lastModifiedTime: "2026-10-30T10:05:00Z" }, "tryg", v);
  assertEquals(d?.status, "unknown"); assertEquals(d?.startTime, undefined); assertEquals(d?.endTime, "2026-10-30T10:05:00.000Z"); assertEquals(d?.sessionSeconds, undefined);
  assertEquals(v.kasseret, ["closure", "firstProcessedTime"]);
  assertEquals(tilSessionDto({ uniqueId: "L4 <script>", closure: "Success" }, "tryg"), null);
});
