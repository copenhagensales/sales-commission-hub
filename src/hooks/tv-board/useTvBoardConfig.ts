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
      const { data, error } = await supabase.rpc("verify_tv_board_code", {
        p_code: normalizedCode,
      });

      if (error) {
        const transient = isLikelyTransient(error);
        if (transient) {
          setTransientError("Midlertidig forbindelsesfejl – forsøger igen …");
          scheduleNextRefresh(false);
          setLoading(false);
          return;
        }

        setHardError({ reason: "invalid", message: "Ugyldig eller inaktiv adgangskode" });
        setLoading(false);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setHardError({ reason: "invalid", message: "Ugyldig eller inaktiv adgangskode" });
        setLoading(false);
        return;
      }

      if (!row.is_active) {
        setHardError({ reason: "inactive", message: "Linket er deaktiveret" });
        setLoading(false);
        return;
      }

      if ((row as any).expires_at) {
        const expiresAt = new Date((row as any).expires_at);
        if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
          setHardError({ reason: "expired", message: "Linket er udløbet" });
          setLoading(false);
          return;
        }
      }

      setTvData(row as TvBoardData);
      setHardError(null);
      setTransientError(null);
      setLoading(false);

      // Daglig heartbeat: opdater last_accessed_at højst én gang per 24 timer
      const now = Date.now();
      if (now - lastHeartbeatRef.current > HEARTBEAT_INTERVAL) {
        lastHeartbeatRef.current = now;
        supabase.rpc("record_tv_board_heartbeat", { p_id: row.id }).then();
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
