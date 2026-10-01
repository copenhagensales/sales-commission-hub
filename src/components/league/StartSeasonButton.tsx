import { useMemo, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { da } from "date-fns/locale";
import { Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";
import { useStartNewSeason } from "@/hooks/useLeagueData";

const fmt = (d: Date) => format(d, "EEEE d. MMM", { locale: da });

export function StartSeasonButton() {
  const { canEdit } = useUnifiedPermissions();
  const mutation = useStartNewSeason();
  const [open, setOpen] = useState(false);

  const mondays = useMemo(() => {
    const thisMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
    return [thisMonday, addDays(thisMonday, 7)];
  }, []);
  const [choice, setChoice] = useState(format(mondays[0], "yyyy-MM-dd"));

  if (!canEdit("menu_league_admin")) return null;

  const start = new Date(`${choice}T00:00:00`);
  const handleStart = async () => {
    try {
      await mutation.mutateAsync(choice);
      toast.success("Ny sæson startet med kvalifikation");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke starte sæson");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Trophy className="h-4 w-4 mr-2" />Start ny sæson</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Start ny sæson</DialogTitle>
          <DialogDescription>
            Sæsonen starter altid med en kvalifikationsuge og kører derefter 6 runder.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {mondays.map((m) => (
                <SelectItem key={m.toISOString()} value={format(m, "yyyy-MM-dd")}>
                  Kvalifikation fra {fmt(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>Kvalifikation: {fmt(start)} – {fmt(addDays(start, 6))} kl. 23:55</li>
            <li>Runder: {fmt(addDays(start, 7))} – {fmt(addDays(start, 48))}</li>
            <li>Alle med salg fra kvalifikationens start tilmeldes automatisk.</li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuller</Button>
          <Button onClick={handleStart} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Start sæson
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
