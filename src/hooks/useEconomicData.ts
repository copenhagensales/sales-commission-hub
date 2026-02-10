import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";

// Types
export interface EconomicKategori {
  id: string;
  navn: string;
  sort_order: number;
  beskrivelse: string | null;
  default_team_id: string | null;
  is_expense: boolean;
  is_active: boolean;
}

export interface EconomicKontoMapping {
  id: string;
  konto_nr: number;
  kategori_id: string;
  team_id: string | null;
  active_from: string;
  active_to: string;
  note: string | null;
  is_auto_suggested: boolean;
  needs_review: boolean;
}

export interface EconomicFordelingsregel {
  id: string;
  priority: number;
  match_field: "tekst" | "leverandoer_nr" | "kunde_nr" | "konto_nr";
  match_operator: "contains" | "equals" | "starts_with" | "ends_with";
  match_value: string;
  kategori_id: string;
  team_id: string | null;
  active_from: string;
  active_to: string;
  note: string | null;
  is_active: boolean;
  affected_count: number;
}

export interface PosteringEnriched {
  loebe_nr: number;
  maaned: string;
  dato: string;
  konto_nr: number;
  kontonavn: string | null;
  tekst: string | null;
  beloeb_dkk: number;
  leverandoer_nr: number | null;
  kunde_nr: number | null;
  bilags_nr: number | null;
  kategori: string;
  kategori_id: string;
  team: string;
  team_id: string;
  klassificering_kilde: "regel" | "mapping" | "fallback";
  needs_review: boolean;
  is_balance_account: boolean;
}

export interface BudgetLine {
  id: string;
  year: number;
  month: number;
  team_id: string | null;
  kategori_id: string;
  amount: number;
  note: string | null;
}

export interface Team {
  id: string;
  name: string;
}

// Fetch kategorier
export function useEconomicKategorier() {
  return useQuery({
    queryKey: ["economic-kategorier"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("economic_kategorier")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as EconomicKategori[];
    },
  });
}

// Fetch konto mapping
export function useEconomicKontoMapping() {
  return useQuery({
    queryKey: ["economic-konto-mapping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("economic_konto_mapping")
        .select("*")
        .order("konto_nr");
      if (error) throw error;
      return data as EconomicKontoMapping[];
    },
  });
}

// Fetch fordelingsregler
export function useEconomicFordelingsregler() {
  return useQuery({
    queryKey: ["economic-fordelingsregler"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("economic_fordelingsregler")
        .select("*")
        .order("priority", { ascending: false });
      if (error) throw error;
      return data as EconomicFordelingsregel[];
    },
  });
}

// Fetch enriched posteringer
export function usePosteringerEnriched(filters?: {
  year?: number;
  months?: number[];
  teamId?: string;
  kategoriId?: string;
}) {
  return useQuery({
    queryKey: ["posteringer-enriched", filters],
    queryFn: async () => {
      const data = await fetchAllRows<PosteringEnriched>(
        "posteringer_enriched",
        "*",
        (q) => {
          let query = q;
          if (filters?.year) {
            const yearStart = `${filters.year}-01-01`;
            const yearEnd = `${filters.year}-12-31`;
            query = query.gte("dato", yearStart).lte("dato", yearEnd);
          }
          if (filters?.teamId) {
            query = query.eq("team_id", filters.teamId);
          }
          if (filters?.kategoriId) {
            query = query.eq("kategori_id", filters.kategoriId);
          }
          return query;
        },
        { orderBy: "dato", ascending: false }
      );
      return data;
    },
  });
}

// Fetch budget lines
export function useEconomicBudget(year: number) {
  return useQuery({
    queryKey: ["economic-budget", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("economic_budget_lines")
        .select("*")
        .eq("year", year)
        .order("month");
      if (error) throw error;
      return data as BudgetLine[];
    },
  });
}

// Fetch teams
export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });
}

// Fetch kontoplan
export function useEconomicKontoplan() {
  return useQuery({
    queryKey: ["economic-kontoplan"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("economic_kontoplan")
        .select("konto_nr, navn, type")
        .order("konto_nr");
      if (error) throw error;
      return data;
    },
  });
}

// Mutations
export function useCreateFordelingsregel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (regel: Omit<EconomicFordelingsregel, "id" | "affected_count">) => {
      const { data, error } = await supabase
        .from("economic_fordelingsregler")
        .insert(regel)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["economic-fordelingsregler"] });
      queryClient.invalidateQueries({ queryKey: ["posteringer-enriched"] });
    },
  });
}

