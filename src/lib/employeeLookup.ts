import { supabase } from "@/integrations/supabase/client";

/**
 * Slår en medarbejder op ud fra auth_user_id, med fallback til
 * private_email / work_email hvis der ikke findes et match.
 *
 * Dette dækker tilfælde hvor en bruger har flere auth-konti (fx separat
 * arbejds- og privat-login) og employee_master_data.auth_user_id peger på
 * den ene, mens brugeren logger ind med den anden.
 */
export async function findEmployeeByAuth<T = any>(
  user: { id?: string | null; email?: string | null } | null | undefined,
  select: string,
  opts: { activeOnly?: boolean } = {}
): Promise<{ data: T | null; error: any }> {
  if (!user?.id) return { data: null, error: null };

  let q = supabase
    .from("employee_master_data")
    .select(select)
    .eq("auth_user_id", user.id);
  if (opts.activeOnly) q = q.eq("is_active", true);
  const first: any = await q.maybeSingle();
  if (first.data || first.error) return first;

  const email = user.email?.toLowerCase();
  if (!email) return { data: null, error: null };

  let q2 = supabase
    .from("employee_master_data")
    .select(select)
    .or(`private_email.ilike.${email},work_email.ilike.${email}`);
  if (opts.activeOnly) q2 = q2.eq("is_active", true);
  const second: any = await q2.maybeSingle();
  return second;
}
