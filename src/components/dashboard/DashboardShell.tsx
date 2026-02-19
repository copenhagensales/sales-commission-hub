/**
 * DashboardShell: Unified layout for all dashboard pages.
 * 
 * mode="dashboard" → sidebar, header, auth, padding (default)
 * mode="tv" → fullscreen, cursor hidden, auto-reload, no auth
 * 
 * Replaces direct usage of DashboardLayout and ad-hoc TV wrappers.
 */
import { ReactNode } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { isTvMode } from "@/utils/tvMode";

interface DashboardShellProps {
  children: ReactNode;
  /** Override auto-detected mode */
  mode?: "dashboard" | "tv";
}

export function DashboardShell({ children, mode }: DashboardShellProps) {
  const detectedMode = mode || (isTvMode() ? "tv" : "dashboard");

  // DashboardLayout already handles both modes:
  // - dashboard: sidebar, header, auth, padding
  // - tv: passthrough with minimal wrapper
  return <DashboardLayout>{children}</DashboardLayout>;
}
