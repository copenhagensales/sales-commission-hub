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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Loader2, Mail, Clock, CalendarIcon } from "lucide-react";
import { format, setHours, setMinutes } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

type SendOption = "now" | "scheduled";

export function SendEmailDialog({ open, onOpenChange, candidate }: SendEmailDialogProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [sendOption, setSendOption] = useState<SendOption>("now");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledHour, setScheduledHour] = useState("09");
  const [scheduledMinute, setScheduledMinute] = useState("00");
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

  const getScheduledDateTime = (): Date | null => {
    if (sendOption === "now" || !scheduledDate) return null;
    const date = new Date(scheduledDate);
    return setMinutes(setHours(date, parseInt(scheduledHour)), parseInt(scheduledMinute));
  };

  const formatScheduledDateTime = (): string => {
    const dateTime = getScheduledDateTime();
    if (!dateTime) return "";
    return format(dateTime, "d. MMM yyyy 'kl.' HH:mm", { locale: da });
  };

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (sendOption === "now") {
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
        const scheduledAt = getScheduledDateTime();
        if (!scheduledAt) {
          throw new Error("Vælg venligst dato og tid");
        }
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
      if (sendOption === "now") {
        toast.success("Email sendt");
      } else {
        toast.success(`Email planlagt til ${formatScheduledDateTime()}`);
      }
      onOpenChange(false);
      setSubject("");
      setMessage("");
      setSelectedTemplate("");
      setSendOption("now");
      setScheduledDate(undefined);
      setScheduledHour("09");
      setScheduledMinute("00");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Kunne ikke sende email");
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
    if (sendOption === "scheduled" && !scheduledDate) {
      toast.error("Vælg venligst en dato for planlagt afsendelse");
      return;
    }
    sendEmailMutation.mutate();
  };

  // Generate hour options (00-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  // Generate minute options (00, 15, 30, 45)
  const minuteOptions = ["00", "15", "30", "45"];

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
            <RadioGroup value={sendOption} onValueChange={(v) => setSendOption(v as SendOption)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="now" id="now" />
                <Label htmlFor="now" className="font-normal cursor-pointer">Send nu</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="scheduled" id="scheduled" />
                <Label htmlFor="scheduled" className="font-normal cursor-pointer">Planlæg afsendelse</Label>
              </div>
            </RadioGroup>

            {sendOption === "scheduled" && (
              <div className="mt-3 space-y-3 pl-6">
                <div className="flex flex-wrap gap-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !scheduledDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate ? format(scheduledDate, "d. MMM yyyy", { locale: da }) : "Vælg dato"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>

                  <div className="flex items-center gap-1">
                    <Select value={scheduledHour} onValueChange={setScheduledHour}>
                      <SelectTrigger className="w-[70px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {hourOptions.map(hour => (
                          <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">:</span>
                    <Select value={scheduledMinute} onValueChange={setScheduledMinute}>
                      <SelectTrigger className="w-[70px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {minuteOptions.map(minute => (
                          <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {scheduledDate && (
                  <p className="text-sm text-muted-foreground">
                    Sendes: {formatScheduledDateTime()}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button onClick={handleSend} disabled={sendEmailMutation.isPending}>
              {sendEmailMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {sendOption === "now" ? "Send email" : "Planlæg email"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
