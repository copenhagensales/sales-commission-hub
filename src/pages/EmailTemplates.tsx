import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Mail, Eye, Save, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const DEFAULT_WELCOME_EMAIL = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a365d; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 1px; }
    .header p { margin: 10px 0 0 0; font-size: 18px; font-weight: normal; opacity: 0.9; }
    .content { padding: 30px; background: #ffffff; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500; }
    .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
    .steps { background: #f0f9ff; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .steps h3 { margin: 0 0 12px 0; color: #1e40af; }
    .steps ol { margin: 0; padding-left: 20px; }
    .steps li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>COPENHAGEN SALES</h1>
      <p>Velkommen!</p>
    </div>
    <div class="content">
      <p>Hej {{firstName}} {{lastName}},</p>
      <p>Du er blevet tilføjet som medarbejder hos Copenhagen Sales. For at få adgang til systemet skal du:</p>
      
      <div class="steps">
        <h3>Sådan kommer du i gang:</h3>
        <ol>
          <li>Klik på knappen nedenfor</li>
          <li>Udfyld dine personlige oplysninger (CPR, adresse, bankoplysninger)</li>
          <li>Opret din adgangskode</li>
          <li>Log ind og begynd at bruge systemet</li>
        </ol>
      </div>
      
      <a href="{{invitationUrl}}" class="button">Start registrering</a>
      
      <p><strong>Vigtigt:</strong> Linket er gyldigt i 7 dage.</p>
      <p>Hvis du har spørgsmål, er du velkommen til at kontakte os.</p>
      <p>Med venlig hilsen,<br>Copenhagen Sales</p>
    </div>
    <div class="footer">
      <p>Denne email er sendt automatisk. Svar venligst ikke på denne email.</p>
    </div>
  </div>
</body>
</html>`;

interface EmailTemplate {
  id: string;
  name: string;
  template_key: string;
  subject: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function EmailTemplates() {
  const queryClient = useQueryClient();
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: welcomeTemplate, isLoading } = useQuery({
    queryKey: ["email-template", "welcome_invitation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("template_key", "welcome_invitation")
        .single();
      
      if (error && error.code === "PGRST116") {
        // Template doesn't exist, return default
        return null;
      }
      if (error) throw error;
      return data as EmailTemplate;
    },
  });

  const currentSubject = editingSubject ?? welcomeTemplate?.subject ?? "Velkommen til Copenhagen Sales - Opret din profil";
  const currentContent = editingContent ?? welcomeTemplate?.content ?? DEFAULT_WELCOME_EMAIL;

  const saveMutation = useMutation({
    mutationFn: async ({ subject, content }: { subject: string; content: string }) => {
      if (welcomeTemplate) {
        const { error } = await supabase
          .from("email_templates")
          .update({ subject, content, updated_at: new Date().toISOString() })
          .eq("id", welcomeTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("email_templates")
          .insert({
            name: "Velkomstmail",
            template_key: "welcome_invitation",
            subject,
            content,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-template", "welcome_invitation"] });
      toast.success("Skabelon gemt");
      setEditingSubject(null);
      setEditingContent(null);
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error("Kunne ikke gemme skabelon: " + error.message);
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      subject: currentSubject,
      content: currentContent,
    });
  };

  const handleReset = () => {
    setEditingSubject(null);
    setEditingContent(null);
    setHasChanges(false);
  };

  const handleResetToDefault = () => {
    setEditingContent(DEFAULT_WELCOME_EMAIL);
    setEditingSubject("Velkommen til Copenhagen Sales - Opret din profil");
    setHasChanges(true);
  };

  // Generate preview with sample data
  const previewHtml = currentContent
    .replace(/\{\{firstName\}\}/g, "Anders")
    .replace(/\{\{lastName\}\}/g, "Andersen")
    .replace(/\{\{invitationUrl\}\}/g, "https://app.copenhagensales.dk/onboarding?token=example123");

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-6">Indlæser...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Skabeloner</h1>
          <p className="text-muted-foreground mt-1">
            Rediger email-skabeloner der sendes til medarbejdere
          </p>
        </div>

        <Tabs defaultValue="welcome" className="space-y-6">
          <TabsList>
            <TabsTrigger value="welcome" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Velkomstmail
            </TabsTrigger>
          </TabsList>

          <TabsContent value="welcome" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Ny medarbejder invitation</Badge>
                {hasChanges && <Badge variant="secondary">Ændringer ikke gemt</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleResetToDefault}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Nulstil til standard
                </Button>
                {hasChanges && (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleReset}>
                      Annuller
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      Gem ændringer
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Editor */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Rediger skabelon</CardTitle>
                  <CardDescription>
                    Brug variabler: {"{{firstName}}"}, {"{{lastName}}"}, {"{{invitationUrl}}"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Emne</Label>
                    <Input
                      value={currentSubject}
                      onChange={(e) => {
                        setEditingSubject(e.target.value);
                        setHasChanges(true);
                      }}
                      placeholder="Email emne..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>HTML indhold</Label>
                    <Textarea
                      value={currentContent}
                      onChange={(e) => {
                        setEditingContent(e.target.value);
                        setHasChanges(true);
                      }}
                      placeholder="HTML email indhold..."
                      rows={20}
                      className="font-mono text-xs resize-none"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Preview
                  </CardTitle>
                  <CardDescription>
                    Sådan ser mailen ud med eksempel-data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <div className="p-2 bg-muted/50 border-b text-xs text-muted-foreground">
                      <strong>Til:</strong> anders@example.dk<br />
                      <strong>Emne:</strong> {currentSubject}
                    </div>
                    <iframe
                      srcDoc={previewHtml}
                      className="w-full h-[500px] border-0"
                      title="Email preview"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
