// Migrerer eksisterende auth-brugeres e-mail til work_email, så Microsoft-login matcher.
//
// To modes:
//   { mode: "dry-run" }  -> lister kun hvad der VILLE blive ændret (default)
//   { mode: "execute" }  -> udfører updateUserById med email_confirm: true
//
// Rører IKKE ved employee_master_data, password, user id, identities, roller eller RLS.

import { requireOwner, sharedCorsHeaders } from "../_shared/auth.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
  });

type Row = {
  employee_id: string;
  name: string;
  work_email: string;
  auth_user_id: string;
  current_email: string;
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

  // Hent alle aktive medarbejdere med work_email + auth_user_id
  const { data: employees, error: empErr } = await svc
    .from("employee_master_data")
    .select("id, first_name, last_name, work_email, auth_user_id")
    .eq("is_active", true)
    .not("work_email", "is", null)
    .not("auth_user_id", "is", null);

  if (empErr) return json(500, { error: empErr.message });

  // Hent alle auth-brugere (paginated)
  const authUsers: { id: string; email: string }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return json(500, { error: error.message });
    const users = data?.users ?? [];
    for (const u of users) authUsers.push({ id: u.id, email: (u.email ?? "").toLowerCase() });
    if (users.length < 1000) break;
  }

  const byId = new Map(authUsers.map((u) => [u.id, u]));
  const byEmail = new Map<string, string[]>();
  for (const u of authUsers) {
    if (!u.email) continue;
    byEmail.set(u.email, [...(byEmail.get(u.email) ?? []), u.id]);
  }

  const toMigrate: Row[] = [];
  const conflicts: (Row & { reason: string })[] = [];
  const missingAuthUser: { name: string; auth_user_id: string }[] = [];

  for (const e of employees ?? []) {
    const work = (e.work_email as string).trim().toLowerCase();
    const authUser = byId.get(e.auth_user_id as string);
    if (!authUser) {
      missingAuthUser.push({ name: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim(), auth_user_id: e.auth_user_id as string });
      continue;
    }
    if (authUser.email === work) continue; // matcher allerede

    const row: Row = {
      employee_id: e.id as string,
      name: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim(),
      work_email: work,
      auth_user_id: e.auth_user_id as string,
      current_email: authUser.email,
    };

    const owners = (byEmail.get(work) ?? []).filter((id) => id !== row.auth_user_id);
    if (owners.length > 0) {
      conflicts.push({ ...row, reason: `work_email bruges allerede af auth-bruger ${owners.join(", ")}` });
    } else {
      toMigrate.push(row);
    }
  }

  if (mode === "dry-run") {
    return json(200, {
      mode,
      changes_made: false,
      to_migrate_count: toMigrate.length,
      conflict_count: conflicts.length,
      to_migrate: toMigrate,
      conflicts,
      missing_auth_user: missingAuthUser,
    });
  }

  // execute
  const results: { name: string; from: string; to: string; ok: boolean; error?: string }[] = [];
  for (const row of toMigrate) {
    const { error } = await svc.auth.admin.updateUserById(row.auth_user_id, {
      email: row.work_email,
      email_confirm: true,
    });
    results.push({
      name: row.name,
      from: row.current_email,
      to: row.work_email,
      ok: !error,
      ...(error ? { error: error.message } : {}),
    });
  }

  return json(200, {
    mode,
    changes_made: true,
    migrated: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    skipped_conflicts: conflicts.length,
    results,
    conflicts,
  });
});
