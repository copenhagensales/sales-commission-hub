import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  resolveCompensation,
  MISSING_BASIS_LABELS,
  type MissingBasisReason,
} from "@/lib/calculations/dbModel";

/**
 * Datakvalitet for DB-/lønberegningen.
 *
 * Formålet er at gøre huller i grundlaget SYNLIGE, så et manglende beløb ikke
 * stille bliver 0 kr. i en rapport der styres efter. Hooken laver ingen
 * ændringer — den finder kun uoverensstemmelser i stamdata.
 */

export type DbDataQualityCategoryId =
  | "missing_salary_row"
  | "salary_without_team"
  | "inactive_on_team"
  | "team_without_leader_rate"
  | "client_without_team";

export interface DbDataQualityIssue {
  id: string;
  /** Navn på person, team eller klient */
  name: string;
  /** Kort forklaring på hvad der mangler */
  detail: string;
  /** Rolle/type, fx "Assisterende teamleder" */
  role?: string;
  teamName?: string | null;
  employeeId?: string;
  teamId?: string;
  clientId?: string;
}

export interface DbDataQualityCategory {
  id: DbDataQualityCategoryId;
  title: string;
  description: string;
  /** true = tallene bliver forkerte hvis det ikke rettes */
  severity: "critical" | "warning";
  issues: DbDataQualityIssue[];
}

export interface UseDbDataQualityResult {
  categories: DbDataQualityCategory[];
  totalIssues: number;
  criticalIssues: number;
  isLoading: boolean;
}

export interface ClientActivityInput {
  clientId: string;
  clientName: string;
  teamId: string | null;
  sales: number;
  revenue: number;
}

const SALARY_TYPE_LABELS: Record<string, string> = {
  team_leader: "Teamleder",
  assistant: "Assisterende teamleder",
  staff: "Stab",
};

function missingLabel(reason: MissingBasisReason | null): string {
  if (!reason) return "Mangler grundlag";
  return MISSING_BASIS_LABELS[reason];
}

