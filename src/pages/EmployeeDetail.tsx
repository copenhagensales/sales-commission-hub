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
      <div className="flex justify-between items-center py-2 border-b border-border last:border-0 gap-2">
        <span className="text-muted-foreground shrink-0">{label}</span>
        <div className="flex items-center gap-1">
          <Input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-7 w-40 text-right"
            autoFocus
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave}>
            <Check className="h-3 w-3 text-green-600" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancel}>
            <X className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex justify-between py-2 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
      onClick={() => setIsEditing(true)}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{displayValue ?? value ?? "-"}</span>
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
      <div className="flex justify-between items-center py-2 border-b border-border last:border-0 gap-2">
        <span className="text-muted-foreground shrink-0">{label}</span>
        <div className="flex items-center gap-1">
          <Input
            type={type === "email" ? "email" : "tel"}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-7 w-40 text-right"
            autoFocus
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave}>
            <Check className="h-3 w-3 text-green-600" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancel}>
            <X className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </div>
    );
  }

  const href = type === "phone" ? `tel:${value}` : `mailto:${value}`;
  const Icon = type === "phone" ? Phone : Mail;

  return (
    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {value ? (
          <a 
            href={href} 
            className="font-medium text-primary hover:underline flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon className="h-3.5 w-3.5" />
            {value}
          </a>
        ) : (
          <span className="font-medium">-</span>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 opacity-50 hover:opacity-100" 
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
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
      <div className="flex justify-between items-center py-2 border-b border-border last:border-0 gap-2">
        <span className="text-muted-foreground shrink-0">{label}</span>
        <div className="flex items-center gap-1">
          <Select value={value || ""} onValueChange={handleChange}>
            <SelectTrigger className="h-7 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditing(false)}>
            <X className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex justify-between py-2 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
      onClick={() => setIsEditing(true)}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{displayValue ?? "-"}</span>
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
      <div className="flex justify-between items-center py-2 border-b border-border last:border-0 gap-2">
        <span className="text-muted-foreground shrink-0">{label}</span>
        <div className="flex items-center gap-1">
          <Input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
            className="h-7 w-40 text-right"
            autoFocus
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave}>
            <Check className="h-3 w-3 text-green-600" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancel}>
            <X className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex justify-between py-2 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
      onClick={() => setIsEditing(true)}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ? "••••••••" : "-"}</span>
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

  // Fetch absence history for this employee
  const { data: absences = [] } = useQuery({
    queryKey: ["employee-absences", id],
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Identitet */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  <CardTitle>Identitet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <EditableField label="Fornavn(e)" value={employee.first_name} field="first_name" onSave={handleSave} />
                  <EditableField label="Efternavn" value={employee.last_name} field="last_name" onSave={handleSave} />
                  <MaskedField label="CPR-nr." value={employee.cpr_number} field="cpr_number" onSave={handleSave} />
                </CardContent>
              </Card>

              {/* Kontakt */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <CardTitle>Kontakt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <EditableField label="Adresse" value={employee.address_street} field="address_street" onSave={handleSave} />
                  <EditableField label="Postnummer" value={employee.address_postal_code} field="address_postal_code" onSave={handleSave} />
                  <EditableField label="By" value={employee.address_city} field="address_city" onSave={handleSave} />
                  <EditableField label="Land" value={employee.address_country} field="address_country" onSave={handleSave} />
                  <ClickableContactField label="Telefon" value={employee.private_phone} field="private_phone" type="phone" onSave={handleSave} />
                  <ClickableContactField label="Privat email" value={employee.private_email} field="private_email" type="email" onSave={handleSave} />
                  <ClickableContactField label="Arbejdsemail" value={employee.work_email} field="work_email" type="email" onSave={handleSave} />
                </CardContent>
              </Card>

              {/* Ansættelse */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <CardTitle>Ansættelse</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <EditableField label="Ansættelsesdato" value={employee.employment_start_date} field="employment_start_date" type="date" onSave={handleSave} displayValue={formatDate(employee.employment_start_date)} />
                  <EditableField label="Slutdato" value={employee.employment_end_date} field="employment_end_date" type="date" onSave={handleSave} displayValue={formatDate(employee.employment_end_date)} />
                  <EditableSelect
                    label="Stilling"
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
                  <EditableSelect
                    label="Afdeling / Team"
                    value={employee.department}
                    field="department"
                    options={clients.map(c => ({ value: c.name, label: c.name }))}
                    onSave={handleSave}
                    displayValue={employee.department}
                  />
                  <EditableSelect
                    label="Arbejdssted"
                    value={employee.work_location}
                    field="work_location"
                    options={[
                      { value: "København V", label: "København V" },
                      { value: "Århus", label: "Århus" },
                    ]}
                    onSave={handleSave}
                    displayValue={employee.work_location || "-"}
                  />
                  <div className="flex justify-between py-2 border-b border-border last:border-0">
                    <span className="text-muted-foreground">Leder</span>
                    <span className="font-medium">{manager ? `${manager.first_name} ${manager.last_name}` : "-"}</span>
                  </div>
                  <EditableField label="Kontrakt-ID" value={employee.contract_id} field="contract_id" onSave={handleSave} />
                  <EditableField label="Kontrakt version" value={employee.contract_version} field="contract_version" onSave={handleSave} />
                  <EditableSwitch label="Aktiv medarbejder" value={employee.is_active} field="is_active" onSave={handleSave} />
                </CardContent>
              </Card>

              {/* Løn */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <CardTitle>Løn</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <EditableSelect
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
                    <EditableField 
                      label="Beløb (DKK)" 
                      value={employee.salary_amount} 
                      field="salary_amount" 
                      type="number" 
                      onSave={handleSave} 
                      displayValue={employee.salary_amount ? `${employee.salary_amount.toLocaleString("da-DK")} DKK` : null}
                    />
                  )}
                  <MaskedField label="Reg.nr." value={employee.bank_reg_number} field="bank_reg_number" onSave={handleSave} />
                  <MaskedField label="Kontonummer" value={employee.bank_account_number} field="bank_account_number" onSave={handleSave} />
                </CardContent>
              </Card>

              {/* Ferie */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Palmtree className="h-5 w-5 text-primary" />
                  <CardTitle>Ferie</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <EditableSelect
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
                    <EditableField 
                      label="Feriebonus %" 
                      value={employee.vacation_bonus_percent} 
                      field="vacation_bonus_percent" 
                      type="number" 
                      onSave={handleSave}
                      displayValue={employee.vacation_bonus_percent ? `${employee.vacation_bonus_percent}%` : null}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Parkering */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Car className="h-5 w-5 text-primary" />
                  <CardTitle>Parkering</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <EditableSwitch label="Parkeringsplads" value={employee.has_parking} field="has_parking" onSave={handleSave} />
                  {employee.has_parking && (
                    <>
                      <EditableField label="Plads-ID" value={employee.parking_spot_id} field="parking_spot_id" onSave={handleSave} />
                      <EditableField 
                        label="Månedlig pris (DKK)" 
                        value={employee.parking_monthly_cost} 
                        field="parking_monthly_cost" 
                        type="number" 
                        onSave={handleSave}
                        displayValue={employee.parking_monthly_cost ? `${employee.parking_monthly_cost.toLocaleString("da-DK")} DKK` : null}
                      />
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Arbejdstid */}
              <Card className="md:col-span-2 lg:col-span-1">
                <CardHeader className="flex flex-row items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <CardTitle>Arbejdstid</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <EditableField label="Timer pr. uge" value={employee.weekly_hours || 37.5} field="weekly_hours" type="number" onSave={handleSave} />
                  <EditableSelect
                    label="Mødetid"
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
                </CardContent>
              </Card>
            </div>

            {/* Metadata */}
            <Card className="mt-6">
              <CardContent className="pt-6">
                <div className="flex gap-8 text-sm text-muted-foreground">
                  <span>Oprettet: {formatDate(employee.created_at)}</span>
                  <span>Sidst opdateret: {formatDate(employee.updated_at)}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fravaer" className="mt-6">
            <div className="space-y-6">
              {/* Period Selector */}
              <div className="flex justify-end">
                <Select value={absencePeriod} onValueChange={(v) => setAbsencePeriod(v as "2" | "6" | "12")}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    <SelectItem value="2">2 måneder</SelectItem>
                    <SelectItem value="6">6 måneder</SelectItem>
                    <SelectItem value="12">12 måneder</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Employee Calendar */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4 text-primary" />
                    Min vagtplan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <EmployeeCalendar
                    standardStartTime={employee.standard_start_time}
                    absences={absences.map(a => ({
                      id: a.id,
                      type: a.type as "sick" | "vacation",
                      start_date: a.start_date,
                      end_date: a.end_date,
                    }))}
                    latenessRecords={latenessRecords.map(l => ({
                      id: l.id,
                      date: l.date,
                      minutes: l.minutes,
                    }))}
                    weeksToShow={8}
                  />
                </CardContent>
              </Card>

              {/* Overview Stats */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/10">
                        <Thermometer className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Sygefravær ({absenceStats.periodLabel})</p>
                        <p className="text-2xl font-bold">{absenceStats.sickPercentInPeriod.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">
                          {absenceStats.sickDaysInPeriod} dage • {absenceStats.sickOccurrencesInPeriod} gange
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <Palmtree className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Ferie ({absenceStats.periodLabel})</p>
                        <p className="text-2xl font-bold">{absenceStats.vacationDaysInPeriod} dage</p>
                        <p className="text-xs text-muted-foreground">
                          Afholdt ferie seneste {absencePeriod} måneder
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

              </div>

              {/* Pattern Analysis */}
              {(absenceStats.hasFrequentShortSickness || absenceStats.mondayFridayPercent > 50) && (
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                      <div className="space-y-2">
                        <p className="font-medium text-amber-700 dark:text-amber-400">Fraværsmønster bemærket</p>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {absenceStats.hasFrequentShortSickness && (
                            <p>• Du har haft {absenceStats.sickOccurrencesInPeriod} korte sygeperioder på under 2 dage i gennemsnit. Overvej om der er noget vi kan hjælpe med?</p>
                          )}
                          {absenceStats.mondayFridayPercent > 50 && absenceStats.sickOccurrencesInPeriod >= 2 && (
                            <p>• {absenceStats.mondayFridaySick} af {absenceStats.sickOccurrencesInPeriod} sygemeldinger ({absenceStats.mondayFridayPercent.toFixed(0)}%) er faldet på mandag eller fredag.</p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                          💡 Hvis du oplever tilbagevendende helbredsproblemer, er du velkommen til at tale med din leder om evt. tilpasninger.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Sick percentage visual - only shown if above 3.5% */}
              {absenceStats.sickPercentInPeriod > 3.5 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Thermometer className="h-4 w-4 text-primary" />
                      Sygefraværsprocent sammenlignet
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Dit fravær ({absenceStats.periodLabel})</span>
                        <span className="font-medium">{absenceStats.sickPercentInPeriod.toFixed(1)}%</span>
                      </div>
                      <Progress 
                        value={Math.min(absenceStats.sickPercentInPeriod * 10, 100)} 
                        className="h-3 [&>div]:bg-destructive"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Dansk gennemsnit</span>
                        <span className="text-muted-foreground">3.5%</span>
                      </div>
                      <Progress value={35} className="h-2 opacity-50" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Det danske gennemsnit for sygefravær ligger på ca. 3,5% af arbejdsdagene.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Lateness Report */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlarmClock className="h-4 w-4 text-orange-500" />
                    Forsinkelsesrapport
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 mb-6">
                    <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                      <p className="text-sm text-muted-foreground">Antal ({absenceStats.periodLabel})</p>
                      <p className="text-xl font-bold">{latenessStats.countInPeriod} gange</p>
                    </div>
                    <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                      <p className="text-sm text-muted-foreground">Total tid ({absenceStats.periodLabel})</p>
                      <p className="text-xl font-bold">{latenessStats.totalMinutesInPeriod} min</p>
                    </div>
                    <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                      <p className="text-sm text-muted-foreground">Gns. forsinkelse</p>
                      <p className="text-xl font-bold">{latenessStats.avgMinutesPerLateness.toFixed(0)} min</p>
                    </div>
                  </div>
                  
                  {latenessRecords.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <AlarmClock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Ingen registrerede forsinkelser</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {latenessRecords.slice(0, 15).map((record) => (
                        <div 
                          key={record.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-orange-500/5 border-orange-500/20"
                        >
                          <div className="flex items-center gap-3">
                            <AlarmClock className="h-4 w-4 text-orange-500" />
                            <div>
                              <p className="font-medium text-sm">
                                {format(new Date(record.date), "EEEE d. MMM yyyy", { locale: da })}
                              </p>
                              {record.note && (
                                <p className="text-xs text-muted-foreground">{record.note}</p>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="border-orange-500/30 text-orange-600">
                            {record.minutes} min
                          </Badge>
                        </div>
                      ))}
                      {latenessRecords.length > 15 && (
                        <p className="text-xs text-center text-muted-foreground pt-2">
                          Viser de seneste 15 af {latenessRecords.length} forsinkelser
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sick Absence History - only sickness, not vacation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Thermometer className="h-4 w-4 text-red-500" />
                    Sygehistorik
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {absences.filter(a => a.type === "sick").length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Thermometer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Ingen registreret sygdom</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {absences.filter(a => a.type === "sick").slice(0, 15).map((absence) => {
                        const start = new Date(absence.start_date);
                        const end = new Date(absence.end_date);
                        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        
                        return (
                          <div 
                            key={absence.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-red-500/5 border-red-500/20"
                          >
                            <div className="flex items-center gap-3">
                              <Thermometer className="h-4 w-4 text-red-500" />
                              <div>
                                <p className="font-medium text-sm">Sygdom</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(start, "d. MMM yyyy", { locale: da })}
                                  {days > 1 && ` – ${format(end, "d. MMM yyyy", { locale: da })}`}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline" className="border-red-500/30">
                              {days} {days === 1 ? "dag" : "dage"}
                            </Badge>
                          </div>
                        );
                      })}
                      {absences.filter(a => a.type === "sick").length > 15 && (
                        <p className="text-xs text-center text-muted-foreground pt-2">
                          Viser de seneste 15 af {absences.filter(a => a.type === "sick").length} sygemeldinger
                        </p>
                      )}
                    </div>
                  )}
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
                  Kontrakter
                </CardTitle>
                <Button onClick={() => setSendContractOpen(true)}>
                  <Send className="h-4 w-4 mr-2" />
                  Send kontrakt
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Ingen kontrakter sendt endnu</p>
                  <p className="text-sm mt-2">Klik "Send kontrakt" for at sende en kontrakt til medarbejderen.</p>
                </div>
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
