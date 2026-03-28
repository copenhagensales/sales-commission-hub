import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Shield, Search, Download, Eye, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AuditEntry = Database["public"]["Tables"]["amo_audit_log"]["Row"];

const actionIcons: Record<string, typeof Plus> = {
  INSERT: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
};

const actionLabels: Record<string, string> = {
  INSERT: "Oprettet",
  UPDATE: "Opdateret",
  DELETE: "Slettet",
};

const tableLabels: Record<string, string> = {
  amo_workplaces: "Arbejdspladser",
  amo_members: "Medlemmer",
  amo_meetings: "Møder",
  amo_annual_discussions: "Årlig drøftelse",
  amo_apv: "APV",
  amo_kemi_apv: "Kemi-APV",
  amo_training_courses: "Uddannelse",
  amo_documents: "Dokumenter",
  amo_tasks: "Opgaver",
  amo_amr_elections: "AMR-valg",
  amo_compliance_rules: "Compliance-regler",
};

export default function AmoAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTable, setFilterTable] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("amo_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data) setEntries(data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterTable !== "all" && e.table_name !== filterTable) return false;
      if (filterAction !== "all" && e.action !== filterAction) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          (e.user_email || "").toLowerCase().includes(s) ||
          e.table_name.toLowerCase().includes(s) ||
          (e.record_id || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [entries, filterTable, filterAction, search]);

  const exportCsv = () => {
    const header = "Tidspunkt;Handling;Tabel;Bruger;Record ID\n";
    const rows = filtered.map((e) =>
      [
        format(new Date(e.created_at), "dd/MM/yyyy HH:mm"),
        actionLabels[e.action] || e.action,
        tableLabels[e.table_name] || e.table_name,
        e.user_email || "System",
        e.record_id || "",
      ].join(";")
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `amo-audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV eksporteret");
  };

  const uniqueTables = useMemo(() => [...new Set(entries.map((e) => e.table_name))].sort(), [entries]);

  return (
    <MainLayout>
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            AMO Audit Log
          </h1>
          <p className="text-muted-foreground text-sm">Spor alle ændringer i AMO-modulerne</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-1" /> Eksportér CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Søg</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Søg bruger, tabel, record..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Tabel</Label>
              <Select value={filterTable} onValueChange={setFilterTable}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle tabeller</SelectItem>
                  {uniqueTables.map((t) => (
                    <SelectItem key={t} value={t}>{tableLabels[t] || t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Handling</Label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="INSERT">Oprettet</SelectItem>
                  <SelectItem value="UPDATE">Opdateret</SelectItem>
                  <SelectItem value="DELETE">Slettet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tidspunkt</TableHead>
                <TableHead>Handling</TableHead>
                <TableHead>Tabel</TableHead>
                <TableHead>Bruger</TableHead>
                <TableHead>Record ID</TableHead>
                <TableHead className="text-right">Detaljer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Indlæser...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Ingen log-poster fundet</TableCell></TableRow>
              ) : (
                filtered.map((entry) => {
                  const Icon = actionIcons[entry.action] || Pencil;
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs gap-1">
                          <Icon className="h-3 w-3" />
                          {actionLabels[entry.action] || entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{tableLabels[entry.table_name] || entry.table_name}</TableCell>
                      <TableCell className="text-xs">{entry.user_email || "System"}</TableCell>
                      <TableCell className="text-xs font-mono">{entry.record_id?.slice(0, 8) || "–"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedEntry(entry)}>
                          <Eye className="h-3 w-3 mr-1" /> Vis
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Detaljer</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Tidspunkt</p>
                  <p className="font-medium">{format(new Date(selectedEntry.created_at), "dd/MM/yyyy HH:mm:ss")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Handling</p>
                  <p className="font-medium">{actionLabels[selectedEntry.action] || selectedEntry.action}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tabel</p>
                  <p className="font-medium">{tableLabels[selectedEntry.table_name] || selectedEntry.table_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bruger</p>
                  <p className="font-medium">{selectedEntry.user_email || "System"}</p>
                </div>
              </div>
              {selectedEntry.old_values && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Gamle værdier</p>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedEntry.old_values, null, 2)}
                  </pre>
                </div>
              )}
              {selectedEntry.new_values && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Nye værdier</p>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedEntry.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </MainLayout>
  );
}
