// Rydder dubletkonti i auth.users for aktive medarbejdere.
//
// En "dublet" = en auth-bruger hvis e-mail matcher en aktiv medarbejders
// work_email eller private_email, men som IKKE er medarbejderens
// employee_master_data.auth_user_id. Stamkort-kontoen bevares altid.
//
// Modes:
//   { mode: "dry-run" }  -> rapporterer kun (default)
//   { mode: "execute" }  -> udfører oprydningen
//
// Pr. medarbejder:
//   1. login_events.user_id + sensitive_data_access_log.user_id flyttes til stamkort-uid
//   2. system_roles flettes (kun manglende roller flyttes, dubletrækker slettes)
//   3. dubletkontoen slettes i auth.users (inkl. identities)
//   4. stamkort-kontoens e-mail sættes til work_email
//   5. logges i auth_account_merge_log
//
// Rører IKKE employee_master_data, provision, løn, RLS eller stamkort-kontoens
// eksisterende roller.

import { requireOwner, sharedCorsHeaders } from "../_shared/auth.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
  });

type Candidate = {
  employee_id: string;
  name: string;
  work_email: string;
  private_email: string | null;
  kept_user_id: string;
  kept_email: string;
  duplicate_user_id: string;
  duplicate_email: string;
  duplicate_providers: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: sharedCorsHeaders });
  }

  const auth = await requireOwner(req);
  if (auth instanceof Response) return auth;
  const { svc } = auth;

  let mode = "dry-run";
  try {
    const body = await req.json();
    if (body?.mode === "execute") mode = "execute";
  } catch {
    // ingen body -> dry-run
  }

  const { data: employees, error: empErr } = await svc
    .from("employee_master_data")
    .select("id, first_name, last_name, work_email, private_email, auth_user_id")
    .eq("is_active", true)
    .not("work_email", "is", null)
    .not("auth_user_id", "is", null);

  if (empErr) return json(500, { error: empErr.message });

  // Alle auth-brugere (paginated)
  type AuthUser = { id: string; email: string; providers: string[] };
  const authUsers: AuthUser[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return json(500, { error: error.message });
    const users = data?.users ?? [];
    for (const u of users) {
      authUsers.push({
        id: u.id,
        email: (u.email ?? "").toLowerCase(),
        providers: (u.identities ?? []).map((i) => i.provider),
      });
    }
    if (users.length < 1000) break;
  }

  const byId = new Map(authUsers.map((u) => [u.id, u]));
  const byEmail = new Map<string, AuthUser[]>();
  for (const u of authUsers) {
    if (!u.email) continue;
    byEmail.set(u.email, [...(byEmail.get(u.email) ?? []), u]);
  }

  const candidates: Candidate[] = [];
  const anomalies: { name: string; reason: string; detail?: unknown }[] = [];

  for (const e of employees ?? []) {
    const work = String(e.work_email).trim().toLowerCase();
    const priv = e.private_email ? String(e.private_email).trim().toLowerCase() : null;
    const name = `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim();
    const kept = byId.get(e.auth_user_id as string);
    if (!kept) {
      anomalies.push({ name, reason: "stamkort-kontoen findes ikke i auth.users" });
      continue;
    }

    const matched = new Map<string, AuthUser>();
    for (const email of [work, priv]) {
      if (!email) continue;
      for (const u of byEmail.get(email) ?? []) matched.set(u.id, u);
    }
    matched.set(kept.id, kept);

    const dups = [...matched.values()].filter((u) => u.id !== kept.id);
    if (dups.length === 0) continue;
    if (dups.length > 1) {
      anomalies.push({
        name,
        reason: "mere end én dubletkonto — kræver manuel gennemgang",
        detail: dups.map((d) => ({ id: d.id, email: d.email })),
      });
      continue;
    }

    candidates.push({
      employee_id: e.id as string,
      name,
      work_email: work,
      private_email: priv,
      kept_user_id: kept.id,
      kept_email: kept.email,
      duplicate_user_id: dups[0].id,
      duplicate_email: dups[0].email,
      duplicate_providers: dups[0].providers,
    });
  }

  // Sikkerhedstjek: bruges dublet-uid'erne i andre public-tabeller end de tre kendte?
  const dupIds = candidates.map((c) => c.duplicate_user_id);
  const refsByUid = new Map<string, { ref_table: string; ref_column: string; ref_count: number }[]>();
  if (dupIds.length > 0) {
    const { data: refs, error: refErr } = await svc.rpc("find_auth_uuid_references", { _uids: dupIds });
    if (refErr) return json(500, { error: `Referencetjek fejlede: ${refErr.message}` });
    for (const r of (refs ?? []) as { uid: string; ref_table: string; ref_column: string; ref_count: number }[]) {
      refsByUid.set(r.uid, [...(refsByUid.get(r.uid) ?? []), r]);
    }
  }

  const eligible = candidates.filter((c) => !refsByUid.has(c.duplicate_user_id));
  const blocked = candidates
    .filter((c) => refsByUid.has(c.duplicate_user_id))
    .map((c) => ({ ...c, unexpected_references: refsByUid.get(c.duplicate_user_id) }));

  if (mode === "dry-run") {
    return json(200, {
      mode,
      changes_made: false,
      eligible_count: eligible.length,
      blocked_count: blocked.length,
      eligible,
      blocked,
      anomalies,
    });
  }

  const results: Record<string, unknown>[] = [];

  for (const c of eligible) {
    const detail: Record<string, unknown> = {};
    let loginMoved = 0;
    let sensitiveMoved = 0;
    let rolesMoved = 0;
    let rolesDeleted = 0;

    try {
      // 1. Flyt audit-rækker
      const { data: le, error: leErr } = await svc
        .from("login_events")
        .update({ user_id: c.kept_user_id })
        .eq("user_id", c.duplicate_user_id)
        .select("id");
      if (leErr) throw new Error(`login_events: ${leErr.message}`);
      loginMoved = le?.length ?? 0;

      const { data: sl, error: slErr } = await svc
        .from("sensitive_data_access_log")
        .update({ user_id: c.kept_user_id })
        .eq("user_id", c.duplicate_user_id)
        .select("id");
      if (slErr) throw new Error(`sensitive_data_access_log: ${slErr.message}`);
      sensitiveMoved = sl?.length ?? 0;

      // 2. Flet roller — stamkort-kontoens roller ændres aldrig
      const { data: keptRoles, error: krErr } = await svc
        .from("system_roles")
        .select("role")
        .eq("user_id", c.kept_user_id);
      if (krErr) throw new Error(`system_roles (kept): ${krErr.message}`);
      const keptRoleSet = new Set((keptRoles ?? []).map((r) => r.role as string));

      const { data: dupRoles, error: drErr } = await svc
        .from("system_roles")
        .select("id, role")
        .eq("user_id", c.duplicate_user_id);
      if (drErr) throw new Error(`system_roles (dup): ${drErr.message}`);

      for (const r of dupRoles ?? []) {
        // system_roles har unique(user_id): stamkort-kontoen kan kun have én række,
        // og dens eksisterende rolle må aldrig overskrives. Kun hvis stamkort-kontoen
        // slet ingen rolle har, flyttes dubletrækken — ellers slettes den.
        if (keptRoleSet.size > 0) {
          const { error } = await svc.from("system_roles").delete().eq("id", r.id);
          if (error) throw new Error(`system_roles delete: ${error.message}`);
          rolesDeleted++;
        } else {
          const { error } = await svc
            .from("system_roles")
            .update({ user_id: c.kept_user_id })
            .eq("id", r.id);
          if (error) throw new Error(`system_roles move: ${error.message}`);
          keptRoleSet.add(r.role as string);
          rolesMoved++;
        }

      }
      detail.duplicate_roles = (dupRoles ?? []).map((r) => r.role);

      // 3. Slet dubletkontoen (identities følger med)
      const { error: delErr } = await svc.auth.admin.deleteUser(c.duplicate_user_id);
      if (delErr) throw new Error(`deleteUser: ${delErr.message}`);

      // 4. Flyt stamkort-kontoens e-mail til work_email
      let emailAfter = c.kept_email;
      if (c.kept_email !== c.work_email) {
        const { error: updErr } = await svc.auth.admin.updateUserById(c.kept_user_id, {
          email: c.work_email,
          email_confirm: true,
        });
        if (updErr) throw new Error(`updateUserById: ${updErr.message}`);
        emailAfter = c.work_email;
      }

      await svc.from("auth_account_merge_log").insert({
        employee_id: c.employee_id,
        employee_name: c.name,
        duplicate_user_id: c.duplicate_user_id,
        duplicate_email: c.duplicate_email,
        kept_user_id: c.kept_user_id,
        kept_email_before: c.kept_email,
        kept_email_after: emailAfter,
        login_events_moved: loginMoved,
        sensitive_access_moved: sensitiveMoved,
        roles_moved: rolesMoved,
        roles_deleted: rolesDeleted,
        status: "completed",
        details: { ...detail, duplicate_providers: c.duplicate_providers },
      });

      results.push({
        name: c.name,
        ok: true,
        duplicate_removed: c.duplicate_user_id,
        duplicate_email: c.duplicate_email,
        kept_user_id: c.kept_user_id,
        email_before: c.kept_email,
        email_after: emailAfter,
        login_events_moved: loginMoved,
        sensitive_access_moved: sensitiveMoved,
        roles_moved: rolesMoved,
        roles_deleted: rolesDeleted,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await svc.from("auth_account_merge_log").insert({
        employee_id: c.employee_id,
        employee_name: c.name,
        duplicate_user_id: c.duplicate_user_id,
        duplicate_email: c.duplicate_email,
        kept_user_id: c.kept_user_id,
        kept_email_before: c.kept_email,
        kept_email_after: c.kept_email,
        login_events_moved: loginMoved,
        sensitive_access_moved: sensitiveMoved,
        roles_moved: rolesMoved,
        roles_deleted: rolesDeleted,
        status: "failed",
        details: { ...detail, error: message },
      });
      results.push({ name: c.name, ok: false, error: message });
    }
  }

  return json(200, {
    mode,
    changes_made: true,
    migrated: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    blocked_count: blocked.length,
    results,
    blocked,
    anomalies,
  });
});
