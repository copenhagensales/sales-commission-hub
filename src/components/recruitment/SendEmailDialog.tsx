import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate;
}

const emailTemplates = [
  {
    id: "interview_invitation",
    name: "Invitation til samtale",
    subject: "Invitation til samtale hos Copenhagen Sales",
    content: `Kære {navn},

Tak for din ansøgning til stillingen hos Copenhagen Sales.

Vi vil meget gerne invitere dig til en samtale, hvor vi kan høre mere om dig og fortælle om mulighederne hos os.

Samtalen vil vare ca. 30 minutter og foregår på vores kontor i København.

Venligst bekræft din deltagelse ved at svare på denne mail.

Med venlig hilsen
Copenhagen Sales`,
  },
  {
    id: "rejection",
    name: "Afslag",
    subject: "Vedrørende din ansøgning hos Copenhagen Sales",
    content: `Kære {navn},

Tak for din interesse i Copenhagen Sales og for den tid, du har brugt på din ansøgning.

Desværre må vi meddele, at vi har valgt at gå videre med andre kandidater til stillingen.

Vi ønsker dig held og lykke med din videre jobsøgning.

Med venlig hilsen
Copenhagen Sales`,
  },
  {
    id: "offer",
    name: "Jobtilbud",
    subject: "Jobtilbud fra Copenhagen Sales",
    content: `Kære {navn},

Det er os en glæde at kunne tilbyde dig ansættelse hos Copenhagen Sales!

Vi var meget imponerede over din profil og samtale, og vi er overbeviste om, at du vil blive et værdifuldt medlem af vores team.

Vedlagt finder du ansættelseskontrakten. Venligst gennemgå den og vend tilbage med eventuelle spørgsmål.

Vi glæder os til at høre fra dig!

Med venlig hilsen
Copenhagen Sales`,
  },
];

export function SendEmailDialog({ open, onOpenChange, candidate }: SendEmailDialogProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const queryClient = useQueryClient();

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      // Log the communication
      const { error: logError } = await supabase
        .from("communication_logs")
        .insert({
          type: "email",
          direction: "outbound",
          content: `Subject: ${subject}\n\n${message}`,
        });

      if (logError) throw logError;

      // In a real implementation, this would call an edge function to send email
      console.log("Email would be sent to:", candidate.email, "Subject:", subject);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication_logs"] });
      toast.success("Email sendt (simuleret)");
      onOpenChange(false);
      setSubject("");
      setMessage("");
      setSelectedTemplate("");
    },
    onError: () => {
      toast.error("Kunne ikke sende email");
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = emailTemplates.find(t => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      const personalizedMessage = template.content.replace(
        "{navn}",
        candidate.first_name
      );
      setMessage(personalizedMessage);
    }
  };

  const handleSend = () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Udfyld både emne og besked");
      return;
    }
    sendEmailMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send email til {candidate.first_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <p className="text-sm text-muted-foreground">Til:</p>
            <p className="font-medium text-foreground">{candidate.email}</p>
          </div>

          <div className="space-y-2">
            <Label>Skabelon (valgfri)</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Vælg en skabelon" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {emailTemplates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Emne</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="bg-background border-border"
              placeholder="Indtast emne..."
            />
          </div>

          <div className="space-y-2">
            <Label>Besked</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-background border-border min-h-[200px]"
              placeholder="Skriv din besked her..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button onClick={handleSend} disabled={sendEmailMutation.isPending}>
              {sendEmailMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send email
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
