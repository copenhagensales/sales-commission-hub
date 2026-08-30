import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CALCULATION_SETTING_KEYS,
  DEFAULT_CALCULATION_SETTINGS,
  parseCalculationSettings,
  toSettingValue,
  type CalculationSettingKey,
  type CalculationSettings,
} from "@/lib/calculations/calculationSettings";

/**
 * Globale beregningsindstillinger — ÉN kilde til satserne.
 *
 * Alle faner (DB Oversigt, DB per klient, lønberegning, rapporter) skal læse
 * satserne herfra, så samme tal bruges overalt. Kan tabellen ikke læses,
 * bruges DEFAULT_CALCULATION_SETTINGS, som er identiske med den tidligere
 * hardkodede adfærd.
 */

export interface CalculationSettingRowDb {
  key: string;
  value: unknown;
  label: string;
  description: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface UseCalculationSettingsResult {
  settings: CalculationSettings;
  rows: CalculationSettingRowDb[];
  isLoading: boolean;
  /** true når satserne ikke kunne læses og defaults er i brug */
  isFallback: boolean;
  /**
   * Kort signatur af de aktive satser. Brug den i queryKey på afledte
   * beregninger, så de genberegnes når en sats ændres.
   */
  fingerprint: string;
}

export const CALCULATION_SETTINGS_QUERY_KEY = ["calculation-settings"] as const;

export function buildSettingsFingerprint(settings: CalculationSettings): string {
  const r = settings.vacationPayRates;
  return [
    r.seller,
    r.assistant,
    r.staff,
    r.leader,
    settings.workdaysPerMonth,
    settings.atpBarselRate,
    settings.stabTeamId ?? "none",
  ].join("|");
}

export function useCalculationSettings(): UseCalculationSettingsResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: CALCULATION_SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calculation_settings")
        .select("key, value, label, description, updated_at, updated_by")
        .order("key");
      if (error) throw error;
      return (data ?? []) as unknown as CalculationSettingRowDb[];
    },
    // Satserne ændres sjældent, men skal slå igennem uden reload af appen
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const rows = data ?? [];
  const settings = parseCalculationSettings(rows);

  return {
    settings,
    rows,
    isLoading,
    isFallback: isError || (!isLoading && rows.length === 0),
    fingerprint: buildSettingsFingerprint(settings),
  };
}

/** Feriepengesatser alene — bekvemmelighed for komponenter der kun mangler dem. */
export function useVacationPayRates() {
  const { settings, isLoading, isFallback } = useCalculationSettings();
  return { rates: settings.vacationPayRates, isLoading, isFallback };
}

export interface UpdateCalculationSettingInput {
  key: CalculationSettingKey;
  /** Hele det opdaterede settings-objekt — kun den valgte nøgle gemmes */
  settings: CalculationSettings;
}

export function useUpdateCalculationSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, settings }: UpdateCalculationSettingInput) => {
      if (!CALCULATION_SETTING_KEYS.includes(key)) {
        throw new Error(`Ukendt indstilling: ${key}`);
      }
      const value = toSettingValue(key, settings);
      const { data: authData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("calculation_settings")
        .update({
          value: value as never,
          updated_by: authData.user?.id ?? null,
        })
        .eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CALCULATION_SETTINGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["calculation-settings-audit"] });
      // Alle beregninger der afhænger af satserne
      queryClient.invalidateQueries({ queryKey: ["assistant-hours-calculation"] });
      queryClient.invalidateQueries({ queryKey: ["staff-hours-calculation"] });
      queryClient.invalidateQueries({ queryKey: ["client-db-data"] });
      queryClient.invalidateQueries({ queryKey: ["db-overview"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-overhead"] });
      queryClient.invalidateQueries({ queryKey: ["db-data-quality"] });
    },
  });
}

export interface CalculationSettingsAuditRow {
  id: string;
  key: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  changed_by_email: string | null;
  created_at: string;
}

export function useCalculationSettingsAudit(limit = 50) {
  return useQuery({
    queryKey: ["calculation-settings-audit", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calculation_settings_audit")
        .select("id, key, old_value, new_value, changed_by_email, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as CalculationSettingsAuditRow[];
    },
    staleTime: 60 * 1000,
  });
}

export { DEFAULT_CALCULATION_SETTINGS };
export type { CalculationSettings, CalculationSettingKey };
