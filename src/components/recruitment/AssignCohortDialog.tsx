import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Users, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AssignCohortDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  onConfirm: (cohortId: string | null, availableFrom: Date | null) => void;
  onSkip: () => void;
}

export function AssignCohortDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  onConfirm,
  onSkip,
}: AssignCohortDialogProps) {
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [availableFrom, setAvailableFrom] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: cohorts = [], isLoading: isLoadingCohorts } = useQuery({
    queryKey: ["onboarding-cohorts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_cohorts")
        .select("*")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      onConfirm(selectedCohortId, availableFrom || null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onSkip();
    onOpenChange(false);
  };

  const noCohorts = cohorts.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Tildel opstartshold
          </DialogTitle>
          <DialogDescription>
            Vælg et opstartshold for {candidateName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoadingCohorts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : noCohorts ? (
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-700">
                  Ingen opstartshold oprettet
                </p>
                <p className="text-xs text-amber-600">
                  Du kan stadig ansætte kandidaten og tildele et hold senere.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="cohort">Opstartshold</Label>
                <Select
                  value={selectedCohortId || ""}
                  onValueChange={setSelectedCohortId}
                >
                  <SelectTrigger id="cohort">
                    <SelectValue placeholder="Vælg et hold..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cohorts.map((cohort) => (
                      <SelectItem key={cohort.id} value={cohort.id}>
                        <span className="flex items-center gap-2">
                          <span>{cohort.name}</span>
                          {cohort.start_date && (
                            <span className="text-xs text-muted-foreground">
                              (starter {format(new Date(cohort.start_date), "d. MMM", { locale: da })})
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Første mulige arbejdsdag</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !availableFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {availableFrom
                        ? format(availableFrom, "PPP", { locale: da })
                        : "Vælg dato..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={availableFrom}
                      onSelect={setAvailableFrom}
                      locale={da}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={handleSkip} disabled={isSubmitting}>
            Spring over
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || (!noCohorts && !selectedCohortId)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gemmer...
              </>
            ) : noCohorts ? (
              "Ansæt uden hold"
            ) : (
              "Bekræft ansættelse"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
