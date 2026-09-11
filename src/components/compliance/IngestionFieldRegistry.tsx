import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  useIngestionKnownFields,
  useUpdateFieldDecision,
  type FieldDecision,
  type IngestionKnownField,
} from "@/hooks/useComplianceMonitoring";

const DECISIONS: FieldDecision[] = ["BEHOLD", "BLOKER", "UAFKLARET"];

const DECISION_STYLE: Record<string, string> = {
  BEHOLD: "bg-emerald-500/10 text-emerald-700 border-emerald-500/40",
  BLOKER: "bg-red-500/10 text-red-700 border-red-500/40",
  UAFKLARET: "bg-yellow-500/10 text-yellow-700 border-yellow-500/40",
};

const isNew = (firstSeen: string) =>
  Date.now() - new Date(firstSeen).getTime() < 7 * 86_400_000;

const formatDa = (iso: string) =>
  new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" });

function FieldRow({ field, canEdit }: { field: IngestionKnownField; canEdit: boolean }) {
  const [note, setNote] = useState(field.note ?? "");
  const update = useUpdateFieldDecision();
  const noteChanged = (note.trim() || null) !== (field.note ?? null);

  const save = (decision: FieldDecision) => {
    update.mutate(
      { id: field.id, decision, note },
      {
        onSuccess: () => toast.success("Beslutningen er gemt"),
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Kunne ikke gemme beslutningen"),
      },
    );
  };

  return (
    <TableRow className={isNew(field.first_seen) ? "bg-primary/5" : undefined}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {field.field_label}
          {isNew(field.first_seen) && (
            <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3" /> Ny
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {field.integration} · {field.container}
        </p>
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {formatDa(field.first_seen)}
        <br />
        {field.occurrences} forekomster
      </TableCell>
      <TableCell>
        {canEdit ? (
          <Select
            value={field.decision}
            onValueChange={(v) => save(v as FieldDecision)}
            disabled={update.isPending}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DECISIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline" className={DECISION_STYLE[field.decision] ?? ""}>
            {field.decision}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {canEdit ? (
          <div className="flex items-center gap-2">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note"
              className="h-9"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!noteChanged || update.isPending}
              onClick={() => save(field.decision as FieldDecision)}
            >
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gem"}
            </Button>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">{field.note ?? "—"}</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export function IngestionFieldRegistry({ canEdit }: { canEdit: boolean }) {
  const [filter, setFilter] = useState<FieldDecision | "ALLE">("ALLE");
  const { data: fields = [], isLoading } = useIngestionKnownFields(filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Alle felter der er kommet ind via indtag. Uafklarede felter vises øverst, og felter set
          inden for 7 dage er fremhævet.
        </p>
        <Select value={filter} onValueChange={(v) => setFilter(v as FieldDecision | "ALLE")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALLE">Alle beslutninger</SelectItem>
            {DECISIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : fields.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Ingen felter fundet.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Felt</TableHead>
                <TableHead>Først set</TableHead>
                <TableHead>Beslutning</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <FieldRow key={field.id} field={field} canEdit={canEdit} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
