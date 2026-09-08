// Validerer et Microsoft (azure) login mod employee_master_data.
//
// Formål: forhindre at der opstår dublet-auth-brugere for samme medarbejder,
// når Microsoft returnerer arbejds-e-mailen, mens den eksisterende auth-konto
// ligger på privat-e-mailen.
//
// Rører IKKE ved e-mail/adgangskode-login, must_change_password, password-reset,
// login-logning, roller eller RLS.

import { requireAuthenticated, sharedCorsHeaders } from "../_shared/auth.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...sharedCorsHeaders, "Content-Type": "application/json" },
  });

const NOT_EMPLOYEE_MSG =
  "Din konto er ikke oprettet i Stork — kontakt din teamleder";
const NEEDS_LINK_MSG =
  "Din konto skal opdateres før Microsoft-login — kontakt administrationen";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: sharedCorsHeaders });
  }

  const auth = await requireAuthenticated(req);
  if (auth instanceof Response) return auth;
  const { userId, svc } = auth;

  // Hent den aktuelle auth-bruger (e-mail + identities + created_at)
  const { data: userRes, error: userErr } = await svc.auth.admin.getUserById(userId);
  if (userErr || !userRes?.user) {
    return json(401, { allowed: false, message: "Ukendt bruger" });
  }
  const user = userRes.user;
  const identities = user.identities ?? [];
  const provider = (user.app_metadata as Record<string, unknown> | null)?.provider;

  // Kun azure-logins vurderes her. Alt andet (password-login) slippes igennem urørt.
  const isAzureOnly =
    identities.length > 0 && identities.every((i) => i.provider === "azure");
  if (provider !== "azure" && !isAzureOnly) {
    return json(200, { allowed: true, reason: "not_microsoft" });
  }

  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) {
    return json(200, { allowed: false, reason: "no_email", message: NOT_EMPLOYEE_MSG });
  }

  // Sletter kun en netop oprettet, tom azure-konto. Aldrig en konto der er
  // koblet til en medarbejder, har password-identity eller er ældre end 15 min.
  const cleanupOrphanUser = async () => {
    if (!isAzureOnly) return false;
    const createdAt = new Date(user.created_at).getTime();
    if (Number.isFinite(createdAt) && Date.now() - createdAt > 15 * 60 * 1000) {
      return false;
    }
    const { data: linked } = await svc
      .from("employee_master_data")
      .select("id")
      .eq("auth_user_id", userId)
      .limit(1);
    if (linked && linked.length > 0) return false;

    const { error: delErr } = await svc.auth.admin.deleteUser(userId);
    return !delErr;
  };

  // 1. Slå e-mailen op på både arbejds- og privat-e-mail (kun aktive medarbejdere)
  const { data: employees, error: empErr } = await svc
    .from("employee_master_data")
    .select("id, auth_user_id, work_email, private_email")
    .or(`work_email.ilike.${email},private_email.ilike.${email}`)
    .eq("is_active", true);

  if (empErr) {
    return json(500, { allowed: false, message: "Kunne ikke validere konto" });
  }

  // 3. Ingen aktiv medarbejder -> afvis og ryd op
  if (!employees || employees.length === 0) {
    const deleted = await cleanupOrphanUser();
    return json(200, {
      allowed: false,
      reason: "not_employee",
      message: NOT_EMPLOYEE_MSG,
      cleaned_up: deleted,
    });
  }

  // 4. Succes-casen: medarbejderen er allerede koblet til netop denne auth-bruger
  const own = employees.find((e) => e.auth_user_id === userId);
  if (own) {
    return json(200, { allowed: true, reason: "linked", employee_id: own.id });
  }

  // Medarbejder uden auth-bruger: kobl denne bruger på
  const unlinked = employees.find((e) => !e.auth_user_id);
  if (unlinked && employees.every((e) => !e.auth_user_id)) {
    const { error: updErr } = await svc
      .from("employee_master_data")
      .update({ auth_user_id: userId })
      .eq("id", unlinked.id)
      .is("auth_user_id", null);
    if (updErr) {
      const deleted = await cleanupOrphanUser();
      return json(200, {
        allowed: false,
        reason: "needs_link",
        message: NEEDS_LINK_MSG,
        cleaned_up: deleted,
      });
    }
    return json(200, { allowed: true, reason: "auto_linked", employee_id: unlinked.id });
  }

  // 2. Medarbejderen har allerede en ANDEN auth-bruger (typisk privat-e-mail):
  // afvis Microsoft-loginet og fjern den netop oprettede dublet.
  const deleted = await cleanupOrphanUser();
  return json(200, {
    allowed: false,
    reason: "needs_link",
    message: NEEDS_LINK_MSG,
    cleaned_up: deleted,
  });
});
