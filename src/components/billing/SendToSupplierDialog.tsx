import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface SendToSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationType: string;
  month: string;
  reportId: string;
  reportData: any;
  hasDiscountRules?: boolean;
}

export function SendToSupplierDialog({
  open,
  onOpenChange,
  locationType,
  month,
  reportId,
  reportData,
  hasDiscountRules,
}: SendToSupplierDialogProps) {
  const [extraEmail, setExtraEmail] = useState("");
  const [extraEmails, setExtraEmails] = useState<string[]>([]);
  const [subject, setSubject] = useState(`Leverandørrapport: ${locationType} - ${month}`);
  const [message, setMessage] = useState(
    `Hermed fremsendes leverandørrapport for ${locationType} for perioden ${month}.\n\nVenlig hilsen\nCopenhagen Sales`
  );

  const { data: contacts } = useQuery({
    queryKey: ["supplier-contacts-for-send", locationType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_contacts")
        .select("*")
        .eq("location_type", locationType)
        .eq("is_active", true)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const allRecipients = [
        ...(contacts?.map((c: any) => c.email) || []),
        ...extraEmails,
      ];

      if (allRecipients.length === 0) {
        throw new Error("Ingen modtagere valgt");
      }

      const { data, error } = await supabase.functions.invoke("send-supplier-report", {
        body: {
          locationType,
          month,
          recipients: allRecipients,
          subject,
          message,
          reportId,
          reportData,
          hasDiscountRules,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Rapport sendt til leverandør!");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error("Fejl ved afsendelse: " + err.message);
    },
  });

  const addExtraEmail = () => {
    if (extraEmail && extraEmail.includes("@") && !extraEmails.includes(extraEmail)) {
      setExtraEmails([...extraEmails, extraEmail]);
      setExtraEmail("");
    }
  };

  const removeExtraEmail = (email: string) => {
    setExtraEmails(extraEmails.filter((e) => e !== email));
  };

  const totalRecipients = (contacts?.length || 0) + extraEmails.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send rapport til leverandør</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Recipients */}
          <div className="space-y-2">
            <Label>Modtagere ({totalRecipients})</Label>
            <div className="flex flex-wrap gap-2">
              {contacts?.map((c: any) => (
                <Badge key={c.id} variant="secondary">
                  {c.name} ({c.email})
                </Badge>
              ))}
              {extraEmails.map((email) => (
                <Badge key={email} variant="outline" className="gap-1">
                  {email}
                  <button onClick={() => removeExtraEmail(email)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            {!contacts?.length && extraEmails.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ingen kontaktpersoner registreret for {locationType}. Tilføj ekstra modtagere nedenfor.
              </p>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Tilføj ekstra e-mail"
                value={extraEmail}
                onChange={(e) => setExtraEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExtraEmail())}
              />
              <Button variant="outline" size="icon" onClick={addExtraEmail}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Emne</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Besked</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || totalRecipients === 0}
          >
            <Send className="h-4 w-4 mr-2" />
            {sendMutation.isPending ? "Sender..." : `Send til ${totalRecipients} modtager${totalRecipients !== 1 ? "e" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
