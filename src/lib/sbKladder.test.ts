import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { onAuthStateChange: vi.fn() } } }));

type Mod = typeof import("./sbKladder");
const ny = async (): Promise<Mod> => { vi.resetModules(); return import("./sbKladder"); };
const afs = (id: string, tekst: string) => ({
  id, tekst, svarId: "svar-1", fil: null, tilstand: "sender" as const, fejl: null, tidligereUkendt: false, oprettet: 1,
});

beforeEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

describe("T1 – holdbar afsendelses- og kladdetilstand (§1)", () => {
  it("to pending afsendelser plus ny skrivekladde bevares særskilt", async () => {
    const m = await ny();
    m.tilfoejAfsendelse("e", "A", afs("1", "første"));
    m.tilfoejAfsendelse("e", "A", afs("2", "anden"));
    m.gemKladde("e", "A", { tekst: "ny tekst", svarId: null });
    expect(m.hentAfsendelser("e", "A").map((a) => a.id)).toEqual(["1", "2"]);
    expect(m.laesKladde("e", "A")?.tekst).toBe("ny tekst");
  });

  it("A–B–A uden reload: afsendelser for A overlever, B er adskilt", async () => {
    const m = await ny();
    m.tilfoejAfsendelse("e", "A", afs("1", "a"));
    expect(m.hentAfsendelser("e", "B")).toEqual([]);
    expect(m.hentAfsendelser("e", "A").map((a) => a.id)).toEqual(["1"]);
  });

  it("reload under afsendelse: genoptages som afstemning af samme id, File er væk", async () => {
    let m = await ny();
    const f = new File(["x"], "x.png", { type: "image/png" });
    m.tilfoejAfsendelse("e", "A", { ...afs("1", "a"), fil: { name: "x.png", type: "image/png", size: 1, sti: "s", trin: "uploadet" } }, f);
    expect(m.afsendelsesFil("e", "A", "1")).toBe(f);
    m = await ny();
    const [a] = m.hentAfsendelser("e", "A");
    expect(a).toMatchObject({ id: "1", tekst: "a", svarId: "svar-1", tilstand: "afstemmer", tidligereUkendt: true });
    expect(a.fil?.sti).toBe("s");
    expect(m.afsendelsesFil("e", "A", "1")).toBeNull();
  });

  it("kendt afvist post genindsendes ikke automatisk efter reload", async () => {
    let m = await ny();
    m.tilfoejAfsendelse("e", "A", { ...afs("1", "a"), tilstand: "afvist", fejl: "CPR" });
    m = await ny();
    expect(m.hentAfsendelser("e", "A")[0]).toMatchObject({ tilstand: "afvist", fejl: "CPR" });
  });

  it("sen succes for A rydder kun A – ikke pending B eller ny tekst", async () => {
    const m = await ny();
    m.tilfoejAfsendelse("e", "A", afs("1", "a"));
    m.tilfoejAfsendelse("e", "A", afs("2", "b"));
    m.gemKladde("e", "A", { tekst: "nyere", svarId: null });
    m.fjernAfsendelse("e", "A", "1");
    expect(m.hentAfsendelser("e", "A").map((a) => a.id)).toEqual(["2"]);
    expect(m.laesKladde("e", "A")?.tekst).toBe("nyere");
  });

  it("lagringsfejl: kladden bevares i hukommelsen og fejlen meldes", async () => {
    const m = await ny();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    m.tilfoejAfsendelse("e", "A", afs("1", "a"));
    expect(m.harLagringsFejl("e", "A")).toBe(true);
    expect(m.hentAfsendelser("e", "A").map((a) => a.id)).toEqual(["1"]);
    expect(m.gemKladde("e", "A", { tekst: "x", svarId: null })).toBe(false);
  });

  it("åben redigeringskladde bevares med revision", async () => {
    const m = await ny();
    m.gemRetKladde("e", "A", { beskedId: "m1", tekst: "rettet", revision: 3 });
    expect((await ny()).laesRetKladde("e", "A", "m1")).toEqual({ beskedId: "m1", tekst: "rettet", revision: 3 });
  });

  it("gemmer aldrig filbytes, blob-URL eller token", async () => {
    const m = await ny();
    const f = new File(["HEMMELIG-BYTES"], "x.txt", { type: "text/plain" });
    m.tilfoejAfsendelse("e", "A", { ...afs("1", "a"), fil: { name: "x.txt", type: "text/plain", size: 14, sti: "s", trin: "uploadet" } }, f);
    m.gemKladde("e", "A", { tekst: "t", svarId: null, fil: { name: "x.txt", type: "text/plain", size: 14, sti: null, trin: "valgt" } });
    const alt = Object.keys(sessionStorage).map((k) => sessionStorage.getItem(k)).join("");
    expect(alt).not.toContain("HEMMELIG-BYTES");
    expect(alt).not.toContain("blob:");
    expect(alt).not.toContain("token");
  });

  it("brugerskift/logud: generationen øges og gamle forløb kan ikke skrive", async () => {
    const m = await ny();
    m.tilfoejAfsendelse("e", "A", afs("1", "a"));
    const gen = m.sessionsGeneration();
    m.rydAlleKladder();
    m.tilfoejAfsendelse("e", "A", afs("2", "b"));
    m.opdaterAfsendelse("e", "A", "2", { tilstand: "afvist" }, gen);
    m.fjernAfsendelse("e", "A", "2", gen);
    expect(m.hentAfsendelser("e", "A")).toMatchObject([{ id: "2", tilstand: "sender" }]);
    expect(m.hentAfsendelser("e", "A").some((a) => a.id === "1")).toBe(false);
  });
});

