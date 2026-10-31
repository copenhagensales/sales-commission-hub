import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { anvendKatalog, harKilde, lavKatalog, sikrKampagnefelter, tilladteNoegler } from "./kald-felt-katalog.ts";

const kat = () => lavKatalog([
  { kilde: "adversus", endpoint: "/calls", felt_sti: "disposition", maal_tabel: "dialer_calls", metadata_noegle: "disposition", hentes: true, status: "aktiv", klassifikation: "teknisk" },
  { kilde: "adversus", endpoint: "/calls", felt_sti: "number", maal_tabel: "dialer_calls", metadata_noegle: "number", hentes: false, status: "inaktiv", klassifikation: "identifikator" },
  { kilde: "adversus", endpoint: "/calls", felt_sti: "links.recording", hentes: false, status: "inaktiv" },
  { kilde: "adversus", endpoint: "/calls", felt_sti: "afledt:hasRecording", maal_tabel: "dialer_calls", metadata_noegle: "hasRecording", hentes: true, status: "aktiv", afledt_af: ["links.recording"] },
  { kilde: "adversus", endpoint: "/calls", felt_sti: "contactId", maal_tabel: "dialer_calls", maal_kolonne: "lead_external_id", hentes: false, status: "inaktiv", klassifikation: "identifikator" },
  { kilde: "adversus", endpoint: "/calls", felt_sti: "start", maal_tabel: "dialer_calls", maal_kolonne: "start_time", hentes: true, status: "aktiv" },
  { kilde: "adversus", endpoint: "/leads", felt_sti: "externalId", maal_tabel: "dialer_leads", maal_kolonne: "ekstern_reference", hentes: false, status: "inaktiv" },
  { kilde: "adversus", endpoint: "/leads", felt_sti: "status", maal_tabel: "dialer_leads", maal_kolonne: "status", hentes: true, status: "aktiv" },
  { kilde: "adversus", endpoint: "/leads", felt_sti: "importId", maal_tabel: "dialer_leads", metadata_noegle: "importId", hentes: true, status: "aktiv" },
  { kilde: "adversus", endpoint: "/leads", felt_sti: "masterData.17", kampagne_ekstern_id: "42", adversus_felt_id: 17, maal_tabel: "dialer_leads", metadata_noegle: "m:17", hentes: true, status: "aktiv" },
  { kilde: "adversus", endpoint: "/leads", felt_sti: "masterData.17", kampagne_ekstern_id: "43", adversus_felt_id: 17, maal_tabel: "dialer_leads", metadata_noegle: "m:17", hentes: false, status: "inaktiv" },
  { kilde: "adversus", endpoint: "/recordings", felt_sti: "cdr.id", maal_tabel: "samtale_optagelser", maal_kolonne: "kald_external_id", hentes: true, status: "forslag" },
], 2);

Deno.test("tilladteNoegler: hentes + aktiv; afledt følger afhængighed; forslag tæller ikke", () => {
  const k = kat();
  const n = tilladteNoegler(k, "dialer_calls", "adversus");
  assertEquals([...n].sort(), ["disposition"]);  // number fravalgt, hasRecording afhænger af fravalgt links.recording
  assertEquals(harKilde(k, "enreach"), false);
  assertEquals(harKilde(k, "adversus"), true);
});

Deno.test("tilladteNoegler pr. kampagne: kampagneløse + kampagnens egne rækker", () => {
  const k = kat();
  assertEquals([...tilladteNoegler(k, "dialer_leads", "adversus", "42")].sort(), ["importId", "m:17"]);
  assertEquals([...tilladteNoegler(k, "dialer_leads", "adversus", "43")].sort(), ["importId"]);
  assertEquals([...tilladteNoegler(k, "dialer_leads", "adversus", "99")].sort(), ["importId"]);
});

