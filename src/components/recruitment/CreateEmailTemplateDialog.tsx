import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

interface CreateEmailTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEmailTemplateDialog({ open, onOpenChange }: CreateEmailTemplateDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState(`Kære {{fornavn}},



Med venlig hilsen
Copenhagen Sales`);

  const createMutation = useMutation({
    mutationFn: async () => {
      // Generate template_key from name
      const templateKey = name
        .toLowerCase()
        .replace(/[æ]/g, "ae")
        .replace(/[ø]/g, "oe")
        .replace(/[å]/g, "aa")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");

      const { error } = await supabase
        .from("email_templates")
        .insert({
          name,
          template_key: `custom_${templateKey}_${Date.now()}`,
          subject,
          content,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment-email-templates"] });
      toast.success("Skabelon oprettet");
      onOpenChange(false);
      setName("");
      setSubject("");
      setContent(`Kære {{fornavn}},



Med venlig hilsen
Copenhagen Sales`);
    },
    onError: (error) => {
      toast.error("Kunne ikke oprette skabelon: " + error.message);
    },
  });

  const isValid = name.trim() && subject.trim() && content.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Opret ny email-skabelon</DialogTitle>
          <DialogDescription>
            Opret en ny email-skabelon til rekruttering. Brug {"{{fornavn}}"} og {"{{rolle}}"} som variabler.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Navn på skabelon</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="F.eks. Opfølgning efter samtale"
            />
          </div>

          <div className="space-y-2">
            <Label>Emne</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="F.eks. Opfølgning på din samtale hos Copenhagen Sales"
            />
          </div>

          <div className="space-y-2">
            <Label>Indhold</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Skriv email-indholdet her..."
              rows={12}
              className="resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Tilgængelige variabler: {"{{fornavn}}"}, {"{{rolle}}"}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button 
            onClick={() => createMutation.mutate()} 
            disabled={!isValid || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Opret skabelon
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
