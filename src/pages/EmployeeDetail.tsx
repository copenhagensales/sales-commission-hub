import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Phone, MessageSquare, KeyRound, RotateCcw, Thermometer, CalendarX, AlertTriangle, AlarmClock, FileText, Send, Palmtree, History, Lock, Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SendContractDialog } from "@/components/contracts/SendContractDialog";
import { EmployeeCalendar } from "@/components/employee/EmployeeCalendar";
import { TeamLeaderTeams } from "@/components/employees/TeamLeaderTeams";
import { EditableRow, ContactRow, SelectRow, TableSection } from "@/components/employee/EmployeeDetailFields";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePositionPermissions";
interface EmployeeMasterDataRecord {
  id: string;
  first_name: string;
  last_name: string;
  cpr_number: string | null;
  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_country: string | null;
  private_phone: string | null;
  private_email: string | null;
  work_email: string | null;
  employment_start_date: string | null;
  employment_end_date: string | null;
  job_title: string | null;
  department: string | null;
  work_location: string | null;
  manager_id: string | null;
  contract_id: string | null;
  contract_version: string | null;
  salary_type: "provision" | "fixed" | "hourly" | null;
  salary_amount: number | null;
  bank_reg_number: string | null;
  bank_account_number: string | null;
  system_role_id: string | null;
  vacation_type: "vacation_pay" | "vacation_bonus" | null;
  vacation_bonus_percent: number | null;
  has_parking: boolean;
  parking_spot_id: string | null;
  parking_monthly_cost: number | null;
  referral_bonus: number | null;
  salary_deduction: number | null;
  salary_deduction_note: string | null;
  working_hours_model: string | null;
  weekly_hours: number | null;
  standard_start_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Freelance consultant fields
  is_freelance_consultant: boolean | null;
  freelance_company_name: string | null;
  freelance_cvr: string | null;
  freelance_company_address: string | null;
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEditEmployees } = usePermissions();
  const [absencePeriod, setAbsencePeriod] = useState<"2" | "6" | "12">("2");
  const [sendContractOpen, setSendContractOpen] = useState(false);
  const [setPasswordOpen, setSetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  const { data: employee, isLoading, error } = useQuery({
    queryKey: ["employee-detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as EmployeeMasterDataRecord | null;
    },
    enabled: !!id,
  });

  const { data: manager } = useQuery({
    queryKey: ["employee-manager", employee?.manager_id],
    queryFn: async () => {
      if (!employee?.manager_id) return null;
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("first_name, last_name")
        .eq("id", employee.manager_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.manager_id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch job positions from the positions tab
  const { data: jobPositions = [] } = useQuery({
    queryKey: ["job-positions-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_positions")
        .select("id, name, description")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Find corresponding vagt-flow employee by email
  const { data: vagtFlowEmployee } = useQuery({
    queryKey: ["vagt-flow-employee-match", employee?.private_email, employee?.work_email],
    queryFn: async () => {
      if (!employee?.private_email && !employee?.work_email) return null;
      const emails = [employee.private_email, employee.work_email].filter(Boolean);
      const { data, error } = await supabase
        .from("employee")
        .select("id")
        .in("email", emails)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!(employee?.private_email || employee?.work_email),
  });

  // Fetch absence history from absence_request_v2 (employee-initiated)
  const { data: absencesV2 = [] } = useQuery({
    queryKey: ["employee-absences-v2", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("absence_request_v2")
        .select("*")
        .eq("employee_id", id)
        .eq("status", "approved")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch absence history from employee_absence (manager-initiated via vagt-flow)
  const { data: absencesVagtFlow = [] } = useQuery({
    queryKey: ["employee-absences-vagtflow", vagtFlowEmployee?.id],
    queryFn: async () => {
      if (!vagtFlowEmployee?.id) return [];
      const { data, error } = await supabase
        .from("employee_absence")
        .select("*")
        .eq("employee_id", vagtFlowEmployee.id)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!vagtFlowEmployee?.id,
  });

  // Combine absences from both sources and normalize format
  const absences = useMemo(() => {
    const normalized: Array<{
      id: string;
      type: "sick" | "vacation";
      start_date: string;
      end_date: string;
      source: "request" | "vagtflow";
    }> = [];

    // Add absences from absence_request_v2
    absencesV2.forEach(a => {
      normalized.push({
        id: a.id,
        type: a.type as "sick" | "vacation",
        start_date: a.start_date,
        end_date: a.end_date,
        source: "request",
      });
    });

    // Add absences from employee_absence (map reason to type)
    absencesVagtFlow.forEach(a => {
      const type = a.reason === "Ferie" ? "vacation" : "sick";
      normalized.push({
        id: a.id,
        type,
        start_date: a.start_date,
        end_date: a.end_date,
        source: "vagtflow",
      });
    });

    // Sort by start_date descending
    return normalized.sort((a, b) => 
      new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );
  }, [absencesV2, absencesVagtFlow]);

  // Fetch contracts for this employee
  const { data: contracts = [] } = useQuery({
    queryKey: ["employee-contracts", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("contracts")
        .select("*, contract_signatures(*)")
        .eq("employee_id", id)
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch lateness records for this employee
  const { data: latenessRecords = [] } = useQuery({
    queryKey: ["employee-lateness", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("lateness_record")
        .select("*")
        .eq("employee_id", id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch time stamps for this employee
  const { data: timeStamps = [] } = useQuery({
    queryKey: ["employee-time-stamps", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("time_stamps")
        .select("*")
        .eq("employee_id", id)
        .order("clock_in", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Calculate absence statistics - based on selected period
  const absenceStats = useMemo(() => {
    const now = new Date();
    const monthsBack = parseInt(absencePeriod);
    const periodStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, now.getDate());
    
    // Filter absences for selected period
    const periodAbsences = absences.filter(a => {
      const date = new Date(a.start_date);
      return date >= periodStart && date <= now;
    });
    
    // Count sick and vacation days
    const countDays = (absenceList: typeof absences, type: string) => {
      return absenceList.filter(a => a.type === type).reduce((sum, a) => {
        const start = new Date(a.start_date);
        const end = new Date(a.end_date);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return sum + days;
      }, 0);
    };
    
    const countOccurrences = (absenceList: typeof absences, type: string) => {
      return absenceList.filter(a => a.type === type).length;
    };
    
    // Calculate working days in period (approximate: ~21.5 working days per month)
    const workingDaysInPeriod = parseInt(absencePeriod) * 21.5;
    
    const sickDaysInPeriod = countDays(periodAbsences, "sick");
    const vacationDaysInPeriod = countDays(periodAbsences, "vacation");
    const sickOccurrencesInPeriod = countOccurrences(periodAbsences, "sick");
    
    // Sick percentage (of working days)
    const sickPercentInPeriod = (sickDaysInPeriod / workingDaysInPeriod) * 100;
    
    // Average days per sick occurrence
    const avgDaysPerSick = sickOccurrencesInPeriod > 0 
      ? sickDaysInPeriod / sickOccurrencesInPeriod 
      : 0;
    
    // Check for patterns (many short sick periods could indicate issues)
    const hasFrequentShortSickness = sickOccurrencesInPeriod >= 3 && avgDaysPerSick < 2;
    
    // Get sick absences sorted by date for pattern analysis
    const sickAbsences = periodAbsences.filter(a => a.type === "sick").sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
    
    // Check for Monday/Friday patterns
    const mondayFridaySick = sickAbsences.filter(a => {
      const day = new Date(a.start_date).getDay();
      return day === 1 || day === 5;
    }).length;
    const mondayFridayPercent = sickOccurrencesInPeriod > 0 
      ? (mondayFridaySick / sickOccurrencesInPeriod) * 100 
      : 0;
    
    return {
      sickDaysInPeriod,
      vacationDaysInPeriod,
      sickOccurrencesInPeriod,
      sickPercentInPeriod,
      avgDaysPerSick,
      hasFrequentShortSickness,
      mondayFridayPercent,
      mondayFridaySick,
      sickAbsences,
      periodLabel: `${absencePeriod} mdr`,
    };
  }, [absences, absencePeriod]);

  // Calculate lateness statistics - based on selected period
  const latenessStats = useMemo(() => {
    const now = new Date();
    const monthsBack = parseInt(absencePeriod);
    const periodStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, now.getDate());
    
    const periodLateness = latenessRecords.filter(l => {
      const date = new Date(l.date);
      return date >= periodStart && date <= now;
    });
    
    const totalMinutesInPeriod = periodLateness.reduce((sum, l) => sum + l.minutes, 0);
    
    const avgMinutesPerLateness = periodLateness.length > 0 
      ? totalMinutesInPeriod / periodLateness.length 
      : 0;
    
    return {
      countInPeriod: periodLateness.length,
      totalMinutesInPeriod,
      avgMinutesPerLateness,
    };
  }, [latenessRecords, absencePeriod]);

  const updateMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: unknown }) => {
      if (!id) throw new Error("No ID");
      const { error } = await supabase
        .from("employee_master_data")
        .update({ [field]: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      toast({ title: "Gemt" });
    },
    onError: (error) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = (field: string, value: unknown) => {
    // Special handling for is_active to update dates automatically
    if (field === "is_active") {
      const today = new Date().toISOString().split("T")[0];
      const isActive = value as boolean;
      
      if (isActive) {
        // Reactivating: set new start date, clear end date
        supabase
          .from("employee_master_data")
          .update({ is_active: true, employment_start_date: today, employment_end_date: null })
          .eq("id", id)
          .then(({ error }) => {
            if (error) {
              toast({ title: "Fejl", description: error.message, variant: "destructive" });
            } else {
              queryClient.invalidateQueries({ queryKey: ["employee-detail", id] });
              queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
              toast({ title: "Medarbejder genaktiveret" });
            }
          });
      } else {
        // Deactivating: set end date
        supabase
          .from("employee_master_data")
          .update({ is_active: false, employment_end_date: today })
          .eq("id", id)
          .then(({ error }) => {
            if (error) {
              toast({ title: "Fejl", description: error.message, variant: "destructive" });
            } else {
              queryClient.invalidateQueries({ queryKey: ["employee-detail", id] });
              queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
              toast({ title: "Medarbejder deaktiveret" });
            }
          });
      }
      return;
    }
    
    updateMutation.mutate({ field, value });
  };

  const formatDate = (date: string | null) => {
    if (!date) return null;
    return format(new Date(date), "d. MMMM yyyy", { locale: da });
  };

  const getSalaryTypeLabel = (type: string | null) => {
    switch (type) {
      case "provision": return "Provision";
      case "fixed": return "Fast løn";
      case "hourly": return "Timeløn";
      default: return null;
    }
  };

  const getVacationTypeLabel = (type: string | null) => {
    switch (type) {
      case "vacation_pay": return "Ferieløn";
      case "vacation_bonus": return "Feriebonus";
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Indlæser...</p>
        </div>
      </MainLayout>
    );
  }

  if (error || !employee) {
    return (
      <MainLayout>
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => navigate("/employees")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Tilbage til oversigt
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Medarbejder ikke fundet</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/employees")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Tilbage
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {employee.first_name} {employee.last_name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {employee.job_title && <span className="text-muted-foreground">{employee.job_title}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {employee.private_phone && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${employee.private_phone}`}>
                    <Phone className="h-4 w-4 mr-2" />
                    Ring op
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`sms:${employee.private_phone}`}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Send SMS
                  </a>
                </Button>
              </>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={async () => {
                if (!employee.private_email) {
                  toast({ 
                    title: "Mangler email", 
                    description: "Medarbejderen har ikke en email registreret.",
                    variant: "destructive"
                  });
                  return;
                }
                
                const { error } = await supabase.auth.resetPasswordForEmail(
                  employee.private_email,
                  { redirectTo: `${window.location.origin}/auth` }
                );
                
                if (error) {
                  toast({ 
                    title: "Fejl ved nulstilling", 
                    description: error.message,
                    variant: "destructive"
                  });
                } else {
                  toast({ 
                    title: "Email sendt", 
                    description: `En email til nulstilling af adgangskode er sendt til ${employee.private_email}` 
                  });
                }
              }}
            >
              <KeyRound className="h-4 w-4 mr-2" />
              Nulstil kode
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={async () => {
                if (!employee.private_email) {
                  toast({ 
                    title: "Mangler email", 
                    description: "Medarbejderen har ikke en email registreret.",
                    variant: "destructive"
                  });
                  return;
                }
                
                try {
                  const { data, error } = await supabase.functions.invoke('reset-login-attempts', {
                    body: { email: employee.private_email }
                  });
                  
                  if (error) {
                    toast({ 
                      title: "Fejl ved nulstilling", 
                      description: error.message,
                      variant: "destructive"
                    });
                  } else if (data?.error) {
                    toast({ 
                      title: "Fejl", 
                      description: data.error,
                      variant: "destructive"
                    });
                  } else {
                    toast({ 
                      title: "Login nulstillet", 
                      description: `Login-forsøg er nulstillet for ${employee.private_email}` 
                    });
                  }
                } catch (err) {
                  toast({ 
                    title: "Fejl", 
                    description: "Kunne ikke kontakte serveren",
                    variant: "destructive"
                  });
                }
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Nulstil login
            </Button>
            {canEditEmployees && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSetPasswordOpen(true)}
              >
                <Lock className="h-4 w-4 mr-2" />
                Sæt ny kode
              </Button>
            )}
            <div className="flex items-center gap-2 border-l pl-4 ml-2">
              <Switch 
                checked={employee.is_active} 
                onCheckedChange={(checked) => handleSave("is_active", checked)} 
              />
              <Badge variant={employee.is_active ? "default" : "secondary"}>
                {employee.is_active ? "Aktiv" : "Inaktiv"}
              </Badge>
            </div>
          </div>
        </div>

        <Tabs defaultValue="stamdata" className="w-full">
          <TabsList>
            <TabsTrigger value="stamdata">Stamdata</TabsTrigger>
            <TabsTrigger value="kontrakter">
              <FileText className="h-4 w-4 mr-2" />
              Kontrakter
            </TabsTrigger>
            <TabsTrigger value="fravaer">
              <CalendarX className="h-4 w-4 mr-2" />
              Fravær
            </TabsTrigger>
            <TabsTrigger value="historik">
              <History className="h-4 w-4 mr-2" />
              Historik
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stamdata" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Left column */}
              <div className="space-y-4">
                <TableSection title="Identitet">
                  <EditableRow label="Fornavn(e)" value={employee.first_name} field="first_name" onSave={handleSave} />
                  <EditableRow label="Efternavn" value={employee.last_name} field="last_name" onSave={handleSave} />
                  <EditableRow label="CPR-nr." value={employee.cpr_number} field="cpr_number" onSave={handleSave} masked />
                </TableSection>

                <TableSection title="Kontakt">
                  <ContactRow label="Telefon" value={employee.private_phone} field="private_phone" type="phone" onSave={handleSave} />
                  <ContactRow label="Privat email" value={employee.private_email} field="private_email" type="email" onSave={handleSave} />
                  <ContactRow label="Arbejdsemail" value={employee.work_email} field="work_email" type="email" onSave={handleSave} />
                </TableSection>

                <TableSection title="Adresse">
                  <EditableRow label="Vejnavn og nr." value={employee.address_street} field="address_street" onSave={handleSave} />
                  <EditableRow label="Postnummer" value={employee.address_postal_code} field="address_postal_code" onSave={handleSave} />
                  <EditableRow label="By" value={employee.address_city} field="address_city" onSave={handleSave} />
                  <EditableRow label="Land" value={employee.address_country} field="address_country" onSave={handleSave} />
                </TableSection>

                <TableSection title="Løn">
                  <SelectRow 
                    label="Løntype" 
                    value={employee.salary_type} 
                    field="salary_type" 
                    options={[
                      { value: "provision", label: "Provision" },
                      { value: "fixed", label: "Fast løn" },
                      { value: "hourly", label: "Timeløn" },
                    ]}
                    onSave={handleSave}
                    displayValue={getSalaryTypeLabel(employee.salary_type)}
                  />
                  {(employee.salary_type === "fixed" || employee.salary_type === "hourly") && (
                    <EditableRow 
                      label="Beløb" 
                      value={employee.salary_amount} 
                      field="salary_amount" 
                      type="number" 
                      onSave={handleSave} 
                      displayValue={employee.salary_amount ? `${employee.salary_amount.toLocaleString("da-DK")} DKK` : null}
                    />
                  )}
                  <EditableRow label="Reg.nr." value={employee.bank_reg_number} field="bank_reg_number" onSave={handleSave} masked />
                  <EditableRow label="Kontonummer" value={employee.bank_account_number} field="bank_account_number" onSave={handleSave} masked />
                </TableSection>

                <TableSection title="Freelance konsulent">
                  <tr className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4 text-sm text-muted-foreground w-1/3">Freelance</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={employee.is_freelance_consultant ?? false} 
                          onCheckedChange={(checked) => handleSave("is_freelance_consultant", checked)} 
                        />
                        <span className="text-sm text-muted-foreground">
                          {employee.is_freelance_consultant ? "Ja" : "Nej"}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {employee.is_freelance_consultant && (
                    <>
                      <EditableRow label="Firmanavn" value={employee.freelance_company_name} field="freelance_company_name" onSave={handleSave} />
                      <EditableRow label="CVR-nr." value={employee.freelance_cvr} field="freelance_cvr" onSave={handleSave} />
                      <EditableRow label="Firmaadresse" value={employee.freelance_company_address} field="freelance_company_address" onSave={handleSave} />
                    </>
                  )}
                </TableSection>
              </div>

              {/* Right column */}
              <div className="space-y-4">
                <TableSection title="Stilling">
                  <SelectRow 
                    label="Jobtitel" 
                    value={employee.job_title} 
                    field="job_title" 
                    options={jobPositions.length > 0 
                      ? jobPositions.map(p => ({ value: p.name, label: p.name }))
                      : [
                          { value: "Salgskonsulent", label: "Salgskonsulent" },
                          { value: "Fieldmarketing", label: "Fieldmarketing" },
                          { value: "Teamleder", label: "Teamleder" },
                          { value: "Assisterende Teamleder", label: "Assisterende Teamleder" },
                          { value: "Rekruttering", label: "Rekruttering" },
                          { value: "SOME", label: "SOME" },
                          { value: "Backoffice", label: "Backoffice" },
                          { value: "Projektleder", label: "Projektleder" },
                          { value: "Ejer", label: "Ejer" },
                        ]
                    }
                    onSave={handleSave}
                    displayValue={employee.job_title}
                    required
                  />
                  <SelectRow 
                    label="Arbejdssted" 
                    value={employee.work_location} 
                    field="work_location" 
                    options={[
                      { value: "København V", label: "København V" },
                      { value: "Århus", label: "Århus" },
                    ]}
                    onSave={handleSave}
                    displayValue={employee.work_location}
                  />
                  <tr className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4 text-sm text-muted-foreground w-1/3">Leder</td>
                    <td className="py-2.5 text-sm font-medium">{manager ? `${manager.first_name} ${manager.last_name}` : "-"}</td>
                  </tr>
                </TableSection>

                <TableSection title="Ansættelse">
                  <EditableRow label="Startdato" value={employee.employment_start_date} field="employment_start_date" type="date" onSave={handleSave} displayValue={formatDate(employee.employment_start_date)} />
                  <EditableRow label="Slutdato" value={employee.employment_end_date} field="employment_end_date" type="date" onSave={handleSave} displayValue={formatDate(employee.employment_end_date)} />
                  <EditableRow label="Timer/uge" value={employee.weekly_hours} field="weekly_hours" type="number" onSave={handleSave} displayValue={employee.weekly_hours ? `${employee.weekly_hours} timer` : null} />
                  <SelectRow 
                    label="Mødetid" 
                    value={employee.standard_start_time} 
                    field="standard_start_time" 
                    options={[
                      { value: "8.00-16.30", label: "8.00-16.30" },
                      { value: "8.30-16.30", label: "8.30-16.30" },
                      { value: "9.00-16.30", label: "9.00-16.30" },
                      { value: "9.30-17.30", label: "9.30-17.30" },
                    ]}
                    onSave={handleSave}
                    displayValue={employee.standard_start_time}
                  />
                  <SelectRow 
                    label="Startside (override)" 
                    value={(employee as any).default_landing_page} 
                    field="default_landing_page" 
                    options={[
                      { value: "/home", label: "Hjem" },
                      { value: "/my-schedule", label: "Min kalender" },
                      { value: "/shift-planning", label: "Vagtplan" },
                      { value: "/dashboard", label: "Dashboard" },
                      { value: "/vagt-flow", label: "Fieldmarketing" },
                      { value: "/employees", label: "Medarbejdere" },
                      { value: "/contracts", label: "Kontrakter" },
                      { value: "/recruitment", label: "Rekruttering" },
                      { value: "/sales", label: "Salg" },
                      { value: "/payroll", label: "Lønkørsel" },
                    ]}
                    onSave={handleSave}
                    displayValue={
                      (employee as any).default_landing_page 
                        ? [
                            { value: "/home", label: "Hjem" },
                            { value: "/my-schedule", label: "Min kalender" },
                            { value: "/shift-planning", label: "Vagtplan" },
                            { value: "/dashboard", label: "Dashboard" },
                            { value: "/vagt-flow", label: "Fieldmarketing" },
                            { value: "/employees", label: "Medarbejdere" },
                            { value: "/contracts", label: "Kontrakter" },
                            { value: "/recruitment", label: "Rekruttering" },
                            { value: "/sales", label: "Salg" },
                            { value: "/payroll", label: "Lønkørsel" },
                          ].find(o => o.value === (employee as any).default_landing_page)?.label
                        : "Brug stilling standard"
                    }
                    allowClear
                  />
                </TableSection>

                <TableSection title="Ferie & tillæg">
                  <SelectRow 
                    label="Ferietype" 
                    value={employee.vacation_type} 
                    field="vacation_type" 
                    options={[
                      { value: "vacation_pay", label: "Ferieløn" },
                      { value: "vacation_bonus", label: "Feriebonus" },
                    ]}
                    onSave={handleSave}
                    displayValue={getVacationTypeLabel(employee.vacation_type)}
                  />
                  {employee.vacation_type === "vacation_bonus" && (
                    <EditableRow 
                      label="Feriebonus %" 
                      value={employee.vacation_bonus_percent} 
                      field="vacation_bonus_percent" 
                      type="number" 
                      onSave={handleSave}
                      displayValue={employee.vacation_bonus_percent ? `${employee.vacation_bonus_percent}%` : null}
                    />
                  )}
                  <EditableRow 
                    label="Parkering/md" 
                    value={employee.parking_monthly_cost} 
                    field="parking_monthly_cost" 
                    type="number" 
                    onSave={handleSave}
                    displayValue={employee.parking_monthly_cost ? `${employee.parking_monthly_cost} DKK` : null}
                  />
                  <EditableRow 
                    label="Henvisningsbonus" 
                    value={employee.referral_bonus} 
                    field="referral_bonus" 
                    type="number" 
                    onSave={handleSave}
                    displayValue={employee.referral_bonus ? `${employee.referral_bonus} DKK` : null}
                  />
                  <EditableRow 
                    label="Regulering/md" 
                    value={employee.salary_deduction} 
                    field="salary_deduction" 
                    type="number" 
                    onSave={handleSave}
                    displayValue={employee.salary_deduction ? `${employee.salary_deduction} DKK` : null}
                  />
                  {employee.salary_deduction && (
                    <EditableRow label="Reg. note" value={employee.salary_deduction_note} field="salary_deduction_note" onSave={handleSave} />
                  )}
                </TableSection>
              </div>

              {/* Team Leader Teams Section - full width */}
              {(employee.job_title === "Teamleder" || employee.job_title === "Ejer" || employee.job_title === "Assisterende Teamleder") && (
                <div className="md:col-span-2">
                  <TeamLeaderTeams 
                    employeeId={employee.id} 
                    employeeName={`${employee.first_name} ${employee.last_name}`} 
                  />
                </div>
              )}

              {/* Calendar Overview - full width */}
              <div className="md:col-span-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>Tilstedeværelse (sidste 4 uger)</span>
                      <div className="flex gap-4 text-xs font-normal">
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30" />
                          Ferie
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" />
                          Syg
                        </span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EmployeeCalendar 
                      standardStartTime={employee?.standard_start_time || null}
                      absences={absences.map(a => ({ id: a.id, type: a.type, start_date: a.start_date, end_date: a.end_date }))}
                      latenessRecords={latenessRecords.map(l => ({ id: l.id, date: l.date, minutes: l.minutes }))}
                      weeksToShow={4}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fravaer" className="mt-6">
            <div className="space-y-6">
              {/* Period Selector */}
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">Periode:</span>
                <Select value={absencePeriod} onValueChange={(val: "2" | "6" | "12") => setAbsencePeriod(val)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 måneder</SelectItem>
                    <SelectItem value="6">6 måneder</SelectItem>
                    <SelectItem value="12">12 måneder</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Warning Card if sick percentage is high */}
              {absenceStats.sickPercentInPeriod > 3.5 && (
                <Card className="border-2 border-red-500 bg-red-500/10">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-full bg-red-500/20">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-red-600 mb-1">
                          Sygefraværsprocent over gennemsnit
                        </h3>
                        <p className="text-3xl font-bold text-red-600 mb-2">
                          {absenceStats.sickPercentInPeriod.toFixed(1)}%
                        </p>
                        <Progress 
                          value={Math.min(absenceStats.sickPercentInPeriod, 15)} 
                          max={15}
                          className="h-3 mb-3 bg-red-200 [&>div]:bg-red-500"
                        />
                        <p className="text-sm text-muted-foreground">
                          Det danske gennemsnit er ca. 3.5%. Højt sygefravær kan påvirke teamet og karriereudviklingen.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stats Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-red-500/10">
                        <Thermometer className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Sygefravær ({absenceStats.periodLabel})</p>
                        <p className="text-2xl font-bold">{absenceStats.sickDaysInPeriod} dage</p>
                        <p className="text-xs text-muted-foreground">{absenceStats.sickOccurrencesInPeriod} perioder</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-amber-500/10">
                        <Palmtree className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Ferie ({absenceStats.periodLabel})</p>
                        <p className="text-2xl font-bold">{absenceStats.vacationDaysInPeriod} dage</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-orange-500/10">
                        <AlarmClock className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Forsinkelser ({absenceStats.periodLabel})</p>
                        <p className="text-2xl font-bold">{latenessStats.countInPeriod} gange</p>
                        <p className="text-xs text-muted-foreground">{latenessStats.totalMinutesInPeriod} min total</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sick History */}
              {absences.filter(a => a.type === "sick").length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Thermometer className="h-4 w-4 text-red-500" />
                      Sygehistorik
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {absences.filter(a => a.type === "sick").slice(0, 15).map((absence) => (
                        <div key={absence.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-2">
                            <Thermometer className="h-4 w-4 text-red-500" />
                            <span className="text-sm">
                              {format(new Date(absence.start_date), "d. MMM yyyy", { locale: da })}
                              {absence.start_date !== absence.end_date && (
                                <> - {format(new Date(absence.end_date), "d. MMM yyyy", { locale: da })}</>
                              )}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {Math.ceil((new Date(absence.end_date).getTime() - new Date(absence.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1} dag(e)
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Lateness History */}
              {latenessRecords.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlarmClock className="h-4 w-4 text-orange-600" />
                      Forsinkelseshistorik
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {latenessRecords.slice(0, 15).map((record) => (
                        <div key={record.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-2">
                            <AlarmClock className="h-4 w-4 text-orange-600" />
                            <span className="text-sm">
                              {format(new Date(record.date), "d. MMM yyyy", { locale: da })}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs bg-orange-500/10">
                            {record.minutes} min
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Calendar */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Kalender</CardTitle>
                </CardHeader>
                <CardContent>
                  <EmployeeCalendar 
                    standardStartTime={employee?.standard_start_time || null}
                    absences={absences.map(a => ({ id: a.id, type: a.type, start_date: a.start_date, end_date: a.end_date }))}
                    latenessRecords={latenessRecords.map(l => ({ id: l.id, date: l.date, minutes: l.minutes }))}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="historik" className="mt-6">
            {/* Payroll Period KPI Card */}
            {(() => {
              // Calculate payroll period (15th to 14th)
              const now = new Date();
              const currentDay = now.getDate();
              let periodStart: Date;
              let periodEnd: Date;
              
              if (currentDay >= 15) {
                // Current period: 15th of this month to 14th of next month
                periodStart = new Date(now.getFullYear(), now.getMonth(), 15);
                periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 14, 23, 59, 59);
              } else {
                // Current period: 15th of last month to 14th of this month
                periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 15);
                periodEnd = new Date(now.getFullYear(), now.getMonth(), 14, 23, 59, 59);
              }

              // Filter time stamps for this period
              const periodStamps = timeStamps.filter(stamp => {
                const clockIn = new Date(stamp.clock_in);
                return clockIn >= periodStart && clockIn <= periodEnd;
              });

              const totalHours = periodStamps.reduce((sum, stamp) => sum + (stamp.effective_hours ?? 0), 0);
              const totalPay = employee?.salary_type === "hourly" && employee?.salary_amount 
                ? totalHours * employee.salary_amount 
                : null;

              return (
                <Card className="mb-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <AlarmClock className="h-4 w-4" />
                      Lønperiode: {format(periodStart, "d. MMM", { locale: da })} - {format(periodEnd, "d. MMM yyyy", { locale: da })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-2xl font-bold">{totalHours.toFixed(1)} t</p>
                        <p className="text-xs text-muted-foreground">Timer optjent</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{periodStamps.length}</p>
                        <p className="text-xs text-muted-foreground">Arbejdsdage</p>
                      </div>
                      {totalPay !== null && (
                        <div>
                          <p className="text-2xl font-bold text-primary">
                            {totalPay.toLocaleString("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                          </p>
                          <p className="text-xs text-muted-foreground">Opsparet løn</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Indstemplinger ({timeStamps.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {timeStamps.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Ingen indstemplinger endnu</p>
                    <p className="text-sm mt-2">Medarbejderen har ikke stemplet ind endnu.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dato</TableHead>
                          <TableHead>Ind</TableHead>
                          <TableHead>Ud</TableHead>
                          <TableHead>Pause</TableHead>
                          <TableHead className="text-right">Effektive timer</TableHead>
                          {employee?.salary_type === "hourly" && employee?.salary_amount && (
                            <TableHead className="text-right">Løn</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {timeStamps.map((stamp) => {
                          const clockIn = new Date(stamp.clock_in);
                          const clockOut = stamp.clock_out ? new Date(stamp.clock_out) : null;
                          const effectiveHours = stamp.effective_hours ?? 0;
                          const dailyPay = employee?.salary_type === "hourly" && employee?.salary_amount 
                            ? effectiveHours * employee.salary_amount 
                            : null;

                          return (
                            <TableRow key={stamp.id}>
                              <TableCell className="font-medium">
                                {format(clockIn, "EEE d. MMM", { locale: da })}
                              </TableCell>
                              <TableCell>
                                {format(clockIn, "HH:mm")}
                              </TableCell>
                              <TableCell>
                                {clockOut ? format(clockOut, "HH:mm") : (
                                  <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                                    Aktiv
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {stamp.break_minutes ? `${stamp.break_minutes} min` : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                {effectiveHours.toFixed(1)} t
                              </TableCell>
                              {employee?.salary_type === "hourly" && employee?.salary_amount && (
                                <TableCell className="text-right font-medium">
                                  {dailyPay?.toLocaleString("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kontrakter" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Kontrakter ({contracts.length})
                </CardTitle>
                <Button onClick={() => setSendContractOpen(true)}>
                  <Send className="h-4 w-4 mr-2" />
                  Send kontrakt
                </Button>
              </CardHeader>
              <CardContent>
                {contracts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Ingen kontrakter sendt endnu</p>
                    <p className="text-sm mt-2">Klik "Send kontrakt" for at sende en kontrakt til medarbejderen.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contracts.map((contract) => {
                      const employeeSignature = contract.contract_signatures?.find(
                        (s: { signer_type: string }) => s.signer_type === "employee"
                      );
                      const statusLabels: Record<string, string> = {
                        draft: "Kladde",
                        pending_employee: "Afventer medarbejder",
                        pending_manager: "Afventer leder",
                        signed: "Underskrevet",
                        rejected: "Afvist",
                        expired: "Udløbet",
                      };
                      const statusColors: Record<string, string> = {
                        draft: "bg-muted text-muted-foreground",
                        pending_employee: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
                        pending_manager: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
                        signed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
                        rejected: "bg-destructive/10 text-destructive",
                        expired: "bg-muted text-muted-foreground",
                      };
                      return (
                        <div
                          key={contract.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/contract/sign/${contract.id}`)}
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{contract.title}</p>
                              <p className="text-sm text-muted-foreground">
                                Sendt {contract.sent_at ? format(new Date(contract.sent_at), "d. MMM yyyy", { locale: da }) : "-"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={statusColors[contract.status || "draft"]}>
                              {statusLabels[contract.status || "draft"]}
                            </Badge>
                            {employeeSignature?.signed_at && (
                              <span className="text-xs text-muted-foreground">
                                Underskrevet {format(new Date(employeeSignature.signed_at), "d. MMM yyyy", { locale: da })}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {employee && (
          <SendContractDialog
            open={sendContractOpen}
            onOpenChange={setSendContractOpen}
            employee={employee}
          />
        )}

        {/* Set Password Dialog - Only for owners */}
        <Dialog open={setPasswordOpen} onOpenChange={(open) => {
          setSetPasswordOpen(open);
          if (!open) setNewPassword("");
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sæt ny adgangskode</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Ny adgangskode for {employee?.first_name} {employee?.last_name}</Label>
                <Input
                  id="new-password"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Indtast ny adgangskode (mindst 6 tegn)"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSetPasswordOpen(false)}>
                Annuller
              </Button>
              <Button 
                disabled={isSettingPassword || newPassword.length < 6}
                onClick={async () => {
                  if (!employee?.private_email) {
                    toast({ 
                      title: "Mangler email", 
                      description: "Medarbejderen har ikke en email registreret.",
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  setIsSettingPassword(true);
                  try {
                    const { data, error } = await supabase.functions.invoke('set-user-password', {
                      body: { email: employee.private_email, newPassword }
                    });
                    
                    if (error) {
                      toast({ 
                        title: "Fejl", 
                        description: error.message,
                        variant: "destructive"
                      });
                    } else if (data?.error) {
                      toast({ 
                        title: "Fejl", 
                        description: data.error,
                        variant: "destructive"
                      });
                    } else {
                      toast({ 
                        title: data?.created ? "Bruger oprettet" : "Adgangskode opdateret", 
                        description: data?.created 
                          ? `Ny bruger oprettet for ${employee.private_email} med den angivne adgangskode`
                          : `Ny adgangskode er sat for ${employee.private_email}` 
                      });
                      setSetPasswordOpen(false);
                      setNewPassword("");
                    }
                  } catch (err) {
                    toast({ 
                      title: "Fejl", 
                      description: "Kunne ikke kontakte serveren",
                      variant: "destructive"
                    });
                  } finally {
                    setIsSettingPassword(false);
                  }
                }}
              >
                {isSettingPassword ? "Gemmer..." : "Gem adgangskode"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
