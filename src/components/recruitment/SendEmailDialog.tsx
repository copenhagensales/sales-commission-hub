import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, Mail, Clock } from "lucide-react";
import { format, addHours } from "date-fns";
import { da } from "date-fns/locale";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  applied_position?: string | null;
}

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate;
}

type DelayOption = "now" | "24h" | "48h";

export function SendEmailDialog({ open, onOpenChange, candidate }: SendEmailDialogProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [delay, setDelay] = useState<DelayOption>("now");
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ["email_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const getScheduledTime = (delayOption: DelayOption): Date => {
    const now = new Date();
    switch (delayOption) {
      case "24h":
        return addHours(now, 24);
      case "48h":
        return addHours(now, 48);
      default:
        return now;
    }
  };

  const formatScheduledTime = (delayOption: DelayOption): string => {
    if (delayOption === "now") return "";
    const scheduledAt = getScheduledTime(delayOption);
    return format(scheduledAt, "d. MMM 'kl.' HH:mm", { locale: da });
  };

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (delay === "now") {
        // Send immediately via edge function
        const { error } = await supabase.functions.invoke("send-recruitment-email", {
          body: {
            candidateId: candidate.id,
            email: candidate.email,
            subject,
            content: message,
            templateKey: templates.find(t => t.id === selectedTemplate)?.template_key,
          },
        });
        if (error) throw error;
      } else {
        // Schedule for later
        const scheduledAt = getScheduledTime(delay);
        const { error } = await supabase
          .from("scheduled_emails")
          .insert({
            candidate_id: candidate.id,
            recipient_email: candidate.email!,
            recipient_name: `${candidate.first_name} ${candidate.last_name}`,
            subject,
            content: message,
            template_key: templates.find(t => t.id === selectedTemplate)?.template_key,
            scheduled_at: scheduledAt.toISOString(),
            status: "pending",
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication_logs"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled_emails"] });
      if (delay === "now") {
        toast.success("Email sendt");
      } else {
        toast.success(`Email planlagt til ${formatScheduledTime(delay)}`);
      }
      onOpenChange(false);
      setSubject("");
      setMessage("");
      setSelectedTemplate("");
      setDelay("now");
    },
    onError: () => {
      toast.error("Kunne ikke sende email");
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSubject(template.subject
        .replace(/\{\{fornavn\}\}/g, candidate.first_name)
        .replace(/\{\{rolle\}\}/g, candidate.applied_position || "stillingen"));
      setMessage(template.content
        .replace(/\{\{fornavn\}\}/g, candidate.first_name)
        .replace(/\{\{rolle\}\}/g, candidate.applied_position || "stillingen"));
    }
  };

  const handleSend = () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Udfyld både emne og besked");
      return;
    }
    if (!candidate.email) {
      toast.error("Kandidaten har ingen email-adresse");
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
                {templates.map(template => (
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
              className="bg-background border-border min-h-[150px]"
              placeholder="Skriv din besked her..."
            />
          </div>

          <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Hvornår skal emailen sendes?
            </Label>
            <RadioGroup value={delay} onValueChange={(v) => setDelay(v as DelayOption)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="now" id="now" />
                <Label htmlFor="now" className="font-normal cursor-pointer">Send nu</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="24h" id="24h" />
                <Label htmlFor="24h" className="font-normal cursor-pointer">
                  Om 24 timer {delay !== "24h" && <span className="text-muted-foreground">({formatScheduledTime("24h")})</span>}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="48h" id="48h" />
                <Label htmlFor="48h" className="font-normal cursor-pointer">
                  Om 48 timer {delay !== "48h" && <span className="text-muted-foreground">({formatScheduledTime("48h")})</span>}
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button onClick={handleSend} disabled={sendEmailMutation.isPending}>
              {sendEmailMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {delay === "now" ? "Send email" : "Planlæg email"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
