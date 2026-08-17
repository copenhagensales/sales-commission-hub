import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  MonitorSmartphone,
  Loader2,
  ShieldAlert,
  Plus,
  Minus,
  Pencil,
  Trash2,
  Check,
  SlidersHorizontal,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { WorkstationCard } from "@/components/it/WorkstationCard";
import { WorkstationDetailSheet } from "@/components/it/WorkstationDetailSheet";
import { OVERALL_DOT_CLASS } from "@/components/it/statusStyles";
import {
  useItAccess,
  useItAreas,
  useItAreaEdges,
  useAddSeats,
  useDeleteWorkstation,
  useSaveAreaEdges,
  useItCampaigns,
  useItRealtime,
  useItStats,
  useItWorkstations,
  type ItWorkstation,
  type EdgeSide,
  type OverallStatus,
  seatLabel,
  DEFAULT_SEATS_PER_ROW,
  isUpdateOverdue,
  useToggleEquipmentStatus,
  EQUIPMENT_LABELS,
  EQUIPMENT_STATUS_LABELS,
  type EquipmentKind,
  type EquipmentStatus,
} from "@/hooks/useItWorkstations";
import { AreaEditorDialog } from "@/components/it/AreaEditorDialog";
import { AreaFloorFrame } from "@/components/it/AreaFloorFrame";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";



import { usePermissions } from "@/hooks/usePositionPermissions";
import { MainLayout } from "@/components/layout/MainLayout";

function chunkSeats(
  seats: ItWorkstation[],
  perRow?: number | null,
  rowSizes?: number[] | null,
): ItWorkstation[][] {
  const size = Math.min(12, Math.max(1, perRow ?? DEFAULT_SEATS_PER_ROW));
  const rows: ItWorkstation[][] = [];
  let i = 0;
  let r = 0;
  while (i < seats.length) {
    const explicit = rowSizes?.[r];
    const take = Math.min(12, Math.max(1, explicit ?? size));
    rows.push(seats.slice(i, i + take));
    i += take;
    r += 1;
  }
  return rows;
}

type StatusFilter =
  | "all"
  | OverallStatus
  | "update_overdue"
  | "campaign_pending"
  | "update_failed"
  | "missing_equipment";

const EQUIPMENT_ICONS: Record<EquipmentKind, typeof Laptop> = {
  computer: Laptop,
  monitor_1: Monitor,
  monitor_2: Monitor,
  headset: Headphones,
  mouse: Mouse,
  keyboard: Keyboard,
};

const EQUIPMENT_ORDER: EquipmentKind[] = [
  "computer",
  "monitor_1",
  "monitor_2",
  "headset",
  "mouse",
  "keyboard",
];

const STATUS_FILTERS: { key: StatusFilter; label: string; dot?: OverallStatus }[] = [
  { key: "all", label: "Alle" },
  { key: "ok", label: "Alt OK", dot: "ok" },
  { key: "attention", label: "Kræver opmærksomhed", dot: "attention" },
  { key: "down", label: "Virker ikke", dot: "down" },
  { key: "update_overdue", label: "Opdatering forfalden (30+ dage)" },
  { key: "update_failed", label: "Opdatering fejlede" },
  { key: "missing_equipment", label: "Manglende udstyr" },
  { key: "unknown", label: "Ukendt", dot: "unknown" },
];

