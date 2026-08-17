import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ============================================================================
// TYPES
// ============================================================================

export type ComputerStatus = "working" | "not_working" | "needs_investigation";
export type UpdateStatus =
  | "updated"
  | "update_required"
  | "update_in_progress"
  | "update_failed"
  | "unknown";
export type EquipmentKind =
  | "computer"
  | "monitor_1"
  | "monitor_2"
  | "headset"
  | "mouse"
  | "keyboard";
export type EquipmentStatus = "ok" | "missing" | "broken" | "unknown";
export type OverallStatus = "ok" | "attention" | "down" | "unknown";

export interface ItEquipment {
  id: string;
  workstation_id: string;
  kind: EquipmentKind;
  status: EquipmentStatus;
  notes: string | null;
}

export interface ItWorkstationRow {
  id: string;
  code: string;
  area_code: string;
  area_label: string;
  seat_order: number;
  computer_name: string | null;
  asset_id: string | null;
  serial_number: string | null;
  computer_status: ComputerStatus;
  update_status: UpdateStatus;
  last_checked_at: string | null;
  last_updated_at: string | null;
  updated_by_name: string | null;
  notes: string | null;
}

/** Visningsnavn: bordene navngives "Bord 1", "Bord 2" ... inden for hvert område. */
export function seatLabel(seat: { seat_order: number }): string {
  return `Bord ${seat.seat_order}`;
}

export interface ItWorkstation extends ItWorkstationRow {
  equipment: ItEquipment[];
  overall: OverallStatus;
  headline: string;
}

export interface ItActivityLog {
  id: string;
  workstation_code: string | null;
  user_name: string | null;
  action: string;
  field: string | null;
  previous_value: string | null;
  new_value: string | null;
  created_at: string;
}

export const EQUIPMENT_KINDS: EquipmentKind[] = [
  "computer",
  "monitor_1",
  "monitor_2",
  "headset",
  "mouse",
  "keyboard",
];

export const EQUIPMENT_LABELS: Record<EquipmentKind, string> = {
  computer: "Computer",
  monitor_1: "Skærm 1",
  monitor_2: "Skærm 2",
  headset: "Headset",
  mouse: "Mus",
  keyboard: "Tastatur",
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  ok: "OK",
  missing: "Mangler",
  broken: "Defekt",
  unknown: "Ukendt",
};

export const COMPUTER_STATUS_LABELS: Record<ComputerStatus, string> = {
  working: "Virker",
  not_working: "Virker ikke",
  needs_investigation: "Skal undersøges",
};

/** Antal dage før en opdateret maskine regnes som forfalden. */
export const UPDATE_OVERDUE_DAYS = 30;

export const UPDATE_STATUS_LABELS: Record<UpdateStatus, string> = {
  updated: "Opdateret",
  update_required: "Ikke opdateret endnu",
  update_in_progress: "Opdatering i gang",
  update_failed: "Opdatering fejlede",
  unknown: "Ukendt",
};

export const OVERALL_LABELS: Record<OverallStatus, string> = {
  ok: "Alt OK",
  attention: "Kræver opmærksomhed",
  down: "Virker ikke",
  unknown: "Ukendt",
};

// ============================================================================
// DERIVATION (single source of truth for status logic)
// ============================================================================

export function deriveWorkstation(
  row: ItWorkstationRow,
  equipment: ItEquipment[],
): ItWorkstation {
  const broken = equipment.filter((e) => e.status === "broken");
  const missing = equipment.filter((e) => e.status === "missing");
  const unknownGear = equipment.filter((e) => e.status === "unknown");

  let overall: OverallStatus;
  let headline: string;

  if (row.computer_status === "not_working") {
    overall = "down";
    headline = "PC nede";
  } else if (
    row.update_status === "unknown" ||
    row.computer_status === "needs_investigation" ||
    (equipment.length > 0 && unknownGear.length === equipment.length)
  ) {
    overall = "unknown";
    headline = "Ikke verificeret";
  } else if (broken.length > 0) {
    overall = "attention";
    headline = "Defekt udstyr";
  } else if (missing.length > 0) {
    overall = "attention";
    headline = "Manglende udstyr";
  } else if (row.update_status === "update_failed") {
    overall = "attention";
    headline = "Opdatering fejlede";
  } else if (!row.last_updated_at) {
    // Aldrig opdateret endnu — udløser ikke en advarsel.
    overall = "ok";
    headline = "Ikke opdateret endnu";
  } else if (isUpdateOverdue(row.last_updated_at)) {
    overall = "attention";
    headline = `Opdatering forfalden (${daysSince(row.last_updated_at)} dage)`;
  } else {
    overall = "ok";
    headline = "Opdateret";
  }

  return { ...row, equipment, overall, headline };
}

