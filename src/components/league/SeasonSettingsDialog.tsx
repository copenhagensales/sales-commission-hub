import { useState, useEffect } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarIcon, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { LeagueSeason, useUpdateSeasonDates } from "@/hooks/useLeagueData";

interface SeasonSettingsDialogProps {
  season: LeagueSeason;
}

export function SeasonSettingsDialog({ season }: SeasonSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [qualSourceStart, setQualSourceStart] = useState<Date | undefined>();
  const [qualSourceEnd, setQualSourceEnd] = useState<Date | undefined>();
  const [qualStartAt, setQualStartAt] = useState<Date | undefined>();
  const [qualEndAt, setQualEndAt] = useState<Date | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const updateDatesMutation = useUpdateSeasonDates();

  useEffect(() => {
    if (season) {
      setQualSourceStart(new Date(season.qualification_source_start));
      setQualSourceEnd(new Date(season.qualification_source_end));
      setQualStartAt(new Date(season.qualification_start_at));
      setQualEndAt(new Date(season.qualification_end_at));
      setStartDate(season.start_date ? new Date(season.start_date) : undefined);
      setEndDate(season.end_date ? new Date(season.end_date) : undefined);
    }
  }, [season]);

  const handleSave = async () => {
    if (!qualSourceStart || !qualSourceEnd || !qualStartAt || !qualEndAt || !startDate) {
      toast.error("Alle påkrævede datoer skal udfyldes");
      return;
    }

    try {
      await updateDatesMutation.mutateAsync({
        seasonId: season.id,
        dates: {
          qualification_source_start: qualSourceStart.toISOString(),
          qualification_source_end: qualSourceEnd.toISOString(),
          qualification_start_at: qualStartAt.toISOString(),
          qualification_end_at: qualEndAt.toISOString(),
          start_date: startDate ? startDate.toISOString().split("T")[0] : undefined,
          end_date: endDate ? endDate.toISOString().split("T")[0] : null,
        },
      });
      toast.success("Sæson-datoer opdateret!");
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Kunne ikke gemme ændringer");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Sæson {season.season_number} – Indstillinger
          </DialogTitle>
          <DialogDescription>
            Justér datoer for sæsonen
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
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
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuller
          </Button>
          <Button onClick={handleSave} disabled={updateDatesMutation.isPending}>
            {updateDatesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Gem ændringer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
