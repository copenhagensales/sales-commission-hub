import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { forberedLeads, hentKampagnefeltDefinitioner, hentLeadsFuldSide, hentLeadsV1, kampagnefelterI, mapLeadEntry, type LeadEntry } from "./adversus-leads.ts";
import { lavKatalog } from "./kald-felt-katalog.ts";

Deno.test("mapLeadEntry: kolonner, felter m:/r:, tider som ISO, null udelades", () => {
  const r = mapLeadEntry({
    id: 555, campaignId: 42, contactAttempts: "3", lastModifiedTime: "2026-10-30T08:12:03Z", nextContactTime: null, importedTime: "2026-10-01T06:00:00Z",
    lastContactedBy: 17, status: "notInterested", active: true, externalId: 9001, importId: 7,
    masterData: [{ id: 1, value: "+45 86 3000 86" }, { id: 2, value: null }, { id: "x", value: "ugyldigt id" }],
    resultData: [{ id: 5, value: "Option 2", name: "Valg" }],
  }, "int-1");
  assertEquals(r.external_id, "555"); assertEquals(r.campaign_external_id, "42"); assertEquals(r.contact_attempts, 3);
  assertEquals(r.last_modified, "2026-10-30T08:12:03.000Z"); assertEquals(r.next_contact, null); assertEquals(r.imported, "2026-10-01T06:00:00.000Z");
  assertEquals(r.last_contacted_by, "17"); assertEquals(r.status, "notInterested"); assertEquals(r.aktiv, true); assertEquals(r.ekstern_reference, "9001");
  assertEquals(r.felter, { importId: 7, "m:1": "+45 86 3000 86", "r:5": "Option 2" });
  assertEquals(mapLeadEntry({ id: 1, active: "false" }, "i").aktiv, false);
  assertEquals(mapLeadEntry({ id: 1 }, "i").aktiv, null);
  assertEquals(kampagnefelterI({ masterData: [{ id: 1 }], resultData: [{ id: 5, name: "Valg", type: "select" }] }), [{ art: "m", id: 1, navn: undefined, type: undefined }, { art: "r", id: 5, navn: "Valg", type: "select" }]);
});

function mockGet(sider: Record<number, unknown>, kald: string[] = []) {
  return (sti: string) => {
    kald.push(sti);
    const side = Number(new URL("https://x" + sti).searchParams.get("page") ?? "1");
    return Promise.resolve(sider[side] ?? { leads: [], meta: { pagination: { pageCount: 0, total: 0 } } });
  };
}

Deno.test("hentLeadsV1: alle sider, dedup, komplet, uden_for_vindue måles", async () => {
  const kald: string[] = [];
  const get = mockGet({
    1: { leads: [{ id: 1, lastModifiedTime: "2026-10-30T09:00:00Z" }, { id: 2, lastModifiedTime: "2026-10-01T09:00:00Z" }], meta: { pagination: { pageCount: 2, total: 3 } } },
    2: { leads: [{ id: 2 }, { id: 3, lastModifiedTime: "2026-10-30T09:30:00Z" }], meta: { pagination: { pageCount: 2, total: 3 } } },
  }, kald);
  const r = await hentLeadsV1(get, "2026-10-30T08:00:00Z", "2026-10-30T10:00:00Z");
  assertEquals(r.entries.map((e) => e.id), [1, 2, 3]); assertEquals(r.sider, 2); assertEquals(r.komplet, true); assertEquals(r.udenForVindue, 1);
  assertEquals(kald.length, 2);
  assertEquals(decodeURIComponent(kald[0]).includes('"lastUpdatedTime":{"$gt":"2026-10-30T08:00:00Z","$lt":"2026-10-30T10:00:00Z"}'), true);
  assertEquals(kald[0].includes("pageSize=1000&page=1&includeMeta=true"), true);
});

Deno.test("hentLeadsV1: tomt vindue er komplet; manglende pageCount på side med emner kaster; stop() giver ikke-komplet", async () => {
  const tom = await hentLeadsV1(mockGet({ 1: { leads: [] } }), "a", "b");
  assertEquals(tom.komplet, true); assertEquals(tom.entries.length, 0);
  await assertRejects(() => hentLeadsV1(mockGet({ 1: { leads: [{ id: 1 }] } }), "a", "b"));
  const stoppet = await hentLeadsV1(mockGet({ 1: { leads: [{ id: 1 }], meta: { pagination: { pageCount: 3, total: 3 } } } }), "a", "b", { stop: () => true });
  assertEquals(stoppet.komplet, false);
});

