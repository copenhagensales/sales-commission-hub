import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  template_key: string;
  subject: string;
  content: string;
}

export default function EmailTemplates() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    template_key: "",
    subject: "",
    content: "",
  });
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingTemplate) {
        const { error } = await supabase
          .from("email_templates")
          .update({
            name: formData.name,
            subject: formData.subject,
            content: formData.content,
          })
          .eq("id", editingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("email_templates")
          .insert({
            name: formData.name,
            template_key: formData.template_key,
            subject: formData.subject,
            content: formData.content,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_templates"] });
      toast.success(editingTemplate ? "Skabelon opdateret" : "Skabelon oprettet");
      setDialogOpen(false);
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("En skabelon med denne nøgle findes allerede");
      } else {
        toast.error("Kunne ikke gemme skabelon");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_templates"] });
      toast.success("Skabelon slettet");
    },
    onError: () => {
      toast.error("Kunne ikke slette skabelon");
    },
  });

  const handleOpenDialog = (template?: EmailTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        template_key: template.template_key,
        subject: template.subject,
        content: template.content,
      });
    } else {
      setEditingTemplate(null);
      setFormData({ name: "", template_key: "", subject: "", content: "" });
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.template_key || !formData.subject) {
      toast.error("Navn, nøgle og emne er påkrævet");
      return;
    }
    saveMutation.mutate();
  };

  const handleDelete = (id: string) => {
    if (!confirm("Er du sikker på at du vil slette denne skabelon?")) return;
    deleteMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-4xl py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email-skabeloner</h1>
            <p className="text-muted-foreground mt-1">
              Brug {"{{fornavn}}"} og {"{{rolle}}"} som variable.
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Ny skabelon
          </Button>
        </div>

        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-foreground">{template.name}</CardTitle>
                    <CardDescription className="mt-1">
                      Nøgle: {template.template_key} | Emne: {template.subject}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(template)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{template.content}</p>
              </CardContent>
            </Card>
          ))}

          {templates.length === 0 && (
            <Card className="bg-card border-border">
              <CardContent className="py-8 text-center text-muted-foreground">
                Ingen email-skabeloner endnu. Klik "Ny skabelon" for at oprette en.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingTemplate ? "Rediger skabelon" : "Ny skabelon"}
            </DialogTitle>
            <DialogDescription>
              Brug {"{{fornavn}}"} og {"{{rolle}}"} som variable i din besked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Navn</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="F.eks. Invitation til samtale"
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Nøgle (unik identifikator)</Label>
              <Input
                value={formData.template_key}
                onChange={(e) => setFormData({ ...formData, template_key: e.target.value })}
                placeholder="F.eks. invitation_samtale"
                disabled={!!editingTemplate}
                className="bg-background border-border"
              />
              {editingTemplate && (
                <p className="text-xs text-muted-foreground">
                  Nøglen kan ikke ændres efter oprettelse
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Emne</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="F.eks. Invitation til samtale hos Copenhagen Sales"
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Besked</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Kære {{fornavn}}..."
                rows={8}
                className="bg-background border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saveMutation.isPending}>
              Annuller
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
