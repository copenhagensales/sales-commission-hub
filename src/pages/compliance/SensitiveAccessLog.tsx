import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const fieldLabels: Record<string, string> = {
  cpr_number: "CPR-nummer",
  bank_reg_number: "Reg.nr.",
  bank_account_number: "Kontonummer",
};

export default function SensitiveAccessLog() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["sensitive-access-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sensitive_data_access_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  // Fetch employee names for display (berørt medarbejder)
  const employeeIds = [...new Set(logs?.map(l => l.employee_id) ?? [])];
  const { data: employees } = useQuery({
    queryKey: ["sensitive-log-employees", employeeIds],
    queryFn: async () => {
      if (!employeeIds.length) return [];
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .in("id", employeeIds);
      return data ?? [];
    },
    enabled: employeeIds.length > 0,
  });

  // Fetch accessor names (tilgået af) via auth_user_id
  const userIds = [...new Set(logs?.map(l => l.user_id).filter(Boolean) ?? [])];
  const { data: accessors } = useQuery({
    queryKey: ["sensitive-log-accessors", userIds],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase
        .from("employee_master_data")
        .select("auth_user_id, first_name, last_name")
        .in("auth_user_id", userIds);
      return data ?? [];
    },
    enabled: userIds.length > 0,
  });

  const employeeMap = new Map(employees?.map(e => [e.id, `${e.first_name} ${e.last_name}`]));
  const accessorMap = new Map(accessors?.map(e => [e.auth_user_id, `${e.first_name} ${e.last_name}`]));

  const filtered = logs?.filter(l => {
    if (!search) return true;
    const name = employeeMap.get(l.employee_id) ?? "";
    const accessorName = l.user_id ? (accessorMap.get(l.user_id) ?? "") : "";
    return name.toLowerCase().includes(search.toLowerCase()) ||
      accessorName.toLowerCase().includes(search.toLowerCase()) ||
      (fieldLabels[l.field_accessed] ?? l.field_accessed).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/compliance")} className="gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Tilbage til oversigt
        </Button>

        <div className="flex items-center gap-3">
          <Eye className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Audit-log: Følsomme data</h1>
            <p className="text-muted-foreground text-sm">Hvem har redigeret CPR, bankoplysninger og andre følsomme felter</p>
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              Denne log registrerer alle tilfælde hvor følsomme medarbejderdata (CPR-nummer, bankoplysninger) er blevet set eller redigeret. Loggen kan ikke slettes og opfylder GDPR art. 5 krav om ansvarlighed.
            </p>
          </CardContent>
        </Card>

        <Input
          placeholder="Søg efter medarbejder eller felttype..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Seneste adgange</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Indlæser...</p>
            ) : !filtered?.length ? (
              <p className="text-muted-foreground text-sm">Ingen logposter fundet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tidspunkt</TableHead>
                    <TableHead>Tilgået af</TableHead>
                    <TableHead>Berørt medarbejder</TableHead>
                    <TableHead>Felt</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), "d. MMM yyyy HH:mm", { locale: da })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {log.user_id ? (accessorMap.get(log.user_id) ?? "Ukendt bruger") : "–"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {employeeMap.get(log.employee_id) ?? log.employee_id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {fieldLabels[log.field_accessed] ?? log.field_accessed}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          log.access_type === "view"
                            ? "bg-blue-500/10 text-blue-700 border-blue-500/30"
                            : log.access_type === "self_edit"
                            ? "bg-green-500/10 text-green-700 border-green-500/30"
                            : "bg-orange-500/10 text-orange-700 border-orange-500/30"
                        }>
                          {log.access_type === "view" ? "Visning" : log.access_type === "self_edit" ? "Selv-redigering" : "Admin-redigering"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