export function useDbDataQuality(
  clientActivity: ClientActivityInput[] = []
): UseDbDataQualityResult {
  const { data, isLoading } = useQuery({
    queryKey: ["db-data-quality"],
    queryFn: async () => {
      const [
        { data: teams },
        { data: members },
        { data: assistantLinks },
        { data: employees },
        { data: salaries },
        { data: teamClients },
      ] = await Promise.all([
        supabase.from("teams").select("id, name, team_leader_id"),
        supabase.from("team_members").select("team_id, employee_id"),
        supabase.from("team_assistant_leaders").select("team_id, employee_id"),
        supabase
          .from("employee_master_data")
          .select("id, first_name, last_name, is_active, team_id, job_title"),
        supabase
          .from("personnel_salaries")
          .select(
            "employee_id, salary_type, is_active, compensation_model, monthly_salary, hourly_rate, percentage_rate, minimum_salary"
          ),
        supabase.from("team_clients").select("team_id, client_id"),
      ]);

      return {
        teams: teams ?? [],
        members: members ?? [],
        assistantLinks: assistantLinks ?? [],
        employees: employees ?? [],
        salaries: salaries ?? [],
        teamClients: teamClients ?? [],
      };
    },
    staleTime: 60 * 1000,
  });

  const categories = useMemo<DbDataQualityCategory[]>(() => {
    const empty: DbDataQualityCategory[] = [
      {
        id: "missing_salary_row",
        title: "Mangler lønrække",
        description:
          "Teamledere og assisterende teamledere uden aktiv lønrække koster 0 kr. i DB-beregningen.",
        severity: "critical",
        issues: [],
      },
      {
        id: "salary_without_team",
        title: "Lønrække uden team",
        description:
          "Personen har en aktiv lønrække, men er ikke tilknyttet et team — lønnen fordeles derfor ikke ud på nogen klient.",
        severity: "critical",
        issues: [],
      },
      {
        id: "inactive_on_team",
        title: "Inaktive stadig på team",
        description:
          "Deaktiverede medarbejdere der stadig er tilknyttet et team. De tælles ikke i ATP-beregningen, men bør ryddes op.",
        severity: "warning",
        issues: [],
      },
      {
        id: "team_without_leader_rate",
        title: "Team uden leder eller procentsats",
        description:
          "Teams med klienter, hvor lederlønnen ikke kan beregnes. DB'et bliver for højt.",
        severity: "critical",
        issues: [],
      },
      {
        id: "client_without_team",
        title: "Klient med salg uden team",
        description:
          "Klienten har aktivitet i perioden, men er ikke knyttet til et team. Der beregnes derfor hverken leder-, assistent- eller ATP-omkostning.",
        severity: "critical",
        issues: [],
      },
    ];

    if (!data) return empty;

    const byId = (id: string) => empty.find((c) => c.id === id)!;
    const employeeById = new Map(data.employees.map((e) => [e.id, e]));
    const teamById = new Map(data.teams.map((t) => [t.id, t]));
    const nameOf = (id: string) => {
      const emp = employeeById.get(id);
      return emp ? `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() : "Ukendt medarbejder";
    };

    const activeSalaryByEmployee = new Map<string, (typeof data.salaries)[number]>();
    for (const row of data.salaries) {
      if (row.is_active) activeSalaryByEmployee.set(row.employee_id, row);
    }

    const teamsWithClients = new Set(data.teamClients.map((tc) => tc.team_id));

    // 1) Ledere og assistenter uden brugbar lønrække
    for (const team of data.teams) {
      if (team.team_leader_id) {
        const leader = employeeById.get(team.team_leader_id);
        if (leader?.is_active) {
          const salary = activeSalaryByEmployee.get(team.team_leader_id);
          const compensation = resolveCompensation(salary ?? null);
          if (!salary || !compensation.hasBasis) {
            byId("missing_salary_row").issues.push({
              id: `leader-${team.team_leader_id}`,
              name: nameOf(team.team_leader_id),
              role: "Teamleder",
              teamName: team.name,
              detail: salary ? missingLabel(compensation.missingReason) : "Ingen aktiv lønrække",
              employeeId: team.team_leader_id,
              teamId: team.id,
            });
          }
        }
      }
    }

    for (const link of data.assistantLinks) {
      const employee = employeeById.get(link.employee_id);
      if (!employee?.is_active) continue;
      const salary = activeSalaryByEmployee.get(link.employee_id);
      const compensation = resolveCompensation(salary ?? null);
      if (!salary || !compensation.hasBasis) {
        byId("missing_salary_row").issues.push({
          id: `assistant-${link.employee_id}-${link.team_id}`,
          name: nameOf(link.employee_id),
          role: "Assisterende teamleder",
          teamName: teamById.get(link.team_id)?.name ?? null,
          detail: salary ? missingLabel(compensation.missingReason) : "Ingen aktiv lønrække",
          employeeId: link.employee_id,
          teamId: link.team_id,
        });
      }
    }

    // 2) Aktiv lønrække uden teamtilknytning
    const teamMemberIds = new Set(data.members.map((m) => m.employee_id));
    const assistantIds = new Set(data.assistantLinks.map((a) => a.employee_id));
    const leaderIds = new Set(
      data.teams.map((t) => t.team_leader_id).filter(Boolean) as string[]
    );

    for (const [employeeId, salary] of activeSalaryByEmployee) {
      if (salary.salary_type === "staff") continue; // Stab hører ikke under et team
      const employee = employeeById.get(employeeId);
      if (!employee?.is_active) continue;
      const hasTeam =
        !!employee.team_id ||
        teamMemberIds.has(employeeId) ||
        assistantIds.has(employeeId) ||
        leaderIds.has(employeeId);
      if (!hasTeam) {
        byId("salary_without_team").issues.push({
          id: `salary-no-team-${employeeId}`,
          name: nameOf(employeeId),
          role: SALARY_TYPE_LABELS[salary.salary_type] ?? salary.salary_type,
          detail: "Ingen teamtilknytning (hverken stamdata, team_members eller assistentrolle)",
          employeeId,
        });
      }
    }

    // 3) Inaktive medarbejdere stadig tilknyttet et team
    const inactiveSeen = new Set<string>();
    const pushInactive = (employeeId: string, teamId: string | null, relation: string) => {
      const employee = employeeById.get(employeeId);
      if (!employee || employee.is_active) return;
      const key = `${employeeId}-${teamId ?? "none"}-${relation}`;
      if (inactiveSeen.has(key)) return;
      inactiveSeen.add(key);
      byId("inactive_on_team").issues.push({
        id: `inactive-${key}`,
        name: nameOf(employeeId),
        role: relation,
        teamName: teamId ? teamById.get(teamId)?.name ?? null : null,
        detail: "Deaktiveret medarbejder er stadig tilknyttet teamet",
        employeeId,
        teamId: teamId ?? undefined,
      });
    };

    for (const link of data.assistantLinks) {
      pushInactive(link.employee_id, link.team_id, "Assisterende teamleder");
    }
    for (const team of data.teams) {
      if (team.team_leader_id) pushInactive(team.team_leader_id, team.id, "Teamleder");
    }
    for (const member of data.members) {
      pushInactive(member.employee_id, member.team_id, "Teammedlem");
    }

    // 4) Teams med klienter men uden leder/procentsats
    for (const team of data.teams) {
      if (!teamsWithClients.has(team.id)) continue;
      if (!team.team_leader_id) {
        byId("team_without_leader_rate").issues.push({
          id: `team-no-leader-${team.id}`,
          name: team.name,
          detail: "Teamet har klienter, men ingen teamleder er sat",
          teamId: team.id,
        });
        continue;
      }
      const salary = activeSalaryByEmployee.get(team.team_leader_id);
      const compensation = resolveCompensation(salary ?? null);
      if (!salary) {
        byId("team_without_leader_rate").issues.push({
          id: `team-no-salary-${team.id}`,
          name: team.name,
          detail: `${nameOf(team.team_leader_id)} har ingen aktiv lønrække`,
          teamId: team.id,
        });
      } else if (compensation.percentageRate <= 0 && compensation.minimumSalary <= 0) {
        byId("team_without_leader_rate").issues.push({
          id: `team-no-rate-${team.id}`,
          name: team.name,
          detail: `${nameOf(team.team_leader_id)} har hverken procentsats eller minimumsløn`,
          teamId: team.id,
        });
      }
    }

    // 5) Klienter med aktivitet men uden team
    for (const client of clientActivity) {
      if (client.teamId) continue;
      if (client.sales <= 0 && client.revenue <= 0) continue;
      byId("client_without_team").issues.push({
        id: `client-no-team-${client.clientId}`,
        name: client.clientName,
        detail: `${client.sales} salg i perioden uden teamtilknytning`,
        clientId: client.clientId,
      });
    }

    return empty;
  }, [data, clientActivity]);

  const totalIssues = categories.reduce((sum, c) => sum + c.issues.length, 0);
  const criticalIssues = categories
    .filter((c) => c.severity === "critical")
    .reduce((sum, c) => sum + c.issues.length, 0);

  return { categories, totalIssues, criticalIssues, isLoading };
}