describe("§6 – hukommelseslager for skrive- og redigeringskladder (B2a-b1)", () => {
  const fil = { name: "x.png", type: "image/png", size: 3, sti: "c/e/x.png", trin: "uploadet" as const };
  const fejlSet = () => vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });

  it("setItem fejler → A–B–A bevarer tekst, svar og fil-metadata samt åben redigering", async () => {
    const m = await ny();
    fejlSet();
    expect(m.gemKladde("e", "A", { tekst: "til A", svarId: "s1", fil })).toBe(false);
    m.gemRetKladde("e", "A", { beskedId: "m1", tekst: "rettet", revision: 4 });
    m.gemKladde("e", "B", { tekst: "til B", svarId: null });
    expect(m.laesKladde("e", "A")).toEqual({ tekst: "til A", svarId: "s1", fil, retId: null });
    expect(m.laesRetKladde("e", "A", "m1")).toEqual({ beskedId: "m1", tekst: "rettet", revision: 4 });
    expect(m.laesKladde("e", "B")?.tekst).toBe("til B");
  });

  it("gammel lagret værdi → fejlet ny skrivning → vellykket læsning giver den NYE tekst", async () => {
    let m = await ny();
    m.gemKladde("e", "A", { tekst: "gammel", svarId: null });
    m.gemRetKladde("e", "A", { beskedId: "m1", tekst: "gammel ret", revision: 1 });
    m = await ny(); // ny session-hukommelse; lageret har de gamle værdier
    const spy = fejlSet();
    m.gemKladde("e", "A", { tekst: "ny", svarId: null });
    m.gemRetKladde("e", "A", { beskedId: "m1", tekst: "ny ret", revision: 2 });
    spy.mockRestore();
    expect(sessionStorage.getItem("sb-kladde:e:A")).toContain("gammel"); // lageret læses fint, men er forældet
    expect(m.laesKladde("e", "A")?.tekst).toBe("ny");
    expect(m.laesRetKladde("e", "A", "m1")).toMatchObject({ tekst: "ny ret", revision: 2 });
  });

  it("fejlet sletning efter Send/annulleret redigering genopliver ikke gammel tekst", async () => {
    const m = await ny();
    m.gemKladde("e", "A", { tekst: "sendt", svarId: null });
    m.gemRetKladde("e", "A", { beskedId: "m1", tekst: "annulleret", revision: 1 });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("låst"); });
    m.sletKladde("e", "A");
    m.sletRetKladde("e", "A", "m1");
    expect(sessionStorage.getItem("sb-kladde:e:A")).toContain("sendt");
    expect(m.laesKladde("e", "A")).toBeNull();
    expect(m.laesRetKladde("e", "A", "m1")).toBeNull();
  });

  it("lageret bliver tilgængeligt igen → fejlstatus ryddes og værdien gemmes", async () => {
    const m = await ny();
    const spy = fejlSet();
    m.gemKladde("e", "A", { tekst: "a", svarId: null });
    m.gemRetKladde("e", "A", { beskedId: "m1", tekst: "r", revision: 1 });
    expect(m.harKladdeLagerFejl("e", "A")).toBe(true);
    expect(m.harRetLagerFejl("e", "A", "m1")).toBe(true);
    spy.mockRestore();
    expect(m.gemKladde("e", "A", { tekst: "ab", svarId: null })).toBe(true);
    expect(m.gemRetKladde("e", "A", { beskedId: "m1", tekst: "rr", revision: 1 })).toBe(true);
    expect(m.harKladdeLagerFejl("e", "A")).toBe(false);
    expect(m.harRetLagerFejl("e", "A", "m1")).toBe(false);
    expect(sessionStorage.getItem("sb-kladde:e:A")).toContain("ab");
  });

  it("fejl på én kladde skjules ikke af vellykket lagring af en anden (begge kladdetyper)", async () => {
    const m = await ny();
    const spy = fejlSet();
    m.gemKladde("e", "A", { tekst: "a", svarId: null });
    m.gemRetKladde("e", "A", { beskedId: "m1", tekst: "r", revision: 1 });
    spy.mockRestore();
    m.gemKladde("e", "B", { tekst: "b", svarId: null });
    m.gemRetKladde("e", "A", { beskedId: "m2", tekst: "r2", revision: 1 });
    expect(m.harKladdeLagerFejl("e", "A")).toBe(true);
    expect(m.harKladdeLagerFejl("e", "B")).toBe(false);
    expect(m.harRetLagerFejl("e", "A", "m1")).toBe(true);
    expect(m.harRetLagerFejl("e", "A", "m2")).toBe(false);
  });

  it("brugerskift rydder hukommelse og lager; ryddede værdier genindlæses ikke selv ved fejlet removeItem", async () => {
    const m = await ny();
    m.gemKladde("e", "A", { tekst: "gammel bruger", svarId: null });
    m.gemRetKladde("e", "A", { beskedId: "m1", tekst: "gammel ret", revision: 1 });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("låst"); });
    m.rydAlleKladder();
    expect(m.laesKladde("e", "A")).toBeNull();
    expect(m.laesRetKladde("e", "A", "m1")).toBeNull();
    expect(m.harKladdeLagerFejl("e", "A")).toBe(false);
  });
});

