import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, User, MapPin, Briefcase, Wallet, Palmtree, Car, Clock } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

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

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "-"}</span>
    </div>
  );
}

function MaskedField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ? "••••••••" : "-"}</span>
    </div>
  );
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
          <Button onClick={() => navigate(`/employees?edit=${employee.id}`)}>
            <Pencil className="mr-2 h-4 w-4" /> Rediger
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Identitet */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Identitet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <DetailRow label="Fornavn(e)" value={employee.first_name} />
              <DetailRow label="Efternavn" value={employee.last_name} />
              <MaskedField label="CPR-nr." value={employee.cpr_number} />
            </CardContent>
          </Card>

          {/* Kontakt */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <CardTitle>Kontakt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <DetailRow label="Adresse" value={employee.address_street} />
              <DetailRow label="Postnummer" value={employee.address_postal_code} />
              <DetailRow label="By" value={employee.address_city} />
              <DetailRow label="Land" value={employee.address_country} />
              <DetailRow label="Telefon" value={employee.private_phone} />
              <DetailRow label="E-mail" value={employee.private_email} />
            </CardContent>
          </Card>

          {/* Ansættelse */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              <CardTitle>Ansættelse</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <DetailRow label="Ansættelsesdato" value={formatDate(employee.employment_start_date)} />
              <DetailRow label="Slutdato" value={formatDate(employee.employment_end_date)} />
              <DetailRow label="Stilling" value={employee.job_title} />
              <DetailRow label="Afdeling / Team" value={employee.department} />
              <DetailRow label="Arbejdssted" value={employee.work_location} />
              <DetailRow label="Leder" value={manager ? `${manager.first_name} ${manager.last_name}` : null} />
              <DetailRow label="Kontrakt-ID" value={employee.contract_id} />
              <DetailRow label="Kontrakt version" value={employee.contract_version} />
            </CardContent>
          </Card>

          {/* Løn */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <CardTitle>Løn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <DetailRow label="Løntype" value={getSalaryTypeLabel(employee.salary_type)} />
              {(employee.salary_type === "fixed" || employee.salary_type === "hourly") && (
                <DetailRow label="Beløb" value={employee.salary_amount ? `${employee.salary_amount.toLocaleString("da-DK")} DKK` : null} />
              )}
              <MaskedField label="Reg.nr." value={employee.bank_reg_number} />
              <MaskedField label="Kontonummer" value={employee.bank_account_number} />
            </CardContent>
          </Card>

          {/* Ferie */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Palmtree className="h-5 w-5 text-primary" />
              <CardTitle>Ferie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <DetailRow label="Ferietype" value={getVacationTypeLabel(employee.vacation_type)} />
              {employee.vacation_type === "vacation_bonus" && (
                <DetailRow label="Feriebonus" value={`${employee.vacation_bonus_percent}%`} />
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
              <DetailRow label="Parkeringsplads" value={employee.has_parking ? "Ja" : "Nej"} />
              {employee.has_parking && (
                <>
                  <DetailRow label="Plads-ID" value={employee.parking_spot_id} />
                  <DetailRow label="Månedlig pris" value={employee.parking_monthly_cost ? `${employee.parking_monthly_cost.toLocaleString("da-DK")} DKK` : null} />
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
              <DetailRow label="Model" value={employee.working_hours_model} />
              <DetailRow label="Timer pr. uge" value={employee.weekly_hours} />
              <DetailRow label="Mødetid" value={employee.standard_start_time} />
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
