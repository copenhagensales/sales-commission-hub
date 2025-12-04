import { useState } from "react";
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
import { ArrowLeft, User, MapPin, Briefcase, Wallet, Palmtree, Car, Clock, Check, X } from "lucide-react";
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
            <SelectContent>
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
        </div>

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
              <EditableField label="Telefon" value={employee.private_phone} field="private_phone" onSave={handleSave} />
              <EditableField label="E-mail" value={employee.private_email} field="private_email" type="email" onSave={handleSave} />
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
              <EditableField label="Stilling" value={employee.job_title} field="job_title" onSave={handleSave} />
              <EditableField label="Afdeling / Team" value={employee.department} field="department" onSave={handleSave} />
              <EditableField label="Arbejdssted" value={employee.work_location} field="work_location" onSave={handleSave} />
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
              <EditableField label="Model" value={employee.working_hours_model} field="working_hours_model" onSave={handleSave} />
              <EditableField label="Timer pr. uge" value={employee.weekly_hours} field="weekly_hours" type="number" onSave={handleSave} />
              <EditableField label="Mødetid" value={employee.standard_start_time} field="standard_start_time" type="time" onSave={handleSave} />
            </CardContent>
          </Card>
        </div>

        {/* Metadata */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-8 text-sm text-muted-foreground">
              <span>Oprettet: {formatDate(employee.created_at)}</span>
              <span>Sidst opdateret: {formatDate(employee.updated_at)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