describe("§3 – kladdefilens uploadforløb ejes af lageret (B2a-b3)", () => {
  const meta = { name: "x.txt", type: "text/plain", size: 1 };
  it("nyt forsøg (også samme File) invaliderer det gamle; kun ejende forsøg opdaterer", async () => {
    const m = await ny();
    const f = new File(["x"], "x.txt");
    const ea = m.fastholdEjer("e", "A", "u")!, eb = m.fastholdEjer("e", "A", "u")!;
    const a = m.startKladdeUpload(ea, f, meta)!;
    const b = m.startKladdeUpload(eb, f, meta)!;
    expect(m.opdaterKladdeUpload(ea, a, { sti: "gammel", trin: "uploadet" })).toBe(false);
    expect(m.opdaterKladdeUpload(eb, b, { sti: "ny", trin: "uploadet", aktiv: false })).toBe(true);
    expect(m.kladdeFilTilstand("e", "A")).toMatchObject({ meta: { sti: "ny", trin: "uploadet" }, aktiv: false, file: f });
  });
  it("fjernelse invaliderer forsøget og genskaber ikke filen; tekst bevares", async () => {
    const m = await ny();
    m.gemKladde("e", "A", { tekst: "behold", svarId: "s" });
    const ea = m.fastholdEjer("e", "A", "u")!;
    const a = m.startKladdeUpload(ea, new File(["x"], "x.txt"), meta)!;
    m.fjernKladdeFil("e", "A");
    expect(m.opdaterKladdeUpload(ea, a, { trin: "uploadet" })).toBe(false);
    expect(m.kladdeFilTilstand("e", "A")).toBeNull();
    expect(m.laesKladde("e", "A")).toMatchObject({ tekst: "behold", svarId: "s", fil: null });
  });
  it("efter reload: ingen levende forløb, ingen File; snapshot er stabil", async () => {
    let m = await ny();
    m.startKladdeUpload(m.fastholdEjer("e", "A", "u")!, new File(["x"], "x.txt"), meta);
    m = await ny();
    const t = m.kladdeFilTilstand("e", "A");
    expect(t).toMatchObject({ aktiv: false, file: null, meta: { trin: "valgt" } });
    expect(m.kladdeFilTilstand("e", "A")).toBe(t);
  });
  it("filErSendeklar kræver trin=uploadet og ikke-tom sti", async () => {
    const m = await ny();
    expect(m.filErSendeklar({ ...meta, sti: "s", trin: "uploadet" })).toBe(true);
    expect(m.filErSendeklar({ ...meta, sti: "", trin: "uploadet" })).toBe(false);
    expect(m.filErSendeklar({ ...meta, sti: "s", trin: "uploader" })).toBe(false);
    expect(m.filErSendeklar(null)).toBe(true);
  });
});

