import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Loader2, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  activateEmployeeAccount,
  processCohortMember,
  type ProcessResults,
} from "@/lib/cohortMemberProcessing";

export interface ActivateMemberTarget {
  memberId: string;
  name: string;
  employeeId: string | null;
  agentEmail: string | null;
  dailyBonusClientId: string | null;
  candidate: {
    id: string;
    first_name: string;
    last_name: string;
    applied_position: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  cohort: {
    id: string;
    team_id: string | null;
    start_date: string | null;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ActivateMemberTarget | null;
}

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function ActivateMemberDialog({ open, onOpenChange, target }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [workEmail, setWorkEmail] = useState("");
  const [startDate, setStartDate] = useState("");

  useEffect(() => {
    if (open && target) {
      setWorkEmail(target.agentEmail ?? "");
      setStartDate(target.cohort.start_date ?? "");
    }
  }, [open, target]);

  const activateMutation = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("Ingen deltager valgt");
      const email = workEmail.trim().toLowerCase();
      if (!isEmail(email)) throw new Error("Skriv en gyldig Copenhagensales-mail");

      // Allerede oprettet som medarbejder: opret kun adgang + velkomstmail
      if (target.employeeId) {
        const [firstName, ...rest] = target.name.trim().split(" ");
        const result = await activateEmployeeAccount({
          employeeId: target.employeeId,
          workEmail: email,
          privateEmail: target.candidate?.email ?? null,
          firstName: firstName || target.name,
          lastName: rest.join(" "),
          startDate: startDate || null,
        });
        return { errors: result.mailError && !result.mailSent ? [result.mailError] : [] };
      }

      if (!target.candidate) throw new Error("Deltageren mangler kandidatoplysninger");

      const results: ProcessResults = { sent: 0, skipped: 0, errors: [] };
      await processCohortMember(
        {
          id: target.memberId,
          daily_bonus_client_id: target.dailyBonusClientId,
          agent_email: target.agentEmail,
          candidate: target.candidate,
        },
        {
          id: target.cohort.id,
          team_id: target.cohort.team_id,
          start_date: startDate || target.cohort.start_date,
        },
        results,
        { workEmail: email, startDate: startDate || target.cohort.start_date },
      );
      if (results.sent === 0 && results.errors.length) {
        throw new Error(results.errors.join(", "));
      }
      return { errors: results.errors };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-cohorts"] });
      queryClient.invalidateQueries({ queryKey: ["unassigned-hired-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({
        title: "Medarbejder oprettet",
        description: res.errors.length
          ? res.errors.join(", ")
          : "Adgang er klar, og velkomstmailen er sendt til den private mail.",
        variant: res.errors.length ? "destructive" : "default",
      });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Kunne ikke oprette medarbejderen",
        description: error instanceof Error ? error.message : "Ukendt fejl",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : undefined)}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Opret som medarbejder</DialogTitle>
          <DialogDescription>
            {target?.name} bliver oprettet som medarbejder og får adgang til Stork med sin
            Copenhagensales-mail. Der sendes en velkomstmail til den private mail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="activate-work-email">Copenhagensales-mail</Label>
            <Input
              id="activate-work-email"
              type="email"
              value={workEmail}
              onChange={(e) => setWorkEmail(e.target.value)}
              placeholder="fornavn@copenhagensales.dk"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Skal være præcis den mail, personen logger ind med.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="activate-start-date">Startdato</Label>
            <Input
              id="activate-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          {target?.candidate?.email && (
            <p className="text-xs text-muted-foreground">
              Velkomstmailen sendes til {target.candidate.email}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={activateMutation.isPending}
          >
            Annuller
          </Button>
          <Button
            onClick={() => activateMutation.mutate()}
            disabled={activateMutation.isPending || !workEmail.trim()}
          >
            {activateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserCheck className="h-4 w-4 mr-2" />
            )}
            Opret medarbejder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
