// Sælger-alias for Enreach/HeroBase (B1 krav 3): kontoens brugere (/users: orgCode, navn, e-mail) registreres i agent_ekstern_alias (kilde enreach, ekstern_id = orgCode i små bogstaver).
// Automatik: entydig e-mail → agent; e-mail uden for kontoens egne domæner → »ikke vores« (manuelle valg overskrives aldrig); resten står »uden kobling« til ejeren vælger i UI.
// Kører for ALLE Enreach-konti før sessions hentes (så dækningskontrollen kan køres før aktivering). Bruger ingen SECURITY DEFINER.
import type { LogFn } from "./sessions-sink.ts";

export interface HeroBaseBruger { orgCode: string; email: string | null; navn: string | null }
const lav = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim().toLowerCase());
const get1 = (o: Record<string, unknown>, keys: string[]): string => { for (const k of keys) { const v = o[k] ?? o[k.charAt(0).toUpperCase() + k.slice(1)]; if (v !== undefined && v !== null && String(v).trim()) return String(v).trim(); } return ""; };

/** Normaliserer HeroBase' /users-svar. */
export function tilBrugere(data: unknown): HeroBaseBruger[] {
  const arr = (Array.isArray(data) ? data : ((data as Record<string, unknown>)?.Results ?? (data as Record<string, unknown>)?.results ?? [])) as Record<string, unknown>[];
  const ud: HeroBaseBruger[] = [];
  for (const u of arr) { const org = get1(u, ["orgCode"]); if (!org) continue; const email = lav(get1(u, ["email"])); ud.push({ orgCode: org, email: email.includes("@") ? email : null, navn: get1(u, ["name", "username"]) || null }); }
  return ud;
}
/** [krav 11] e-mailens domæne i egne domæner? null = ingen e-mail. */
export function domaeneOk(email: string | null | undefined, egneDomaener: string[]): boolean | null {
  const e = lav(email); if (!e.includes("@")) return null;
  return egneDomaener.map((d) => d.toLowerCase()).includes(e.split("@")[1]);
}

