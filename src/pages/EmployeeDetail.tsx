import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, MapPin, Briefcase, Wallet, Palmtree, Car, Clock, Check, X, History, Phone, Mail, Pencil, MessageSquare, KeyRound, RotateCcw, Thermometer, CalendarX, TrendingUp, AlertTriangle, AlarmClock, FileText, Send } from "lucide-react";
import { SendContractDialog } from "@/components/contracts/SendContractDialog";
import { EmployeeCalendar } from "@/components/employee/EmployeeCalendar";
import { TeamLeaderTeams } from "@/components/employees/TeamLeaderTeams";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

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
  working_hours_model: string | null;
  weekly_hours: number | null;
  standard_start_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EditableFieldProps {
  label: string;
  value: string | number | null | undefined;
  field: keyof EmployeeMasterDataRecord;
  type?: "text" | "date" | "number" | "time" | "email" | "password";
  onSave: (field: string, value: string | number | null) => void;
  displayValue?: string | null;
}

function EditableField({ label, value, field, type = "text", onSave, displayValue }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value || ""));

  const handleSave = () => {
    let finalValue: string | number | null = editValue || null;
    if (type === "number" && editValue) {
      finalValue = parseFloat(editValue);
    }
    onSave(field, finalValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(String(value || ""));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-9 flex-1"
          autoFocus
        />
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleSave}>
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCancel}>
          <X className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md cursor-pointer hover:bg-muted/50 transition-colors group min-h-[40px]"
      onClick={() => setIsEditing(true)}
    >
      <span className="font-medium">{displayValue ?? value ?? "-"}</span>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

interface ClickableContactFieldProps {
  label: string;
  value: string | null;
  field: keyof EmployeeMasterDataRecord;
  type: "phone" | "email";
  onSave: (field: string, value: string | null) => void;
}

