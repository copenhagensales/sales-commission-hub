import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowLeft, Brain, Users, BookOpen, ClipboardList, Send, Plus, Pencil, Trash2, Check, X, Mail, UserCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { da } from "date-fns/locale";

// ─── Politik-tab indhold ───
const policyContent = [
  {
    id: "formaal",
    title: "2.1 Formål",
    content: "At sikre at Copenhagen Sales anvender AI lovligt, ansvarligt, sikkert og forretningsmæssigt hensigtsmæssigt i overensstemmelse med EU's AI Act og databeskyttelsesreglerne (GDPR)."
  },
  {
    id: "omfang",
    title: "2.2 Omfang",
    content: "Denne politik gælder for alle medarbejdere, ledere og samarbejdspartnere der anvender AI-værktøjer i forbindelse med deres arbejde for Copenhagen Sales. Det dækker både centralt godkendte AI-systemer og enhver ekstern AI-tjeneste der bruges til arbejdsrelaterede formål."
  },
  {
    id: "godkendte",
    title: "2.3 Godkendte AI-systemer",
    content: "Kun følgende AI-systemer er godkendt til brug:\n\n• ChatGPT Business (OpenAI) — Til tekstudkast, opsummeringer og kommunikation. Workspace-data deles IKKE med OpenAI til træning.\n• Lovable (AI-assisteret kodning) — Til intern systemudvikling. AI bruges til kodegenerering; ingen persondata sendes til AI-modellen.\n\nAndre AI-værktøjer må IKKE bruges til arbejdsrelaterede opgaver uden forudgående godkendelse fra AI-ansvarlig."
  },
  {
    id: "tilladt",
    title: "2.4 Tilladt og ikke-tilladt brug",
    content: "✅ Tilladt:\n• Udkast til e-mails, opslag og intern kommunikation\n• Opsummering af mødenotater (uden persondata)\n• Research og idégenerering\n• Kodegenerering via Lovable\n\n❌ Ikke tilladt:\n• Indtastning af CPR-numre, løndata, bankoplysninger eller helbredsdata\n• Brug af kunders persondata (navne, telefonnumre, adresser)\n• Automatiserede beslutninger uden menneskelig kontrol\n• Upload af interne dokumenter med fortrolige oplysninger\n• Brug af AI til overvågning af medarbejdere\n• Brug af AI til emotionsgenkendelse på arbejdspladsen"
  },
  {
    id: "dataregler",
    title: "2.5 Dataregler",
    content: "• Ingen persondata må indtastes i AI-værktøjer medmindre det er eksplicit godkendt i use case-registeret\n• Anonymiser altid data før brug i AI hvis muligt\n• ChatGPT Business workspace er konfigureret så data IKKE bruges til træning\n• Data i Lovable/Supabase forbliver i EU (Frankfurt-region)"
  },
  {
    id: "kontrol",
    title: "2.6 Menneskelig kontrol",
    content: "Alt AI-genereret output skal gennemgås og godkendes af en medarbejder inden det bruges eksternt eller danner grundlag for beslutninger. AI bruges som støtteværktøj – ikke som beslutningsmotor."
  },
  {
    id: "ansvar",
    title: "2.7 Ansvarsfordeling",
    content: "• AI-ansvarlig: Overordnet ansvar for politik, compliance og revision\n• Systemejere: Ansvarlig for konfiguration, adgangsstyring og korrekt brug af deres system\n• Nærmeste leder: Sikrer at egne medarbejdere er instrueret og overholder politikken\n• Alle medarbejdere: Følger politikken og rapporterer fejl eller tvivlsspørgsmål"
  },
  {
    id: "traening",
    title: "2.8 Træning og instruktion (Art. 4 AI Literacy)",
    content: "EU AI Act Artikel 4 kræver at alle der anvender AI-systemer har tilstrækkelig AI-færdigheder (AI literacy).\n\n• Alle medarbejdere der bruger AI modtager skriftlig instruktion om godkendte værktøjer, regler og begrænsninger\n• Instruktionen logges i systemet med dato, metode og kvittering\n• Nye medarbejdere instrueres som del af onboarding\n• Ved ændringer i politik eller nye værktøjer sendes opdateret instruktion"
  },
  {
    id: "forbudt",
    title: "2.9 Forbudte AI-praksisser (Art. 5)",
    content: "Følgende er forbudt iht. EU AI Act Artikel 5 og er eksplicit ikke tilladt hos Copenhagen Sales:\n\n🚫 Subliminal manipulation eller vildledende AI-teknikker\n🚫 Udnyttelse af sårbarheder (alder, handicap, social situation)\n🚫 Social scoring af medarbejdere eller kunder\n🚫 Emotionsgenkendelse på arbejdspladsen\n🚫 Biometrisk kategorisering baseret på følsomme data\n🚫 Masseindsamling af ansigtsdata fra internet/overvågning\n🚫 Forudsigende politiarbejde baseret udelukkende på profilering"
  },
  {
    id: "revision",
    title: "2.10 Revision og opdatering",
    content: "• Denne politik revideres minimum én gang årligt\n• AI-registeret gennemgås kvartalsvis\n• Ved nye AI-systemer eller væsentlige ændringer opdateres politik og register\n• Næste planlagte revision: Juni 2026"
  },
];