export async function registrerEnreachBrugere(supabase: any, brugere: HeroBaseBruger[], kontoId: string, egneDomaener: string[], log: LogFn): Promise<{ nye: number; koblet: number; ikke_vores: number }> {
  const kilde = "enreach";
  // Ingen brugerliste (fx /users = 403 på ase) → trin 1–2 springes over; automatik (trin 3–4) kører stadig på rækker, kaldshentningen har registreret (e-mail = orgCode)
  const raekker = brugere.map((b) => ({ kilde, ekstern_id: lav(b.orgCode), konto_id: kontoId, navn: b.navn, email: b.email, oprindelse: "brugere" }));
  let nye: typeof raekker = [];
  if (raekker.length > 0) {
  // 1) Nye rækker (ignorerer eksisterende – manuelle valg røres ikke)
  const { data: findes } = await supabase.from("agent_ekstern_alias").select("ekstern_id").eq("kilde", kilde).in("ekstern_id", raekker.map((r) => r.ekstern_id).slice(0, 1000));
  const kendt = new Set(((findes ?? []) as { ekstern_id: string }[]).map((f) => f.ekstern_id));
  nye = raekker.filter((r) => !kendt.has(r.ekstern_id));
  if (nye.length > 0) { const { error } = await supabase.from("agent_ekstern_alias").upsert(nye, { onConflict: "kilde,ekstern_id", ignoreDuplicates: true }); if (error) log("WARN", `enreach-alias: ${nye.length} brugere kunne ikke registreres: ${error.message}`); }
  // 2) Eksisterende rækker uden konto/navn/e-mail (fx fra kaldshentningen eller salg) får kontoens oplysninger
  const { data: mangler } = await supabase.from("agent_ekstern_alias").select("ekstern_id, navn, email, konto_id").eq("kilde", kilde).or(`konto_id.is.null,email.is.null`).in("ekstern_id", raekker.map((r) => r.ekstern_id).slice(0, 1000));
  const pr = new Map(raekker.map((r) => [r.ekstern_id, r]));
  for (const m of (mangler ?? []) as { ekstern_id: string; navn: string | null; email: string | null; konto_id: string | null }[]) {
    const r = pr.get(m.ekstern_id); if (!r) continue;
    const aendring: Record<string, unknown> = {};
    if (!m.konto_id) aendring.konto_id = kontoId;
    if (!m.email && r.email) aendring.email = r.email;
    if (!m.navn && r.navn) aendring.navn = r.navn;
    if (Object.keys(aendring).length > 0) await supabase.from("agent_ekstern_alias").update({ ...aendring, aendret: new Date().toISOString() }).eq("kilde", kilde).eq("ekstern_id", m.ekstern_id);
  }
  }
  // 3) Automatik: entydig e-mail → agent; fremmed domæne → ikke vores (kun rækker uden kobling og uden manuelt valg)
  const { data: agents } = await supabase.from("agents").select("id, email").not("email", "is", null).limit(5000);
  const pe = new Map<string, string[]>(); for (const a of (agents ?? []) as { id: string; email: string }[]) { const e = lav(a.email); pe.set(e, [...(pe.get(e) ?? []), a.id]); }
  const { data: aabne } = await supabase.from("agent_ekstern_alias").select("ekstern_id, email, ikke_vores").eq("kilde", kilde).eq("konto_id", kontoId).is("agent_id", null).neq("oprindelse", "manuel").not("email", "is", null).limit(2000);
  let koblet = 0, ikkeVores = 0;
  for (const a of (aabne ?? []) as { ekstern_id: string; email: string; ikke_vores: boolean }[]) {
    const ids = pe.get(lav(a.email)) ?? [];
    // Automatisk kobling kun ved ENTYDIG e-mail i et af kontoens egne domæner (krav 3; Codex r1: undtagelser som gmail afventer manuelt valg)
    if (ids.length === 1 && domaeneOk(a.email, egneDomaener) === true) {
      const { error } = await supabase.from("agent_ekstern_alias").update({ agent_id: ids[0], ikke_vores: false, anvendt_tid: null, aendret: new Date().toISOString() }).eq("kilde", kilde).eq("ekstern_id", a.ekstern_id).is("agent_id", null).neq("oprindelse", "manuel");
      if (!error) koblet++;
    } else {
      const skal = domaeneOk(a.email, egneDomaener) === false;
      if (skal !== a.ikke_vores) { const { error } = await supabase.from("agent_ekstern_alias").update({ ikke_vores: skal, aendret: new Date().toISOString() }).eq("kilde", kilde).eq("ekstern_id", a.ekstern_id).is("agent_id", null).neq("oprindelse", "manuel"); if (!error && skal) ikkeVores++; }
    }
  }
  // 4) Koblinger anvendes på sessions/kald uden sælger ved HVER kørsel (ét hash-join; funktionen rammer kun konti på den nye vej og kampagner med regel) – så aktivering
  //    og nye sletteregler samler historik op uden særskilt trin (Codex r2); anvendt_tid er dermed kun en markør, ikke en port
  const { data: harKobling } = await supabase.from("agent_ekstern_alias").select("ekstern_id").eq("kilde", kilde).not("agent_id", "is", null).limit(1);
  if ((harKobling ?? []).length > 0) { const { data: n, error } = await supabase.rpc("agent_alias_anvend_alle", { p_kilde: kilde }); if (error) log("WARN", `agent_alias_anvend_alle: ${error.message}`); else if (Number(n) > 0) log("INFO", `alias anvendt på ${n} sessions/kald uden sælger`); }
  log("INFO", `enreach-alias: ${brugere.length} brugere fra /users (${nye.length} nye), ${koblet} koblet automatisk, ${ikkeVores} markeret »ikke vores«`);
  return { nye: nye.length, koblet, ikke_vores: ikkeVores };
}
