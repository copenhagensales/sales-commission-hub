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
import { Mail, Eye, Save, RotateCcw, Send, Loader2, UserPlus, CalendarCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// CPH Sales official colors:
// Light Blue: #e6f0f1 - Background + text + logo on dark background
// Onyx: #2e3136 - Background + text + logo on light background
// Emerald Green: #3BE086 - Primary for text + logo

const DEFAULT_INTERVIEW_INVITATION = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #2e3136; margin: 0; padding: 0; background: #e6f0f1; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2e3136; color: #e6f0f1; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px; color: #3BE086; }
    .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; color: #e6f0f1; }
    .content { padding: 30px; background: #ffffff; }
    .button { display: inline-block; background: #3BE086; color: #2e3136; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .footer { padding: 20px; text-align: center; color: #2e3136; font-size: 12px; background: #e6f0f1; border-radius: 0 0 8px 8px; }
    .info-box { background: #e6f0f1; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3BE086; }
    .info-box h3 { margin: 0 0 12px 0; color: #2e3136; }
    .info-box p { margin: 8px 0; color: #2e3136; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>COPENHAGEN SALES</h1>
      <p>Invitation til samtale</p>
    </div>
    <div class="content">
      <p>Kære {{fornavn}},</p>
      <p>Tak for din ansøgning til stillingen som {{rolle}} hos Copenhagen Sales.</p>
      <p>Vi vil gerne invitere dig til en samtale, hvor vi kan lære hinanden bedre at kende.</p>
      
      <div class="info-box">
        <h3>Praktiske oplysninger:</h3>
        <p><strong>Dato:</strong> {{dato}}</p>
        <p><strong>Tidspunkt:</strong> {{tidspunkt}}</p>
        <p><strong>Sted:</strong> {{adresse}}</p>
      </div>
      
      <p>Bekræft venligst din deltagelse ved at svare på denne mail.</p>
      <p>Vi glæder os til at møde dig!</p>
      <p>Med venlig hilsen,<br>Copenhagen Sales</p>
    </div>
    <div class="footer">
      <p>Copenhagen Sales | Rekruttering</p>
    </div>
  </div>
</body>
</html>`;

const DEFAULT_APPLICATION_CONFIRMATION = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #2e3136; margin: 0; padding: 0; background: #e6f0f1; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2e3136; color: #e6f0f1; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px; color: #3BE086; }
    .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; color: #e6f0f1; }
    .content { padding: 30px; background: #ffffff; }
    .footer { padding: 20px; text-align: center; color: #2e3136; font-size: 12px; background: #e6f0f1; border-radius: 0 0 8px 8px; }
    .steps { background: #e6f0f1; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .steps h3 { margin: 0 0 12px 0; color: #2e3136; }
    .steps ol { margin: 0; padding-left: 20px; }
    .steps li { margin: 8px 0; color: #2e3136; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>COPENHAGEN SALES</h1>
      <p>Tak for din ansøgning</p>
    </div>
    <div class="content">
      <p>Kære {{fornavn}},</p>
      <p>Tak for din ansøgning til stillingen som {{rolle}} hos Copenhagen Sales.</p>
      <p>Vi har modtaget din ansøgning og vil gennemgå den hurtigst muligt.</p>
      
      <div class="steps">
        <h3>Hvad sker der nu?</h3>
        <ol>
          <li>Vi gennemgår alle ansøgninger</li>
          <li>Udvalgte kandidater kontaktes til samtale</li>
          <li>Du hører fra os inden for 1-2 uger</li>
        </ol>
      </div>
      
      <p>Har du spørgsmål i mellemtiden, er du velkommen til at kontakte os.</p>
      <p>Med venlig hilsen,<br>Copenhagen Sales</p>
    </div>
    <div class="footer">
      <p>Copenhagen Sales | Rekruttering</p>
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

type TemplateKey = "recruitment_interview_invitation" | "recruitment_application_confirmation";

interface TemplateConfig {
  key: TemplateKey;
  name: string;
  description: string;
  icon: typeof Mail;
  defaultSubject: string;
  defaultContent: string;
  previewReplacements: Record<string, string>;
  badge: string;
}

const TEMPLATE_CONFIGS: TemplateConfig[] = [
  {
    key: "recruitment_interview_invitation",
    name: "Samtale invitation",
    description: "Sendes når en kandidat inviteres til samtale",
    icon: CalendarCheck,
    defaultSubject: "Invitation til samtale hos Copenhagen Sales",
    defaultContent: DEFAULT_INTERVIEW_INVITATION,
    previewReplacements: {
      "{{fornavn}}": "Maria",
      "{{rolle}}": "Salgskonsulent",
      "{{dato}}": "Mandag d. 15. januar 2026",
      "{{tidspunkt}}": "10:00",
      "{{adresse}}": "Amagerbrogade 123, 2300 København S",
    },
    badge: "Samtale invitation",
  },
  {
    key: "recruitment_application_confirmation",
    name: "Ansøgning modtaget",
    description: "Bekræftelse sendt ved modtagelse af ansøgning",
    icon: UserPlus,
    defaultSubject: "Tak for din ansøgning - Copenhagen Sales",
    defaultContent: DEFAULT_APPLICATION_CONFIRMATION,
    previewReplacements: {
      "{{fornavn}}": "Maria",
      "{{rolle}}": "Salgskonsulent",
    },
    badge: "Ansøgningsbekræftelse",
  },
];

export default function EmailTemplates() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TemplateKey>("recruitment_interview_invitation");
  const [editingSubjects, setEditingSubjects] = useState<Record<string, string | null>>({});
  const [editingContents, setEditingContents] = useState<Record<string, string | null>>({});
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({});
  const [testEmail, setTestEmail] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["recruitment-email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .in("template_key", TEMPLATE_CONFIGS.map(c => c.key));
      
      if (error) throw error;
      
      const templateMap: Record<string, EmailTemplate> = {};
      data?.forEach(t => {
        templateMap[t.template_key] = t as EmailTemplate;
      });
      return templateMap;
    },
  });

  const getConfig = (key: TemplateKey) => TEMPLATE_CONFIGS.find(c => c.key === key)!;
  const getTemplate = (key: TemplateKey) => templates?.[key];

  const getCurrentSubject = (key: TemplateKey) => {
    const config = getConfig(key);
    return editingSubjects[key] ?? getTemplate(key)?.subject ?? config.defaultSubject;
  };

  const getCurrentContent = (key: TemplateKey) => {
    const config = getConfig(key);
    return editingContents[key] ?? getTemplate(key)?.content ?? config.defaultContent;
  };

  const saveMutation = useMutation({
    mutationFn: async ({ key, subject, content }: { key: TemplateKey; subject: string; content: string }) => {
      const template = getTemplate(key);
      const config = getConfig(key);
      
      if (template) {
        const { error } = await supabase
          .from("email_templates")
          .update({ subject, content, updated_at: new Date().toISOString() })
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("email_templates")
          .insert({
            name: config.name,
            template_key: key,
            subject,
            content,
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, { key }) => {
      queryClient.invalidateQueries({ queryKey: ["recruitment-email-templates"] });
      toast.success("Skabelon gemt");
      setEditingSubjects(prev => ({ ...prev, [key]: null }));
      setEditingContents(prev => ({ ...prev, [key]: null }));
      setHasChanges(prev => ({ ...prev, [key]: false }));
    },
    onError: (error) => {
      toast.error("Kunne ikke gemme skabelon: " + error.message);
    },
  });

  const handleSave = (key: TemplateKey) => {
    saveMutation.mutate({
      key,
      subject: getCurrentSubject(key),
      content: getCurrentContent(key),
    });
  };

  const handleReset = (key: TemplateKey) => {
    setEditingSubjects(prev => ({ ...prev, [key]: null }));
    setEditingContents(prev => ({ ...prev, [key]: null }));
    setHasChanges(prev => ({ ...prev, [key]: false }));
  };

  const handleResetToDefault = (key: TemplateKey) => {
    const config = getConfig(key);
    setEditingContents(prev => ({ ...prev, [key]: config.defaultContent }));
    setEditingSubjects(prev => ({ ...prev, [key]: config.defaultSubject }));
    setHasChanges(prev => ({ ...prev, [key]: true }));
  };

  const handleSubjectChange = (key: TemplateKey, value: string) => {
    setEditingSubjects(prev => ({ ...prev, [key]: value }));
    setHasChanges(prev => ({ ...prev, [key]: true }));
  };

  const handleContentChange = (key: TemplateKey, value: string) => {
    setEditingContents(prev => ({ ...prev, [key]: value }));
    setHasChanges(prev => ({ ...prev, [key]: true }));
  };

  const handleSendTestEmail = async (key: TemplateKey) => {
    if (!testEmail) {
      toast.error("Indtast en email-adresse");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      toast.error("Ugyldig email-adresse");
      return;
    }

    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: {
          recipientEmail: testEmail,
          subject: getCurrentSubject(key),
          htmlContent: getCurrentContent(key),
        },
      });

      if (error) throw error;
      toast.success(`Test-mail sendt til ${testEmail}`);
      setTestEmail("");
    } catch (error) {
      console.error("Error sending test email:", error);
      toast.error("Kunne ikke sende test-mail: " + (error instanceof Error ? error.message : "Ukendt fejl"));
    } finally {
      setIsSendingTest(false);
    }
  };

  const getPreviewHtml = (key: TemplateKey) => {
    const config = getConfig(key);
    let html = getCurrentContent(key);
    Object.entries(config.previewReplacements).forEach(([placeholder, value]) => {
      html = html.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value);
    });
    return html;
  };

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
          <h1 className="text-3xl font-bold">Email-skabeloner</h1>
          <p className="text-muted-foreground mt-1">
            Rediger email-skabeloner til rekruttering
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TemplateKey)} className="space-y-6">
          <TabsList>
            {TEMPLATE_CONFIGS.map((config) => {
              const Icon = config.icon;
              return (
                <TabsTrigger key={config.key} value={config.key} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {config.name}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {TEMPLATE_CONFIGS.map((config) => (
            <TabsContent key={config.key} value={config.key} className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{config.badge}</Badge>
                  {hasChanges[config.key] && <Badge variant="secondary">Ændringer ikke gemt</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleResetToDefault(config.key)}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Nulstil til standard
                  </Button>
                  {hasChanges[config.key] && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => handleReset(config.key)}>
                        Annuller
                      </Button>
                      <Button size="sm" onClick={() => handleSave(config.key)} disabled={saveMutation.isPending}>
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
                      {config.description}
                      <br />
                      <span className="text-xs mt-1 block">
                        Variabler: {Object.keys(config.previewReplacements).join(", ")}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Emne</Label>
                      <Input
                        value={getCurrentSubject(config.key)}
                        onChange={(e) => handleSubjectChange(config.key, e.target.value)}
                        placeholder="Email emne..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>HTML indhold</Label>
                      <Textarea
                        value={getCurrentContent(config.key)}
                        onChange={(e) => handleContentChange(config.key, e.target.value)}
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
                  <CardContent className="space-y-4">
                    {/* Test email section */}
                    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                      <Label className="text-sm font-medium">Send test-mail</Label>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="Indtast email-adresse..."
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSendTestEmail(config.key);
                            }
                          }}
                        />
                        <Button 
                          onClick={() => handleSendTestEmail(config.key)} 
                          disabled={isSendingTest || !testEmail}
                          size="default"
                        >
                          {isSendingTest ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Test-mails får automatisk [TEST] i emnelinjen
                      </p>
                    </div>

                    <div className="border rounded-lg overflow-hidden bg-white">
                      <div className="p-2 bg-muted/50 border-b text-xs text-muted-foreground">
                        <strong>Til:</strong> maria@example.dk<br />
                        <strong>Emne:</strong> {getCurrentSubject(config.key)}
                      </div>
                      <iframe
                        srcDoc={getPreviewHtml(config.key)}
                        className="w-full h-[500px] border-0"
                        title="Email preview"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </MainLayout>
  );
}