// ============================================================================
// ACCESS
// ============================================================================

/** Reflects the same rule as the database: active staff employee + IT permission. */
export function useItAccess() {
  const { user, loading } = useAuth();

  return useQuery({
    queryKey: ["it-access", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.rpc("has_it_access", {
        _user_id: user.id,
      });
      if (error) throw error;
      return Boolean(data);
    },
    enabled: !!user?.id && !loading,
    staleTime: 60_000,
  });
}

export function useItCurrentUserName() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["it-current-user-name", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const email = user.email.toLowerCase();
      const { data } = await supabase
        .from("employee_master_data")
        .select("first_name, last_name")
        .or(`private_email.ilike.${email},work_email.ilike.${email}`)
        .maybeSingle();
      if (!data) return user.email;
      return `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || user.email;
    },
    enabled: !!user?.email,
    staleTime: 5 * 60_000,
  });
}

// ============================================================================
// QUERIES
// ============================================================================

export function useItWorkstations(enabled = true) {
  return useQuery({
    queryKey: ["it-workstations"],
    queryFn: async () => {
      const [wsRes, eqRes] = await Promise.all([
        supabase
          .from("it_workstations")
          .select(
            "id, code, area_code, area_label, seat_order, computer_name, asset_id, serial_number, computer_status, update_status, last_checked_at, last_updated_at, updated_by_name, notes",
          )
          .order("area_code")
          .order("seat_order"),
        supabase
          .from("it_equipment")
          .select("id, workstation_id, kind, status, notes"),
      ]);

      if (wsRes.error) throw wsRes.error;
      if (eqRes.error) throw eqRes.error;

      const byWs = new Map<string, ItEquipment[]>();
      for (const e of (eqRes.data ?? []) as ItEquipment[]) {
        const list = byWs.get(e.workstation_id) ?? [];
        list.push(e);
        byWs.set(e.workstation_id, list);
      }

      return ((wsRes.data ?? []) as ItWorkstationRow[]).map((row) => {
        const equipment = (byWs.get(row.id) ?? []).sort(
          (a, b) => EQUIPMENT_KINDS.indexOf(a.kind) - EQUIPMENT_KINDS.indexOf(b.kind),
        );
        return deriveWorkstation(row, equipment);
      });
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useItActivityLog(limit = 25, enabled = true) {
  return useQuery({
    queryKey: ["it-activity-log", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("it_activity_logs")
        .select(
          "id, workstation_code, user_name, action, field, previous_value, new_value, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ItActivityLog[];
    },
    enabled,
    staleTime: 15_000,
  });
}

export interface ItCampaignProgress {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  total: number;
  completed: number;
  pending: number;
  failed: number;
  percent: number;
}

export function useItCampaigns(enabled = true) {
  return useQuery({
    queryKey: ["it-campaigns"],
    queryFn: async () => {
      const { data: campaigns, error } = await supabase
        .from("it_campaigns")
        .select("id, name, description, is_active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: links, error: linkError } = await supabase
        .from("it_campaign_workstations")
        .select("campaign_id, workstation_id, status");
      if (linkError) throw linkError;

      return (campaigns ?? []).map((c) => {
        const rows = (links ?? []).filter((l) => l.campaign_id === c.id);
        const completed = rows.filter((r) => r.status === "completed").length;
        const failed = rows.filter((r) => r.status === "failed").length;
        const total = rows.length;
        return {
          ...c,
          total,
          completed,
          failed,
          pending: total - completed - failed,
          percent: total > 0 ? Math.round((completed / total) * 100) : 0,
        } as ItCampaignProgress;
      });
    },
    enabled,
    staleTime: 30_000,
  });
}

/** Workstation ids that are still pending/failed in the active campaign. */
export function useActiveCampaignPending(campaignId?: string) {
  return useQuery({
    queryKey: ["it-campaign-pending", campaignId],
    queryFn: async () => {
      if (!campaignId) return [] as string[];
      const { data, error } = await supabase
        .from("it_campaign_workstations")
        .select("workstation_id, status")
        .eq("campaign_id", campaignId)
        .neq("status", "completed");
      if (error) throw error;
      return (data ?? []).map((r) => r.workstation_id);
    },
    enabled: !!campaignId,
    staleTime: 30_000,
  });
}

// ============================================================================
// REALTIME
// ============================================================================

export function useItRealtime(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["it-workstations"] });
      queryClient.invalidateQueries({ queryKey: ["it-activity-log"] });
      queryClient.invalidateQueries({ queryKey: ["it-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["it-campaign-pending"] });
    };

    const channel = supabase
      .channel("it-workstations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "it_workstations" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "it_equipment" }, invalidate)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "it_campaign_workstations" },
        invalidate,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "it_activity_logs" }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}

// ============================================================================
// MUTATIONS
// ============================================================================

interface LogEntry {
  action: string;
  field?: string | null;
  previous?: string | null;
  next?: string | null;
}

export interface SaveWorkstationInput {
  workstation: ItWorkstation;
  computerStatus?: ComputerStatus;
  updateStatus?: UpdateStatus;
  equipment?: Partial<Record<EquipmentKind, EquipmentStatus>>;
  notes?: string | null;
  markUpdatedNow?: boolean;
  /** Optional active campaign to mark completed/failed alongside the update status. */
  campaignId?: string;
}

export function useSaveWorkstation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: userName } = useItCurrentUserName();

  return useMutation({
    mutationFn: async (input: SaveWorkstationInput) => {
      const ws = input.workstation;
      const logs: LogEntry[] = [];
      const nowIso = new Date().toISOString();

      const patch: Record<string, unknown> = { last_checked_at: nowIso };

      if (input.computerStatus && input.computerStatus !== ws.computer_status) {
        patch.computer_status = input.computerStatus;
        logs.push({
          action: `Computerstatus ændret til "${COMPUTER_STATUS_LABELS[input.computerStatus]}"`,
          field: "computer_status",
          previous: COMPUTER_STATUS_LABELS[ws.computer_status],
          next: COMPUTER_STATUS_LABELS[input.computerStatus],
        });
      }

      const nextUpdateStatus = input.markUpdatedNow ? "updated" : input.updateStatus;
      if (nextUpdateStatus && nextUpdateStatus !== ws.update_status) {
        patch.update_status = nextUpdateStatus;
        logs.push({
          action: `Opdateringsstatus ændret til "${UPDATE_STATUS_LABELS[nextUpdateStatus]}"`,
          field: "update_status",
          previous: UPDATE_STATUS_LABELS[ws.update_status],
          next: UPDATE_STATUS_LABELS[nextUpdateStatus],
        });
      }

      if (nextUpdateStatus === "updated") {
        patch.last_updated_at = nowIso;
        patch.updated_by_name = userName ?? null;
        patch.updated_by = user?.id ?? null;
      }

      if (input.notes !== undefined && (input.notes ?? "") !== (ws.notes ?? "")) {
        patch.notes = input.notes;
        logs.push({ action: "Note opdateret", field: "notes" });
      }

      const { error: wsError } = await supabase
        .from("it_workstations")
        .update(patch)
        .eq("id", ws.id);
      if (wsError) throw wsError;

      // Equipment changes
      if (input.equipment) {
        for (const kind of Object.keys(input.equipment) as EquipmentKind[]) {
          const next = input.equipment[kind];
          if (!next) continue;
          const existing = ws.equipment.find((e) => e.kind === kind);
          if (existing && existing.status === next) continue;

          const { error: eqError } = await supabase
            .from("it_equipment")
            .upsert(
              { workstation_id: ws.id, kind, status: next },
              { onConflict: "workstation_id,kind" },
            );
          if (eqError) throw eqError;

          logs.push({
            action: `${EQUIPMENT_LABELS[kind]} markeret som "${EQUIPMENT_STATUS_LABELS[next]}"`,
            field: kind,
            previous: existing ? EQUIPMENT_STATUS_LABELS[existing.status] : null,
            next: EQUIPMENT_STATUS_LABELS[next],
          });
        }
      }

      // Campaign progress follows the update status
      if (input.campaignId && nextUpdateStatus) {
        const campaignStatus =
          nextUpdateStatus === "updated"
            ? "completed"
            : nextUpdateStatus === "update_failed"
              ? "failed"
              : "pending";
        const { error: campError } = await supabase
          .from("it_campaign_workstations")
          .upsert(
            {
              campaign_id: input.campaignId,
              workstation_id: ws.id,
              status: campaignStatus,
              completed_at: campaignStatus === "completed" ? nowIso : null,
              completed_by: campaignStatus === "completed" ? (user?.id ?? null) : null,
              completed_by_name: campaignStatus === "completed" ? (userName ?? null) : null,
            },
            { onConflict: "campaign_id,workstation_id" },
          );
        if (campError) throw campError;
      }

      if (logs.length > 0) {
        const { error: logError } = await supabase.from("it_activity_logs").insert(
          logs.map((l) => ({
            workstation_id: ws.id,
            workstation_code: ws.code,
            user_id: user?.id ?? null,
            user_name: userName ?? null,
            action: `${ws.code}: ${l.action}`,
            field: l.field ?? null,
            previous_value: l.previous ?? null,
            new_value: l.next ?? null,
          })),
        );
        if (logError) throw logError;
      }

      return { changes: logs.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["it-workstations"] });
      queryClient.invalidateQueries({ queryKey: ["it-activity-log"] });
      queryClient.invalidateQueries({ queryKey: ["it-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["it-campaign-pending"] });
    },
  });
}

// ============================================================================
// AGGREGATES
// ============================================================================

export interface ItStats {
  total: number;
  ok: number;
  attention: number;
  down: number;
  unknown: number;
  updated: number;
  updateRequired: number;
  missingEquipment: number;
  brokenEquipment: number;
}

export function useItStats(workstations: ItWorkstation[] | undefined): ItStats {
  return useMemo(() => {
    const list = workstations ?? [];
    return {
      total: list.length,
      ok: list.filter((w) => w.overall === "ok").length,
      attention: list.filter((w) => w.overall === "attention").length,
      down: list.filter((w) => w.overall === "down").length,
      unknown: list.filter((w) => w.overall === "unknown").length,
      updated: list.filter((w) => w.update_status === "updated").length,
      updateRequired: list.filter((w) => w.update_status !== "updated").length,
      missingEquipment: list.filter((w) =>
        w.equipment.some((e) => e.status === "missing"),
      ).length,
      brokenEquipment: list.filter((w) => w.equipment.some((e) => e.status === "broken"))
        .length,
    };
  }, [workstations]);
}

// ============================================================================
// AREA & SEAT MANAGEMENT
// ============================================================================

export interface ItArea {
  code: string;
  label: string;
  seats: ItWorkstation[];
}

export function useItAreas(workstations: ItWorkstation[] | undefined): ItArea[] {
  return useMemo(() => {
    const map = new Map<string, ItArea>();
    for (const w of workstations ?? []) {
      const existing = map.get(w.area_code);
      if (existing) existing.seats.push(w);
      else map.set(w.area_code, { code: w.area_code, label: w.area_label, seats: [w] });
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [workstations]);
}

// ============================================================================
// AREA EDGE LABELS (fx "Vinduer", "Møderum", "Hovedgang")
// ============================================================================

export interface ItAreaEdges {
  area_code: string;
  edge_top: string | null;
  edge_right: string | null;
  edge_bottom: string | null;
  edge_left: string | null;
  /** Antal borde pr. række i gulvplanen (fx 5 i bredden). */
  seats_per_row: number;
  /** Rækkenumre (1-baseret) der efterfølges af et mellemrum/gang. */
  row_gap_after: number[];
  /** Eksplicit antal borde pr. række (fx [4,3,4]). Tom = brug seats_per_row. */
  row_sizes: number[];
}

export const DEFAULT_SEATS_PER_ROW = 4;

export type EdgeSide = "edge_top" | "edge_right" | "edge_bottom" | "edge_left";

export const EDGE_SIDE_LABEL: Record<EdgeSide, string> = {
  edge_top: "Øverste kant",
  edge_right: "Højre kant",
  edge_bottom: "Nederste kant",
  edge_left: "Venstre kant",
};

/** All area edge labels, keyed by area code. */
export function useItAreaEdges(enabled = true) {
  return useQuery({
    queryKey: ["it-area-edges"],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, ItAreaEdges>> => {
      const { data, error } = await supabase
        .from("it_area_edges")
        .select(
          "area_code, edge_top, edge_right, edge_bottom, edge_left, seats_per_row, row_gap_after, row_sizes",
        );
      if (error) throw error;
      const map: Record<string, ItAreaEdges> = {};
      for (const row of data ?? []) {
        map[row.area_code] = {
          ...(row as ItAreaEdges),
          seats_per_row: row.seats_per_row ?? DEFAULT_SEATS_PER_ROW,
          row_gap_after: row.row_gap_after ?? [],
          row_sizes: row.row_sizes ?? [],
        };
      }
      return map;
    },
  });
}

/** Save (upsert) the four edge labels for an area. */
export function useSaveAreaEdges() {
  const queryClient = useQueryClient();
  const log = useItLogger();

  return useMutation({
    mutationFn: async ({
      areaCode,
      edges,
      seatsPerRow,
      rowGapAfter,
      rowSizes,
    }: {
      areaCode: string;
      edges: Record<EdgeSide, string>;
      seatsPerRow?: number;
      rowGapAfter?: number[];
      rowSizes?: number[];
    }) => {
      const clean = (v: string) => {
        const t = v.trim();
        return t.length > 0 ? t : null;
      };
      const { error } = await supabase.from("it_area_edges").upsert(
        {
          area_code: areaCode,
          edge_top: clean(edges.edge_top),
          edge_right: clean(edges.edge_right),
          edge_bottom: clean(edges.edge_bottom),
          edge_left: clean(edges.edge_left),
          seats_per_row: Math.min(12, Math.max(1, seatsPerRow ?? DEFAULT_SEATS_PER_ROW)),
          row_gap_after: [...new Set(rowGapAfter ?? [])].sort((a, b) => a - b),
          row_sizes: (rowSizes ?? [])
            .map((n) => Math.min(12, Math.max(1, Math.round(n))))
            .filter((n) => Number.isFinite(n)),
        },
        { onConflict: "area_code" },
      );
      if (error) throw error;

      await log([
        {
          action: `Layout opdateret for område ${areaCode}`,
          field: "area_edges",
          new_value: (["edge_top", "edge_right", "edge_bottom", "edge_left"] as EdgeSide[])
            .map((s) => `${EDGE_SIDE_LABEL[s]}: ${clean(edges[s]) ?? "—"}`)
            .join(" · "),
        },
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["it-area-edges"] });
      queryClient.invalidateQueries({ queryKey: ["it-activity-log"] });
    },
  });
}


function buildSeatCode(areaCode: string, seatOrder: number) {
  return `${areaCode}${String(seatOrder).padStart(2, "0")}`;
}

function useItLogger() {
  const { user } = useAuth();
  const { data: userName } = useItCurrentUserName();

  return async (entries: {
    workstation_id?: string | null;
    workstation_code?: string | null;
    action: string;
    field?: string | null;
    previous_value?: string | null;
    new_value?: string | null;
  }[]) => {
    if (entries.length === 0) return;
    const { error } = await supabase.from("it_activity_logs").insert(
      entries.map((e) => ({
        workstation_id: e.workstation_id ?? null,
        workstation_code: e.workstation_code ?? null,
        user_id: user?.id ?? null,
        user_name: userName ?? null,
        action: e.action,
        field: e.field ?? null,
        previous_value: e.previous_value ?? null,
        new_value: e.new_value ?? null,
      })),
    );
    if (error) throw error;
  };
}

function useItInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["it-workstations"] });
    queryClient.invalidateQueries({ queryKey: ["it-activity-log"] });
    queryClient.invalidateQueries({ queryKey: ["it-campaigns"] });
    queryClient.invalidateQueries({ queryKey: ["it-campaign-pending"] });
  };
}

/** Rename an area (all seats in it share the label). */
export function useRenameArea() {
  const log = useItLogger();
  const invalidate = useItInvalidate();

  return useMutation({
    mutationFn: async ({
      areaCode,
      label,
      previousLabel,
    }: {
      areaCode: string;
      label: string;
      previousLabel?: string;
    }) => {
      const trimmed = label.trim();
      if (!trimmed) throw new Error("Områdenavnet må ikke være tomt");

      const { error } = await supabase
        .from("it_workstations")
        .update({ area_label: trimmed })
        .eq("area_code", areaCode);
      if (error) throw error;

      await log([
        {
          action: `Område ${areaCode} omdøbt til "${trimmed}"`,
          field: "area_label",
          previous_value: previousLabel ?? null,
          new_value: trimmed,
        },
      ]);
    },
    onSuccess: invalidate,
  });
}

/** Add one or more seats (desks) to an area. Codes are generated automatically. */
export function useAddSeats() {
  const log = useItLogger();
  const invalidate = useItInvalidate();

  return useMutation({
    mutationFn: async ({
      areaCode,
      areaLabel,
      count,
      withEquipment = true,
    }: {
      areaCode: string;
      areaLabel: string;
      count: number;
      withEquipment?: boolean;
    }) => {
      const code = areaCode.trim().toUpperCase();
      const label = areaLabel.trim();
      if (!code) throw new Error("Områdekode mangler");
      if (!label) throw new Error("Områdenavn mangler");
      if (count < 1 || count > 50) throw new Error("Antal borde skal være mellem 1 og 50");

      const { data: existing, error: existingError } = await supabase
        .from("it_workstations")
        .select("code, seat_order")
        .eq("area_code", code);
      if (existingError) throw existingError;

      const taken = new Set((existing ?? []).map((r) => r.code));
      let nextOrder = Math.max(0, ...(existing ?? []).map((r) => r.seat_order)) + 1;

      const rows: { code: string; area_code: string; area_label: string; seat_order: number }[] = [];
      for (let i = 0; i < count; i++) {
        let seatCode = buildSeatCode(code, nextOrder);
        while (taken.has(seatCode)) {
          nextOrder += 1;
          seatCode = buildSeatCode(code, nextOrder);
        }
        taken.add(seatCode);
        rows.push({ code: seatCode, area_code: code, area_label: label, seat_order: nextOrder });
        nextOrder += 1;
      }

      const { data: inserted, error } = await supabase
        .from("it_workstations")
        .insert(rows)
        .select("id, code");
      if (error) throw error;

      if (withEquipment && inserted) {
        const equipmentRows = inserted.flatMap((ws) =>
          EQUIPMENT_KINDS.map((kind) => ({
            workstation_id: ws.id,
            kind,
            status: "unknown" as EquipmentStatus,
          })),
        );
        const { error: eqError } = await supabase
          .from("it_equipment")
          .upsert(equipmentRows, { onConflict: "workstation_id,kind" });
        if (eqError) throw eqError;
      }

      await log(
        (inserted ?? []).map((ws) => ({
          workstation_id: ws.id,
          workstation_code: ws.code,
          action: `${ws.code}: Bord oprettet i område ${code}`,
          field: "workstation",
          new_value: ws.code,
        })),
      );

      return inserted?.map((r) => r.code) ?? [];
    },
    onSuccess: invalidate,
  });
}

/** Delete a single seat and its equipment. */
export function useDeleteWorkstation() {
  const log = useItLogger();
  const invalidate = useItInvalidate();

  return useMutation({
    mutationFn: async (ws: Pick<ItWorkstation, "id" | "code" | "area_code">) => {
      const { error: eqError } = await supabase
        .from("it_equipment")
        .delete()
        .eq("workstation_id", ws.id);
      if (eqError) throw eqError;

      const { error: linkError } = await supabase
        .from("it_campaign_workstations")
        .delete()
        .eq("workstation_id", ws.id);
      if (linkError) throw linkError;

      const { error } = await supabase.from("it_workstations").delete().eq("id", ws.id);
      if (error) throw error;

      await log([
        {
          workstation_code: ws.code,
          action: `${ws.code}: Bord fjernet fra område ${ws.area_code}`,
          field: "workstation",
          previous_value: ws.code,
        },
      ]);
    },
    onSuccess: invalidate,
  });
}
