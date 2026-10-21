// MIDLERTIDIG: sletter Hjerteforeningen-udtræk fra tryg-report-exports. Fjernes straks efter brug.
import { requireAuthenticated, sharedCorsHeaders } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: sharedCorsHeaders });
  const auth = await requireAuthenticated(req);
  if (auth instanceof Response) return auth;
  const { data: sa } = await auth.svc.rpc("is_superadmin", { _user_id: auth.userId });
  const h = { ...sharedCorsHeaders, "Content-Type": "application/json" };
  if (sa !== true) return new Response(JSON.stringify({ error: "Kun superadmin" }), { status: 403, headers: h });
  const { data: files } = await auth.svc.storage.from("tryg-report-exports").list("", { search: "Hjerteforeningen" });
  const names = (files ?? []).map((f) => f.name).filter((n) => n.startsWith("Hjerteforeningen"));
  const { data, error } = names.length ? await auth.svc.storage.from("tryg-report-exports").remove(names) : { data: [], error: null };
  return new Response(JSON.stringify({ deleted: data?.length ?? 0, error: error?.message ?? null }), { headers: h });
});
