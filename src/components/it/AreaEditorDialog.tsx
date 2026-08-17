import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  useAddSeats,
  useDeleteWorkstation,
  useItAreaEdges,
  useRenameArea,
  useSaveAreaEdges,
  EDGE_SIDE_LABEL,
  type EdgeSide,
  type ItArea,
} from "@/hooks/useItWorkstations";
import { formatSince, stalenessLevel, STALENESS_TEXT_CLASS } from "@/lib/itTime";

const EDGE_SIDES: EdgeSide[] = ["edge_top", "edge_right", "edge_bottom", "edge_left"];
const EDGE_PLACEHOLDER: Record<EdgeSide, string> = {
  edge_top: "Fx Vinduer mod Nørre Voldgade",
  edge_right: "Fx Glasvæg til område B",
  edge_bottom: "Fx Hovedgang",
  edge_left: "Fx Indgang / elevatorer",
};


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing area to edit. Leave undefined to create a new area. */
  area?: ItArea | null;
  /** Area codes already in use — blocks duplicates when creating. */
  existingCodes?: string[];
}

export function AreaEditorDialog({ open, onOpenChange, area, existingCodes = [] }: Props) {
  const isNew = !area;
  const rename = useRenameArea();
  const addSeats = useAddSeats();
  const deleteSeat = useDeleteWorkstation();
  const { data: edgeMap } = useItAreaEdges(open);
  const saveEdges = useSaveAreaEdges();

  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [seatCount, setSeatCount] = useState("4");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [edges, setEdges] = useState<Record<EdgeSide, string>>({
    edge_top: "",
    edge_right: "",
    edge_bottom: "",
    edge_left: "",
  });

  useEffect(() => {
    if (!open) return;
    setLabel(area?.label ?? "");
    setCode(area?.code ?? "");
    setSeatCount(isNew ? "4" : "1");
    setConfirmDeleteId(null);
  }, [open, area, isNew]);

  useEffect(() => {
    if (!open) return;
    const row = area ? edgeMap?.[area.code] : undefined;
    setEdges({
      edge_top: row?.edge_top ?? "",
      edge_right: row?.edge_right ?? "",
      edge_bottom: row?.edge_bottom ?? "",
      edge_left: row?.edge_left ?? "",
    });
  }, [open, area, edgeMap]);

  const busy =
    rename.isPending || addSeats.isPending || deleteSeat.isPending || saveEdges.isPending;

  const handleSaveEdges = async () => {
    const targetCode = area?.code ?? code.trim().toUpperCase();
    if (!targetCode) return toast.error("Angiv først en områdekode");
    try {
      await saveEdges.mutateAsync({ areaCode: targetCode, edges });
      toast.success("Kanttekster gemt");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke gemme kantteksterne");
    }
  };


  const handleCreate = async () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return toast.error("Angiv en områdekode, fx B");
    if (existingCodes.includes(normalized)) return toast.error("Områdekoden findes allerede");
    if (!label.trim()) return toast.error("Angiv et navn til området");
    try {
      const created = await addSeats.mutateAsync({
        areaCode: normalized,
        areaLabel: label,
        count: Number(seatCount) || 1,
      });
      if (EDGE_SIDES.some((s) => edges[s].trim())) {
        await saveEdges.mutateAsync({ areaCode: normalized, edges });
      }
      toast.success(`Område ${normalized} oprettet med ${created.length} borde`);
      onOpenChange(false);

    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke oprette området");
    }
  };

  const handleRename = async () => {
    if (!area) return;
    if (label.trim() === area.label) return toast.info("Navnet er uændret");
    try {
      await rename.mutateAsync({
        areaCode: area.code,
        label,
        previousLabel: area.label,
      });
      toast.success("Områdenavn opdateret");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke omdøbe området");
    }
  };

  const handleAddSeats = async () => {
    if (!area) return;
    try {
      const created = await addSeats.mutateAsync({
        areaCode: area.code,
        areaLabel: label.trim() || area.label,
        count: Number(seatCount) || 1,
      });
      toast.success(
        created.length === 1
          ? `Bord ${created[0]} tilføjet`
          : `${created.length} borde tilføjet (${created[0]}–${created[created.length - 1]})`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke tilføje borde");
    }
  };

  const handleDelete = async (seatId: string) => {
    const seat = area?.seats.find((s) => s.id === seatId);
    if (!seat) return;
    try {
      await deleteSeat.mutateAsync(seat);
      toast.success(`Bord ${seat.code} fjernet`);
      setConfirmDeleteId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke fjerne bordet");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nyt område" : `Redigér område ${area?.code}`}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "Giv området et navn og opret det antal borde, der står i lokalet."
              : "Omdøb området, og tilføj eller fjern borde efter behov."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isNew && (
            <div className="space-y-2">
              <Label htmlFor="area-code">Områdekode</Label>
              <Input
                id="area-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="Fx B"
                className="font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Bordene navngives automatisk, fx {(code || "B").toUpperCase()}01,{" "}
                {(code || "B").toUpperCase()}02 …
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="area-label">Områdenavn</Label>
            <div className="flex gap-2">
              <Input
                id="area-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Fx Salg – nord"
              />
              {!isNew && (
                <Button variant="secondary" onClick={() => void handleRename()} disabled={busy}>
                  Gem navn
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="area-seats">{isNew ? "Antal borde" : "Tilføj borde"}</Label>
            <div className="flex gap-2">
              <Input
                id="area-seats"
                type="number"
                min={1}
                max={50}
                value={seatCount}
                onChange={(e) => setSeatCount(e.target.value)}
                className="w-28 tabular-nums"
              />
              {!isNew && (
                <Button variant="outline" className="gap-2" onClick={() => void handleAddSeats()} disabled={busy}>
                  <Plus className="h-4 w-4" />
                  Tilføj
                </Button>
              )}
            </div>
          </div>

          {!isNew && area && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Borde i området</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {area.seats.length} borde
                  </span>
                </div>
                <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {area.seats.map((seat) => {
                    const level = stalenessLevel(seat.last_updated_at);
                    return (
                      <li
                        key={seat.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-mono">
                              {seat.code}
                            </Badge>
                            <span className="truncate text-xs text-muted-foreground">
                              {seat.computer_name ?? "Ingen computer"}
                            </span>
                          </div>
                          <p className={cn("mt-0.5 text-xs", STALENESS_TEXT_CLASS[level])}>
                            Opdateret {formatSince(seat.last_updated_at)}
                          </p>
                        </div>
                        {confirmDeleteId === seat.id ? (
                          <div className="flex shrink-0 gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => void handleDelete(seat.id)}
                            >
                              {deleteSeat.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Fjern"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={busy}
                            >
                              Annullér
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Fjern bord ${seat.code}`}
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setConfirmDeleteId(seat.id)}
                            disabled={busy}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {isNew ? (
            <Button onClick={() => void handleCreate()} disabled={busy} className="gap-2">
              {addSeats.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Opret område
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Luk
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