function ClickableContactField({ label, value, field, type, onSave }: ClickableContactFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");

  const handleSave = () => {
    onSave(field, editValue || null);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type={type === "email" ? "email" : "tel"}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-9 flex-1"
          autoFocus
        />
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleSave}>
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCancel}>
          <X className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    );
  }

  const href = type === "phone" ? `tel:${value}` : `mailto:${value}`;
  const Icon = type === "phone" ? Phone : Mail;

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md group min-h-[40px]">
      <div className="flex items-center gap-2">
        {value ? (
          <a 
            href={href} 
            className="font-medium text-primary hover:underline flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon className="h-4 w-4" />
            {value}
          </a>
        ) : (
          <span className="font-medium text-muted-foreground">-</span>
        )}
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" 
        onClick={() => setIsEditing(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

interface EditableSelectProps {
  label: string;
  value: string | null;
  field: keyof EmployeeMasterDataRecord;
  options: { value: string; label: string }[];
  onSave: (field: string, value: string | null) => void;
  displayValue?: string | null;
}

function EditableSelect({ label, value, field, options, onSave, displayValue }: EditableSelectProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (newValue: string) => {
    onSave(field, newValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Select value={value || ""} onValueChange={handleChange}>
          <SelectTrigger className="h-9 flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setIsEditing(false)}>
          <X className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md cursor-pointer hover:bg-muted/50 transition-colors group min-h-[40px]"
      onClick={() => setIsEditing(true)}
    >
      <span className="font-medium">{displayValue ?? "-"}</span>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

interface EditableSwitchProps {
  label: string;
  value: boolean;
  field: keyof EmployeeMasterDataRecord;
  onSave: (field: string, value: boolean) => void;
}

function EditableSwitch({ label, value, field, onSave }: EditableSwitchProps) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <Switch checked={value} onCheckedChange={(checked) => onSave(field, checked)} />
    </div>
  );
}

function MaskedField({ label, value, field, onSave }: { label: string; value: string | null; field: keyof EmployeeMasterDataRecord; onSave: (field: string, value: string | null) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");

  const handleSave = () => {
    onSave(field, editValue || null);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
          className="h-9 flex-1"
          autoFocus
        />
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleSave}>
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCancel}>
          <X className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md cursor-pointer hover:bg-muted/50 transition-colors group min-h-[40px]"
      onClick={() => setIsEditing(true)}
    >
      <span className="font-medium">{value ? "••••••••" : "-"}</span>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [absencePeriod, setAbsencePeriod] = useState<"2" | "6" | "12">("2");
  const [sendContractOpen, setSendContractOpen] = useState(false);

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
                <Badge variant={employee.is_active ? "default" : "secondary"}>
                  {employee.is_active ? "Aktiv" : "Inaktiv"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
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
            <div className="space-y-6">
              {/* Personal Information - Combined Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Personlige oplysninger</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Left Column - Identity & Contact */}
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Identitet</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Fornavn(e)</label>
                            <EditableField label="" value={employee.first_name} field="first_name" onSave={handleSave} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Efternavn</label>
                            <EditableField label="" value={employee.last_name} field="last_name" onSave={handleSave} />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">CPR-nr.</label>
                          <MaskedField label="" value={employee.cpr_number} field="cpr_number" onSave={handleSave} />
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Kontakt</h4>
                        <div>
                          <label className="text-xs text-muted-foreground">Telefon</label>
                          <ClickableContactField label="" value={employee.private_phone} field="private_phone" type="phone" onSave={handleSave} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Privat email</label>
                          <ClickableContactField label="" value={employee.private_email} field="private_email" type="email" onSave={handleSave} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Arbejdsemail</label>
                          <ClickableContactField label="" value={employee.work_email} field="work_email" type="email" onSave={handleSave} />
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Address */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Adresse</h4>
                      <div>
                        <label className="text-xs text-muted-foreground">Vejnavn og nr.</label>
                        <EditableField label="" value={employee.address_street} field="address_street" onSave={handleSave} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Postnummer</label>
                          <EditableField label="" value={employee.address_postal_code} field="address_postal_code" onSave={handleSave} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">By</label>
                          <EditableField label="" value={employee.address_city} field="address_city" onSave={handleSave} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Land</label>
                        <EditableField label="" value={employee.address_country} field="address_country" onSave={handleSave} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Employment Information - Combined Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ansættelsesforhold</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Employment Details */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Stilling</h4>
                      <div>
                        <label className="text-xs text-muted-foreground">Jobtitel</label>
                        <EditableSelect
                          label=""
                          value={employee.job_title}
                          field="job_title"
                          options={[
                            { value: "Salgskonsulent", label: "Salgskonsulent" },
                            { value: "Fieldmarketing", label: "Fieldmarketing" },
                            { value: "Teamleder", label: "Teamleder" },
                            { value: "Assisterende Teamleder", label: "Assisterende Teamleder" },
                            { value: "Rekruttering", label: "Rekruttering" },
                            { value: "SOME", label: "SOME" },
                            { value: "Backoffice", label: "Backoffice" },
                            { value: "Projektleder", label: "Projektleder" },
                            { value: "Ejer", label: "Ejer" },
                          ]}
                          onSave={handleSave}
                          displayValue={employee.job_title}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Afdeling / Team</label>
                        <EditableSelect
                          label=""
                          value={employee.department}
                          field="department"
                          options={clients.map(c => ({ value: c.name, label: c.name }))}
                          onSave={handleSave}
                          displayValue={employee.department}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Arbejdssted</label>
                        <EditableSelect
                          label=""
                          value={employee.work_location}
                          field="work_location"
                          options={[
                            { value: "København V", label: "København V" },
                            { value: "Århus", label: "Århus" },
                          ]}
                          onSave={handleSave}
                          displayValue={employee.work_location || "-"}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Leder</label>
                        <div className="py-2 font-medium">{manager ? `${manager.first_name} ${manager.last_name}` : "-"}</div>
                      </div>
                    </div>

                    {/* Dates & Status */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Periode</h4>
                      <div>
                        <label className="text-xs text-muted-foreground">Ansættelsesdato</label>
                        <EditableField label="" value={employee.employment_start_date} field="employment_start_date" type="date" onSave={handleSave} displayValue={formatDate(employee.employment_start_date)} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Slutdato</label>
                        <EditableField label="" value={employee.employment_end_date} field="employment_end_date" type="date" onSave={handleSave} displayValue={formatDate(employee.employment_end_date)} />
                      </div>
                      <div className="pt-2">
                        <label className="text-xs text-muted-foreground">Status</label>
                        <div className="flex items-center justify-between py-2">
                          <span className="font-medium">{employee.is_active ? "Aktiv" : "Inaktiv"}</span>
                          <Switch checked={employee.is_active} onCheckedChange={(checked) => handleSave("is_active", checked)} />
                        </div>
                      </div>
                    </div>

                    {/* Working Hours */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Arbejdstid</h4>
                      <div>
                        <label className="text-xs text-muted-foreground">Timer pr. uge</label>
                        <EditableField label="" value={employee.weekly_hours} field="weekly_hours" type="number" onSave={handleSave} displayValue={employee.weekly_hours ? `${employee.weekly_hours} timer` : null} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Mødetid</label>
                        <EditableSelect
                          label=""
                          value={employee.standard_start_time}
                          field="standard_start_time"
                          options={[
                            { value: "8.00-16.30", label: "8.00-16.30" },
                            { value: "8.30-16.30", label: "8.30-16.30" },
                            { value: "9.30-17.30", label: "9.30-17.30" },
                          ]}
                          onSave={handleSave}
                          displayValue={employee.standard_start_time || "-"}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Salary & Benefits - Combined Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Løn og goder</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Salary */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Løn</h4>
                      <div>
                        <label className="text-xs text-muted-foreground">Løntype</label>
                        <EditableSelect
                          label=""
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
                      </div>
                      {(employee.salary_type === "fixed" || employee.salary_type === "hourly") && (
                        <div>
                          <label className="text-xs text-muted-foreground">Beløb (DKK)</label>
                          <EditableField 
                            label="" 
                            value={employee.salary_amount} 
                            field="salary_amount" 
                            type="number" 
                            onSave={handleSave} 
                            displayValue={employee.salary_amount ? `${employee.salary_amount.toLocaleString("da-DK")} DKK` : null}
                          />
                        </div>
                      )}
                    </div>

                    {/* Bank */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Bank</h4>
                      <div>
                        <label className="text-xs text-muted-foreground">Reg.nr.</label>
                        <MaskedField label="" value={employee.bank_reg_number} field="bank_reg_number" onSave={handleSave} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Kontonummer</label>
                        <MaskedField label="" value={employee.bank_account_number} field="bank_account_number" onSave={handleSave} />
                      </div>
                    </div>

                    {/* Vacation & Parking */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Ferie</h4>
                      <div>
                        <label className="text-xs text-muted-foreground">Ferietype</label>
                        <EditableSelect
                          label=""
                          value={employee.vacation_type}
                          field="vacation_type"
                          options={[
                            { value: "vacation_pay", label: "Ferieløn" },
                            { value: "vacation_bonus", label: "Feriebonus" },
                          ]}
                          onSave={handleSave}
                          displayValue={getVacationTypeLabel(employee.vacation_type)}
                        />
                      </div>
                      {employee.vacation_type === "vacation_bonus" && (
                        <div>
                          <label className="text-xs text-muted-foreground">Feriebonus %</label>
                          <EditableField 
                            label="" 
                            value={employee.vacation_bonus_percent} 
                            field="vacation_bonus_percent" 
                            type="number" 
                            onSave={handleSave}
                            displayValue={employee.vacation_bonus_percent ? `${employee.vacation_bonus_percent}%` : null}
                          />
                        </div>
                      )}
                      <div className="pt-3">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Parkering</h4>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Har parkering</span>
                          <Switch checked={employee.has_parking} onCheckedChange={(checked) => handleSave("has_parking", checked)} />
                        </div>
                        {employee.has_parking && (
                          <div className="mt-3 space-y-2">
                            <div>
                              <label className="text-xs text-muted-foreground">P-plads ID</label>
                              <EditableField label="" value={employee.parking_spot_id} field="parking_spot_id" onSave={handleSave} />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Månedlig udgift</label>
                              <EditableField 
                                label="" 
                                value={employee.parking_monthly_cost} 
                                field="parking_monthly_cost" 
                                type="number" 
                                onSave={handleSave}
                                displayValue={employee.parking_monthly_cost ? `${employee.parking_monthly_cost} DKK` : null}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Team Leader Teams Section - only show for Teamleder or Ejer */}
              {(employee.job_title === "Teamleder" || employee.job_title === "Ejer" || employee.job_title === "Assisterende Teamleder") && (
                <TeamLeaderTeams 
                  employeeId={employee.id} 
                  employeeName={`${employee.first_name} ${employee.last_name}`} 
                />
              )}
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Lønhistorik
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Historik kommer snart</p>
                  <p className="text-sm mt-2">Her vil du kunne se løndata fra vagter, salg, provision og annulleringer.</p>
                </div>
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
      </div>
    </MainLayout>
  );
}