export function useUpdateKontoMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ konto_nr, kategori_id, team_id }: { konto_nr: number; kategori_id: string; team_id?: string }) => {
      // Upsert mapping
      const { data, error } = await supabase
        .from("economic_konto_mapping")
        .upsert({
          konto_nr,
          kategori_id,
          team_id: team_id || null,
          is_auto_suggested: false,
          needs_review: false,
        }, { onConflict: "konto_nr,active_from" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["economic-konto-mapping"] });
      queryClient.invalidateQueries({ queryKey: ["posteringer-enriched"] });
    },
  });
}

export function useUpdateBudgetLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (line: { year: number; month: number; kategori_id: string; amount: number; team_id: string | null; note?: string | null }) => {
      const { data, error } = await supabase
        .from("economic_budget_lines")
        .upsert({
          ...line,
          note: line.note ?? null,
        }, { onConflict: "year,month,team_id,kategori_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["economic-budget"] });
    },
  });
}

export function useAutoSuggestMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("auto_suggest_konto_mapping");
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["economic-konto-mapping"] });
    },
  });
}

// Aggregated data hooks
export function useEconomicSummary(year: number) {
  const { data: posteringer, isLoading } = usePosteringerEnriched({ year });
  
  if (isLoading || !posteringer) {
    return { data: null, isLoading: true };
  }
  
  // Calculate summary
  const omsaetning = posteringer
    .filter(p => p.kategori === "Omsætning")
    .reduce((sum, p) => sum + Math.abs(p.beloeb_dkk), 0);
  
  const udgifter = posteringer
    .filter(p => p.kategori !== "Omsætning" && p.beloeb_dkk < 0 && !p.is_balance_account)
    .reduce((sum, p) => sum + Math.abs(p.beloeb_dkk), 0);
  
  const resultat = omsaetning - udgifter;
  
  // Group by month
  const byMonth: Record<string, { omsaetning: number; udgifter: number; resultat: number }> = {};
  posteringer.forEach(p => {
    if (!byMonth[p.maaned]) {
      byMonth[p.maaned] = { omsaetning: 0, udgifter: 0, resultat: 0 };
    }
    if (p.kategori === "Omsætning") {
      byMonth[p.maaned].omsaetning += Math.abs(p.beloeb_dkk);
    } else if (p.beloeb_dkk < 0 && !p.is_balance_account) {
      byMonth[p.maaned].udgifter += Math.abs(p.beloeb_dkk);
    }
  });
  
  Object.keys(byMonth).forEach(m => {
    byMonth[m].resultat = byMonth[m].omsaetning - byMonth[m].udgifter;
  });
  
  // Group by kategori (exclude balance accounts)
  const byKategori: Record<string, number> = {};
  posteringer.filter(p => p.beloeb_dkk < 0 && !p.is_balance_account).forEach(p => {
    if (!byKategori[p.kategori]) {
      byKategori[p.kategori] = 0;
    }
    byKategori[p.kategori] += Math.abs(p.beloeb_dkk);
  });
  
  // Group by team (exclude balance accounts)
  const byTeam: Record<string, number> = {};
  posteringer.filter(p => p.beloeb_dkk < 0 && !p.is_balance_account).forEach(p => {
    if (!byTeam[p.team]) {
      byTeam[p.team] = 0;
    }
    byTeam[p.team] += Math.abs(p.beloeb_dkk);
  });
  
  return {
    data: {
      omsaetning,
      udgifter,
      resultat,
      byMonth,
      byKategori,
      byTeam,
      monthCount: Object.keys(byMonth).length,
    },
    isLoading: false,
  };
}

// Baseline calculation hook
export function useBaselineExclusions() {
  return useQuery({
    queryKey: ["economic-baseline-exclusions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("economic_baseline_exclusions")
        .select("kategori_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map(d => d.kategori_id);
    },
  });
}

export function useUpdateBaselineExclusions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kategoriIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      // Delete existing
      await supabase
        .from("economic_baseline_exclusions")
        .delete()
        .eq("user_id", user.id);
      
      // Insert new
      if (kategoriIds.length > 0) {
        const { error } = await supabase
          .from("economic_baseline_exclusions")
          .insert(kategoriIds.map(id => ({ user_id: user.id, kategori_id: id })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["economic-baseline-exclusions"] });
    },
  });
}
