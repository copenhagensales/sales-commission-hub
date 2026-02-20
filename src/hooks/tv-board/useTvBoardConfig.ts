import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CelebrationSettings {
  enabled: boolean;
  effect: "fireworks" | "confetti" | "stars" | "hearts" | "flames" | "sparkles";
  duration: number;
  triggerCondition: string;
  text: string;
  metric: string;
  sourceDashboard: string | null;
}

export interface TvBoardData {
  id: string;
  dashboard_slug: string;
  dashboard_slugs: string[] | null;
  is_active: boolean;
  access_count: number | null;
  auto_rotate: boolean | null;
  rotate_interval_seconds: number | null;
  rotate_intervals_per_dashboard: Record<string, number> | null;
  celebration_enabled: boolean | null;
  celebration_effect: string | null;
  celebration_duration: number | null;
  celebration_trigger_condition: string | null;
  celebration_text: string | null;
  celebration_metric: string | null;
  celebration_source_dashboard: string | null;
  start_fullscreen: boolean | null;
  expires_at?: string | null;
}

type HardErrorReason = "missing_code" | "invalid" | "inactive" | "expired";

export function useTvBoardConfig(accessCode: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [hardError, setHardError] = useState<{ reason: HardErrorReason; message: string } | null>(null);
  const [transientError, setTransientError] = useState<string | null>(null);
  const [tvData, setTvData] = useState<TvBoardData | null>(null);

  const refreshTimerRef = useRef<number | null>(null);
  const failuresRef = useRef(0);
  const lastHeartbeatRef = useRef(0);

  const HEARTBEAT_INTERVAL = 24 * 60 * 60 * 1000; // 24 timer

  const normalizedCode = useMemo(() => (accessCode || "").trim().toUpperCase(), [accessCode]);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const scheduleNextRefresh = useCallback(
    (success: boolean) => {
      clearRefreshTimer();

      if (success) {
        failuresRef.current = 0;
      } else {
        failuresRef.current += 1;
      }

      // Success path: every 30s. Failure path: quick retries then fall back.
      const backoffSeconds = [2, 5, 10, 20, 30];
      const delaySeconds = success ? 30 : backoffSeconds[Math.min(failuresRef.current - 1, backoffSeconds.length - 1)];

      refreshTimerRef.current = window.setTimeout(() => {
        void refresh();
      }, delaySeconds * 1000);
    },
    // refresh is defined below but stable via useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearRefreshTimer]
  );

  const isLikelyTransient = (err: unknown) => {
    const msg = typeof err === "object" && err && "message" in err ? String((err as any).message) : String(err);
    // Common browser/network errors
    return (
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("Load failed") ||
      msg.includes("fetch")
    );
  };

  const refresh = useCallback(async () => {
    if (!normalizedCode) {
      setHardError({ reason: "missing_code", message: "Ingen adgangskode angivet" });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("tv_board_access")
        .select(
          `
            id,
            dashboard_slug,
            dashboard_slugs,
            is_active,
            access_count,
            auto_rotate,
            rotate_interval_seconds,
            rotate_intervals_per_dashboard,
            celebration_enabled,
            celebration_effect,
            celebration_duration,
            celebration_trigger_condition,
            celebration_text,
            celebration_metric,
            celebration_source_dashboard,
            start_fullscreen,
            expires_at
          `
        )
        .eq("access_code", normalizedCode)
        .maybeSingle();

      if (error) {
        const transient = isLikelyTransient(error);
        if (transient) {
          setTransientError("Midlertidig forbindelsesfejl – forsøger igen …");
          // Keep last known good tvData if we have it
          scheduleNextRefresh(false);
          setLoading(false);
          return;
        }

        // Non-transient: treat as hard error (but keep UI message generic)
        setHardError({ reason: "invalid", message: "Ugyldig eller inaktiv adgangskode" });
        setLoading(false);
        return;
      }

      // No row -> invalid
      if (!data) {
        setHardError({ reason: "invalid", message: "Ugyldig eller inaktiv adgangskode" });
        setLoading(false);
        return;
      }

      // Inactive
      if (!data.is_active) {
        setHardError({ reason: "inactive", message: "Linket er deaktiveret" });
        setLoading(false);
        return;
      }

      // Expired (if feature is used)
      if ((data as any).expires_at) {
        const expiresAt = new Date((data as any).expires_at);
        if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
          setHardError({ reason: "expired", message: "Linket er udløbet" });
          setLoading(false);
          return;
        }
      }

      setTvData(data as TvBoardData);
      setHardError(null);
      setTransientError(null);
      setLoading(false);

      // Daglig heartbeat: opdater last_accessed_at højst én gang per 24 timer
      const now = Date.now();
      if (now - lastHeartbeatRef.current > HEARTBEAT_INTERVAL) {
        lastHeartbeatRef.current = now;
        supabase
          .from("tv_board_access")
          .update({
            last_accessed_at: new Date().toISOString(),
            access_count: (data.access_count || 0) + 1,
          })
          .eq("id", data.id)
          .then(); // fire-and-forget
      }

      scheduleNextRefresh(true);
    } catch (e) {
      const transient = isLikelyTransient(e);
      if (transient) {
        setTransientError("Midlertidig forbindelsesfejl – forsøger igen …");
        scheduleNextRefresh(false);
        setLoading(false);
        return;
      }

      setHardError({ reason: "invalid", message: "Ugyldig eller inaktiv adgangskode" });
      setLoading(false);
    }
  }, [normalizedCode, scheduleNextRefresh]);

  useEffect(() => {
    void refresh();
    return () => clearRefreshTimer();
  }, [refresh, clearRefreshTimer]);

  return {
    loading,
    hardError,
    transientError,
    tvData,
    refresh,
  };
}
