import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Plus, Pencil, Trash2, FolderOpen, Download, FileText, Upload } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const categories = [
  "Referat", "APV", "Kemi-APV", "Sikkerhedsdatablad", "Certifikat",
  "Uddannelse", "Valg", "Politik", "Instruktion", "Øvrigt",
];

const moduleLabels: Record<string, string> = {
  meetings: "Møder", apv: "APV", kemi_apv: "Kemi-APV",
  training: "Uddannelse", annual_discussion: "Årlig drøftelse",
  organisation: "Organisation", general: "Generelt",
};

type DocForm = {
  title: string;
  category: string;
  related_module: string;
  document_date: string;
  expiry_date: string;
  owner: string;
  tags: string;
  doko_reference: string;
  file_url: string;
  comments: string;
};

const emptyForm: DocForm = {
  title: "", category: "", related_module: "", document_date: "",
  expiry_date: "", owner: "", tags: "", doko_reference: "",
  file_url: "", comments: "",
};

export default function AmoDocuments() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<DocForm>(emptyForm);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: documents } = useQuery({
    queryKey: ["amo-documents"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_documents").select("*").order("upload_date", { ascending: false });
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async (f: DocForm) => {
      const payload = {
        title: f.title,
        category: f.category || null,
        related_module: f.related_module || null,
        document_date: f.document_date || null,
        expiry_date: f.expiry_date || null,
        owner: f.owner || null,
        tags: f.tags ? f.tags.split(",").map(s => s.trim()) : null,
        doko_reference: f.doko_reference || null,
        file_url: f.file_url || null,
        comments: f.comments || null,
      };
      if (editing) {
        const { error } = await supabase.from("amo_documents").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("amo_documents").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amo-documents"] });
      qc.invalidateQueries({ queryKey: ["amo-documents-recent"] });
      setDialog(false);
      toast.success(editing ? "Dokument opdateret" : "Dokument oprettet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("amo_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amo-documents"] });
      toast.success("Dokument slettet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialog(true); };
  const openEdit = (d: any) => {
    setEditing(d);
    setForm({
      title: d.title, category: d.category || "", related_module: d.related_module || "",
      document_date: d.document_date?.split("T")[0] || "", expiry_date: d.expiry_date?.split("T")[0] || "",
      owner: d.owner || "", tags: (d.tags || []).join(", "), doko_reference: d.doko_reference || "",
      file_url: d.file_url || "", comments: d.comments || "",
    });
    setDialog(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `documents/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("amo-documents").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("amo-documents").getPublicUrl(path);
      setForm(f => ({ ...f, file_url: urlData.publicUrl }));
      toast.success("Fil uploadet");
    } catch (err: any) {
      toast.error("Upload fejlede: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const filtered = documents?.filter(d => {
    if (filterCategory !== "all" && d.category !== filterCategory) return false;
    if (searchTerm && !d.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }) || [];

  const today = new Date();
  const expiringSoon = documents?.filter(d => {
    if (!d.expiry_date) return false;
    const exp = new Date(d.expiry_date);
    const days = Math.floor((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 30;
  }) || [];

  const categoryCount = categories.reduce((acc, cat) => {
    acc[cat] = documents?.filter(d => d.category === cat).length || 0;
    return acc;
  }, {} as Record<string, number>);

  return (
    <MainLayout>
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <Shield className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dokumentcenter</h1>
            <p className="text-sm text-muted-foreground">Upload, kategoriser og spor AMO-dokumenter</p>
          </div>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Tilføj dokument</Button>
      </div>

      {expiringSoon.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
          <FileText className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-200">{expiringSoon.length} dokumenter udløber inden for 30 dage</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Input
          placeholder="Søg i dokumenter..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle kategorier</SelectItem>
            {categories.map(c => (
              <SelectItem key={c} value={c}>{c} ({categoryCount[c] || 0})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Modul</TableHead>
                <TableHead>Dato</TableHead>
                <TableHead>Udløber</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>DOKO</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(d => {
                const isExpiring = d.expiry_date && new Date(d.expiry_date) < today;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        {d.file_url ? (
                          <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                            {d.title}
                          </a>
                        ) : d.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      {d.category && <Badge variant="outline" className="text-xs">{d.category}</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.related_module ? moduleLabels[d.related_module] || d.related_module : "–"}</TableCell>
                    <TableCell className="text-xs">
                      {d.document_date ? format(new Date(d.document_date), "d. MMM yyyy", { locale: da }) : format(new Date(d.upload_date), "d. MMM yyyy", { locale: da })}
                    </TableCell>
                    <TableCell className="text-xs">
                      {d.expiry_date ? (
                        <span className={cn(isExpiring ? "text-red-400 font-medium" : "text-muted-foreground")}>
                          {format(new Date(d.expiry_date), "d. MMM yyyy", { locale: da })}
                        </span>
                      ) : "–"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">v{d.version}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.doko_reference || "–"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Slet dette dokument?")) del.mutate(d.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Ingen dokumenter fundet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Rediger dokument" : "Nyt dokument"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Titel *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kategori</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Vælg" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Relateret modul</Label>
                <Select value={form.related_module} onValueChange={v => setForm(f => ({ ...f, related_module: v }))}>
                  <SelectTrigger><SelectValue placeholder="Vælg" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(moduleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Dokumentdato</Label><Input type="date" value={form.document_date} onChange={e => setForm(f => ({ ...f, document_date: e.target.value }))} /></div>
              <div><Label>Udløbsdato</Label><Input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Upload fil</Label>
              <div className="flex gap-2 items-center">
                <Input type="file" onChange={handleFileUpload} disabled={uploading} />
                {uploading && <span className="text-xs text-muted-foreground">Uploader...</span>}
              </div>
              {form.file_url && <p className="text-xs text-muted-foreground mt-1 truncate">URL: {form.file_url}</p>}
            </div>
            <div><Label>Fil URL (eller indsæt manuelt)</Label><Input value={form.file_url} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Ejer</Label><Input value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} /></div>
              <div><Label>DOKO-reference</Label><Input value={form.doko_reference} onChange={e => setForm(f => ({ ...f, doko_reference: e.target.value }))} /></div>
            </div>
            <div><Label>Tags (kommasepareret)</Label><Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="F.eks. APV, 2025, kontor" /></div>
            <div><Label>Kommentarer</Label><Textarea rows={2} value={form.comments} onChange={e => setForm(f => ({ ...f, comments: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Annuller</Button>
            <Button onClick={() => save.mutate(form)} disabled={!form.title || save.isPending}>
              {save.isPending ? "Gemmer..." : "Gem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </MainLayout>
  );
}
