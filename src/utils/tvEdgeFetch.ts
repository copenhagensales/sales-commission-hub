import { supabase } from "@/integrations/supabase/client";

/**
 * Kalder `tv-dashboard-data` edge function med korrekt autentifikation.
 *
 * To lovlige kaldere:
 *  - TV-tavler: autentificeret med adgangskode gemt i sessionStorage
 *    (`tv_board_code`), som sendes videre som `code`-query-parameter.
 *  - Almindelige brugere i appen: sender deres session-JWT.
 *
 * Uden en af de to afvises kaldet med 401 af edge functionen.
 */
export async function tvEdgeFetch(pathWithQuery: string, init?: RequestInit): Promise<Response> {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const url = new URL(`${base}/functions/v1/${pathWithQuery.replace(/^\/+/, "")}`);

  const code = typeof sessionStorage !== "undefined"
    ? sessionStorage.getItem("tv_board_code")
    : null;
  if (code) url.searchParams.set("code", code);

  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  return fetch(url.toString(), {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token ?? anonKey}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

