import { useState, useEffect } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { CalendarIcon, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  
  const updateDatesMutation = useUpdateSeasonDates();

  // Initialize dates from season
  useEffect(() => {
    if (season) {
      setQualSourceStart(new Date(season.qualification_source_start));
      setQualSourceEnd(new Date(season.qualification_source_end));
      setQualStartAt(new Date(season.qualification_start_at));
      setQualEndAt(new Date(season.qualification_end_at));
    }
  }, [season]);

  const handleSave = async () => {
    if (!qualSourceStart || !qualSourceEnd || !qualStartAt || !qualEndAt) {
      toast.error("Alle datoer skal udfyldes");
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
            Sæson Indstillinger
          </DialogTitle>
          <DialogDescription>
            Justér datoer for kvalifikationsperioden
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Provision calculation period */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              📊 Provision beregnes fra
            </Label>
            <p className="text-xs text-muted-foreground">
              Salg i denne periode tæller til kvalifikationen
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Start dato</Label>
                <DatePickerButton
                  date={qualSourceStart}
                  onSelect={setQualSourceStart}
                  placeholder="Vælg start"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Slut dato</Label>
                <DatePickerButton
                  date={qualSourceEnd}
                  onSelect={setQualSourceEnd}
                  placeholder="Vælg slut"
                />
              </div>
            </div>
          </div>

          {/* Enrollment period */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              📅 Tilmeldingsperiode
            </Label>
            <p className="text-xs text-muted-foreground">
              Hvornår spillere kan tilmelde sig
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <DatePickerButton
                  date={qualStartAt}
                  onSelect={setQualStartAt}
                  placeholder="Vælg start"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Slut</Label>
                <DatePickerButton
                  date={qualEndAt}
                  onSelect={setQualEndAt}
                  placeholder="Vælg slut"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuller
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateDatesMutation.isPending}
          >
            {updateDatesMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Gem ændringer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DatePickerButtonProps {
  date: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  placeholder: string;
}

function DatePickerButton({ date, onSelect, placeholder }: DatePickerButtonProps) {
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