function StatCard({
  label,
  value,
  hint,
  dot,
}: {
  label: string;
  value: number | string;
  hint: string;
  dot?: OverallStatus;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        {dot && (
          <span
            className={cn("h-2 w-2 rounded-full", OVERALL_DOT_CLASS[dot])}
            aria-hidden="true"
          />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

export default function ItWorkstations() {
  const p = usePermissions();
  const canEdit = p.canEdit?.("menu_it_workstations") ?? false;
  const { data: hasAccess, isLoading: accessLoading } = useItAccess();

  const enabled = hasAccess === true;
  const { data: workstations, isLoading, isError, refetch } = useItWorkstations(enabled);
  const { data: campaigns } = useItCampaigns(enabled);
  useItRealtime(enabled);

  const stats = useItStats(workstations);
  const activeCampaign = campaigns?.find((c) => c.is_active) ?? campaigns?.[0];

  const toggleEquipment = useToggleEquipmentStatus();

  const handleToggleEquipment = (
    ws: ItWorkstation,
    kind: EquipmentKind,
    next: EquipmentStatus,
  ) => {
    const previous = ws.equipment.find((e) => e.kind === kind)?.status ?? "unknown";
    toggleEquipment.mutate(
      { workstation: ws, kind, next },
      {
        onSuccess: () => {
          toast.success(
            `${seatLabel(ws)}: ${EQUIPMENT_LABELS[kind]} → ${EQUIPMENT_STATUS_LABELS[next]}`,
            {
              action: {
                label: "Fortryd",
                onClick: () =>
                  toggleEquipment.mutate({ workstation: ws, kind, next: previous }),
              },
            },
          );
        },
        onError: () => toast.error("Kunne ikke gemme ændringen"),
      },
    );
  };

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [selected, setSelected] = useState<ItWorkstation | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [areaBeingEdited, setAreaBeingEdited] = useState<string | null>(null);

  const areaList = useItAreas(workstations);
  const { data: areaEdges } = useItAreaEdges(enabled);

  const areas = useMemo(
    () => areaList.map((a) => [a.code, a.label] as [string, string]),
    [areaList],
  );
  const editingArea = areaList.find((a) => a.code === areaBeingEdited) ?? null;

  const openAreaEditor = (code: string | null) => {
    setAreaBeingEdited(code);
    setAreaDialogOpen(true);
  };

  // ---- Inline redigering af borde og mellemrum direkte i gulvplanen ----
  const [layoutEditAreas, setLayoutEditAreas] = useState<string[]>([]);
  const [seatToDelete, setSeatToDelete] = useState<ItWorkstation | null>(null);
  const addSeats = useAddSeats();
  const deleteSeat = useDeleteWorkstation();
  const saveEdges = useSaveAreaEdges();

  const isLayoutEdit = (code: string) => layoutEditAreas.includes(code);
  const toggleLayoutEdit = (code: string) =>
    setLayoutEditAreas((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );

  const edgeValues = (code: string): Record<EdgeSide, string> => {
    const row = areaEdges?.[code];
    return {
      edge_top: row?.edge_top ?? "",
      edge_right: row?.edge_right ?? "",
      edge_bottom: row?.edge_bottom ?? "",
      edge_left: row?.edge_left ?? "",
    };
  };

  const handleAddSeat = async (code: string, label: string) => {
    try {
      const created = await addSeats.mutateAsync({ areaCode: code, areaLabel: label, count: 1 });
      toast.success(`Bord ${created[0]} tilføjet`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke tilføje bordet");
    }
  };

  const handleDeleteSeat = async (ws: ItWorkstation) => {
    try {
      await deleteSeat.mutateAsync(ws);
      toast.success(`${seatLabel(ws)} fjernet`);
      setSeatToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke fjerne bordet");
    }
  };

  const toggleRowGap = async (code: string, row: number) => {
    const current = areaEdges?.[code]?.row_gap_after ?? [];
    const next = current.includes(row)
      ? current.filter((r) => r !== row)
      : [...current, row].sort((a, b) => a - b);
    try {
      await saveEdges.mutateAsync({
        areaCode: code,
        edges: edgeValues(code),
        seatsPerRow: areaEdges?.[code]?.seats_per_row ?? DEFAULT_SEATS_PER_ROW,
        rowGapAfter: next,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke gemme mellemrummet");
    }
  };

  /** Ændrer antal borde i én specifik række (fx 3 i én række, 4 i næste). */
  const adjustRowSize = async (
    code: string,
    rowIndex: number,
    delta: number,
    currentRowLengths: number[],
  ) => {
    const next = currentRowLengths.slice(0, rowIndex + 1);
    next[rowIndex] = Math.min(12, Math.max(1, (next[rowIndex] ?? 0) + delta));
    try {
      await saveEdges.mutateAsync({
        areaCode: code,
        edges: edgeValues(code),
        seatsPerRow: areaEdges?.[code]?.seats_per_row ?? DEFAULT_SEATS_PER_ROW,
        rowGapAfter: areaEdges?.[code]?.row_gap_after ?? [],
        rowSizes: next,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke gemme rækken");
    }
  };




  const matchesStatus = (w: ItWorkstation) => {
    switch (statusFilter) {
      case "all":
        return true;
      case "update_overdue":
        return isUpdateOverdue(w.last_updated_at);
      case "campaign_pending":
        return w.update_status !== "updated";
      case "update_failed":
        return w.update_status === "update_failed";
      case "missing_equipment":
        return w.equipment.some((e) => e.status === "missing" || e.status === "broken");
      default:
        return w.overall === statusFilter;
    }
  };

  const searchTerm = search.trim().toLowerCase();
  const matchesSearch = (w: ItWorkstation) =>
    !searchTerm ||
    [w.code, seatLabel(w), w.computer_name, w.asset_id, w.serial_number]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(searchTerm));

  const isProblem = (w: ItWorkstation) => w.overall !== "ok";

  const visible = useMemo(
    () =>
      (workstations ?? []).filter(
        (w) =>
          matchesStatus(w) &&
          matchesSearch(w) &&
          (areaFilter === "all" || w.area_code === areaFilter),
      ),
    [workstations, statusFilter, searchTerm, areaFilter],
  );


  const openWorkstation = (ws: ItWorkstation) => {
    setSelected(ws);
    setSheetOpen(true);
  };

  // Keep the sheet in sync with realtime data
  const selectedLive = selected
    ? (workstations ?? []).find((w) => w.id === selected.id) ?? selected
    : null;

  if (accessLoading) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!hasAccess) {
    return (
      <MainLayout>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">Ingen adgang til IT-modulet</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          IT-overblikket er forbeholdt stab med IT-rettigheden. Kontakt en ejer, hvis du skal
          have adgang.
        </p>
      </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-sm font-bold text-primary">
              IT
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Arbejdsstationer
              </h1>
              <p className="text-xs text-muted-foreground">
                Copenhagen HQ · live status
              </p>
            </div>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Søg arbejdsstation"
              placeholder="Søg plads, computer, aktiv-ID, serienr."
              className="pl-9"
            />
          </div>
        </div>
      </header>

      {/* KPI row */}
      <section className="grid gap-3 px-4 py-4 sm:px-6 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Arbejdsstationer" value={stats.total} hint={`${areas.length} områder`} />
        <StatCard label="Alt OK" value={stats.ok} hint="opdateret & komplet" dot="ok" />
        <StatCard
          label="Kræver opmærksomhed"
          value={stats.attention}
          hint="udstyr eller opdatering"
          dot="attention"
        />
        <StatCard label="Virker ikke" value={stats.down} hint="hardware nede" dot="down" />
        <StatCard label="Ukendt" value={stats.unknown} hint="ikke tjekket" dot="unknown" />

        <Card className="p-4">
          {activeCampaign ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Kampagne
                </span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {activeCampaign.percent}%
                </span>
              </div>
              <p className="mt-1 truncate text-xs font-medium text-foreground">
                {activeCampaign.name}
              </p>
              <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                <span className="text-2xl font-semibold text-foreground">
                  {activeCampaign.completed}
                </span>{" "}
                / {activeCampaign.total} opdateret
              </p>
              <Progress value={activeCampaign.percent} className="mt-2 h-2" />
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("campaign_pending");
                  setProblemsOnly(false);
                }}
                className="mt-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                Vis de {activeCampaign.pending + activeCampaign.failed} der mangler →
              </button>
            </>
          ) : (
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Kampagne
              </span>
              <p className="text-sm text-muted-foreground">Ingen aktiv kampagne</p>
            </div>
          )}
        </Card>
      </section>

      {/* Manglende udstyr pr. type */}
      {missingByKind.total > 0 && (
        <section className="px-4 pb-4 sm:px-6">
          <Card className="p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Manglende udstyr
              </span>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("missing_equipment");
                  setProblemsOnly(false);
                }}
                className="text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                Vis berørte borde →
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {missingByKind.rows.map((row) => {
                const Icon = EQUIPMENT_ICONS[row.kind];
                return (
                  <div
                    key={row.kind}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-border px-3 py-2",
                      row.count > 0 ? "bg-destructive/5 border-destructive/30" : "opacity-60",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        row.count > 0 ? "text-destructive" : "text-muted-foreground",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs text-muted-foreground">
                        {EQUIPMENT_LABELS[row.kind]}
                      </p>
                      <p
                        className={cn(
                          "text-lg font-semibold tabular-nums",
                          row.count > 0 ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {row.count}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              I alt {missingByKind.total} markeringer ({missingByKind.missing} mangler,{" "}
              {missingByKind.broken} defekte) på {missingByKind.stations} borde.
            </p>
          </Card>
        </section>
      )}

      {/* Filters */}
      <section className="space-y-3 border-y border-border px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => {
            const count =
              f.key === "all"
                ? stats.total
                : f.key === "update_overdue"
                  ? stats.updateOverdue
                  : f.key === "missing_equipment"
                    ? stats.missingEquipment
                    : f.key === "update_failed"
                      ? (workstations ?? []).filter((w) => w.update_status === "update_failed")
                          .length
                      : (workstations ?? []).filter((w) => w.overall === f.key).length;
            const active = statusFilter === f.key;
            return (
              <Button
                key={f.key}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => setStatusFilter(f.key)}
                aria-pressed={active}
                className="h-9 gap-2 rounded-full"
              >
                {f.dot && (
                  <span
                    className={cn("h-2 w-2 rounded-full", OVERALL_DOT_CLASS[f.dot])}
                    aria-hidden="true"
                  />
                )}
                {f.label}
                <span className="tabular-nums opacity-70">{count}</span>
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={areaFilter === "all" ? "default" : "outline"}
              onClick={() => setAreaFilter("all")}
              aria-pressed={areaFilter === "all"}
              className="h-9 rounded-full"
            >
              Alle områder
            </Button>
            {areas.map(([code, label]) => (
              <Button
                key={code}
                size="sm"
                variant={areaFilter === code ? "default" : "outline"}
                onClick={() => setAreaFilter(code)}
                aria-pressed={areaFilter === code}
                className="h-9 rounded-full"
              >
                <span className="font-mono opacity-70">{code}</span>
                <span className="ml-1.5">{label}</span>
              </Button>
            ))}
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openAreaEditor(null)}
                className="h-9 gap-1.5 rounded-full"
              >
                <Plus className="h-4 w-4" />
                Nyt område
              </Button>
            )}
          </div>


          <div className="flex items-center gap-2">
            <Switch
              id="problems-only"
              checked={problemsOnly}
              onCheckedChange={setProblemsOnly}
            />
            <Label htmlFor="problems-only" className="cursor-pointer text-sm">
              Vis kun problemer
            </Label>
          </div>
        </div>
      </section>

      {/* Floor map + activity */}
      <div className="grid gap-6 px-4 py-6 sm:px-6">
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">
              Gulvplan{" "}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {visible.length} af {stats.total} vist
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {(["ok", "attention", "down", "unknown"] as OverallStatus[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span
                    className={cn("h-2 w-2 rounded-full", OVERALL_DOT_CLASS[s])}
                    aria-hidden="true"
                  />
                  {s === "ok"
                    ? "Alt OK"
                    : s === "attention"
                      ? "Kræver opmærksomhed"
                      : s === "down"
                        ? "Virker ikke"
                        : "Ukendt"}
                </span>
              ))}
            </div>
          </div>

          {isLoading && (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          )}

          {isError && (
            <Card className="flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Kunne ikke hente arbejdsstationerne.
              </p>
              <Button onClick={() => void refetch()}>Prøv igen</Button>
            </Card>
          )}

          {!isLoading && !isError && visible.length === 0 && (
            <Card className="flex flex-col items-center gap-2 p-10 text-center">
              <MonitorSmartphone className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Ingen arbejdsstationer matcher</p>
              <p className="text-xs text-muted-foreground">
                Justér søgning eller filtre for at se flere pladser.
              </p>
            </Card>
          )}

          {!isLoading && !isError && visible.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {areas
                .filter(([code]) => visible.some((w) => w.area_code === code))
                .map(([code, label]) => {
                  const seats = visible.filter((w) => w.area_code === code);
                  const attention = seats.filter(isProblem).length;
                  const editing = canEdit && isLayoutEdit(code);
                  const gapRows = areaEdges?.[code]?.row_gap_after ?? [];
                  const seatRows = chunkSeats(
                    seats,
                    areaEdges?.[code]?.seats_per_row,
                    areaEdges?.[code]?.row_sizes,
                  );
                  const rowLengths = seatRows.map((r) => r.length);
                  return (
                    <Card key={code} className={cn("p-4", editing && "ring-1 ring-primary/40")}>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono">
                            {code}
                          </Badge>
                          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                          {canEdit && (
                            <>
                              <Button
                                size="sm"
                                variant={editing ? "default" : "ghost"}
                                className="h-7 gap-1.5 px-2 text-xs"
                                aria-pressed={editing}
                                onClick={() => toggleLayoutEdit(code)}
                              >
                                {editing ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" />
                                    Færdig
                                  </>
                                ) : (
                                  <>
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                    Redigér borde
                                  </>
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                aria-label={`Områdeindstillinger for ${code}`}
                                onClick={() => openAreaEditor(code)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {seats.length} pladser · {attention} kræver opmærksomhed
                        </span>
                      </div>

                      {editing && (
                        <p className="mb-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                          Klik på papirkurven for at slette et bord, brug "Tilføj bord" nederst,
                          klik på en stiplet linje for mellemrum, og brug −/+ ude til højre for en
                          række for at ændre antal borde i netop den række.
                        </p>
                      )}

                      <AreaFloorFrame edges={areaEdges?.[code]}>
                        <div className="space-y-2">
                          {seatRows.map((row, rowIndex, rows) => (
                            <div key={`row-${rowIndex}`}>
                              <div className="flex items-stretch gap-2">
                              <div
                                className="grid flex-1 gap-2"
                                style={{
                                  gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                                }}
                              >
                                {row.map((ws) => (
                                  <div key={ws.id} className="relative min-w-0">
                                    <WorkstationCard
                                      workstation={ws}
                                      onOpen={openWorkstation}
                                      onToggleEquipment={
                                        canEdit ? handleToggleEquipment : undefined
                                      }
                                      faded={problemsOnly && !isProblem(ws)}
                                      highlighted={!!searchTerm && matchesSearch(ws)}
                                    />
                                    {editing && (
                                      <Button
                                        size="icon"
                                        variant="destructive"
                                        aria-label={`Slet ${seatLabel(ws)}`}
                                        className="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full shadow-md"
                                        disabled={deleteSeat.isPending}
                                        onClick={() => setSeatToDelete(ws)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {editing && (
                                <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border px-1 py-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    aria-label={`Færre borde i række ${rowIndex + 1}`}
                                    disabled={saveEdges.isPending || row.length <= 1}
                                    onClick={() =>
                                      void adjustRowSize(code, rowIndex, -1, rowLengths)
                                    }
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="text-[10px] font-medium text-muted-foreground">
                                    {row.length}
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    aria-label={`Flere borde i række ${rowIndex + 1}`}
                                    disabled={saveEdges.isPending || row.length >= 12}
                                    onClick={() =>
                                      void adjustRowSize(code, rowIndex, 1, rowLengths)
                                    }
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                              </div>
                              {rowIndex < rows.length - 1 &&
                                (editing ? (
                                  <button
                                    type="button"
                                    onClick={() => void toggleRowGap(code, rowIndex + 1)}
                                    disabled={saveEdges.isPending}
                                    aria-pressed={gapRows.includes(rowIndex + 1)}
                                    className={cn(
                                      "my-2 flex w-full items-center justify-center rounded-lg transition-colors",
                                      gapRows.includes(rowIndex + 1)
                                        ? "my-3 border border-border bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0px,hsl(var(--muted))_8px,hsl(var(--background))_8px,hsl(var(--background))_16px)] py-2.5 hover:border-destructive/50"
                                        : "gap-2 border border-dashed border-border/60 py-1.5 hover:bg-muted/60",
                                    )}
                                  >
                                    {gapRows.includes(rowIndex + 1) ? (
                                      <span className="rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-foreground shadow-sm">
                                        Gang — klik for at fjerne
                                      </span>
                                    ) : (
                                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                                        Tilføj mellemrum
                                      </span>
                                    )}
                                  </button>
                                ) : (
                                  gapRows.includes(rowIndex + 1) && (
                                    <div
                                      className="my-3 flex items-center justify-center rounded-lg border border-border bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0px,hsl(var(--muted))_8px,hsl(var(--background))_8px,hsl(var(--background))_16px)] py-2.5"
                                      aria-label="Gangareal"
                                    >
                                      <span className="rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shadow-sm">
                                        Gang
                                      </span>
                                    </div>
                                  )
                                ))}
                            </div>
                          ))}

                          {editing && (
                            <Button
                              variant="outline"
                              className="mt-2 w-full gap-2 border-dashed"
                              disabled={addSeats.isPending}
                              onClick={() => void handleAddSeat(code, label)}
                            >
                              {addSeats.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                              Tilføj bord
                            </Button>
                          )}
                        </div>
                      </AreaFloorFrame>

                    </Card>
                  );
                })}

            </div>
          )}
        </section>


      </div>

      <WorkstationDetailSheet
        workstation={selectedLive}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        canEdit={canEdit}
        campaignId={activeCampaign?.id}
      />

      <AreaEditorDialog
        open={areaDialogOpen}
        onOpenChange={setAreaDialogOpen}
        area={editingArea}
        existingCodes={areaList.map((a) => a.code)}
      />

      <AlertDialog open={!!seatToDelete} onOpenChange={(o) => !o && setSeatToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Slet {seatToDelete ? seatLabel(seatToDelete) : "bordet"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bordet og dets udstyr fjernes permanent fra gulvplanen. Handlingen kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSeat.isPending}>Annullér</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (seatToDelete) void handleDeleteSeat(seatToDelete);
              }}
              disabled={deleteSeat.isPending}
            >
              {deleteSeat.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Slet bord
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div>
    </MainLayout>
  );
}
