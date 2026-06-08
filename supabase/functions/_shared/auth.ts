import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const sharedCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-gdpr-cron-token",
};

const jsonError = (
  status: number,
  message: string,
  extraHeaders: Record<string, string> = {},
) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...sharedCorsHeaders, ...extraHeaders, "Content-Type": "application/json" },
  });

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function getUserFromAuthHeader(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const svc = getServiceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) return null;
  return { user: data.user, svc };
}

export type AuthOk = { ok: true; userId: string; svc: ReturnType<typeof getServiceClient> };
export type AuthCron = { ok: true; userId: null; svc: ReturnType<typeof getServiceClient>; caller: "cron" };

/** Require caller is an authenticated owner (is_owner = true). */
export async function requireOwner(req: Request): Promise<AuthOk | Response> {
  const ctx = await getUserFromAuthHeader(req);
  if (!ctx) return jsonError(401, "Unauthorized");
  const { data: isOwner } = await ctx.svc.rpc("is_owner", { _user_id: ctx.user.id });
  if (!isOwner) return jsonError(403, "Forbidden");
  return { ok: true, userId: ctx.user.id, svc: ctx.svc };
}

/** Require caller is a manager or above (is_manager_or_above = true). */
export async function requireManager(req: Request): Promise<AuthOk | Response> {
  const ctx = await getUserFromAuthHeader(req);
  if (!ctx) return jsonError(401, "Unauthorized");
  const { data: isManager } = await ctx.svc.rpc("is_manager_or_above", { _user_id: ctx.user.id });
  if (!isManager) return jsonError(403, "Forbidden");
  return { ok: true, userId: ctx.user.id, svc: ctx.svc };
}

/**
 * Allow either an internal cron caller (x-cron-secret header matching CRON_SECRET env)
 * or an authenticated owner. Suitable for scheduled maintenance/payroll/cleanup jobs.
 */
/**
 * Allow either an internal cron caller or an authenticated owner.
 *
 * Cron callers are recognized in two ways:
 *   1. `x-cron-secret` header matching the `CRON_SECRET` env var.
 *   2. Authorization Bearer header carrying the project's service-role key
 *      (pg_cron jobs currently authenticate this way).
 *
 * Suitable for scheduled maintenance/payroll/cleanup jobs.
 */
export async function requireCronOrOwner(
  req: Request,
): Promise<AuthOk | AuthCron | Response> {
  const cronSecret = req.headers.get("x-cron-secret");
  const expected = Deno.env.get("CRON_SECRET");
  if (cronSecret && expected && cronSecret === expected) {
    return { ok: true, userId: null, svc: getServiceClient(), caller: "cron" };
  }

  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (authHeader && serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) {
    return { ok: true, userId: null, svc: getServiceClient(), caller: "cron" };
  }

  return requireOwner(req);
}

