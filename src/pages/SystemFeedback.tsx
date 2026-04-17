import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Bug, Lightbulb, Sparkles, Upload, Image, AlertTriangle, ArrowUp, Minus, ArrowDown, Eye, Copy, CheckCircle2, UserPlus, X, Bell, Shield, ChevronDown, Send, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

const CATEGORIES = [
  { value: "bug", label: "Fejl / Bug", icon: Bug, color: "text-destructive" },
  { value: "improvement", label: "Forbedring", icon: Lightbulb, color: "text-yellow-400" },
  { value: "feature_request", label: "Ny funktion", icon: Sparkles, color: "text-primary" },
];

const PRIORITIES = [
  { value: "critical", label: "Kritisk", icon: AlertTriangle, bgClass: "bg-destructive/20 text-destructive border-destructive/30" },
  { value: "high", label: "Høj", icon: ArrowUp, bgClass: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { value: "medium", label: "Medium", icon: Minus, bgClass: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { value: "low", label: "Lav", icon: ArrowDown, bgClass: "bg-muted text-muted-foreground border-border" },
];

const SYSTEM_AREAS = [
  "Salg", "Vagtplan", "Dashboard", "Annulleringer", "Rekruttering",
  "Medarbejdere", "Kontrakter", "Rapporter", "Løn", "Onboarding",
  "Økonomisk", "AMO", "Andet",
];

const STATUSES = [
  { value: "new", label: "Ny", color: "bg-blue-500/20 text-blue-400" },
  { value: "seen", label: "Set", color: "bg-muted text-muted-foreground" },
  { value: "in_progress", label: "Under arbejde", color: "bg-yellow-500/20 text-yellow-400" },
  { value: "resolved", label: "Løst", color: "bg-primary/20 text-primary" },
  { value: "wont_fix", label: "Afvist", color: "bg-destructive/20 text-destructive" },
  { value: "needs_clarification", label: "Afventer svar", color: "bg-purple-500/20 text-purple-400" },
];

function useCurrentEmployeeId() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["current-employee-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      return data ? { id: data.id, name: `${data.first_name || ""} ${data.last_name || ""}`.trim() } : null;
    },
    enabled: !!user?.id,
  });
}

function useIsOwner() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-owner-feedback", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase.rpc("is_owner", { _user_id: user.id });
      return !!data;
    },
    enabled: !!user?.id,
  });
}

