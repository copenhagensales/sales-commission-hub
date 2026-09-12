import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Opstartshold — udelukkende lederrettet.
 *
 * Adgangen haandhaeves i databasen (RLS + SECURITY DEFINER via
 * `can_view_ramp_team`). En saelger kan aldrig se siden eller sine egne data
 * her. Denne hook bruges kun til at vise data i lederens brugerflade.
 */

export const RAMP_ACTION_TYPES = [
  "1-1 samtale",
  "medlyt med feedback",
  "fravær hele ugen",
  "ny leadbatch",
  "samtale med salgschef",
  "ingen handling",
] as const;

export type RampActionType = (typeof RAMP_ACTION_TYPES)[number];

/** Ugens faste forloeb: begge skal registreres hver uge for alle nye saelgere. */
export const RAMP_WEEKLY_COACHING: RampActionType = "1-1 samtale";
export const RAMP_WEEKLY_LISTEN: RampActionType = "medlyt med feedback";
export const RAMP_WEEKLY_ABSENCE: RampActionType = "fravær hele ugen";

export type RampStatus = "over" | "midt" | "under" | "ukendt";

export interface RampAction {
  action_type: string;
  performed_at: string;
  performed_by_name: string | null;
}

export interface RampWeekPoint {
  week_no: number;
  iso_year: number;
  iso_week: number;
  sales: number;
  p25: number;
  p50: number;
  p75: number;
}

export interface RampTeamMember {
  employee_id: string;
  employee_name: string;
  campaign_name: string | null;
  team_name: string | null;
  day_no: number;
  days_left: number;
  cum_sales: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  status: RampStatus;
  flag_id: string | null;
  flag_created_at: string | null;
  flag_days_open: number | null;
  iso_year: number;
  iso_week: number;
  workdays_this_week: number;
  has_coaching: boolean;
  has_listen: boolean;
  has_absence: boolean;
  week_required: boolean;
  week_complete: boolean;
  weeks: RampWeekPoint[];
  actions: RampAction[];
}

export interface RampRiskStat {
  day_no: number;
  threshold_p25: number;
  n_below: number;
  n_below_stopped: number;
  n_below_pending: number;
  n_above: number;
  n_above_stopped: number;
  n_above_pending: number;
  computed_at: string;
  campaign_name: string | null;
}


export function useCanViewRampTeam() {
  return useQuery({
    queryKey: ["can-view-ramp-team"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_view_ramp_team");
      if (error) return false;
      return data === true;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRampTeamOverview() {
  return useQuery({
    queryKey: ["ramp-team-overview"],
    queryFn: async (): Promise<RampTeamMember[]> => {
      const { data, error } = await supabase.rpc("get_ramp_team_overview");
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as unknown as RampTeamMember[];
    },
    staleTime: 60_000,
  });
}

export function useRampRiskStats() {
  return useQuery({
    queryKey: ["ramp-risk-stats"],
    queryFn: async (): Promise<RampRiskStat[]> => {
      const { data, error } = await supabase
        .from("ramp_risk_stats")
        .select(
          "day_no, threshold_p25, n_below, n_below_stopped, n_below_pending, n_above, n_above_stopped, n_above_pending, computed_at, client_campaigns(name)",
        )
        .order("day_no", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        day_no: row.day_no,
        threshold_p25: Number(row.threshold_p25),
        n_below: row.n_below,
        n_below_stopped: row.n_below_stopped,
        n_below_pending: row.n_below_pending,
        n_above: row.n_above,
        n_above_stopped: row.n_above_stopped,
        n_above_pending: row.n_above_pending,
        computed_at: row.computed_at,
        campaign_name:
          (row as { client_campaigns?: { name: string } | null }).client_campaigns?.name ?? null,
      }));

    },
    staleTime: 10 * 60 * 1000,
  });
}

async function currentEmployeeId(): Promise<string> {
  const { data, error } = await supabase.rpc("get_current_employee_id");
  if (error) throw error;
  if (!data) throw new Error("Din bruger er ikke koblet til et medarbejderkort");
  return data as string;
}

export function useLogRampAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      employeeId: string;
      actionType: RampActionType;
      flagId?: string | null;
    }) => {
      const performedBy = await currentEmployeeId();
      const { error } = await supabase.from("ramp_flag_action").insert({
        employee_id: params.employeeId,
        flag_id: params.flagId ?? null,
        action_type: params.actionType,
        performed_by: performedBy,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ramp-team-overview"] });
      toast.success("Handling registreret");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Kunne ikke registrere handlingen");
    },
  });
}

export function useCloseRampFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (flagId: string) => {
      const closedBy = await currentEmployeeId();
      const { error } = await supabase
        .from("ramp_risk_flag")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          closed_by: closedBy,
        })
        .eq("id", flagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ramp-team-overview"] });
      toast.success("Flaget er lukket");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Kunne ikke lukke flaget");
    },
  });
}

/**
 * Bygger den observerede gruppefrekvens som klar tekst.
 * Procent uden de raa antal er forbudt — derfor staar antallene altid med.
 */
export function formatRiskStatSentence(stat: RampRiskStat): string {
  const pct = (stopped: number, total: number) =>
    total === 0 ? null : Math.round((stopped / total) * 100);

  const belowPct = pct(stat.n_below_stopped, stat.n_below);
  const abovePct = pct(stat.n_above_stopped, stat.n_above);
  const campaign = stat.campaign_name ?? "kampagnen";

  const parts: string[] = [];
  if (belowPct !== null) {
    parts.push(
      `Blandt nye sælgere på ${campaign} stoppede ${belowPct} % af dem, der lå under det typiske på dag ${stat.day_no}, inden dag 40 (${stat.n_below_stopped} af ${stat.n_below} vurderbare).`,
    );
  }
  if (abovePct !== null) {
    parts.push(
      `Blandt dem på eller over lå tallet på ${abovePct} % (${stat.n_above_stopped} af ${stat.n_above} vurderbare).`,
    );
  }
  const pending = stat.n_below_pending + stat.n_above_pending;
  if (pending > 0) {
    parts.push(
      `${pending} sælgere er stadig undervejs mod dag 40 og tælles ikke med (${stat.n_below_pending} under, ${stat.n_above_pending} på eller over).`,
    );
  }
  return parts.join(" ");
}

/** Kort linje pr. maalepunkt: procent altid med de raa antal. */
export function formatRiskStatShort(stat: RampRiskStat): string | null {
  if (stat.n_below === 0 && stat.n_above === 0) return null;
  const belowPct = stat.n_below === 0 ? null : Math.round((stat.n_below_stopped / stat.n_below) * 100);
  const abovePct = stat.n_above === 0 ? null : Math.round((stat.n_above_stopped / stat.n_above) * 100);
  const below =
    belowPct === null ? "ingen vurderbare" : `${belowPct} % (${stat.n_below_stopped} af ${stat.n_below})`;
  const above =
    abovePct === null ? "ingen vurderbare" : `${abovePct} % (${stat.n_above_stopped} af ${stat.n_above})`;
  return `Dag ${stat.day_no}: ${below} mod ${above}`;
}
