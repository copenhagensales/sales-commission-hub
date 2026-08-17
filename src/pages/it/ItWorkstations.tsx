import { useMemo, useState } from "react";
import { Search, ArrowRight, MonitorSmartphone, Loader2, ShieldAlert, Plus, Pencil } from "lucide-react";
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
  useItActivityLog,
  useItAreas,
  useItAreaEdges,

  useItCampaigns,
  useItRealtime,
  useItStats,
  useItWorkstations,
  type ItWorkstation,
  type OverallStatus,
  seatLabel,
  DEFAULT_SEATS_PER_ROW,
} from "@/hooks/useItWorkstations";
import { AreaEditorDialog } from "@/components/it/AreaEditorDialog";
import { AreaFloorFrame } from "@/components/it/AreaFloorFrame";


import { usePermissions } from "@/hooks/usePositionPermissions";
import { MainLayout } from "@/components/layout/MainLayout";

function chunkSeats(seats: ItWorkstation[], perRow?: number | null): ItWorkstation[][] {
  const size = Math.min(12, Math.max(1, perRow ?? DEFAULT_SEATS_PER_ROW));
  const rows: ItWorkstation[][] = [];
  for (let i = 0; i < seats.length; i += size) rows.push(seats.slice(i, i + size));
  return rows;
}

type StatusFilter =
  | "all"
  | OverallStatus
  | "update_required"
  | "update_failed"
  | "missing_equipment";

const STATUS_FILTERS: { key: StatusFilter; label: string; dot?: OverallStatus }[] = [
  { key: "all", label: "Alle" },
  { key: "ok", label: "Alt OK", dot: "ok" },
  { key: "attention", label: "Kræver opmærksomhed", dot: "attention" },
  { key: "down", label: "Virker ikke", dot: "down" },
  { key: "update_required", label: "Opdatering påkrævet" },
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
  const { data: activity } = useItActivityLog(8, enabled);
  const { data: campaigns } = useItCampaigns(enabled);
  useItRealtime(enabled);

  const stats = useItStats(workstations);
  const activeCampaign = campaigns?.find((c) => c.is_active) ?? campaigns?.[0];

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


  const matchesStatus = (w: ItWorkstation) => {
    switch (statusFilter) {
      case "all":
        return true;
      case "update_required":
        return w.update_status === "update_required" || w.update_status === "update_in_progress";
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

  const problemQueue = useMemo(
    () => (workstations ?? []).filter(isProblem),
    [workstations],
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
                  setStatusFilter("update_required");
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

      {/* Filters */}
      <section className="space-y-3 border-y border-border px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => {
            const count =
              f.key === "all"
                ? stats.total
                : f.key === "update_required"
                  ? stats.updateRequired
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
                  return (
                    <Card key={code} className="p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono">
                            {code}
                          </Badge>
                          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                          {canEdit && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              aria-label={`Redigér område ${code}`}
                              onClick={() => openAreaEditor(code)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {seats.length} pladser · {attention} kræver opmærksomhed
                        </span>
                      </div>

                      <AreaFloorFrame edges={areaEdges?.[code]}>
                        <div className="space-y-2">
                          {chunkSeats(seats, areaEdges?.[code]?.seats_per_row).map((row, rowIndex, rows) => (
                            <div key={`row-${rowIndex}`}>
                              <div
                                className="grid gap-2"
                                style={{
                                  gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                                }}
                              >
                                {row.map((ws) => (
                                  <WorkstationCard
                                    key={ws.id}
                                    workstation={ws}
                                    onOpen={openWorkstation}
                                    faded={problemsOnly && !isProblem(ws)}
                                    highlighted={!!searchTerm && matchesSearch(ws)}
                                  />
                                ))}
                              </div>
                              {rowIndex < rows.length - 1 &&
                                (areaEdges?.[code]?.row_gap_after ?? []).includes(rowIndex + 1) && (
                                  <div
                                    className="my-3 flex items-center gap-2"
                                    aria-hidden="true"
                                  >
                                    <span className="h-px flex-1 border-t border-dashed border-border" />
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                      Gang
                                    </span>
                                    <span className="h-px flex-1 border-t border-dashed border-border" />
                                  </div>
                                )}
                            </div>
                          ))}
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

    </div>
    </MainLayout>
  );
}
