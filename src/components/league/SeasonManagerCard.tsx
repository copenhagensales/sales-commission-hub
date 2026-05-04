import { useState } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarIcon, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  LeagueSeason,
  useAllSeasons,
  useCreateSeason,
  useUpdateSeasonStatus,
} from "@/hooks/useLeagueData";
import { SeasonSettingsDialog } from "./SeasonSettingsDialog";

const STATUS_OPTIONS = [
  { value: "draft", label: "Kladde" },
  { value: "qualification", label: "Kvalifikation" },
  { value: "active", label: "Aktiv" },
  { value: "completed", label: "Afsluttet" },
];

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "draft": return "secondary" as const;
    case "qualification": return "default" as const;
    case "active": return "default" as const;
    case "completed": return "outline" as const;
    default: return "secondary" as const;
  }
}

function getStatusLabel(status: string) {
  return STATUS_OPTIONS.find(o => o.value === status)?.label || status;
}

export function SeasonManagerCard() {
  const { data: seasons = [], isLoading } = useAllSeasons();
  const createMutation = useCreateSeason();
  const statusMutation = useUpdateSeasonStatus();
  const [createOpen, setCreateOpen] = useState(false);

  // Create season form state
  const [qualSourceStart, setQualSourceStart] = useState<Date | undefined>();
  const [qualSourceEnd, setQualSourceEnd] = useState<Date | undefined>();
  const [qualStartAt, setQualStartAt] = useState<Date | undefined>();
  const [qualEndAt, setQualEndAt] = useState<Date | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const resetForm = () => {
    setQualSourceStart(undefined);
    setQualSourceEnd(undefined);
    setQualStartAt(undefined);
    setQualEndAt(undefined);
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const handleCreate = async () => {
    if (!qualSourceStart || !qualSourceEnd || !qualStartAt || !qualEndAt || !startDate) {
      toast.error("Alle påkrævede datoer skal udfyldes");
      return;
    }

    try {
      await createMutation.mutateAsync({
        qualification_source_start: qualSourceStart.toISOString(),
        qualification_source_end: qualSourceEnd.toISOString(),
        qualification_start_at: qualStartAt.toISOString(),
        qualification_end_at: qualEndAt.toISOString(),
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate ? endDate.toISOString().split("T")[0] : null,
      });
      toast.success("Ny sæson oprettet!");
      setCreateOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Kunne ikke oprette sæson");
    }
  };

  const handleStatusChange = async (seasonId: string, newStatus: string) => {
    try {
      await statusMutation.mutateAsync({ seasonId, status: newStatus });
      toast.success(`Status ændret til ${getStatusLabel(newStatus)}`);
    } catch (error: any) {
      toast.error(error.message || "Kunne ikke ændre status");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "d. MMM yy", { locale: da });
    } catch {
      return "-";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Sæsoner</CardTitle>
          <CardDescription>Opret og administrér liga-sæsoner</CardDescription>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Ny sæson
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Opret ny sæson</DialogTitle>
              <DialogDescription>
                Sæsonen oprettes som kladde. Skift status når du er klar.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-4">
              <DateRangeSection
                label="📊 Provision beregnes fra"
                description="Salg i denne periode tæller til kvalifikationen"
                startDate={qualSourceStart}
                endDate={qualSourceEnd}
                onStartChange={setQualSourceStart}
                onEndChange={setQualSourceEnd}
              />
              <DateRangeSection
                label="📅 Tilmeldingsperiode"
                description="Hvornår spillere kan tilmelde sig"
                startDate={qualStartAt}
                endDate={qualEndAt}
                onStartChange={setQualStartAt}
                onEndChange={setQualEndAt}
              />
              <DateRangeSection
                label="🏆 Sæson periode"
                description="Hvornår selve ligaen kører (slutdato er valgfri)"
                startDate={startDate}
                endDate={endDate}
                onStartChange={setStartDate}
                onEndChange={setEndDate}
                endPlaceholder="Valgfri"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Annuller
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Opret sæson
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : seasons.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Ingen sæsoner oprettet endnu</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2">Status opdateres automatisk baseret på datoerne</p>
            <div className="rounded-md border overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Nr</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Provision periode</TableHead>
                  <TableHead className="hidden md:table-cell">Tilmelding</TableHead>
                  <TableHead className="hidden lg:table-cell">Sæson</TableHead>
                  <TableHead className="w-[100px]">Handling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seasons.map((season) => (
                  <TableRow key={season.id}>
                    <TableCell className="font-bold">S{season.season_number}</TableCell>
                    <TableCell>
                      <Select
                        value={season.status}
                        onValueChange={(val) => handleStatusChange(season.id, val)}
                        disabled={statusMutation.isPending}
                      >
                        <SelectTrigger className="w-[140px]">
                          <Badge
                            variant={getStatusBadgeVariant(season.status)}
                            className={season.status === "active" ? "bg-green-600 text-white border-green-600" : ""}
                          >
                            {getStatusLabel(season.status)}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {formatDate(season.qualification_source_start)} – {formatDate(season.qualification_source_end)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {formatDate(season.qualification_start_at)} – {formatDate(season.qualification_end_at)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {formatDate(season.start_date)} – {formatDate(season.end_date)}
                    </TableCell>
                    <TableCell>
                      <SeasonSettingsDialog season={season} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Reusable date range section for the create dialog
function DateRangeSection({
  label,
  description,
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  endPlaceholder,
}: {
  label: string;
  description: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartChange: (d: Date | undefined) => void;
  onEndChange: (d: Date | undefined) => void;
  endPlaceholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="grid grid-cols-2 gap-3">
        <DatePickerButton date={startDate} onSelect={onStartChange} placeholder="Start" />
        <DatePickerButton date={endDate} onSelect={onEndChange} placeholder={endPlaceholder || "Slut"} />
      </div>
    </div>
  );
}

function DatePickerButton({
  date,
  onSelect,
  placeholder,
}: {
  date: Date | undefined;
  onSelect: (d: Date | undefined) => void;
  placeholder: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "d. MMM yyyy", { locale: da }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