const dosDonts = [
  { do: "Brug ChatGPT til udkast til e-mails og tekster", dont: "Indtast CPR-numre, løn eller bankdata" },
  { do: "Lad AI opsummere mødenotater (uden navne/persondata)", dont: "Upload fortrolige dokumenter" },
  { do: "Brug AI til research og idégenerering", dont: "Lad AI træffe beslutninger uden din godkendelse" },
  { do: "Gennemgå og ret altid AI-output inden brug", dont: "Brug ikke-godkendte AI-værktøjer til arbejdsopgaver" },
  { do: "Rapportér fejl eller tvivlsspørgsmål til AI-ansvarlig", dont: "Del kunders persondata med AI-værktøjer" },
];

// ─── Component ───
export default function AiGovernance() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingRole, setEditingRole] = useState<any>(null);
  const [useCaseDialog, setUseCaseDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [sendingInstruction, setSendingInstruction] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());

  // ─── Queries ───
  const { data: roles = [] } = useQuery({
    queryKey: ["ai-governance-roles"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ai_governance_roles").select("*").order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: useCases = [] } = useQuery({
    queryKey: ["ai-use-case-registry"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ai_use_case_registry").select("*").order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: instructionLogs = [] } = useQuery({
    queryKey: ["ai-instruction-log"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ai_instruction_log").select("*").order("instruction_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["active-employees-for-ai"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, work_email")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  // ─── Mutations ───
  const updateRole = useMutation({
    mutationFn: async ({ id, responsible_person }: { id: string; responsible_person: string }) => {
      const { error } = await (supabase as any).from("ai_governance_roles").update({ responsible_person, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-governance-roles"] });
      setEditingRole(null);
      toast.success("Rolle opdateret");
    },
  });

  const upsertUseCase = useMutation({
    mutationFn: async (data: any) => {
      if (data.id) {
        const { error } = await (supabase as any).from("ai_use_case_registry").update({ ...data, updated_at: new Date().toISOString() }).eq("id", data.id);
        if (error) throw error;
      } else {
        const { id: _, ...insertData } = data;
        const { error } = await (supabase as any).from("ai_use_case_registry").insert(insertData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-use-case-registry"] });
      setUseCaseDialog({ open: false });
      toast.success("Use case gemt");
    },
  });

  const deleteUseCase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("ai_use_case_registry").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-use-case-registry"] });
      toast.success("Use case slettet");
    },
  });

  // Employees with work_email for selection
  const eligibleEmployees = employees.filter((e: any) => e.work_email && e.work_email.trim());
  const instructedEmployeeIds = new Set(instructionLogs.map((l: any) => l.employee_id));

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedEmployeeIds.size === eligibleEmployees.length) {
      setSelectedEmployeeIds(new Set());
    } else {
      setSelectedEmployeeIds(new Set(eligibleEmployees.map((e: any) => e.id)));
    }
  };

  const sendInstruction = async () => {
    if (selectedEmployeeIds.size === 0) {
      toast.error("Vælg mindst én medarbejder");
      return;
    }
    setSendingInstruction(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-ai-instruction-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ employee_ids: Array.from(selectedEmployeeIds) }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Fejl ved afsendelse");
      toast.success(`AI-instruktion sendt til ${result.sent_count} medarbejder(e)`);
      setSelectedEmployeeIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["ai-instruction-log"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSendingInstruction(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-8 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/compliance")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Tilbage
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">AI Governance</h1>
            <Badge variant="outline" className="bg-violet-500/10 text-violet-700 border-violet-500/30">EU AI Act</Badge>
          </div>
          <p className="text-muted-foreground text-lg">
            Intern styring af kunstig intelligens iht. EU AI Act og GDPR
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm text-foreground space-y-1">
              <p>
                EU AI Act kræver at virksomheder der anvender AI-systemer sikrer AI-færdigheder (Art. 4), 
                undgår forbudte praksisser (Art. 5), og dokumenterer brug af AI-systemer.
              </p>
              <p className="text-muted-foreground text-xs">
                AI-ansvarlig: Kasper Mikkelsen · Politik godkendt: Juni 2025
              </p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="politik" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="politik">Politik</TabsTrigger>
            <TabsTrigger value="ansvar">Ansvarsfordeling</TabsTrigger>
            <TabsTrigger value="register">AI-register</TabsTrigger>
            <TabsTrigger value="instruktion">Instruktionslog</TabsTrigger>
          </TabsList>

          {/* ─── Politik Tab ─── */}
          <TabsContent value="politik" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI-politik for Copenhagen Sales</CardTitle>
                <CardDescription>Intern politik for brug af kunstig intelligens — sektioner 2.1–2.10</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {policyContent.map((section) => (
                    <AccordionItem key={section.id} value={section.id}>
                      <AccordionTrigger className="text-sm font-medium">{section.title}</AccordionTrigger>
                      <AccordionContent>
                        <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                          {section.content}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Brugerinstruks — Do's & Don'ts
                </CardTitle>
                <CardDescription>Praktisk vejledning til medarbejdere der bruger AI-værktøjer</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-green-700">✅ Gør</TableHead>
                      <TableHead className="text-red-700">❌ Gør ikke</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dosDonts.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{row.do}</TableCell>
                        <TableCell className="text-sm">{row.dont}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Ansvarsfordeling Tab ─── */}
          <TabsContent value="ansvar" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Udpegede roller
                </CardTitle>
                <CardDescription>Roller og ansvarlige personer for AI-styring iht. EU AI Act</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rolle</TableHead>
                      <TableHead>Ansvarlig</TableHead>
                      <TableHead>Udpeget af</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role: any) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium text-sm">{role.role_name}</TableCell>
                        <TableCell>
                          {editingRole?.id === role.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editingRole.responsible_person}
                                onChange={(e) => setEditingRole({ ...editingRole, responsible_person: e.target.value })}
                                className="h-8 w-48"
                              />
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateRole.mutate({ id: role.id, responsible_person: editingRole.responsible_person })}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingRole(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm">{role.responsible_person}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{role.appointed_by}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={role.status === "active" ? "bg-green-500/10 text-green-700 border-green-500/30" : "bg-muted text-muted-foreground"}>
                            {role.status === "active" ? "Aktiv" : role.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {editingRole?.id !== role.id && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingRole({ id: role.id, responsible_person: role.responsible_person })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {roles.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-4">
                    Bemærk: {roles[0]?.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── AI-register Tab ─── */}
          <TabsContent value="register" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    AI Use Case Register
                  </CardTitle>
                  <CardDescription>Oversigt over alle godkendte AI-anvendelser iht. EU AI Act</CardDescription>
                </div>
                <Button size="sm" onClick={() => setUseCaseDialog({ open: true, data: undefined })}>
                  <Plus className="h-4 w-4 mr-1" /> Tilføj
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {useCases.map((uc: any) => (
                    <Card key={uc.id} className="border">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-sm">{uc.name}</h4>
                            <p className="text-xs text-muted-foreground">{uc.system}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={
                              uc.risk_level === "minimal" ? "bg-green-500/10 text-green-700 border-green-500/30" :
                              uc.risk_level === "begrænset" ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" :
                              "bg-red-500/10 text-red-700 border-red-500/30"
                            }>
                              {uc.risk_level}
                            </Badge>
                            {uc.has_personal_data && (
                              <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">
                                <AlertTriangle className="h-3 w-3 mr-1" /> Persondata
                              </Badge>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setUseCaseDialog({ open: true, data: uc })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Slet denne use case?")) deleteUseCase.mutate(uc.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div><span className="text-muted-foreground">Ejer:</span> {uc.owner}</div>
                          <div><span className="text-muted-foreground">Brugere:</span> {uc.user_group}</div>
                          <div><span className="text-muted-foreground">Godkendt:</span> {uc.approved_date || "–"}</div>
                          <div><span className="text-muted-foreground">Næste review:</span> {uc.next_review_date || "–"}</div>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Datatyper:</span> {uc.data_types}
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Menneskelig kontrol:</span> {uc.human_control_requirement}
                        </div>
                        {uc.notes && (
                          <p className="text-xs text-muted-foreground border-t pt-2">{uc.notes}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Instruktionslog Tab ─── */}
          <TabsContent value="instruktion" className="space-y-6">
            {/* ── Vælg modtagere ── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Send AI-instruktion
                </CardTitle>
                <CardDescription>
                  Vælg de medarbejdere der skal modtage AI-instruktionsmail (EU AI Act Art. 4)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={eligibleEmployees.length > 0 && selectedEmployeeIds.size === eligibleEmployees.length}
                      onCheckedChange={toggleAll}
                    />
                    <span className="text-sm font-medium">
                      {selectedEmployeeIds.size === eligibleEmployees.length ? "Fravælg alle" : "Vælg alle"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({eligibleEmployees.length} medarbejdere med arbejdsmail)
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={sendInstruction}
                    disabled={sendingInstruction || selectedEmployeeIds.size === 0}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {sendingInstruction ? "Sender..." : `Send til valgte (${selectedEmployeeIds.size})`}
                  </Button>
                </div>

                <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
                  {eligibleEmployees.map((emp: any) => {
                    const alreadyInstructed = instructedEmployeeIds.has(emp.id);
                    return (
                      <label
                        key={emp.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedEmployeeIds.has(emp.id)}
                          onCheckedChange={() => toggleEmployee(emp.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">
                            {emp.first_name} {emp.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2 truncate">
                            {emp.work_email}
                          </span>
                        </div>
                        {alreadyInstructed && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30 text-[10px] shrink-0">
                            <Check className="h-3 w-3 mr-0.5" /> Instrueret
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                  {eligibleEmployees.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      Ingen aktive medarbejdere med arbejdsmail fundet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── Log ── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Instruktionslog
                </CardTitle>
                <CardDescription>Historik over sendte AI-instruktioner</CardDescription>
              </CardHeader>
              <CardContent>
                {instructionLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>Ingen instruktioner sendt endnu</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medarbejder</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Dato</TableHead>
                        <TableHead>Metode</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {instructionLogs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm font-medium">{log.employee_name || "–"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{log.employee_email || "–"}</TableCell>
                          <TableCell className="text-sm">
                            {log.instruction_date ? format(new Date(log.instruction_date), "d. MMM yyyy HH:mm", { locale: da }) : "–"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={log.method === "email" ? "bg-blue-500/10 text-blue-700 border-blue-500/30" : ""}>
                              {log.method === "email" ? "E-mail" : "Manuelt"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.acknowledged ? (
                              <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                                <Check className="h-3 w-3 mr-1" /> Ja
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">Afventer</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Use Case Dialog ─── */}
      <UseCaseDialog
        open={useCaseDialog.open}
        data={useCaseDialog.data}
        onClose={() => setUseCaseDialog({ open: false })}
        onSave={(data) => upsertUseCase.mutate(data)}
      />
    </MainLayout>
  );
}

function UseCaseDialog({ open, data, onClose, onSave }: { open: boolean; data?: any; onClose: () => void; onSave: (data: any) => void }) {
  const [form, setForm] = useState<any>(data || {});

  const handleOpen = () => {
    setForm(data || { risk_level: "minimal", has_personal_data: false });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); else handleOpen(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.id ? "Rediger use case" : "Ny AI use case"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Navn</Label>
            <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="F.eks. Tekstudkast og kommunikation" />
          </div>
          <div className="space-y-2">
            <Label>System</Label>
            <Input value={form.system || ""} onChange={(e) => setForm({ ...form, system: e.target.value })} placeholder="F.eks. ChatGPT Business" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ejer</Label>
              <Input value={form.owner || ""} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Brugergruppe</Label>
              <Input value={form.user_group || ""} onChange={(e) => setForm({ ...form, user_group: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Datatyper</Label>
            <Input value={form.data_types || ""} onChange={(e) => setForm({ ...form, data_types: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Risikoniveau</Label>
              <Select value={form.risk_level || "minimal"} onValueChange={(v) => setForm({ ...form, risk_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="begrænset">Begrænset</SelectItem>
                  <SelectItem value="høj">Høj</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={form.has_personal_data || false} onCheckedChange={(c) => setForm({ ...form, has_personal_data: c })} />
              <Label>Indeholder persondata</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Menneskelig kontrol</Label>
            <Textarea value={form.human_control_requirement || ""} onChange={(e) => setForm({ ...form, human_control_requirement: e.target.value })} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Godkendelsesdato</Label>
              <Input type="date" value={form.approved_date || ""} onChange={(e) => setForm({ ...form, approved_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Næste review</Label>
              <Input type="date" value={form.next_review_date || ""} onChange={(e) => setForm({ ...form, next_review_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Noter</Label>
            <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuller</Button>
          <Button onClick={() => onSave({ ...form, id: data?.id })} disabled={!form.name || !form.system || !form.owner}>
            {data?.id ? "Gem ændringer" : "Opret"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