describe("b1-hensyn (i): auth-bruger i operationsejeren (B2a-b4)", () => {
  it("ejer med anden auth-bruger end den aktive er ugyldig; samme bruger er gyldig", async () => {
    const m = await ny();
    const { supabase } = await import("@/integrations/supabase/client");
    m.registrerKladdeOprydning();
    const cb = vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0] as (e: string, s: unknown) => void;
    cb("SIGNED_IN", { user: { id: "u1" } });
    const egen = m.fastholdEjer("e", "A")!;
    expect(egen.bruger).toBe("u1");
    // c1 §1: en eksplicit anden bruger end den aktive giver ingen kontekst.
    expect(m.fastholdEjer("e", "A", "u2")).toBeNull();
    expect(egen.op).toBeTruthy();
    expect(m.ejerGyldig(egen)).toBe(true);
    expect(m.ejerGyldig({ ...egen, bruger: "u2" })).toBe(false);
    expect(m.fastholdEjer("e", "A")!.op).not.toBe(egen.op);
  });
});

describe("c1 §1/§2: fuld kontekst, uploadejerskab og redigeringsversion", () => {
  it("uploadforsøget ejes af sin operation: anden operation med samme forsøgs-id kan ikke opdatere", async () => {
    const m = await ny();
    const ejer = m.fastholdEjer("e", "A", "u")!;
    const id = m.startKladdeUpload(ejer, new File(["x"], "x.txt"), { name: "x.txt", type: "text/plain", size: 1 })!;
    expect(id).not.toBe(ejer.op);
    const fremmed = { ...ejer, op: m.nytOperationsId() };
    expect(m.erAktuelKladdeUpload(fremmed, id)).toBe(false);
    expect(m.opdaterKladdeUpload(fremmed, id, { trin: "uploadet" })).toBe(false);
    expect(m.erAktuelKladdeUpload(ejer, id)).toBe(true);
  });
  it("forældet kontekst kan ikke starte et uploadforsøg", async () => {
    const m = await ny();
    const ejer = m.fastholdEjer("e", "A", "u")!;
    m.rydAlleKladder();
    expect(m.startKladdeUpload(ejer, new File(["x"], "x.txt"), { name: "x.txt", type: "text/plain", size: 1 })).toBeNull();
  });
  it("TOKEN_REFRESHED for samme bruger bevarer kladder og kontekst; logud/genlogin som samme bruger invaliderer", async () => {
    const m = await ny();
    const { supabase } = await import("@/integrations/supabase/client");
    m.registrerKladdeOprydning();
    const cb = vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0] as (e: string, s: unknown) => void;
    cb("SIGNED_IN", { user: { id: "u1" } });
    m.gemKladde("e", "A", { tekst: "t", svarId: null });
    const ejer = m.fastholdEjer("e", "A")!;
    cb("TOKEN_REFRESHED", { user: { id: "u1" } });
    expect(m.laesKladde("e", "A")?.tekst).toBe("t");
    expect(m.ejerGyldig(ejer)).toBe(true);
    cb("SIGNED_OUT", null);
    cb("SIGNED_IN", { user: { id: "u1" } });
    expect(m.ejerGyldig(ejer)).toBe(false);
    expect(m.laesKladde("e", "A")).toBeNull();
  });
  it("redigeringskladde: sen sletning rydder kun den oprindelige version og generation", async () => {
    const m = await ny();
    m.gemRetKladde("e", "A", { beskedId: "m", tekst: "v1", revision: 1 });
    const v1 = m.retKladdeVersion("e", "A", "m"), g = m.sessionsGeneration();
    m.gemRetKladde("e", "A", { beskedId: "m", tekst: "v2", revision: 1 });
    expect(m.sletRetKladdeHvis("e", "A", "m", v1, g)).toBe(false);
    expect(m.laesRetKladde("e", "A", "m")?.tekst).toBe("v2");
    const v2 = m.retKladdeVersion("e", "A", "m");
    m.rydAlleKladder();
    m.gemRetKladde("e", "A", { beskedId: "m", tekst: "ny session", revision: 1 });
    expect(m.sletRetKladdeHvis("e", "A", "m", v2, g)).toBe(false);
    expect(m.laesRetKladde("e", "A", "m")?.tekst).toBe("ny session");
    expect(m.sletRetKladdeHvis("e", "A", "m", m.retKladdeVersion("e", "A", "m"), m.sessionsGeneration())).toBe(true);
    expect(m.laesRetKladde("e", "A", "m")).toBeNull();
  });
});

