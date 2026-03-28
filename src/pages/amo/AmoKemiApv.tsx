import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Plus, Pencil, Trash2, AlertTriangle, Beaker, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type KemiForm = {
  product_name: string;
  supplier: string;
  product_type: string;
  hazard_flag: boolean;
  sds_url: string;
  storage_notes: string;
  work_process: string;
  exposure_risk: string;
  protective_measures: string;
  instructions: string;
  responsible_owner: string;
  review_date: string;
  next_review_due: string;
};

const emptyForm: KemiForm = {
  product_name: "", supplier: "", product_type: "", hazard_flag: false,
  sds_url: "", storage_notes: "", work_process: "", exposure_risk: "",
  protective_measures: "", instructions: "", responsible_owner: "",
  review_date: "", next_review_due: "",
};

export default function AmoKemiApv() {
  const qc = useQueryClient();
  const today = new Date();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<KemiForm>(emptyForm);

  const { data: products } = useQuery({
    queryKey: ["amo-kemi-apv"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_kemi_apv").select("*").order("product_name");
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async (f: KemiForm) => {
      const payload = {
        product_name: f.product_name,
        supplier: f.supplier || null,
        product_type: f.product_type || null,
        hazard_flag: f.hazard_flag,
        sds_url: f.sds_url || null,
        storage_notes: f.storage_notes || null,
        work_process: f.work_process || null,
        exposure_risk: f.exposure_risk || null,
        protective_measures: f.protective_measures || null,
        instructions: f.instructions || null,
        responsible_owner: f.responsible_owner || null,
        review_date: f.review_date || null,
        next_review_due: f.next_review_due || null,
      };
      if (editing) {
        const { error } = await supabase.from("amo_kemi_apv").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("amo_kemi_apv").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amo-kemi-apv"] });
      setDialog(false);
      toast.success(editing ? "Produkt opdateret" : "Produkt oprettet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("amo_kemi_apv").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amo-kemi-apv"] });
      toast.success("Produkt slettet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialog(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      product_name: p.product_name, supplier: p.supplier || "", product_type: p.product_type || "",
      hazard_flag: p.hazard_flag, sds_url: p.sds_url || "", storage_notes: p.storage_notes || "",
      work_process: p.work_process || "", exposure_risk: p.exposure_risk || "",
      protective_measures: p.protective_measures || "", instructions: p.instructions || "",
      responsible_owner: p.responsible_owner || "",
      review_date: p.review_date?.split("T")[0] || "", next_review_due: p.next_review_due?.split("T")[0] || "",
    });
    setDialog(true);
  };

  const hazardous = products?.filter(p => p.hazard_flag) || [];
  const missingSds = hazardous.filter(p => !p.sds_url);
  const overdueReview = products?.filter(p => p.next_review_due && new Date(p.next_review_due) < today) || [];

  return (
    <MainLayout>
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <Shield className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Kemisk risikovurdering (Kemi-APV)</h1>
            <p className="text-sm text-muted-foreground">Produktliste med sikkerhedsdatablade og risikovurdering</p>
          </div>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Tilføj produkt</Button>
      </div>

      {missingSds.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">{missingSds.length} farlige produkter mangler sikkerhedsdatablad!</p>
            <p className="text-xs text-red-300">{missingSds.map(p => p.product_name).join(", ")}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{products?.length || 0}</div>
          <div className="text-xs text-muted-foreground">Produkter i alt</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{hazardous.length}</div>
          <div className="text-xs text-muted-foreground">Farlige stoffer</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{missingSds.length}</div>
          <div className="text-xs text-muted-foreground">Mangler SDS</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-400">{overdueReview.length}</div>
          <div className="text-xs text-muted-foreground">Forfaldne reviews</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produkt</TableHead>
                <TableHead>Leverandør</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Farlig</TableHead>
                <TableHead>SDS</TableHead>
                <TableHead>Ansvarlig</TableHead>
                <TableHead>Næste review</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products?.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.product_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.supplier || "–"}</TableCell>
                  <TableCell className="text-xs">{p.product_type || "–"}</TableCell>
                  <TableCell>
                    {p.hazard_flag ? (
                      <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Ja</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Nej</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.sds_url ? (
                      <a href={p.sds_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Åbn
                      </a>
                    ) : p.hazard_flag ? (
                      <span className="text-xs text-red-400">Mangler!</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">–</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{p.responsible_owner || "–"}</TableCell>
                  <TableCell className="text-xs">
                    {p.next_review_due ? (
                      <span className={cn(new Date(p.next_review_due) < today ? "text-red-400" : "text-muted-foreground")}>
                        {format(new Date(p.next_review_due), "d. MMM yyyy", { locale: da })}
                      </span>
                    ) : "–"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Slet dette produkt?")) del.mutate(p.id); }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!products || products.length === 0) && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Ingen produkter registreret</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Rediger produkt" : "Nyt kemisk produkt"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Produktnavn *</Label><Input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Leverandør</Label><Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} /></div>
              <div><Label>Produkttype</Label><Input value={form.product_type} onChange={e => setForm(f => ({ ...f, product_type: e.target.value }))} placeholder="F.eks. Rengøringsmiddel" /></div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.hazard_flag} onCheckedChange={v => setForm(f => ({ ...f, hazard_flag: v }))} />
              <Label>Farligt stof (kræver sikkerhedsdatablad)</Label>
            </div>
            <div><Label>Sikkerhedsdatablad URL (SDS)</Label><Input value={form.sds_url} onChange={e => setForm(f => ({ ...f, sds_url: e.target.value }))} /></div>
            <div><Label>Opbevaringsvejledning</Label><Textarea rows={2} value={form.storage_notes} onChange={e => setForm(f => ({ ...f, storage_notes: e.target.value }))} /></div>
            <div><Label>Arbejdsproces</Label><Textarea rows={2} value={form.work_process} onChange={e => setForm(f => ({ ...f, work_process: e.target.value }))} /></div>
            <div><Label>Eksponeringsrisiko</Label><Textarea rows={2} value={form.exposure_risk} onChange={e => setForm(f => ({ ...f, exposure_risk: e.target.value }))} /></div>
            <div><Label>Beskyttelsesforanstaltninger</Label><Textarea rows={2} value={form.protective_measures} onChange={e => setForm(f => ({ ...f, protective_measures: e.target.value }))} /></div>
            <div><Label>Instruktioner</Label><Textarea rows={2} value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Ansvarlig</Label><Input value={form.responsible_owner} onChange={e => setForm(f => ({ ...f, responsible_owner: e.target.value }))} /></div>
              <div><Label>Reviewdato</Label><Input type="date" value={form.review_date} onChange={e => setForm(f => ({ ...f, review_date: e.target.value }))} /></div>
            </div>
            <div><Label>Næste review</Label><Input type="date" value={form.next_review_due} onChange={e => setForm(f => ({ ...f, next_review_due: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Annuller</Button>
            <Button onClick={() => save.mutate(form)} disabled={!form.product_name || save.isPending}>
              {save.isPending ? "Gemmer..." : "Gem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </MainLayout>
  );
}
