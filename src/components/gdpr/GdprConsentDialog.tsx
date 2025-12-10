import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useGiveConsent } from "@/hooks/useGdpr";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface GdprConsentDialogProps {
  open: boolean;
  onConsent: () => void;
}

export function GdprConsentDialog({ open, onConsent }: GdprConsentDialogProps) {
  const [accepted, setAccepted] = useState(false);
  const giveConsent = useGiveConsent();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleConsent = async () => {
    try {
      await giveConsent.mutateAsync({ consentType: "data_processing" });
      toast({
        title: "Samtykke registreret",
        description: "Dit samtykke til databehandling er blevet registreret.",
      });
      // Invalidate queries to refresh consent status everywhere
      await queryClient.invalidateQueries({ queryKey: ["gdpr-consents"] });
      onConsent();
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke registrere samtykke",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <DialogTitle>Samtykke til behandling af persondata</DialogTitle>
          </div>
          <DialogDescription>
            For at bruge systemet skal du acceptere vores behandling af dine personoplysninger i henhold til GDPR.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border p-4 bg-muted/30">
            <h4 className="font-semibold mb-2">Vi behandler følgende data:</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Navn og kontaktoplysninger (email, telefon, adresse)</li>
              <li>CPR-nummer til lønudbetaling</li>
              <li>Bankoplysninger til lønudbetaling</li>
              <li>Ansættelsesdata (stilling, afdeling, arbejdstider)</li>
              <li>Fravær og sygemeldinger</li>
              <li>Login-aktivitet og systemhandlinger</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4 bg-muted/30">
            <h4 className="font-semibold mb-2">Dine rettigheder:</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Ret til indsigt i dine persondata</li>
              <li>Ret til at få eksporteret dine data</li>
              <li>Ret til at blive glemt (sletning af data)</li>
              <li>Ret til at tilbagekalde samtykke</li>
            </ul>
          </div>

          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="consent"
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(checked === true)}
            />
            <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
              Jeg har læst og accepterer, at Copenhagen Sales behandler mine personoplysninger 
              som beskrevet ovenfor i forbindelse med mit ansættelsesforhold.
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleConsent}
            disabled={!accepted || giveConsent.isPending}
          >
            {giveConsent.isPending ? "Gemmer..." : "Acceptér og fortsæt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
