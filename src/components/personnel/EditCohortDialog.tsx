import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface EditCohortDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohort: {
    id: string;
    name: string;
    start_date: string;
    start_time: string | null;
    max_capacity: number | null;
  } | null;
}

export function EditCohortDialog({ open, onOpenChange, cohort }: EditCohortDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    start_date: "",
    start_time: "10:00",
    max_capacity: "",
  });

  // Update form when cohort changes
  useEffect(() => {
    if (cohort) {
      setFormData({
        name: cohort.name || "",
        start_date: cohort.start_date || "",
        start_time: cohort.start_time?.slice(0, 5) || "10:00",
        max_capacity: cohort.max_capacity?.toString() || "",
      });
    }
  }, [cohort]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!cohort) throw new Error("Ingen hold valgt");

      const { error } = await supabase
        .from("onboarding_cohorts")
        .update({
          name: data.name || null,
          start_date: data.start_date,
          start_time: data.start_time || null,
          max_capacity: data.max_capacity ? parseInt(data.max_capacity) : null,
        })
        .eq("id", cohort.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Hold opdateret" });
      queryClient.invalidateQueries({ queryKey: ["onboarding-cohorts"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Fejl ved opdatering",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.start_date) {
      toast({
        title: "Vælg en dato",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate(formData);
  };

  if (!cohort) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rediger opstartshold</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Holdnavn</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Opstartsdato *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.start_date
                      ? format(new Date(formData.start_date), "d. MMM yyyy", { locale: da })
                      : "Vælg dato..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.start_date ? new Date(formData.start_date) : undefined}
                    onSelect={(date) => setFormData({ 
                      ...formData, 
                      start_date: date ? format(date, "yyyy-MM-dd") : "" 
                    })}
                    locale={da}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-start_time">Tidspunkt</Label>
              <Input
                id="edit-start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-max_capacity">Max kapacitet</Label>
            <Input
              id="edit-max_capacity"
              type="number"
              min="1"
              placeholder="Ingen grænse"
              value={formData.max_capacity}
              onChange={(e) => setFormData({ ...formData, max_capacity: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Gemmer..." : "Gem ændringer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
