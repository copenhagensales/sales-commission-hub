import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, MapPin, Briefcase, Wallet, Palmtree, Car, Clock, FileText, CalendarX, History, Thermometer, AlertTriangle, AlarmClock, TrendingUp } from "lucide-react";
import { EmployeeCalendar } from "@/components/employee/EmployeeCalendar";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

export default function MyProfile() {
  const navigate = useNavigate();
  const [absencePeriod, setAbsencePeriod] = useState<"2" | "6" | "12">("2");

  // Fetch current user's employee data
  const { data: employee, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      const { data, error } = await supabase
        .from("employee_master_data")
        .select("*")
        .or(`private_email.eq.${userData.user.email},work_email.eq.${userData.user.email}`)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch absence history
  const { data: absences = [] } = useQuery({
    queryKey: ["my-absences", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data, error } = await supabase
        .from("absence_request_v2")
        .select("*")
        .eq("employee_id", employee.id)
        .eq("status", "approved")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id,
  });

  // Fetch lateness records
  const { data: latenessRecords = [] } = useQuery({
    queryKey: ["my-lateness", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data, error } = await supabase
        .from("lateness_record")
        .select("*")
        .eq("employee_id", employee.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id,
  });

  // Fetch my contracts
  const { data: contracts = [] } = useQuery({
    queryKey: ["my-contracts-profile", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data, error } = await supabase
        .from("contracts")
        .select("*, contract_signatures(*)")
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id,
  });

  // Calculate absence statistics
  const absenceStats = useMemo(() => {
    const now = new Date();
    const monthsBack = parseInt(absencePeriod);
    const periodStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, now.getDate());
    
    const periodAbsences = absences.filter(a => {
      const date = new Date(a.start_date);
      return date >= periodStart && date <= now;
    });
    
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
    
    const workingDaysInPeriod = parseInt(absencePeriod) * 21.5;
    const sickDaysInPeriod = countDays(periodAbsences, "sick");
    const vacationDaysInPeriod = countDays(periodAbsences, "vacation");
    const sickOccurrencesInPeriod = countOccurrences(periodAbsences, "sick");
    const sickPercentInPeriod = (sickDaysInPeriod / workingDaysInPeriod) * 100;
    
    const sickAbsences = periodAbsences.filter(a => a.type === "sick").sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
    
    return {
      sickDaysInPeriod,
      vacationDaysInPeriod,
      sickOccurrencesInPeriod,
      sickPercentInPeriod,
      sickAbsences,
    };
  }, [absences, absencePeriod]);

  // Calculate lateness statistics
  const latenessStats = useMemo(() => {
    const now = new Date();
    const monthsBack = parseInt(absencePeriod);
    const periodStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, now.getDate());
    
    const periodLateness = latenessRecords.filter(l => {
      const date = new Date(l.date);
      return date >= periodStart && date <= now;
    });
    
    const totalMinutesInPeriod = periodLateness.reduce((sum, l) => sum + l.minutes, 0);
    
    return {
      countInPeriod: periodLateness.length,
      totalMinutesInPeriod,
      records: periodLateness.slice(0, 15),
    };
  }, [latenessRecords, absencePeriod]);

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "d. MMM yyyy", { locale: da });
  };

  const formatSalaryType = (type: string | null) => {
    if (!type) return "-";
    const map: Record<string, string> = { provision: "Provision", fixed: "Fast løn", hourly: "Timeløn" };
    return map[type] || type;
  };

  const formatVacationType = (type: string | null) => {
    if (!type) return "-";
    const map: Record<string, string> = { vacation_pay: "Ferieløn", vacation_bonus: "1% ferietillæg" };
    return map[type] || type;
  };

  const getContractStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { label: "Kladde", variant: "secondary" },
      pending_employee: { label: "Afventer underskrift", variant: "destructive" },
      pending_manager: { label: "Afventer godkendelse", variant: "secondary" },
      signed: { label: "Underskrevet", variant: "default" },
      rejected: { label: "Afvist", variant: "destructive" },
      expired: { label: "Udløbet", variant: "secondary" },
    };
    const { label, variant } = statusMap[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-6">Indlæser...</div>
      </MainLayout>
    );
  }

  if (!employee) {
    return (
      <MainLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Din bruger er ikke tilknyttet en medarbejderprofil.</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Mit stamkort</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-muted-foreground">{employee.first_name} {employee.last_name}</span>
            {employee.job_title && <span className="text-muted-foreground">• {employee.job_title}</span>}
            <Badge variant={employee.is_active ? "default" : "secondary"}>
              {employee.is_active ? "Aktiv" : "Inaktiv"}
            </Badge>
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
                <CardContent className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Fornavn(e)</span>
                    <span className="font-medium">{employee.first_name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Efternavn</span>
                    <span className="font-medium">{employee.last_name}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">CPR-nr.</span>
                    <span className="font-medium">{employee.cpr_number ? "••••••••" : "-"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Kontakt */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <CardTitle>Kontakt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Adresse</span>
                    <span className="font-medium">{employee.address_street || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Postnummer</span>
                    <span className="font-medium">{employee.address_postal_code || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">By</span>
                    <span className="font-medium">{employee.address_city || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Land</span>
                    <span className="font-medium">{employee.address_country || "Danmark"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Telefon</span>
                    <span className="font-medium">{employee.private_phone || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Privat email</span>
                    <span className="font-medium truncate max-w-[200px]">{employee.private_email || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Arbejdsemail</span>
                    <span className="font-medium truncate max-w-[200px]">{employee.work_email || "-"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Ansættelse */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <CardTitle>Ansættelse</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Ansættelsesdato</span>
                    <span className="font-medium">{formatDate(employee.employment_start_date)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Slutdato</span>
                    <span className="font-medium">{formatDate(employee.employment_end_date)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Stilling</span>
                    <span className="font-medium">{employee.job_title || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Afdeling / Team</span>
                    <span className="font-medium">{employee.department || "-"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Arbejdssted</span>
                    <span className="font-medium">{employee.work_location || "-"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Løn */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <CardTitle>Løn</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Løntype</span>
                    <span className="font-medium">{formatSalaryType(employee.salary_type)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Reg.nr.</span>
                    <span className="font-medium">{employee.bank_reg_number ? "••••" : "-"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Kontonummer</span>
                    <span className="font-medium">{employee.bank_account_number ? "••••••••" : "-"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Ferie */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Palmtree className="h-5 w-5 text-primary" />
                  <CardTitle>Ferie</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Ferietype</span>
                    <span className="font-medium">{formatVacationType(employee.vacation_type)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Parkering */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Car className="h-5 w-5 text-primary" />
                  <CardTitle>Parkering</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Parkeringsplads</span>
                    <span className="font-medium">{employee.has_parking ? "Ja" : "Nej"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Arbejdstid */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <CardTitle>Arbejdstid</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">Timer pr. uge</span>
                    <span className="font-medium">{employee.weekly_hours || 37}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Mødetid</span>
                    <span className="font-medium">{employee.standard_start_time || "-"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="kontrakter" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Mine kontrakter</CardTitle>
              </CardHeader>
              <CardContent>
                {contracts.length > 0 ? (
                  <div className="space-y-3">
                    {contracts.map((contract) => (
                      <div key={contract.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div>
                          <p className="font-medium">{contract.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(contract.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {getContractStatusBadge(contract.status || "draft")}
                          {contract.status === "pending_employee" && (
                            <Button size="sm" onClick={() => navigate(`/contract/${contract.id}`)}>
                              Underskriv
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Ingen kontrakter</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fravaer" className="mt-6 space-y-6">
            {/* Period selector */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Vis periode:</span>
              <Select value={absencePeriod} onValueChange={(v) => setAbsencePeriod(v as "2" | "6" | "12")}>
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

            {/* Calendar */}
            <EmployeeCalendar 
              standardStartTime={employee.standard_start_time}
              absences={absences.map(a => ({ id: a.id, type: a.type, start_date: a.start_date, end_date: a.end_date }))}
              latenessRecords={latenessRecords.map(l => ({ id: l.id, date: l.date, minutes: l.minutes }))}
            />

            {/* Stats cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">Sygefravær</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Dit fravær</span>
                      <span className="font-medium">{absenceStats.sickPercentInPeriod.toFixed(1)}%</span>
                    </div>
                    <Progress 
                      value={Math.min(absenceStats.sickPercentInPeriod, 10) * 10} 
                      className={absenceStats.sickPercentInPeriod > 3.5 ? "h-3 [&>div]:bg-red-500" : "h-2"} 
                    />
                    <p className="text-xs text-muted-foreground">
                      {absenceStats.sickDaysInPeriod} sygedage ({absenceStats.sickOccurrencesInPeriod} perioder)
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Palmtree className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Ferie</span>
                  </div>
                  <p className="text-2xl font-bold">{absenceStats.vacationDaysInPeriod}</p>
                  <p className="text-xs text-muted-foreground">feriedage brugt i perioden</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <AlarmClock className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Forsinkelser</span>
                  </div>
                  <p className="text-2xl font-bold">{latenessStats.countInPeriod}</p>
                  <p className="text-xs text-muted-foreground">
                    {latenessStats.totalMinutesInPeriod} minutter total
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* High sick absence warning */}
            {absenceStats.sickPercentInPeriod > 3.5 && (
              <Card className="border-amber-500/50 bg-amber-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Sygefraværsprocent over gennemsnit</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Dit sygefravær på {absenceStats.sickPercentInPeriod.toFixed(1)}% er højere end det danske gennemsnit på 3.5%.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="historik" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Sick history */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-red-500" />
                    Sygehistorik
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {absenceStats.sickAbsences.length > 0 ? (
                    <div className="space-y-2">
                      {absenceStats.sickAbsences.slice(0, 10).map((absence) => (
                        <div key={absence.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                          <span className="text-sm">
                            {formatDate(absence.start_date)}
                            {absence.start_date !== absence.end_date && ` - ${formatDate(absence.end_date)}`}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {Math.ceil((new Date(absence.end_date).getTime() - new Date(absence.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1} dag(e)
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Ingen sygeperioder i valgt periode</p>
                  )}
                </CardContent>
              </Card>

              {/* Lateness history */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlarmClock className="h-4 w-4 text-orange-500" />
                    Forsinkelseshistorik
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {latenessStats.records.length > 0 ? (
                    <div className="space-y-2">
                      {latenessStats.records.map((record) => (
                        <div key={record.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                          <span className="text-sm">{formatDate(record.date)}</span>
                          <div className="text-right">
                            <span className="text-sm font-medium">{record.minutes} min</span>
                            {record.note && (
                              <p className="text-xs text-muted-foreground">{record.note}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Ingen forsinkelser i valgt periode</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
