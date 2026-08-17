import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, RefreshCw, PackageX, PowerOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COMPUTER_STATUS_LABELS,
  EQUIPMENT_KINDS,
  EQUIPMENT_LABELS,
  EQUIPMENT_STATUS_LABELS,
  OVERALL_LABELS,
  UPDATE_STATUS_LABELS,
  useSaveWorkstation,
  type ComputerStatus,
  type EquipmentKind,
  type EquipmentStatus,
  type ItWorkstation,
  type UpdateStatus,
  seatLabel,
} from "@/hooks/useItWorkstations";
import { OVERALL_DOT_CLASS } from "./statusStyles";
import { formatSince, stalenessLevel, STALENESS_TEXT_CLASS } from "@/lib/itTime";


interface Props {
  workstation: ItWorkstation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  campaignId?: string;
  onSaved?: () => void;
}

const EQUIPMENT_STATUSES: EquipmentStatus[] = ["ok", "missing", "broken", "unknown"];

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("da-DK", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WorkstationDetailSheet({
  workstation,
  open,
  onOpenChange,
  canEdit,
  campaignId,
  onSaved,
}: Props) {
  const save = useSaveWorkstation();
  const [computerStatus, setComputerStatus] = useState<ComputerStatus>("working");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("unknown");
  const [equipment, setEquipment] = useState<Record<EquipmentKind, EquipmentStatus>>(
    {} as Record<EquipmentKind, EquipmentStatus>,
  );
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!workstation) return;
    setComputerStatus(workstation.computer_status);
    setUpdateStatus(workstation.update_status);
    setNotes(workstation.notes ?? "");
    const map = {} as Record<EquipmentKind, EquipmentStatus>;
    for (const kind of EQUIPMENT_KINDS) {
      map[kind] = workstation.equipment.find((e) => e.kind === kind)?.status ?? "unknown";
    }
    setEquipment(map);
  }, [workstation]);

  if (!workstation) return null;

  const persist = async (
    overrides: Partial<{
      computerStatus: ComputerStatus;
      updateStatus: UpdateStatus;
      equipment: Partial<Record<EquipmentKind, EquipmentStatus>>;
      notes: string | null;
      markUpdatedNow: boolean;
    }> = {},
    successMessage = "Gemt",
  ) => {
    try {
      await save.mutateAsync({
        workstation,
        computerStatus: overrides.computerStatus ?? computerStatus,
        updateStatus: overrides.updateStatus ?? updateStatus,
        equipment: overrides.equipment ?? equipment,
        notes: overrides.notes !== undefined ? overrides.notes : notes,
        markUpdatedNow: overrides.markUpdatedNow,
        campaignId,
      });
      toast.success(`${seatLabel(workstation)}: ${successMessage}`);
      onSaved?.();
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunne ikke gemme ændringen",
      );
      return false;
    }
  };

  const allOk = () =>
    persist(
      {
        computerStatus: "working",
        equipment: EQUIPMENT_KINDS.reduce(
          (acc, kind) => ({ ...acc, [kind]: "ok" as EquipmentStatus }),
          {} as Partial<Record<EquipmentKind, EquipmentStatus>>,
        ),
      },
      "Alt markeret OK",
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-2xl">{seatLabel(workstation)}</SheetTitle>
            <Badge variant="outline" className="gap-1.5">
              <span
                className={cn("h-2 w-2 rounded-full", OVERALL_DOT_CLASS[workstation.overall])}
                aria-hidden="true"
              />
              {OVERALL_LABELS[workstation.overall]}
            </Badge>
          </div>
          <SheetDescription>
            {workstation.area_label} · {workstation.computer_name ?? "Ingen computer"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Meta */}
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/30 p-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Aktiv-ID</dt>
              <dd className="font-medium text-foreground">{workstation.asset_id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Serienummer</dt>
              <dd className="font-medium text-foreground">{workstation.serial_number ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sidst tjekket</dt>
              <dd className="font-medium text-foreground">
                {formatDateTime(workstation.last_checked_at)}
              </dd>
              <dd className={cn("text-xs", STALENESS_TEXT_CLASS[stalenessLevel(workstation.last_checked_at)])}>
                {formatSince(workstation.last_checked_at)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sidst opdateret</dt>
              <dd className="font-medium text-foreground">
                {formatDateTime(workstation.last_updated_at)}
                {workstation.updated_by_name ? ` · ${workstation.updated_by_name}` : ""}
              </dd>
              <dd className={cn("text-xs", STALENESS_TEXT_CLASS[stalenessLevel(workstation.last_updated_at)])}>
                {formatSince(workstation.last_updated_at)}
              </dd>
            </div>
          </dl>


          {canEdit && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Hurtige handlinger</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="default"
                  className="justify-start gap-2"
                  disabled={save.isPending}
                  onClick={() => void allOk()}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Alt OK
                </Button>
                <Button
                  variant="secondary"
                  className="justify-start gap-2"
                  disabled={save.isPending}
                  onClick={() => void persist({ markUpdatedNow: true }, "Markeret som opdateret")}
                >
                  <RefreshCw className="h-4 w-4" />
                  Markér opdateret
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-2"
                  disabled={save.isPending}
                  onClick={() =>
                    void persist(
                      { equipment: { headset: "missing" } },
                      "Headset markeret som manglende",
                    )
                  }
                >
                  <PackageX className="h-4 w-4" />
                  Udstyr mangler
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-2 text-destructive"
                  disabled={save.isPending}
                  onClick={() =>
                    void persist({ computerStatus: "not_working" }, "Computer markeret som nede")
                  }
                >
                  <PowerOff className="h-4 w-4" />
                  PC virker ikke
                </Button>
              </div>
            </section>
          )}

          {/* Status controls */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Status</h3>
            <div className="space-y-2">
              <Label htmlFor="it-computer-status">Computer</Label>
              <Select
                value={computerStatus}
                onValueChange={(v) => setComputerStatus(v as ComputerStatus)}
                disabled={!canEdit}
              >
                <SelectTrigger id="it-computer-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(COMPUTER_STATUS_LABELS) as ComputerStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {COMPUTER_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="it-update-status">Opdatering</Label>
              <Select
                value={updateStatus}
                onValueChange={(v) => setUpdateStatus(v as UpdateStatus)}
                disabled={!canEdit}
              >
                <SelectTrigger id="it-update-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(UPDATE_STATUS_LABELS) as UpdateStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {UPDATE_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* Equipment checklist */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Udstyr</h3>
            <div className="space-y-2">
              {EQUIPMENT_KINDS.map((kind) => (
                <div key={kind} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`it-eq-${kind}`} className="text-sm font-normal">
                    {EQUIPMENT_LABELS[kind]}
                  </Label>
                  <Select
                    value={equipment[kind] ?? "unknown"}
                    onValueChange={(v) =>
                      setEquipment((prev) => ({ ...prev, [kind]: v as EquipmentStatus }))
                    }
                    disabled={!canEdit}
                  >
                    <SelectTrigger id={`it-eq-${kind}`} className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EQUIPMENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {EQUIPMENT_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </section>

          {/* Notes */}
          <section className="space-y-2">
            <Label htmlFor="it-notes">Noter</Label>
            <Textarea
              id="it-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={!canEdit}
              placeholder="Fx: skærm 2 sendt til reparation"
            />
          </section>

          {canEdit && (
            <div className="flex gap-2 pb-4">
              <Button
                className="flex-1 min-h-11"
                disabled={save.isPending}
                onClick={() => {
                  void persist({}, "Ændringer gemt").then((ok) => {
                    if (ok) onOpenChange(false);
                  });
                }}
              >
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gem ændringer
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => onOpenChange(false)}
                disabled={save.isPending}
              >
                Luk
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