describe("c2 §4 – rydning tåler fejl på selve sessionStorage-getteren", () => {
  const lagerEgenskab = Object.getOwnPropertyDescriptor(window, "sessionStorage")!;
  const ægte = window.sessionStorage;
  const getterKaster = () => Object.defineProperty(window, "sessionStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
  const genetabler = () => Object.defineProperty(window, "sessionStorage", lagerEgenskab);
  const gamle = (m: Mod) => {
    m.gemKladde("e", "A", { tekst: "gammel tekst", svarId: "s1" });
    m.gemRetKladde("e", "A", { beskedId: "m1", tekst: "gammel ret", revision: 1 });
    m.tilfoejAfsendelse("e", "A", afs("p1", "gammel pending"));
    expect(ægte.getItem("sb-kladde:e:A")).not.toBeNull();
  };
  const ingenGamle = (m: Mod) => {
    expect(m.laesKladde("e", "A")).toBeNull();
    expect(m.laesRetKladde("e", "A", "m1")).toBeNull();
    expect(m.hentAfsendelser("e", "A")).toEqual([]);
  };

  it("getter kaster under rydning → adgang genetableres → ingen gammel værdi genindlæses", async () => {
    const m = await ny();
    gamle(m);
    getterKaster();
    try { m.rydAlleKladder(); } finally { genetabler(); }
    ingenGamle(m);
    // Gamle nøgler er nu fjernet fra det genetablerede lager.
    expect(ægte.getItem("sb-kladde:e:A")).toBeNull();
    expect(ægte.getItem("sb-kladde:e:A:afs")).toBeNull();
  });

  it("gentagne mislykkede rydninger bevarer beskyttelsen", async () => {
    const m = await ny();
    gamle(m);
    getterKaster();
    try { m.rydAlleKladder(); m.rydAlleKladder(); } finally { genetabler(); }
    getterKaster();
    try { m.rydAlleKladder(); } finally { genetabler(); }
    ingenGamle(m);
  });

  it("nye kladder i ny generation virker under og efter utilgængeligt lager; gamle forbliver væk", async () => {
    const m = await ny();
    gamle(m);
    getterKaster();
    try {
      m.rydAlleKladder();
      m.gemKladde("e", "A", { tekst: "ny tekst", svarId: null });
      expect(m.laesKladde("e", "A")?.tekst).toBe("ny tekst");
      expect(m.harKladdeLagerFejl("e", "A")).toBe(true);
    } finally { genetabler(); }
    expect(m.laesKladde("e", "A")?.tekst).toBe("ny tekst");
    expect(m.laesRetKladde("e", "A", "m1")).toBeNull();
    expect(m.hentAfsendelser("e", "A")).toEqual([]);
  });

  it("removeItem-fejl ved senere oprydning efterlader tombstone; spærring ophæves ikke for tidligt", async () => {
    const m = await ny();
    gamle(m);
    getterKaster();
    try { m.rydAlleKladder(); } finally { genetabler(); }
    const rm = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("nej"); });
    ingenGamle(m);
    rm.mockRestore();
    ingenGamle(m);
  });

  it("vellykket skrivning til én kladde skjuler ikke en anden kladdes fejl", async () => {
    const m = await ny();
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new Error("fuld"); });
    m.gemKladde("e", "A", { tekst: "a", svarId: null });
    set.mockRestore();
    m.gemKladde("e", "B", { tekst: "b", svarId: null });
    expect(m.harKladdeLagerFejl("e", "A")).toBe(true);
    expect(m.harKladdeLagerFejl("e", "B")).toBe(false);
  });
});

