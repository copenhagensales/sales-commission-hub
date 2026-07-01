// Single source of truth: hvem er med i salgsligaen.
// Spejles i src/lib/leagueEligibility.ts — hold 1:1 synkroniseret.

export const LEAGUE_ELIGIBLE_JOB_TITLES = new Set<string>([
  "salgskonsulent",
  "fieldmarketing",
]);

export interface LeagueEligibilityEmployee {
  is_active?: boolean | null;
  job_title?: string | null;
}

export function isLeagueEligible(employee: LeagueEligibilityEmployee | null | undefined): boolean {
  if (!employee) return false;
  if (employee.is_active === false) return false;
  const title = (employee.job_title || "").trim().toLowerCase();
  if (!title) return false;
  return LEAGUE_ELIGIBLE_JOB_TITLES.has(title);
}
