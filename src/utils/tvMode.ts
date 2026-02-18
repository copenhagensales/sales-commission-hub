/**
 * Shared TV mode detection and utilities.
 * Centralizes TV mode logic used across all dashboard pages.
 * 
 * Master plan: Ensartet API-standard + DRY utilities.
 */

import { useEffect } from "react";

/**
 * Check if the current page is in TV mode.
 * Detects /t/ and /tv/ routes plus sessionStorage flag.
 */
export function isTvMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.pathname.startsWith("/t/") ||
    window.location.pathname.startsWith("/tv/") ||
    sessionStorage.getItem("tv_board_code") !== null
  );
}

/**
 * Auto-reload page at fixed intervals (for TV displays to pick up code/layout changes).
 * Only active when `enabled` is true.
 * 
 * @param enabled - Whether auto-reload is active (typically `isTvMode()`)
 * @param intervalMs - Reload interval in ms (default: 5 minutes)
 */
export function useAutoReload(enabled: boolean, intervalMs = 5 * 60 * 1000) {
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      window.location.reload();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs]);
}

/**
 * Standard refresh profiles per dashboard type.
 * Ensures consistent, documented refetch behavior.
 */
export const REFRESH_PROFILES = {
  /** TV live views: fast refresh for real-time visibility */
  tv: {
    staleTime: 15_000,       // 15 seconds
    refetchInterval: 30_000, // 30 seconds
  },
  /** Standard dashboards: balanced refresh */
  dashboard: {
    staleTime: 30_000,       // 30 seconds
    refetchInterval: 60_000, // 1 minute
  },
  /** Background/config data: infrequent refresh */
  config: {
    staleTime: 5 * 60_000,       // 5 minutes
    refetchInterval: 10 * 60_000, // 10 minutes
  },
  /** Permissions/roles: rarely change during session */
  permissions: {
    staleTime: 15 * 60_000, // 15 minutes
    gcTime: 30 * 60_000,    // 30 minutes
    refetchOnWindowFocus: false,
  },
} as const;