describe("B2a-d1 §2 – annullerOperation", () => {
  it("ugyldiggør kun den annullerede operation; andre operationer i samme session forbliver gyldige", async () => {
    // B2c-2a: årsag til ustabilitet – den cachede sbKladder kunne være registreret mod en ældre (resetModules) mock-instans
    // af klienten, så denne instans havde ingen kald. Friske moduler for både sbKladder og klienten giver ét sikkert kald.
    const m = await ny();
    const { supabase } = await import("@/integrations/supabase/client");
    m.registrerKladdeOprydning(); // fast udgangspunkt uafhængigt af rækkefølge: aktiv auth-bruger via rigtig callback
    expect(vi.mocked(supabase.auth.onAuthStateChange).mock.calls.length).toBeGreaterThan(0);
    (vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0] as (e: string, s: unknown) => void)("SIGNED_IN", { user: { id: "u" } });
    const a = m.fastholdEjer("e", "A", "u"), b = m.fastholdEjer("e", "A", "u");
    expect(m.ejerGyldig(a) && m.ejerGyldig(b)).toBe(true);
    m.annullerOperation(a!.op);
    expect(m.ejerGyldig(a)).toBe(false);
    expect(m.ejerGyldig(b)).toBe(true);
  });
});

describe("T12 – rydning efter bekræftet sletning/forladelse (§12)", () => {
  it("rydder kun (bruger, samtale): kladde, ret-kladder, pending, File, uploadforløb; andre poster bevares", async () => {
    const m = await ny();
    const f = new File(["x"], "x.png", { type: "image/png" });
    m.gemKladde("e", "A", { tekst: "kladde A", svarId: null });
    m.gemRetKladde("e", "A", { beskedId: "b1", tekst: "ret", revision: 1 });
    m.tilfoejAfsendelse("e", "A", afs("1", "a"), f);
    m.saetKladdeFil("e", "A", f);
    m.gemKladde("e", "AB", { tekst: "nabo med fælles præfiks", svarId: null });
    m.gemKladde("e", "B", { tekst: "kladde B", svarId: null });
    m.gemKladde("x", "A", { tekst: "anden bruger", svarId: null });
    m.rydSamtale("e", "A");
    expect(m.laesKladde("e", "A")).toBeNull();
    expect(m.laesRetKladde("e", "A", "b1")).toBeNull();
    expect(m.hentAfsendelser("e", "A")).toEqual([]);
    expect(m.afsendelsesFil("e", "A", "1")).toBeNull();
    expect(m.kladdeFil("e", "A")).toBeNull();
    expect(Object.keys(sessionStorage).filter((k) => k.startsWith("sb-kladde:e:A:") || k === "sb-kladde:e:A")).toEqual([]);
    expect(m.laesKladde("e", "AB")?.tekst).toBe("nabo med fælles præfiks");
    expect(m.laesKladde("e", "B")?.tekst).toBe("kladde B");
    expect(m.laesKladde("x", "A")?.tekst).toBe("anden bruger");
  });

  it("sene callbacks genskaber intet: gemKladde/gemRetKladde/tilfoejAfsendelse/opdaterAfsendelse/upload efter rydning", async () => {
    const m = await ny();
    m.registrerKladdeOprydning();
    const ejer = m.fastholdEjer("e", "A", "u")!;
    const f = new File(["x"], "x.png", { type: "image/png" });
    const forsoeg = m.startKladdeUpload(ejer, f, { name: "x.png", type: "image/png", size: 1 })!;
    m.tilfoejAfsendelse("e", "A", afs("1", "a"));
    m.rydSamtale("e", "A");
    m.gemKladde("e", "A", { tekst: "sen autogem", svarId: null });
    m.gemRetKladde("e", "A", { beskedId: "b1", tekst: "sen", revision: 2 });
    m.tilfoejAfsendelse("e", "A", afs("2", "sen"));
    m.opdaterAfsendelse("e", "A", "1", { tilstand: "afvist" });
    expect(m.opdaterKladdeUpload(ejer, forsoeg, { trin: "uploadet", sti: "s" })).toBe(false);
    expect(m.laesKladde("e", "A")).toBeNull();
    expect(m.laesRetKladde("e", "A", "b1")).toBeNull();
    expect(m.hentAfsendelser("e", "A")).toEqual([]);
    expect(Object.keys(sessionStorage).filter((k) => k.startsWith("sb-kladde:e:A"))).toEqual([]);
  });

  it("forkert generation (logud siden handlingens start) rydder intet; logud rydder alt og ophæver lukning", async () => {
    const m = await ny();
    const gen = m.sessionsGeneration();
    m.rydAlleKladder();
    m.gemKladde("e", "A", { tekst: "ny session", svarId: null });
    m.rydSamtale("e", "A", gen);
    expect(m.laesKladde("e", "A")?.tekst).toBe("ny session");
    m.rydSamtale("e", "A");
    m.rydAlleKladder();
    m.gemKladde("e", "A", { tekst: "efter logud", svarId: null });
    expect(m.laesKladde("e", "A")?.tekst).toBe("efter logud");
  });
});
