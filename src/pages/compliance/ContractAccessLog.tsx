import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { FileText, Search, Eye, Download, PenLine, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const accessTypeLabels: Record<string, { label: string; color: string; icon: typeof Eye }> = {
  view: { label: "Visning", color: "bg-blue-100 text-blue-800", icon: Eye },
  sign: { label: "Underskrift", color: "bg-green-100 text-green-800", icon: PenLine },
  download: { label: "Download", color: "bg-orange-100 text-orange-800", icon: Download },
};

export default function ContractAccessLog() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["contract-access-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_access_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch user & employee names for display
  const userIds = [...new Set(logs.map((l: any) => l.user_id))];
  const employeeIds = [...new Set(logs.map((l: any) => l.employee_id))];
  const contractIds = [...new Set(logs.map((l: any) => l.contract_id))];

  const { data: employees = [] } = useQuery({
    queryKey: ["contract-log-employees", employeeIds],
    queryFn: async () => {
      if (employeeIds.length === 0) return [];
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, auth_user_id")
        .in("id", employeeIds);
      return data || [];
    },
    enabled: employeeIds.length > 0,
  });

  const { data: allEmployees = [] } = useQuery({
    queryKey: ["contract-log-users", userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, auth_user_id")
        .in("auth_user_id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["contract-log-contracts", contractIds],
    queryFn: async () => {
      if (contractIds.length === 0) return [];
      const { data } = await supabase
        .from("contracts")
        .select("id, title")
        .in("id", contractIds);
      return data || [];
    },
    enabled: contractIds.length > 0,
  });

  const getUserName = (userId: string) => {
    const emp = allEmployees.find((e: any) => e.auth_user_id === userId);
    return emp ? `${emp.first_name} ${emp.last_name}` : userId.slice(0, 8) + "…";
  };

  const getEmployeeName = (empId: string) => {
    const emp = employees.find((e: any) => e.id === empId);
    return emp ? `${emp.first_name} ${emp.last_name}` : empId.slice(0, 8) + "…";
  };

  const getContractTitle = (contractId: string) => {
    const c = contracts.find((c: any) => c.id === contractId);
    return c ? c.title : contractId.slice(0, 8) + "…";
  };

  const filtered = logs.filter((log: any) => {
    const matchesType = typeFilter === "all" || log.access_type === typeFilter;
    if (!matchesType) return false;
    if (!searchTerm) return true;
    const lower = searchTerm.toLowerCase();
    return (
      getUserName(log.user_id).toLowerCase().includes(lower) ||
      getEmployeeName(log.employee_id).toLowerCase().includes(lower) ||
      getContractTitle(log.contract_id).toLowerCase().includes(lower)
    );
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/compliance")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              Audit-log: Kontraktadgang
            </h1>
            <p className="text-muted-foreground">
              Log over hvem der har åbnet, underskrevet eller downloadet kontrakter tilhørende andre medarbejdere.
            </p>
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-sm text-foreground">
            Denne log registrerer alle tilfælde hvor en bruger tilgår en kontrakt der tilhører en anden medarbejder.
            Egne kontrakter logges ikke. Loggen kan ikke slettes og opfylder GDPR art. 5 krav om ansvarlighed.
          </CardContent>
        </Card>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søg bruger, medarbejder eller kontrakt..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Alle typer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle typer</SelectItem>
              <SelectItem value="view">Visning</SelectItem>
              <SelectItem value="sign">Underskrift</SelectItem>
              <SelectItem value="download">Download</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tidspunkt</TableHead>
                <TableHead>Bruger</TableHead>
                <TableHead>Kontrakt</TableHead>
                <TableHead>Tilhører</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Henter log...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Ingen log-poster fundet
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log: any) => {
                  const config = accessTypeLabels[log.access_type] || accessTypeLabels.view;
                  const Icon = config.icon;
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), "d. MMM yyyy HH:mm", { locale: da })}
                      </TableCell>
                      <TableCell className="font-medium">{getUserName(log.user_id)}</TableCell>
                      <TableCell className="text-sm">{getContractTitle(log.contract_id)}</TableCell>
                      <TableCell className="text-sm">{getEmployeeName(log.employee_id)}</TableCell>
                      <TableCell>
                        <Badge className={`${config.color} gap-1`}>
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </MainLayout>
  );
}