Deno.test("anvendKatalog: metadata filtreres, undefined droppes, tom → null, kernekolonne beholdes, katalog_version stemples", () => {
  const k = kat();
  const r = anvendKatalog(k, "dialer_calls", "adversus", {
    external_id: "1", lead_external_id: "L1", start_time: "2026-10-30T08:00:00Z", agent_id: "a", recording_url: null,
    metadata: { disposition: "answered", number: "+4512345678", hasRecording: true, ukendt: 1, tom: undefined },
  } as Record<string, unknown>);
  assertEquals(r.raekke.metadata, { disposition: "answered" });
  assertEquals(r.kasserede_noegler.sort(), ["hasRecording", "number", "ukendt"]);
  assertEquals(r.raekke.lead_external_id, "L1");  // kerne (NOT NULL) – ignoreres med markering
  assertEquals(r.kerne_ignoreret, ["lead_external_id"]);
  assertEquals(r.raekke.agent_id, "a");  // ukendt for kataloget → urørt
  assertEquals(r.raekke.katalog_version, 2);
  const tom = anvendKatalog(k, "dialer_calls", "adversus", { external_id: "2", metadata: { number: "x" } });
  assertEquals(tom.raekke.metadata, null);
});

Deno.test("anvendKatalog på emner: fravalgt kolonne nulles, kampagnefelter filtreres pr. kampagne", () => {
  const k = kat();
  const r = anvendKatalog(k, "dialer_leads", "adversus", { external_id: "5", status: "success", ekstern_reference: "K-1", felter: { importId: 9, "m:17": "Firma", "m:18": "x" } } as Record<string, unknown>, { metadataFelt: "felter", kampagne: "42" });
  assertEquals(r.raekke.ekstern_reference, null);
  assertEquals(r.nullede_kolonner, ["ekstern_reference"]);
  assertEquals(r.raekke.status, "success");
  assertEquals(r.raekke.felter, { importId: 9, "m:17": "Firma" });
  const r43 = anvendKatalog(k, "dialer_leads", "adversus", { external_id: "6", felter: { "m:17": "Firma" } }, { metadataFelt: "felter", kampagne: "43" });
  assertEquals(r43.raekke.felter, null);
});

function mockSvc(fejlPaa: string[] = []) {
  const inserts: Record<string, unknown>[] = [];
  const svc = {
    from(tabel: string) {
      return {
        insert(r: Record<string, unknown>) {
          if (tabel !== "kald_felt_katalog") throw new Error("forkert tabel");
          inserts.push(r);
          return Promise.resolve(fejlPaa.includes(String(r.felt_sti)) ? { error: { code: "23505", message: "dublet" } } : { error: null });
        },
      };
    },
  };
  return { svc, inserts };
}

Deno.test("sikrKampagnefelter: opretter kun ukendte, navngiver, ignorerer dubletter og udvider kataloget i hukommelsen", async () => {
  const k = kat();
  const { svc, inserts } = mockSvc(["resultData.5"]);
  const n = await sikrKampagnefelter(svc, k, "42", [
    { art: "m", id: 17 },                       // findes for kampagne 42
    { art: "m", id: 18, navn: "Telefon", type: "string" },
    { art: "r", id: 5 },                        // dublet i DB (23505) → ignoreres, men kendes bagefter
    { art: "r", id: 5 },                        // gentagelse i samme kald
  ]);
  assertEquals(n, 1);
  assertEquals(inserts.length, 2);
  assertEquals(inserts[0].felt_sti, "masterData.18"); assertEquals(inserts[0].felt_navn, "Telefon"); assertEquals(inserts[0].metadata_noegle, "m:18");
  assertEquals(inserts[0].klassifikation, "ukendt"); assertEquals(inserts[0].hentes, true); assertEquals(inserts[0].version, 2); assertEquals(inserts[0].kampagne_ekstern_id, "42");
  assertEquals(inserts[1].felt_navn, "Resultatfelt 5");
  assertEquals([...tilladteNoegler(k, "dialer_leads", "adversus", "42")].sort(), ["importId", "m:17", "m:18", "r:5"]);
  // andet kald: intet nyt
  assertEquals(await sikrKampagnefelter(svc, k, "42", [{ art: "m", id: 18 }]), 0);
});
