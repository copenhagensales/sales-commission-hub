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