export default function SystemFeedback() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentEmployee } = useCurrentEmployeeId();
  const employeeId = currentEmployee?.id || null;
  const employeeName = currentEmployee?.name || "";
  const { data: isOwner } = useIsOwner();

  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("bug");
  const [priority, setPriority] = useState("medium");
  const [affectedEmployee, setAffectedEmployee] = useState("");
  const [systemArea, setSystemArea] = useState("");
  const [description, setDescription] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail dialog
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [commentText, setCommentText] = useState("");

  // Filters
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onload = () => setScreenshotPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  // Fetch feedback
  const { data: feedbackList = [], isLoading } = useQuery({
    queryKey: ["system-feedback", filterCategory, filterPriority, filterStatus, isOwner, employeeId],
    queryFn: async () => {
      let query = supabase
        .from("system_feedback")
        .select("*, submitted_by_employee:employee_master_data!system_feedback_submitted_by_fkey(first_name, last_name)")
        .order("created_at", { ascending: false });

      // Non-owners only see their own submissions
      if (!isOwner && employeeId) {
        query = query.eq("submitted_by", employeeId);
      }

      if (filterCategory !== "all") query = query.eq("category", filterCategory);
      if (filterPriority !== "all") query = query.eq("priority", filterPriority);
      if (filterStatus !== "all") query = query.eq("status", filterStatus);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Overskrift er påkrævet");
      
      let screenshot_url: string | null = null;

      if (screenshotFile) {
        const ext = screenshotFile.name.split(".").pop();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("feedback-screenshots")
          .upload(path, screenshotFile);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("feedback-screenshots")
          .getPublicUrl(path);
        screenshot_url = urlData.publicUrl;
      }

      const { error } = await supabase.from("system_feedback").insert({
        submitted_by: employeeId,
        title: title.trim(),
        category,
        priority,
        affected_employee_name: affectedEmployee.trim() || null,
        system_area: systemArea || null,
        description: description.trim() || null,
        screenshot_url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Tak for din indrapportering!", description: "Vi kigger på det hurtigst muligt." });
      // Fire-and-forget email notification
      supabase.functions.invoke("notify-system-feedback", {
        body: { title, category, priority, description, affectedEmployee, systemArea, submittedBy: employeeName },
      }).catch((err) => console.error("Email notification error:", err));
      setTitle(""); setCategory("bug"); setPriority("medium");
      setAffectedEmployee(""); setSystemArea(""); setDescription("");
      setScreenshotFile(null); setScreenshotPreview(null);
      queryClient.invalidateQueries({ queryKey: ["system-feedback"] });
    },
    onError: (err: any) => {
      toast({ title: "Fejl", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes, feedbackTitle, submittedById }: { id: string; status: string; notes: string; feedbackTitle: string; submittedById: string | null }) => {
      const updatePayload: any = { status, admin_notes: notes || null, updated_at: new Date().toISOString() };
      const { error } = await supabase
        .from("system_feedback")
        .update(updatePayload)
        .eq("id", id);
      if (error) throw error;

      // Fetch submitter's email to send notification
      if (submittedById) {
        const { data: empData } = await supabase
          .from("employee_master_data")
          .select("first_name, last_name, work_email, private_email")
          .eq("id", submittedById)
          .maybeSingle();

        const email = empData?.work_email || empData?.private_email;
        if (email) {
          return { employeeEmail: email, employeeName: `${empData.first_name || ""} ${empData.last_name || ""}`.trim(), feedbackTitle, newStatus: status, adminNotes: notes };
        }
      }
      return null;
    },
    onSuccess: (notificationData) => {
      toast({ title: "Opdateret" });
      setSelectedFeedback(null);
      queryClient.invalidateQueries({ queryKey: ["system-feedback"] });

      // Fire-and-forget notification to submitter
      if (notificationData) {
        supabase.functions.invoke("notify-feedback-status-change", {
          body: notificationData,
        }).catch((err) => console.error("Status change notification error:", err));
      }
    },
  });

  const isFilteringResolved = filterStatus === "resolved" || filterStatus === "wont_fix";

  const { activeFeedback, resolvedFeedback } = useMemo(() => {
    if (isFilteringResolved) {
      return { activeFeedback: feedbackList, resolvedFeedback: [] };
    }
    const active: any[] = [];
    const resolved: any[] = [];
    for (const fb of feedbackList) {
      if (fb.status === "resolved" || fb.status === "wont_fix") {
        resolved.push(fb);
      } else {
        active.push(fb);
      }
    }
    return { activeFeedback: active, resolvedFeedback: resolved };
  }, [feedbackList, isFilteringResolved]);

  const copyForLovable = (fb: any) => {
    const text = [
      `## ${fb.title}`,
      `**Kategori:** ${CATEGORIES.find(c => c.value === fb.category)?.label}`,
      `**Prioritet:** ${PRIORITIES.find(p => p.value === fb.priority)?.label}`,
      fb.affected_employee_name ? `**Berørt bruger:** ${fb.affected_employee_name}` : null,
      fb.system_area ? `**Systemområde:** ${fb.system_area}` : null,
      fb.description ? `\n${fb.description}` : null,
      fb.screenshot_url ? `\n**Screenshot:** ${fb.screenshot_url}` : null,
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Kopieret til udklipsholder" });
  };

  const getPriorityBadge = (p: string) => {
    const prio = PRIORITIES.find(x => x.value === p);
    return prio ? <Badge variant="outline" className={prio.bgClass}>{prio.label}</Badge> : p;
  };

  const getStatusBadge = (s: string) => {
    const status = STATUSES.find(x => x.value === s);
    return status ? <Badge className={status.color}>{status.label}</Badge> : s;
  };

  const getCategoryLabel = (c: string) => {
    const cat = CATEGORIES.find(x => x.value === c);
    if (!cat) return c;
    const Icon = cat.icon;
    return <span className={`flex items-center gap-1.5 ${cat.color}`}><Icon className="h-3.5 w-3.5" />{cat.label}</span>;
  };

  return (
    <DashboardLayout>
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fejlrapportering & Forslag</h1>
        <p className="text-muted-foreground text-sm mt-1">Rapportér fejl, forbedringsforslag eller ønsk nye funktioner</p>
      </div>

      <Tabs defaultValue="submit">
        <TabsList>
          <TabsTrigger value="submit">Indsend</TabsTrigger>
          <TabsTrigger value="list">
            Alle indrapporteringer
            {activeFeedback.length > 0 && <Badge variant="secondary" className="ml-2">{activeFeedback.length}</Badge>}
          </TabsTrigger>
          {isOwner && <TabsTrigger value="recipients"><Bell className="h-4 w-4 mr-1" />Modtagere</TabsTrigger>}
          {isOwner && <TabsTrigger value="access"><Shield className="h-4 w-4 mr-1" />Adgang</TabsTrigger>}
        </TabsList>

        {/* Submit form */}
        <TabsContent value="submit">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ny indrapportering</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Overskrift *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Kort beskrivelse af problemet" maxLength={200} />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Kategori</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2">
                          <c.icon className={`h-4 w-4 ${c.color}`} />
                          {c.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Prioritet</label>
                <div className="flex gap-2 flex-wrap">
                  {PRIORITIES.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPriority(p.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-all ${
                        priority === p.value ? p.bgClass + " ring-1 ring-offset-1 ring-offset-background" : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      <p.icon className="h-3.5 w-3.5" />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Berørt bruger</label>
                <Input value={affectedEmployee} onChange={e => setAffectedEmployee(e.target.value)} placeholder="Fulde navn (fornavn og efternavn) på personen der oplever problemet" maxLength={100} />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Beskrivelse</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Beskriv hvad der sker, og hvad der burde ske..." rows={4} maxLength={2000} />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Screenshot</label>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <input {...getInputProps()} />
                  {screenshotPreview ? (
                    <div className="space-y-2">
                      <img src={screenshotPreview} alt="Preview" className="max-h-48 mx-auto rounded-md" />
                      <p className="text-sm text-muted-foreground">Klik eller træk for at erstatte</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Træk et screenshot hertil eller klik for at vælge</p>
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={() => submitMutation.mutate()}
                disabled={!title.trim() || submitMutation.isPending}
                className="w-full sm:w-auto"
              >
                {submitMutation.isPending ? "Sender..." : "Indsend"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* List view */}
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <CardTitle className="text-lg">Indrapporteringer</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle kategorier</SelectItem>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterPriority} onValueChange={setFilterPriority}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle prioriteter</SelectItem>
                      {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle statuser</SelectItem>
                      {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-center py-8">Indlæser...</p>
              ) : activeFeedback.length === 0 && resolvedFeedback.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Ingen indrapporteringer endnu</p>
              ) : (
                <div className="space-y-6">
                  {activeFeedback.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Ingen aktive opgaver</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Titel</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead>Prioritet</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Indsendt af</TableHead>
                            <TableHead>Dato</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeFeedback.map((fb: any) => (
                            <TableRow key={fb.id} className="cursor-pointer hover:bg-muted/30" onClick={() => {
                              setSelectedFeedback(fb);
                              setAdminNotes(fb.admin_notes || "");
                              setNewStatus(fb.status);
                              setCommentText("");
                            }}>
                              <TableCell className="font-medium max-w-[200px] truncate">{fb.title}</TableCell>
                              <TableCell>{getCategoryLabel(fb.category)}</TableCell>
                              <TableCell>{getPriorityBadge(fb.priority)}</TableCell>
                              <TableCell>{getStatusBadge(fb.status)}</TableCell>
                              <TableCell className="text-sm">
                                {fb.submitted_by_employee
                                  ? `${fb.submitted_by_employee.first_name} ${fb.submitted_by_employee.last_name}`
                                  : "Ukendt"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {format(new Date(fb.created_at), "d. MMM yyyy", { locale: da })}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {fb.screenshot_url && <Image className="h-4 w-4 text-muted-foreground" />}
                                  {isOwner && (
                                    <button onClick={e => { e.stopPropagation(); copyForLovable(fb); }} title="Kopiér til Lovable">
                                      <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                    </button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {resolvedFeedback.length > 0 && (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group w-full">
                        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                        Vis løste opgaver ({resolvedFeedback.length})
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Titel</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Prioritet</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Indsendt af</TableHead>
                                <TableHead>Dato</TableHead>
                                <TableHead></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {resolvedFeedback.map((fb: any) => (
                                <TableRow key={fb.id} className="cursor-pointer hover:bg-muted/30 opacity-60" onClick={() => {
                                  setSelectedFeedback(fb);
                                  setAdminNotes(fb.admin_notes || "");
                                  setNewStatus(fb.status);
                                  setCommentText("");
                                }}>
                                  <TableCell className="font-medium max-w-[200px] truncate">{fb.title}</TableCell>
                                  <TableCell>{getCategoryLabel(fb.category)}</TableCell>
                                  <TableCell>{getPriorityBadge(fb.priority)}</TableCell>
                                  <TableCell>{getStatusBadge(fb.status)}</TableCell>
                                  <TableCell className="text-sm">
                                    {fb.submitted_by_employee
                                      ? `${fb.submitted_by_employee.first_name} ${fb.submitted_by_employee.last_name}`
                                      : "Ukendt"}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {format(new Date(fb.created_at), "d. MMM yyyy", { locale: da })}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      {fb.screenshot_url && <Image className="h-4 w-4 text-muted-foreground" />}
                                      {isOwner && (
                                        <button onClick={e => { e.stopPropagation(); copyForLovable(fb); }} title="Kopiér til Lovable">
                                          <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                        </button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recipients tab (owner only) */}
        {isOwner && (
          <TabsContent value="recipients">
            <RecipientsTab />
          </TabsContent>
        )}

        {/* Access tab (owner only) */}
        {isOwner && (
          <TabsContent value="access">
            <AccessTab />
          </TabsContent>
        )}
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!selectedFeedback} onOpenChange={open => !open && setSelectedFeedback(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedFeedback && (
            <FeedbackDetailContent
              feedback={selectedFeedback}
              isOwner={!!isOwner}
              employeeId={employeeId}
              employeeName={employeeName}
              adminNotes={adminNotes}
              setAdminNotes={setAdminNotes}
              newStatus={newStatus}
              setNewStatus={setNewStatus}
              commentText={commentText}
              setCommentText={setCommentText}
              updateMutation={updateMutation}
              copyForLovable={copyForLovable}
              getCategoryLabel={getCategoryLabel}
              getPriorityBadge={getPriorityBadge}
              getStatusBadge={getStatusBadge}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}

// Comment thread component
function CommentThread({ feedbackId, employeeId, employeeName, isOwner }: { feedbackId: string; employeeId: string | null; employeeName: string; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: comments = [] } = useQuery({
    queryKey: ["feedback-comments", feedbackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_feedback_comments")
        .select("*, author:employee_master_data!system_feedback_comments_author_employee_id_fkey(first_name, last_name)")
        .eq("feedback_id", feedbackId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if ((!message.trim() && !attachment) || !employeeId) return;

      let attachment_url: string | null = null;
      let attachment_name: string | null = null;
      let attachment_type: string | null = null;

      if (attachment) {
        const ext = attachment.name.split(".").pop() || "bin";
        const path = `comments/${feedbackId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("feedback-screenshots")
          .upload(path, attachment, { contentType: attachment.type || undefined, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("feedback-screenshots").getPublicUrl(path);
        attachment_url = pub.publicUrl;
        attachment_name = attachment.name;
        attachment_type = attachment.type || null;
      }

      const { error } = await supabase.from("system_feedback_comments").insert({
        feedback_id: feedbackId,
        author_employee_id: employeeId,
        message: message.trim() || (attachment_name ? `📎 ${attachment_name}` : ""),
        is_admin: isOwner,
        attachment_url,
        attachment_name,
        attachment_type,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["feedback-comments", feedbackId] });
    },
    onError: (e: any) => {
      toast({ title: "Fejl", description: e?.message || "Kunne ikke sende besked", variant: "destructive" });
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMutation.mutate();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Filen er for stor", description: "Maks. 10 MB pr. fil", variant: "destructive" });
      return;
    }
    setAttachment(file);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">Beskedtråd</p>
      </div>

      <div ref={scrollRef} className="max-h-[200px] overflow-y-auto space-y-2 p-2 rounded-md border border-border bg-muted/20">
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Ingen beskeder endnu</p>
        ) : (
          comments.map((c: any) => {
            const authorName = c.author ? `${c.author.first_name || ""} ${c.author.last_name || ""}`.trim() : "Ukendt";
            const isImage = c.attachment_type?.startsWith("image/");
            return (
              <div key={c.id} className={`p-2 rounded-md text-sm ${c.is_admin ? "bg-purple-500/10 border border-purple-500/20 ml-4" : "bg-background border border-border mr-4"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium ${c.is_admin ? "text-purple-400" : "text-muted-foreground"}`}>
                    {authorName} {c.is_admin && "(Admin)"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(c.created_at), "d. MMM HH:mm", { locale: da })}
                  </span>
                </div>
                {c.message && <p className="whitespace-pre-wrap">{c.message}</p>}
                {c.attachment_url && (
                  <div className="mt-2">
                    {isImage ? (
                      <a href={c.attachment_url} target="_blank" rel="noopener noreferrer">
                        <img src={c.attachment_url} alt={c.attachment_name || "vedhæftning"} className="max-h-48 rounded-md border border-border" />
                      </a>
                    ) : (
                      <a
                        href={c.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs text-primary hover:underline px-2 py-1 rounded-md bg-muted/40 border border-border"
                      >
                        <Upload className="h-3 w-3" />
                        {c.attachment_name || "Vedhæftet fil"}
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {attachment && (
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border border-border bg-muted/30">
          <span className="text-xs truncate">📎 {attachment.name} ({(attachment.size / 1024).toFixed(0)} KB)</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={() => {
              setAttachment(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Skriv en besked..."
          rows={2}
          className="min-h-[60px]"
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-[60px] w-10 flex-shrink-0"
          disabled={sendMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
          title="Vedhæft fil"
        >
          <Upload className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          className="h-[60px] w-10 flex-shrink-0"
          disabled={(!message.trim() && !attachment) || sendMutation.isPending}
          onClick={() => sendMutation.mutate()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Feedback detail content component
function FeedbackDetailContent({
  feedback, isOwner, employeeId, employeeName, adminNotes, setAdminNotes, newStatus, setNewStatus, commentText, setCommentText, updateMutation, copyForLovable, getCategoryLabel, getPriorityBadge, getStatusBadge
}: any) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {getCategoryLabel(feedback.category)}
          <span className="ml-1">{feedback.title}</span>
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {getPriorityBadge(feedback.priority)}
          {getStatusBadge(feedback.status)}
          {feedback.system_area && <Badge variant="outline">{feedback.system_area}</Badge>}
        </div>

        {feedback.affected_employee_name && (
          <div>
            <p className="text-xs text-muted-foreground">Berørt bruger</p>
            <p className="text-sm font-medium">{feedback.affected_employee_name}</p>
          </div>
        )}

        {feedback.description && (
          <div>
            <p className="text-xs text-muted-foreground">Beskrivelse</p>
            <p className="text-sm whitespace-pre-wrap">{feedback.description}</p>
          </div>
        )}

        {feedback.screenshot_url && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Screenshot</p>
            <img src={feedback.screenshot_url} alt="Screenshot" className="max-w-full rounded-md border border-border" />
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Indsendt {format(new Date(feedback.created_at), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
          {feedback.submitted_by_employee && ` af ${feedback.submitted_by_employee.first_name} ${feedback.submitted_by_employee.last_name}`}
        </div>

        {/* Legacy admin_response display */}
        {feedback.admin_response && (
          <div className="border border-purple-500/30 bg-purple-500/10 rounded-md p-3">
            <p className="text-xs font-medium text-purple-400 mb-1">Tidligere besked fra admin</p>
            <p className="text-sm whitespace-pre-wrap">{feedback.admin_response}</p>
          </div>
        )}

        {/* Comment thread */}
        <div className="border-t border-border pt-4">
          <CommentThread
            feedbackId={feedback.id}
            employeeId={employeeId}
            employeeName={employeeName}
            isOwner={isOwner}
          />
        </div>

        {/* Needs clarification prompt for non-owners */}
        {!isOwner && feedback.status === "needs_clarification" && (
          <div className="border border-purple-500/30 bg-purple-500/10 rounded-md p-3">
            <p className="text-sm font-medium text-purple-400">⬆️ Admin har bedt om uddybning — skriv et svar i tråden ovenfor</p>
          </div>
        )}

        {/* Admin controls */}
        {isOwner && (
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-medium">Administration</p>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Admin-noter (kun synlige for dig)</label>
              <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={3} maxLength={2000} />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => updateMutation.mutate({ id: feedback.id, status: newStatus, notes: adminNotes, feedbackTitle: feedback.title, submittedById: feedback.submitted_by })}
                disabled={updateMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Gem
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                onClick={() => updateMutation.mutate({ id: feedback.id, status: "needs_clarification", notes: adminNotes, feedbackTitle: feedback.title, submittedById: feedback.submitted_by })}
                disabled={updateMutation.isPending}
              >
                Bed om uddybning
              </Button>
              <Button size="sm" variant="outline" onClick={() => copyForLovable(feedback)}>
                <Copy className="h-4 w-4 mr-1" />
                Kopiér til Lovable
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Recipients management component (only for owners)
function RecipientsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch current recipients
  const { data: recipients = [] } = useQuery({
    queryKey: ["feedback-recipients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_feedback_recipients" as any)
        .select("id, employee_id, employee:employee_master_data!system_feedback_recipients_employee_id_fkey(id, first_name, last_name, work_email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Search employees
  const { data: searchResults = [] } = useQuery({
    queryKey: ["employee-search-feedback", searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 2) return [];
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, work_email")
        .eq("is_active", true)
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,work_email.ilike.%${searchTerm}%`)
        .limit(10);
      if (error) throw error;
      const recipientIds = recipients.map((r: any) => r.employee_id);
      return (data || []).filter((e: any) => !recipientIds.includes(e.id));
    },
    enabled: searchTerm.length >= 2,
  });

  const addMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from("system_feedback_recipients" as any)
        .insert({ employee_id: employeeId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Modtager tilføjet" });
      setSearchTerm("");
      queryClient.invalidateQueries({ queryKey: ["feedback-recipients"] });
    },
    onError: (err: any) => {
      toast({ title: "Fejl", description: err.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("system_feedback_recipients" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Modtager fjernet" });
      queryClient.invalidateQueries({ queryKey: ["feedback-recipients"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Notifikationsmodtagere</CardTitle>
        <p className="text-sm text-muted-foreground">Disse personer får besked når der indsendes nye fejlrapporteringer</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and add */}
        <div className="relative">
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Søg efter medarbejder..."
          />
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map((emp: any) => (
                <button
                  key={emp.id}
                  onClick={() => addMutation.mutate(emp.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 text-left"
                >
                  <span>{emp.first_name} {emp.last_name}</span>
                  <span className="text-muted-foreground text-xs">{emp.work_email}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Current recipients */}
        {recipients.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">Ingen modtagere tilføjet endnu</p>
        ) : (
          <div className="space-y-2">
            {recipients.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-md">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {r.employee?.first_name} {r.employee?.last_name}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.employee?.work_email}</span>
                </div>
                <button
                  onClick={() => removeMutation.mutate(r.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Access management component (only for owners)
function AccessTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: accessList = [] } = useQuery({
    queryKey: ["feedback-access"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_feedback_access" as any)
        .select("id, employee_id, employee:employee_master_data!system_feedback_access_employee_id_fkey(id, first_name, last_name, work_email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["employee-search-access", searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 2) return [];
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, work_email")
        .eq("is_active", true)
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,work_email.ilike.%${searchTerm}%`)
        .limit(10);
      if (error) throw error;
      const accessIds = accessList.map((r: any) => r.employee_id);
      return (data || []).filter((e: any) => !accessIds.includes(e.id));
    },
    enabled: searchTerm.length >= 2,
  });

  const addMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from("system_feedback_access" as any)
        .insert({ employee_id: employeeId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Adgang tilføjet" });
      setSearchTerm("");
      queryClient.invalidateQueries({ queryKey: ["feedback-access"] });
    },
    onError: (err: any) => {
      toast({ title: "Fejl", description: err.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("system_feedback_access" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Adgang fjernet" });
      queryClient.invalidateQueries({ queryKey: ["feedback-access"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Adgangsstyring</CardTitle>
        <p className="text-sm text-muted-foreground">Styr hvilke medarbejdere der har adgang til at se og indsende fejlrapporteringer</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Søg efter medarbejder..."
          />
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map((emp: any) => (
                <button
                  key={emp.id}
                  onClick={() => addMutation.mutate(emp.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 text-left"
                >
                  <span>{emp.first_name} {emp.last_name}</span>
                  <span className="text-muted-foreground text-xs">{emp.work_email}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {accessList.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">Ingen medarbejdere har adgang endnu</p>
        ) : (
          <div className="space-y-2">
            {accessList.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-md">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {r.employee?.first_name} {r.employee?.last_name}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.employee?.work_email}</span>
                </div>
                <button
                  onClick={() => removeMutation.mutate(r.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
