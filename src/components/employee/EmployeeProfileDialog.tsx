import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ReadOnlyRow, ReadOnlyContactRow, ReadOnlyDateRow, ReadOnlyTableSection } from "./ReadOnlyRow";

interface EmployeeProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
}

export function EmployeeProfileDialog({ open, onOpenChange, employeeId }: EmployeeProfileDialogProps) {
  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee-profile-dialog", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("*")
        .eq("id", employeeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && open,
  });

  const { data: manager } = useQuery({
    queryKey: ["employee-profile-manager", employee?.manager_id],
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
    enabled: !!employee?.manager_id && open,
  });

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
      case "vacation_pay": return "Feriepenge";
      case "vacation_bonus": return "Ferie med løn";
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="grid gap-4 md:grid-cols-2 mt-6">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          </div>
        ) : employee ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {employee.first_name} {employee.last_name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                {employee.job_title && (
                  <span className="text-muted-foreground">{employee.job_title}</span>
                )}
                <Badge variant={employee.is_active ? "default" : "secondary"}>
                  {employee.is_active ? "Aktiv" : "Inaktiv"}
                </Badge>
              </div>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2 mt-4">
              {/* Left column */}
              <div className="space-y-4">
                <ReadOnlyTableSection title="Identitet">
                  <ReadOnlyRow label="Fornavn(e)" value={employee.first_name} />
                  <ReadOnlyRow label="Efternavn" value={employee.last_name} />
                  <ReadOnlyRow label="CPR-nr." value={employee.cpr_number} />
                </ReadOnlyTableSection>

                <ReadOnlyTableSection title="Kontakt">
                  <ReadOnlyContactRow label="Telefon" value={employee.private_phone} type="phone" />
                  <ReadOnlyContactRow label="Privat email" value={employee.private_email} type="email" />
                  <ReadOnlyContactRow label="Arbejdsemail" value={employee.work_email} type="email" />
                </ReadOnlyTableSection>

                <ReadOnlyTableSection title="Adresse">
                  <ReadOnlyRow label="Vejnavn og nr." value={employee.address_street} />
                  <ReadOnlyRow label="Postnummer" value={employee.address_postal_code} />
                  <ReadOnlyRow label="By" value={employee.address_city} />
                  <ReadOnlyRow label="Land" value={employee.address_country} />
                </ReadOnlyTableSection>
              </div>

              {/* Right column */}
              <div className="space-y-4">
                <ReadOnlyTableSection title="Stilling">
                  <ReadOnlyRow label="Jobtitel" value={employee.job_title} />
                  <ReadOnlyRow label="Arbejdssted" value={employee.work_location} />
                  <ReadOnlyRow 
                    label="Leder" 
                    value={manager ? `${manager.first_name} ${manager.last_name}` : null} 
                  />
                </ReadOnlyTableSection>

                <ReadOnlyTableSection title="Ansættelse">
                  <ReadOnlyDateRow label="Startdato" value={employee.employment_start_date} />
                  <ReadOnlyDateRow label="Slutdato" value={employee.employment_end_date} />
                  <ReadOnlyRow 
                    label="Timer/uge" 
                    value={employee.weekly_hours} 
                    displayValue={employee.weekly_hours ? `${employee.weekly_hours} timer` : null}
                  />
                  <ReadOnlyRow label="Mødetid" value={employee.standard_start_time} />
                </ReadOnlyTableSection>

                <ReadOnlyTableSection title="Løn">
                  <ReadOnlyRow 
                    label="Løntype" 
                    value={employee.salary_type}
                    displayValue={getSalaryTypeLabel(employee.salary_type)}
                  />
                  {(employee.salary_type === "fixed" || employee.salary_type === "hourly") && (
                    <ReadOnlyRow 
                      label="Beløb" 
                      value={employee.salary_amount}
                      displayValue={employee.salary_amount ? `${employee.salary_amount.toLocaleString("da-DK")} DKK` : null}
                    />
                  )}
                </ReadOnlyTableSection>

                <ReadOnlyTableSection title="Ferie & tillæg">
                  <ReadOnlyRow 
                    label="Ferietype" 
                    value={employee.vacation_type}
                    displayValue={getVacationTypeLabel(employee.vacation_type)}
                  />
                  {employee.vacation_type === "vacation_bonus" && (
                    <ReadOnlyRow 
                      label="Feriebonus %" 
                      value={employee.vacation_bonus_percent}
                      displayValue={employee.vacation_bonus_percent ? `${employee.vacation_bonus_percent}%` : null}
                    />
                  )}
                  <ReadOnlyRow 
                    label="Parkering/md" 
                    value={employee.parking_monthly_cost}
                    displayValue={employee.parking_monthly_cost ? `${employee.parking_monthly_cost.toLocaleString("da-DK")} DKK` : null}
                  />
                  <ReadOnlyRow 
                    label="Henvisningsbonus" 
                    value={employee.referral_bonus}
                    displayValue={employee.referral_bonus ? `${employee.referral_bonus.toLocaleString("da-DK")} DKK` : null}
                  />
                  <ReadOnlyRow 
                    label="Regulering/md" 
                    value={employee.salary_deduction}
                    displayValue={employee.salary_deduction ? `${employee.salary_deduction.toLocaleString("da-DK")} DKK` : null}
                  />
                </ReadOnlyTableSection>
              </div>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Medarbejder ikke fundet
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