Deno.test("hentKampagnefeltDefinitioner: liste eller {fields}", async () => {
  const a = await hentKampagnefeltDefinitioner(() => Promise.resolve([{ id: 3, name: "Firma", type: "string" }]));
  assertEquals(a.get(3), { name: "Firma", type: "string" });
  const b = await hentKampagnefeltDefinitioner(() => Promise.resolve({ fields: [{ id: 4 }] }));
  assertEquals(b.get(4), { name: "Kampagnefelt 4", type: "string" });
});

Deno.test("forberedLeads: ukendte kampagnefelter oprettes (navne fra /campaign-fields én gang), fravalgte felter kasseres, felter aldrig null", async () => {
  const kat = lavKatalog([
    { kilde: "adversus", endpoint: "/leads", felt_sti: "id", maal_tabel: "dialer_leads", maal_kolonne: "external_id", hentes: true, status: "aktiv" },
    { kilde: "adversus", endpoint: "/leads", felt_sti: "status", maal_tabel: "dialer_leads", maal_kolonne: "status", hentes: true, status: "aktiv" },
    { kilde: "adversus", endpoint: "/leads", felt_sti: "importId", maal_tabel: "dialer_leads", metadata_noegle: "importId", hentes: true, status: "aktiv" },
    { kilde: "adversus", endpoint: "/leads", felt_sti: "masterData.1", kampagne_ekstern_id: "42", adversus_felt_id: 1, maal_tabel: "dialer_leads", metadata_noegle: "m:1", hentes: false, status: "inaktiv" },
  ], 2);
  const inserts: Record<string, unknown>[] = [];
  const svc = { from: (_t: string) => ({ insert: (r: Record<string, unknown>) => { inserts.push(r); return Promise.resolve({ error: null }); } }) };
  let defsKald = 0;
  const defs = () => { defsKald++; return Promise.resolve(new Map([[2, { name: "Telefon", type: "string" }]])); };
  const entries: LeadEntry[] = [
    { id: 10, campaignId: 42, status: "success", importId: 1, masterData: [{ id: 1, value: "Firma A" }, { id: 2, value: "+4511111111" }], resultData: [{ id: 5, value: "Ja", name: "Accept" }] },
    { id: 11, campaignId: 42, status: "new", masterData: [{ id: 2, value: "+4522222222" }] },
    { id: 12, campaignId: 43, status: "new", masterData: [{ id: 2, value: "+4533333333" }] },
    { campaignId: 43 },  // uden id → springes over
  ];
  const r = await forberedLeads(svc, kat, entries, "int-1", defs);
  assertEquals(defsKald, 1);
  assertEquals(r.nyeKatalogfelter, 3);  // m:2 (42), r:5 (42), m:2 (43)
  assertEquals(inserts.map((i) => `${i.kampagne_ekstern_id}:${i.metadata_noegle}:${i.felt_navn}`).sort(), ["42:m:2:Telefon", "42:r:5:Accept", "43:m:2:Telefon"]);
  assertEquals(r.raekker.length, 3);
  assertEquals(r.raekker[0].felter, { importId: 1, "m:2": "+4511111111", "r:5": "Ja" });  // m:1 fravalgt for kampagne 42
  assertEquals(r.raekker[0].katalog_version, 2);
  assertEquals(r.raekker[1].felter, { "m:2": "+4522222222" });
  assertEquals(r.raekker[2].felter, { "m:2": "+4533333333" });
  assertEquals(r.kasseredeNoegler, 1);
  const tomt = await forberedLeads(svc, kat, [{ id: 20, campaignId: 42 }], "int-1", defs);
  assertEquals(tomt.raekker[0].felter, {});
});

Deno.test("hentLeadsFuldSide: id-cursor, filter id > fraId, færdig når siden ikke er fuld, fejl hvis cursor står stille", async () => {
  const kald: string[] = [];
  const get = (sti: string) => { kald.push(sti); return Promise.resolve({ leads: [{ id: 11 }, { id: 12 }, { id: 15 }] }); };
  const s = await hentLeadsFuldSide(get, 10, 3);
  assertEquals(s.sidsteId, 15); assertEquals(s.faerdig, false); assertEquals(s.entries.length, 3);
  assertEquals(decodeURIComponent(kald[0]).includes('{"id":{"$gt":10}}'), true);
  assertEquals(kald[0].includes("sortProperty=id&sortDirection=asc&pageSize=3&page=1"), true);
  const s2 = await hentLeadsFuldSide(() => Promise.resolve({ leads: [{ id: 16 }] }), 15, 3);
  assertEquals(s2.faerdig, true); assertEquals(s2.sidsteId, 16);
  const s3 = await hentLeadsFuldSide(() => Promise.resolve({ leads: [] }), 16, 3);
  assertEquals(s3.faerdig, true); assertEquals(s3.sidsteId, 16);
  await assertRejects(() => hentLeadsFuldSide(() => Promise.resolve({ leads: [{ id: 5 }] }), 10, 3));
});
