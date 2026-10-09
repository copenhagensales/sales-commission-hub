import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertTriangle, Trash2, Plus, FileSpreadsheet, Loader2 } from "lucide-react";
import { parseExcelFile } from "@/utils/excel";
import { toast } from "@/hooks/use-toast";
import {
  useDataImportRules, useSaveCategory, useDeleteCategory, useAddColumns, useSetColumnCategory, useDeleteColumn,
} from "@/hooks/useDataImportRules";

function CategoriesCard() {
  const { data } = useDataImportRules();
  const save = useSaveCategory();
  const del = useDeleteCategory();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [days, setDays] = useState("");
  const categories = data?.categories ?? [];
  const usage = new Map<string, number>();
  for (const r of data?.rules ?? []) if (r.category_id) usage.set(r.category_id, (usage.get(r.category_id) ?? 0) + 1);

  const add = () => {
    if (!name.trim()) return;
    const n = days ? Number(days) : null;
    if (n !== null && (!Number.isInteger(n) || n <= 0)) {
      toast({ title: "Ugyldigt antal dage", variant: "destructive" });
      return;
    }
    save.mutate({ name, description: desc || null, retention_days: n }, { onSuccess: () => { setName(""); setDesc(""); setDays(""); } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kategorier og sletteregler</CardTitle>
        <CardDescription>Hver kategori har en sletteregel: antal dage efter upload, før feltet slettes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {categories.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
            <Input className="w-56" defaultValue={c.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && save.mutate({ id: c.id, name: e.target.value, description: c.description, retention_days: c.retention_days })} />
            <Input className="flex-1 min-w-48" placeholder="Beskrivelse" defaultValue={c.description ?? ""}
              onBlur={(e) => e.target.value !== (c.description ?? "") && save.mutate({ id: c.id, name: c.name, description: e.target.value || null, retention_days: c.retention_days })} />
            <Input className="w-28" type="number" min={1} placeholder="Dage" defaultValue={c.retention_days ?? ""}
              onBlur={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                if (v !== c.retention_days && (v === null || (Number.isInteger(v) && v > 0))) save.mutate({ id: c.id, name: c.name, description: c.description, retention_days: v });
              }} />
            <span className="text-sm text-muted-foreground">dage</span>
            {c.retention_days == null && <Badge variant="destructive">Mangler sletteregel</Badge>}
            <Button variant="ghost" size="icon" aria-label="Slet kategori" disabled={(usage.get(c.id) ?? 0) > 0}
              title={(usage.get(c.id) ?? 0) > 0 ? "Bruges af kolonner" : "Slet"} onClick={() => del.mutate(c.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border p-2">
          <Input className="w-56" placeholder="Ny kategori, fx Kundetelefon" value={name} onChange={(e) => setName(e.target.value)} />
          <Input className="flex-1 min-w-48" placeholder="Beskrivelse" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Input className="w-28" type="number" min={1} placeholder="Dage" value={days} onChange={(e) => setDays(e.target.value)} />
          <Button onClick={add} disabled={!name.trim() || save.isPending}><Plus className="mr-1 h-4 w-4" />Tilføj</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ColumnsCard() {
  const { data } = useDataImportRules();
  const addCols = useAddColumns();
  const setCat = useSetColumnCategory();
  const delCol = useDeleteColumn();
  const [newCol, setNewCol] = useState("");
  const [reading, setReading] = useState(false);
  const def = data?.definition;
  const categories = data?.categories ?? [];
  const rules = data?.rules ?? [];

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    maxFiles: 1,
    disabled: !def,
    onDrop: async (files) => {
      const f = files[0];
      if (!f || !def) return;
      setReading(true);
      try {
        const { columns } = await parseExcelFile(await f.arrayBuffer());
        addCols.mutate({ definitionId: def.id, columns });
        toast({ title: "Kolonner indlæst", description: `${columns.length} kolonneoverskrifter fundet. Ingen værdier er gemt.` });
      } catch {
        toast({ title: "Kunne ikke læse filen", variant: "destructive" });
      } finally {
        setReading(false);
      }
    },
  });

  if (!def) return null;
  const catById = new Map(categories.map((c) => [c.id, c]));
  const missing = rules.filter((r) => !r.category_id || catById.get(r.category_id)?.retention_days == null).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{def.name}</CardTitle>
        <CardDescription>Arket uploades på Annulleringer for Eesy TM. Kun kolonner, der er defineret her, bliver gemt.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`flex items-center gap-2 rounded-md p-3 text-sm ${missing === 0 && rules.length > 0 ? "bg-success/10 text-foreground" : "bg-warning/10 text-foreground"}`}>
          {missing === 0 && rules.length > 0
            ? <><CheckCircle2 className="h-4 w-4 text-success" />Alle {rules.length} kolonner har kategori og sletteregel.</>
            : <><AlertTriangle className="h-4 w-4 text-warning" />{rules.length === 0 ? "Ingen kolonner defineret endnu." : `${missing} af ${rules.length} kolonner mangler kategori eller sletteregel.`}</>}
        </div>

        <div {...getRootProps()} className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center text-sm ${isDragActive ? "border-primary bg-primary/5" : "border-border"}`}>
          <input {...getInputProps()} />
          {reading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : <FileSpreadsheet className="mx-auto h-6 w-6 text-muted-foreground" />}
          <p className="mt-2 font-medium">Indlæs kolonnenavne fra en eksempelfil</p>
          <p className="text-xs text-muted-foreground">Kun overskrifterne læses. Ingen værdier gemmes.</p>
        </div>

        <div className="flex gap-2">
          <Input placeholder="Tilføj kolonnenavn manuelt" value={newCol} onChange={(e) => setNewCol(e.target.value)} />
          <Button onClick={() => addCols.mutate({ definitionId: def.id, columns: [newCol] }, { onSuccess: () => setNewCol("") })} disabled={!newCol.trim()}>
            <Plus className="mr-1 h-4 w-4" />Tilføj
          </Button>
        </div>

        <div className="divide-y divide-border rounded-md border border-border">
          {rules.map((r) => {
            const cat = r.category_id ? catById.get(r.category_id) : undefined;
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 p-2">
                <span className="min-w-48 flex-1 font-mono text-sm">{r.column_name}</span>
                <Select value={r.category_id ?? ""} onValueChange={(v) => setCat.mutate({ id: r.id, categoryId: v })}>
                  <SelectTrigger className="w-64"><SelectValue placeholder="Vælg kategori" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="w-32 text-sm text-muted-foreground">
                  {cat?.retention_days != null ? `Slettes efter ${cat.retention_days} dage` : <Badge variant="destructive">Mangler</Badge>}
                </span>
                <Button variant="ghost" size="icon" aria-label="Fjern kolonne" onClick={() => delCol.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function ManualUploadRules() {
  return (
    <div className="space-y-6">
      <CategoriesCard />
      <ColumnsCard />
    </div>
  );
}
