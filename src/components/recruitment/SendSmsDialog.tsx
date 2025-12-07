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
import { Loader2, MessageSquare } from "lucide-react";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
}

interface SendSmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate;
}

const smsTemplates = [
  {
    id: "interview_invitation",
    name: "Invitation til samtale",
    content: "Hej {navn}, tak for din ansøgning hos Copenhagen Sales! Vi vil gerne invitere dig til en samtale. Er du ledig i morgen kl. 10:00? Venlig hilsen Copenhagen Sales",
  },
  {
    id: "interview_reminder",
    name: "Påmindelse om samtale",
    content: "Hej {navn}, dette er en påmindelse om din samtale i morgen. Vi glæder os til at møde dig! Venlig hilsen Copenhagen Sales",
  },
  {
    id: "thank_you",
    name: "Tak for samtale",
    content: "Hej {navn}, tak for samtalen i dag. Vi vender tilbage med svar inden for et par dage. Venlig hilsen Copenhagen Sales",
  },
];

export function SendSmsDialog({ open, onOpenChange, candidate }: SendSmsDialogProps) {
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const queryClient = useQueryClient();

  const sendSmsMutation = useMutation({
    mutationFn: async () => {
      // Log the communication
      const { error: logError } = await supabase
        .from("communication_logs")
        .insert({
          type: "sms",
          direction: "outbound",
          content: message,
        });

      if (logError) throw logError;

      // In a real implementation, this would call an edge function to send via Twilio
      // For now, we just log it
      console.log("SMS would be sent to:", candidate.phone, "Message:", message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication_logs"] });
      toast.success("SMS sendt (simuleret)");
      onOpenChange(false);
      setMessage("");
      setSelectedTemplate("");
    },
    onError: () => {
      toast.error("Kunne ikke sende SMS");
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = smsTemplates.find(t => t.id === templateId);
    if (template) {
      const personalizedMessage = template.content.replace(
        "{navn}",
        candidate.first_name
      );
      setMessage(personalizedMessage);
    }
  };

  const handleSend = () => {
    if (!message.trim()) {
      toast.error("Indtast en besked");
      return;
    }
    sendSmsMutation.mutate();
  };

  const charCount = message.length;
  const smsCount = Math.ceil(charCount / 160) || 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send SMS til {candidate.first_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <p className="text-sm text-muted-foreground">Til:</p>
            <p className="font-medium text-foreground">{candidate.phone}</p>
          </div>

          <div className="space-y-2">
            <Label>Skabelon (valgfri)</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Vælg en skabelon" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {smsTemplates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Besked</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-background border-border min-h-[120px]"
              placeholder="Skriv din besked her..."
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{charCount} tegn</span>
              <span>{smsCount} SMS</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button onClick={handleSend} disabled={sendSmsMutation.isPending}>
              {sendSmsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send SMS
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
