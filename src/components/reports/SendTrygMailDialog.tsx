import { useEffect, useState } from "react";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TRYG_MAIL_RECIPIENTS } from "@/config/trygMailRecipients";
import { useSendTrygCancellation } from "@/hooks/useSendTrygCancellation";

interface SendTrygMailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Forudfyldt emne */
  defaultSubject: string;
  /** Forudfyldt besked (skabelon med telefonnumre indsat) */
  defaultBody: string;
  /** De markerede telefonnumre der sendes */
  phones: string[];
  onSent?: () => void;
}

export function SendTrygMailDialog({
  open,
  onOpenChange,
  defaultSubject,
  defaultBody,
  phones,
  onSent,
}: SendTrygMailDialogProps) {
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const sendMail = useSendTrygCancellation();

  // Forudfyld på ny hver gang dialogen åbnes
  useEffect(() => {
    if (open) {
      setSubject(defaultSubject);
      setBody(defaultBody);
    }
  }, [open, defaultSubject, defaultBody]);

  const handleSend = async () => {
    try {
      await sendMail.mutateAsync({ subject, body, phones });
      toast.success(
        `Mail sendt til ${TRYG_MAIL_RECIPIENTS.length} modtager${
          TRYG_MAIL_RECIPIENTS.length !== 1 ? "e" : ""
        }`,
      );
      onOpenChange(false);
      onSent?.();
    } catch (error: unknown) {
      toast.error(
        `Mailen blev ikke sendt: ${
          error instanceof Error ? error.message : "ukendt fejl"
        }`,
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Send til Tryg
          </DialogTitle>
          <DialogDescription>
            {phones.length} markeret{phones.length !== 1 ? "e" : ""} telefonnummer
            {phones.length !== 1 ? "e" : ""} indsat i beskeden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Modtagere ({TRYG_MAIL_RECIPIENTS.length})</Label>
            <div className="flex flex-wrap gap-2">
              {TRYG_MAIL_RECIPIENTS.map((email) => (
                <Badge key={email} variant="secondary">
                  {email}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tryg-mail-subject">Emne</Label>
            <Input
              id="tryg-mail-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tryg-mail-body">Besked</Label>
            <Textarea
              id="tryg-mail-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button
            onClick={handleSend}
            disabled={
              sendMail.isPending || !subject.trim() || !body.trim() || phones.length === 0
            }
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {sendMail.isPending ? "Sender..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
