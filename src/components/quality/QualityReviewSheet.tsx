import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { formatDanishTime } from "@/lib/qualityDates";
import {
  deriveQualityResult,
  QUALITY_RESULT_LABEL,
  useQualityChecklist,
  useQualityErrorCodes,
  useSaveQualityReview,
  type QualityItemState,
  type QualityQueueRow,
} from "@/hooks/useQualityControl";

interface Props {
  sale: QualityQueueRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (saleId: string) => void;
}

const STATE_LABEL: Record<QualityItemState, string> = {
  ok: "OK",
  mangler: "Mangler",
  ikke_relevant: "Ikke relevant",
};

export function QualityReviewSheet({ sale, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const { data: checklistData, isLoading: checklistLoading } = useQualityChecklist(
    sale?.client_campaign_id,
  );
  const { data: errorCodes } = useQualityErrorCodes();
  const saveReview = useSaveQualityReview();

  const [states, setStates] = useState<Record<string, QualityItemState>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const startedAtRef = useRef<string>(new Date().toISOString());

  const items = checklistData?.items ?? [];

  useEffect(() => {
    if (!open || !sale) return;
    startedAtRef.current = new Date().toISOString();
    setStates({});
    setSelectedCodes([]);
    setComment("");
    setActiveIndex(0);
  }, [open, sale?.sale_id]);

  const answered = useMemo(
    () =>
      items
        .filter((i) => states[i.id])
        .map((i) => ({ item_type: i.item_type, state: states[i.id] })),
    [items, states],
  );

  const allAnswered = items.length > 0 && items.every((i) => !!states[i.id]);
  const result = allAnswered ? deriveQualityResult(answered) : null;

  const requiredCodesSelected = selectedCodes.some(
    (id) => errorCodes?.find((c) => c.id === id)?.item_type === "obligatorisk",
  );

  const canSave =
    allAnswered && (result !== "afvist" || requiredCodesSelected) && !saveReview.isPending;

  const setState = (itemId: string, state: QualityItemState) => {
    setStates((prev) => ({ ...prev, [itemId]: state }));
  };

  const handleSave = async () => {
    if (!sale || !checklistData || !canSave) return;
    try {
      await saveReview.mutateAsync({
        sale,
        checklistId: checklistData.checklist.id,
        checklistVersion: checklistData.checklist.version,
        items: items.map((i) => ({
          checklist_item_id: i.id,
          item_type: i.item_type,
          state: states[i.id],
        })),
        errorCodeIds: selectedCodes,
        comment,
        startedAt: startedAtRef.current,
      });
      toast({
        title: "Kontrol gemt",
        description: result ? QUALITY_RESULT_LABEL[result] : undefined,
      });
      onSaved(sale.sale_id);
    } catch (error) {
      toast({
        title: "Kunne ikke gemme kontrollen",
        description: error instanceof Error ? error.message : "Ukendt fejl",
        variant: "destructive",
      });
    }
  };

  // Tastaturgenveje: 1 = OK, 2 = Mangler, 3 = Ikke relevant, pile skifter punkt.
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT");
      if (typing && event.key !== "Enter") return;

      const active = items[activeIndex];
      if (event.key === "1" && active) {
        event.preventDefault();
        setState(active.id, "ok");
        setActiveIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (event.key === "2" && active) {
        event.preventDefault();
        setState(active.id, "mangler");
        setActiveIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (event.key === "3" && active) {
        event.preventDefault();
        setState(active.id, "ikke_relevant");
        setActiveIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, items, activeIndex, canSave, states, selectedCodes, comment]);

  const relevantCodes = (errorCodes ?? []).filter((c) => c.is_active);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-xl flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="shrink-0 space-y-1 border-b p-6">
          <SheetTitle>{sale?.seller_name ?? "Ukendt sælger"}</SheetTitle>
          <SheetDescription>
            {sale?.campaign_name ?? "Ukendt kampagne"} · {formatDanishTime(sale?.sale_datetime ?? null)}
            {sale?.search_key ? ` · ${sale.search_key}` : ""}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-6">
            {checklistLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Henter tjekliste
              </div>
            )}

            {!checklistLoading && items.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Der findes ingen aktiv tjekliste for denne kampagne.
              </p>
            )}

            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "rounded-lg border p-4 transition-colors",
                    index === activeIndex ? "border-primary bg-accent/40" : "border-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.label}</span>
                        <Badge variant={item.item_type === "obligatorisk" ? "default" : "secondary"}>
                          {item.item_type === "obligatorisk" ? "Obligatorisk" : "Kvalitet"}
                        </Badge>
                      </div>
                      {item.guidance && (
                        <p className="text-xs text-muted-foreground">{item.guidance}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["ok", "mangler", "ikke_relevant"] as QualityItemState[]).map((state, i) => (
                      <Button
                        key={state}
                        type="button"
                        size="sm"
                        variant={states[item.id] === state ? "default" : "outline"}
                        onClick={() => {
                          setState(item.id, state);
                          setActiveIndex(index);
                        }}
                      >
                        {i + 1} · {STATE_LABEL[state]}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Fejlkoder</Label>
              <p className="text-xs text-muted-foreground">
                Vælg de koder der passer. Ved Afvist kræves mindst én obligatorisk fejlkode.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {relevantCodes.map((code) => (
                  <label
                    key={code.id}
                    className="flex items-start gap-2 rounded-md border p-2 text-sm"
                  >
                    <Checkbox
                      checked={selectedCodes.includes(code.id)}
                      onCheckedChange={(checked) =>
                        setSelectedCodes((prev) =>
                          checked ? [...prev, code.id] : prev.filter((id) => id !== code.id),
                        )
                      }
                    />
                    <span>
                      {code.label}
                      <span className="block text-xs text-muted-foreground">
                        {code.item_type === "obligatorisk" ? "Obligatorisk" : "Kvalitet"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quality-comment">Kommentar</Label>
              <Textarea
                id="quality-comment"
                value={comment}
                maxLength={500}
                rows={4}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Skriv om sælgerens adfærd"
              />
              <p className="text-xs text-muted-foreground">
                Skriv om sælgerens adfærd – aldrig kundens navn, adresse eller andre
                kundeoplysninger. {comment.length}/500 tegn.
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="shrink-0 space-y-3 border-t p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Resultat</span>
            <span className="font-medium">
              {result ? QUALITY_RESULT_LABEL[result] : "Udfyld alle punkter"}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Luk
            </Button>
            <Button className="flex-1" disabled={!canSave} onClick={handleSave}>
              {saveReview.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gem og næste
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Genveje: 1 = OK, 2 = Mangler, 3 = Ikke relevant, pil op og ned skifter punkt,
            Enter gemmer.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
