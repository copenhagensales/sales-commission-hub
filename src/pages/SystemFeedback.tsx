import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Bug, Lightbulb, Sparkles, Upload, Image, AlertTriangle, ArrowUp, Minus, ArrowDown, Eye, Copy, CheckCircle2, UserPlus, X, Bell, Shield } from "lucide-react";
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
];

function useCurrentEmployeeId() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["current-employee-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("employee_master_data")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      return data?.id || null;
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
  const { data: employeeId } = useCurrentEmployeeId();
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
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const { error } = await supabase
        .from("system_feedback")
        .update({ status, admin_notes: notes || null, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Opdateret" });
      setSelectedFeedback(null);
      queryClient.invalidateQueries({ queryKey: ["system-feedback"] });
    },
  });

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
            {feedbackList.length > 0 && <Badge variant="secondary" className="ml-2">{feedbackList.length}</Badge>}
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
              ) : feedbackList.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Ingen indrapporteringer endnu</p>
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
                      {feedbackList.map((fb: any) => (
                        <TableRow key={fb.id} className="cursor-pointer hover:bg-muted/30" onClick={() => {
                          setSelectedFeedback(fb);
                          setAdminNotes(fb.admin_notes || "");
                          setNewStatus(fb.status);
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
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getCategoryLabel(selectedFeedback.category)}
                  <span className="ml-1">{selectedFeedback.title}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {getPriorityBadge(selectedFeedback.priority)}
                  {getStatusBadge(selectedFeedback.status)}
                  {selectedFeedback.system_area && <Badge variant="outline">{selectedFeedback.system_area}</Badge>}
                </div>

                {selectedFeedback.affected_employee_name && (
                  <div>
                    <p className="text-xs text-muted-foreground">Berørt bruger</p>
                    <p className="text-sm font-medium">{selectedFeedback.affected_employee_name}</p>
                  </div>
                )}

                {selectedFeedback.description && (
                  <div>
                    <p className="text-xs text-muted-foreground">Beskrivelse</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedFeedback.description}</p>
                  </div>
                )}

                {selectedFeedback.screenshot_url && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Screenshot</p>
                    <img src={selectedFeedback.screenshot_url} alt="Screenshot" className="max-w-full rounded-md border border-border" />
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Indsendt {format(new Date(selectedFeedback.created_at), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
                  {selectedFeedback.submitted_by_employee && ` af ${selectedFeedback.submitted_by_employee.first_name} ${selectedFeedback.submitted_by_employee.last_name}`}
                </div>

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
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: selectedFeedback.id, status: newStatus, notes: adminNotes })}
                        disabled={updateMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Gem
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => copyForLovable(selectedFeedback)}>
                        <Copy className="h-4 w-4 mr-1" />
                        Kopiér til Lovable
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
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
