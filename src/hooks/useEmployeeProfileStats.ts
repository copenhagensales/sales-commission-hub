/**
 * Præberegnet profilstatistik til spillerprofil-kortet.
 *
 * Alle tal kommer fra public.employee_profile_stats, som genberegnes server-side
 * hver nat. Hooken hentes ÉN gang pr. liste — hover udløser ingen forespørgsler.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmployeeProfileStats {
  employee_id: string;
  total_sales: number;
  pay_periods: number;
  total_commission: number;
  avg_per_pay_period: number;
  best_day_amount: number | null;
  best_day_date: string | null;
  best_week_amount: number | null;
  best_week_iso: number | null;
  best_week_year: number | null;
  best_period_amount: number | null;
  best_period_start: string | null;
  longest_streak_days: number;
  streak_start: string | null;
  streak_end: string | null;
  club_50_count: number;
  club_100_count: number;
  club_200_count: number;
  league_best_division: number | null;
  league_round_wins: number;
  league_seasons: number;
  uses_weekday_fallback: boolean;
  computed_at: string;
}

export interface ProfilePerson {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  jobTitle: string | null;
  teamName: string | null;
  employmentStartDate: string | null;
  avatarUrl: string | null;
  clients: string[];
  stats: EmployeeProfileStats | null;
}

export interface ProfileCardData {
  byId: Map<string, ProfilePerson>;
  club200Members: number;
}

/**
 * Henter statistik + identitetsdata for alle medarbejdere i ét kald pr. tabel.
 */
export function useEmployeeProfileStats(options?: { enabled?: boolean }) {
  return useQuery<ProfileCardData>({
    queryKey: ["employee-profile-stats"],
    queryFn: async () => {
      const [statsRes, empRes, teamRes, assignRes] = await Promise.all([
        supabase.from("employee_profile_stats").select("*"),
        supabase
          .from("employee_master_data")
          .select(
            "id, first_name, last_name, job_title, team_id, employment_start_date, avatar_url"
          ),
        supabase.from("teams").select("id, name"),
        supabase
          .from("employee_client_assignments")
          .select("employee_id, clients(name)"),
      ]);

      if (statsRes.error) throw statsRes.error;
      if (empRes.error) throw empRes.error;
      if (teamRes.error) throw teamRes.error;
      if (assignRes.error) throw assignRes.error;

      const statsById = new Map<string, EmployeeProfileStats>();
      (statsRes.data ?? []).forEach((row) => {
        statsById.set(row.employee_id, row as EmployeeProfileStats);
      });

      const teamNames = new Map<string, string>();
      (teamRes.data ?? []).forEach((t) => teamNames.set(t.id, t.name));

      const clientsByEmployee = new Map<string, string[]>();
      (assignRes.data ?? []).forEach((row) => {
        const rel = row.clients as { name: string } | { name: string }[] | null;
        const name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
        if (!name) return;
        const list = clientsByEmployee.get(row.employee_id) ?? [];
        if (!list.includes(name)) list.push(name);
        clientsByEmployee.set(row.employee_id, list);
      });

      const byId = new Map<string, ProfilePerson>();
      (empRes.data ?? []).forEach((emp) => {
        byId.set(emp.id, {
          id: emp.id,
          firstName: emp.first_name ?? "",
          lastName: emp.last_name ?? "",
          fullName: `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim(),
          jobTitle: emp.job_title ?? null,
          teamName: emp.team_id ? teamNames.get(emp.team_id) ?? null : null,
          employmentStartDate: emp.employment_start_date ?? null,
          avatarUrl: emp.avatar_url ?? null,
          clients: (clientsByEmployee.get(emp.id) ?? []).sort((a, b) =>
            a.localeCompare(b, "da-DK")
          ),
          stats: statsById.get(emp.id) ?? null,
        });
      });

      const club200Members = (statsRes.data ?? []).filter(
        (r) => (r.club_200_count ?? 0) > 0
      ).length;

      return { byId, club200Members };
    },
    staleTime: 600_000,
    enabled: options?.enabled ?? true,
  });
}
