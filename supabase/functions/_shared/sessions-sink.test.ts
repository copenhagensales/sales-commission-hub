import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { delMedRegel, delTilladte, findAgent, kampagneRaekker, type SessionDto } from "./sessions-sink.ts";
import { domaeneOk, tilBrugere } from "./enreach-alias.ts";

const s = (p: Partial<SessionDto>): SessionDto => ({ externalId: "x", integrationType: "enreach", dialerName: "t", status: "success", ...p });

Deno.test("port: kun kampagner med regel; uden kampagne frasorteres", () => {
  const r = delMedRegel([s({ externalId: "1", campaignExternalId: "CAMP1" }), s({ externalId: "2", campaignExternalId: "CAMP2" }), s({ externalId: "3" })], new Set(["CAMP1"]));
  assertEquals(r.med.map((x) => x.externalId), ["1"]); assertEquals(r.uden, 2);
});
Deno.test("kun egne: tilladte bruger-id'er uanset store/små bogstaver; uden bruger-id frasorteres", () => {
  const r = delTilladte([s({ externalId: "1", agentExternalId: "Ab@CopenhagenSales.dk" }), s({ externalId: "2", agentExternalId: "t123" }), s({ externalId: "3" })], new Set(["ab@copenhagensales.dk"]));
  assertEquals(r.med.map((x) => x.externalId), ["1"]); assertEquals(r.uden, 2);
});
Deno.test("kampagneregistrering: én række pr. kampagne, navn fra metadata, id som navn hvis intet", () => {
  const r = kampagneRaekker([s({ campaignExternalId: "CAMP1", metadata: { campaignName: "Tryg Bil" } }), s({ campaignExternalId: "CAMP1" }), s({ campaignExternalId: "CAMP2" }), s({})]);
  assertEquals(r, [{ adversus_campaign_id: "CAMP1", adversus_campaign_name: "Tryg Bil", client_campaign_id: null }, { adversus_campaign_id: "CAMP2", adversus_campaign_name: "CAMP2", client_campaign_id: null }]);
});
Deno.test("sælger: alias før agents; e-mail matcher uanset bogstaver; ukendt → null", () => {
  const alias = new Map([["t123", "A1"]]), ext = new Map([["900", "A2"]]), dialer = new Map([["x@y.dk", "A3"]]), email = new Map([["z@y.dk", "A4"]]);
  assertEquals(findAgent("T123", alias, ext, dialer, email), "A1");
  assertEquals(findAgent("900", alias, ext, dialer, email), "A2");
  assertEquals(findAgent("x@y.dk", alias, ext, dialer, email), "A3");
  assertEquals(findAgent("Z@Y.dk", alias, ext, dialer, email), "A4");
  assertEquals(findAgent("ukendt", alias, ext, dialer, email), null);
  assertEquals(findAgent(undefined, alias, ext, dialer, email), null);
});
Deno.test("entydighed: e-mail/id delt af to agenter kobles ikke på den nye vej (ingen gæt)", () => {
  const par: [string, string][] = [["x@y.dk", "A1"], ["x@y.dk", "A2"], ["z@y.dk", "A3"]];
  const n = new Map<string, number>(); for (const [k] of par) n.set(k, (n.get(k) ?? 0) + 1);
  const entydig = new Map(par.filter(([k]) => n.get(k) === 1));
  assertEquals(findAgent("x@y.dk", new Map(), new Map(), new Map(), entydig), null);
  assertEquals(findAgent("z@y.dk", new Map(), new Map(), new Map(), entydig), "A3");
});
Deno.test("brugere: /users normaliseres (orgCode, e-mail i små bogstaver, navn), rækker uden orgCode udelades", () => {
  const b = tilBrugere([{ orgCode: "T1", email: "A@Tryg.dk", name: "A" }, { OrgCode: "x@cs.dk", Email: "", username: "x" }, { email: "ingen@org.dk" }]);
  assertEquals(b, [{ orgCode: "T1", email: "a@tryg.dk", navn: "A" }, { orgCode: "x@cs.dk", email: null, navn: "x" }]);
});
Deno.test("domæne: eget/fremmed/ingen e-mail", () => {
  assertEquals(domaeneOk("a@copenhagensales.dk", ["copenhagensales.dk"]), true);
  assertEquals(domaeneOk("a@tryg.dk", ["copenhagensales.dk"]), false);
  assertEquals(domaeneOk(null, ["copenhagensales.dk"]), null);
});
