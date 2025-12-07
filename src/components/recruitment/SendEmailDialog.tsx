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
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

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

export function SendEmailDialog({ open, onOpenChange, candidate }: SendEmailDialogProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
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
