import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Contract policy settings — single source of truth for all contract rules
 * (reminders, system locks, management digest, UI warnings).
 *
 * SAFETY: if the settings cannot be read (network error, empty table, RLS),
 * DEFAULT_CONTRACT_POLICY is used. These defaults are byte-for-byte identical
 * to the previously hardcoded behaviour, so the system never becomes stricter
 * or looser than today by accident.
 */

export type ContractPolicyKey =
  | "employee_reminder"
  | "pending_lock"
  | "rejected_lock"
  | "management_digest"
  | "ui_warning";

export interface ContractPolicyRow {
  key: ContractPolicyKey;
  enabled: boolean;
  config: Record<string, unknown>;
  updated_at: string | null;
  updated_by: string | null;
}

export interface ReminderConfig {
  first_after_days: number;
  interval_days: number;
  max_reminders: number;
}

export interface PendingLockConfig {
  days: number;
}

export interface DigestConfig {
  recipients: string[];
  weekdays_only: boolean;
}

export interface UiWarningConfig {
  warn_days_before_start: number;
}

export const DEFAULT_CONTRACT_POLICY: Record<
  ContractPolicyKey,
  { enabled: boolean; config: Record<string, unknown> }
> = {
  employee_reminder: {
    enabled: true,
    config: { first_after_days: 3, interval_days: 3, max_reminders: 3 },
  },
  pending_lock: { enabled: true, config: { days: 5 } },
  rejected_lock: { enabled: true, config: {} },
  management_digest: { enabled: false, config: { recipients: [], weekdays_only: true } },
  ui_warning: { enabled: true, config: { warn_days_before_start: 7 } },
};

/** Guardrails — a lock can be disabled, but never set to an absurd threshold. */
export const POLICY_LIMITS = {
  pending_lock_days: { min: 1, max: 90 },
  first_after_days: { min: 1, max: 60 },
  interval_days: { min: 1, max: 60 },
  max_reminders: { min: 1, max: 20 },
  warn_days_before_start: { min: 0, max: 60 },
} as const;

export const clampPolicyNumber = (
  value: number,
  limit: { min: number; max: number },
  fallback: number
): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(limit.max, Math.max(limit.min, Math.round(value)));
};

const buildPolicyMap = (rows: ContractPolicyRow[] | null | undefined) => {
  const map = { ...DEFAULT_CONTRACT_POLICY } as Record<
    ContractPolicyKey,
    { enabled: boolean; config: Record<string, unknown>; updated_at?: string | null }
  >;
  (rows ?? []).forEach((row) => {
    if (!(row.key in DEFAULT_CONTRACT_POLICY)) return;
    map[row.key] = {
      enabled: row.enabled,
      // Merge onto defaults so a partially filled config never yields undefined numbers
      config: { ...DEFAULT_CONTRACT_POLICY[row.key].config, ...(row.config ?? {}) },
      updated_at: row.updated_at,
    };
  });
  return map;
};

export function useContractPolicy() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contract-policy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_policy_settings")
        .select("key, enabled, config, updated_at, updated_by");
      if (error) throw error;
      return (data ?? []) as unknown as ContractPolicyRow[];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const policy = buildPolicyMap(data);

  const updatePolicy = useMutation({
    mutationFn: async (input: {
      key: ContractPolicyKey;
      enabled: boolean;
      config: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from("contract_policy_settings")
        .update({
          enabled: input.enabled,
          config: input.config as never,
          updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
        })
        .eq("key", input.key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-policy"] });
      queryClient.invalidateQueries({ queryKey: ["contract-policy-audit"] });
      queryClient.invalidateQueries({ queryKey: ["pending-contract-lock"] });
      queryClient.invalidateQueries({ queryKey: ["rejected-contract-lock"] });
    },
  });

  return {
    policy,
    /** True while loading — callers must NOT lock users out before this resolves. */
    isLoading,
    /** True when settings could not be read; defaults are in effect. */
    isFallback: isError || (!isLoading && (data?.length ?? 0) === 0),
    reminder: policy.employee_reminder.config as unknown as ReminderConfig,
    reminderEnabled: policy.employee_reminder.enabled,
    pendingLockDays: clampPolicyNumber(
      (policy.pending_lock.config as unknown as PendingLockConfig).days,
      POLICY_LIMITS.pending_lock_days,
      5
    ),
    pendingLockEnabled: policy.pending_lock.enabled,
    rejectedLockEnabled: policy.rejected_lock.enabled,
    digest: policy.management_digest.config as unknown as DigestConfig,
    digestEnabled: policy.management_digest.enabled,
    uiWarning: policy.ui_warning.config as unknown as UiWarningConfig,
    uiWarningEnabled: policy.ui_warning.enabled,
    updatePolicy,
  };
}

export interface ContractPolicyAuditRow {
  id: string;
  key: string;
  old_enabled: boolean | null;
  new_enabled: boolean | null;
  old_config: Record<string, unknown> | null;
  new_config: Record<string, unknown> | null;
  changed_by_email: string | null;
  created_at: string;
}

export function useContractPolicyAudit(limit = 50) {
  return useQuery({
    queryKey: ["contract-policy-audit", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_policy_audit")
        .select("id, key, old_enabled, new_enabled, old_config, new_config, changed_by_email, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as ContractPolicyAuditRow[];
    },
    staleTime: 60 * 1000,
  });
}
