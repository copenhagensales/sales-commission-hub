import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format, differenceInMinutes } from "date-fns";
import { da } from "date-fns/locale";
import { Clock, User, Calendar, DollarSign, Timer, Coffee, AlertCircle } from "lucide-react";

interface TimeStampData {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  effective_clock_in: string | null;
  effective_clock_out: string | null;
  effective_hours: number | null;
  break_minutes: number | null;
  note: string | null;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  salary_type: string | null;
  salary_amount: number | null;
  standard_start_time: string | null;
}

interface ShiftDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  date: Date | null;
  timeStamp: TimeStampData | null;
}

export function ShiftDetailDialog({
  open,
  onOpenChange,
  employee,
  date,
  timeStamp,
}: ShiftDetailDialogProps) {
  if (!employee || !date) return null;

  const clockedIn = timeStamp ? new Date(timeStamp.clock_in) : null;
  const clockedOut = timeStamp?.clock_out ? new Date(timeStamp.clock_out) : null;
  
  // Calculate duration if clocked in
  const durationMinutes = clockedIn 
    ? differenceInMinutes(clockedOut || new Date(), clockedIn)
    : 0;
  const durationHours = Math.floor(durationMinutes / 60);
  const durationMins = durationMinutes % 60;

  // Check if clocked out by system (has effective_clock_out but no clock_out)
  const clockedOutBySystem = timeStamp && !timeStamp.clock_out && timeStamp.effective_clock_out;

  // Calculate salary estimate
  const getSalaryEstimate = () => {
    if (!employee.salary_type || !employee.salary_amount) return null;
    
    if (employee.salary_type === "Timeløn") {
      const hours = timeStamp?.effective_hours || (durationMinutes - (timeStamp?.break_minutes || 0)) / 60;
      return {
        type: "hourly",
        hourlyRate: employee.salary_amount,
        estimatedPay: Math.round(hours * employee.salary_amount),
        hours: hours.toFixed(2),
      };
    } else if (employee.salary_type === "Månedsløn") {
      return {
        type: "monthly",
        monthlyRate: employee.salary_amount,
        estimatedPay: null,
      };
    }
    return null;
  };

  const salaryInfo = getSalaryEstimate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Vagtdetaljer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Employee Info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
              {employee.first_name?.charAt(0)}{employee.last_name?.charAt(0)}
            </div>
            <div>
              <p className="font-medium">{employee.first_name} {employee.last_name}</p>
              {employee.department && (
                <p className="text-sm text-muted-foreground">{employee.department}</p>
              )}
            </div>
          </div>

          {/* Date */}
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{format(date, "EEEE d. MMMM yyyy", { locale: da })}</span>
          </div>

          {/* Time Stamps */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tidsregistrering
            </h4>
            
            {timeStamp ? (
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Stemplet ind</p>
                    <p className="font-medium">{format(clockedIn!, "HH:mm")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Stemplet ud</p>
                    {clockedOut ? (
                      <p className="font-medium">{format(clockedOut, "HH:mm")}</p>
                    ) : clockedOutBySystem ? (
                      <div className="flex items-center gap-1">
                        <p className="font-medium text-orange-600">
                          {format(new Date(timeStamp.effective_clock_out!), "HH:mm")}
                        </p>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-orange-100 text-orange-700 border-orange-300">
                          Auto
                        </Badge>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Aktiv</Badge>
                    )}
                  </div>
                </div>

                {clockedOutBySystem && (
                  <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 rounded px-2 py-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Automatisk udstemplet af systemet
                  </div>
                )}

                {/* Effective times if different */}
                {timeStamp.effective_clock_in && timeStamp.effective_clock_out && (
                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs text-muted-foreground mb-1">Effektiv tid</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Fra</p>
                        <p className="font-medium">{format(new Date(timeStamp.effective_clock_in), "HH:mm")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Til</p>
                        <p className="font-medium">{format(new Date(timeStamp.effective_clock_out), "HH:mm")}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground text-center">
                Ingen tidsregistrering for denne dag
              </div>
            )}
          </div>

          {/* Duration & Break */}
          {timeStamp && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Timer className="h-4 w-4" />
                  <span className="text-xs">Varighed</span>
                </div>
                <p className="font-semibold">
                  {clockedOut || clockedOutBySystem 
                    ? `${durationHours}t ${durationMins}m`
                    : "Igangværende"
                  }
                </p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Coffee className="h-4 w-4" />
                  <span className="text-xs">Pause</span>
                </div>
                <p className="font-semibold">{timeStamp.break_minutes || 0} min</p>
              </div>
            </div>
          )}

          {/* Effective Hours */}
          {timeStamp?.effective_hours && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Effektive timer</p>
              <p className="text-xl font-bold text-primary">{timeStamp.effective_hours.toFixed(2)} timer</p>
            </div>
          )}

          {/* Salary Info */}
          {salaryInfo && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Lønoplysninger
              </h4>
              <div className="bg-muted/30 rounded-lg p-3">
                {salaryInfo.type === "hourly" ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Timeløn</span>
                      <span>{salaryInfo.hourlyRate} kr/time</span>
                    </div>
                    {timeStamp && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Timer</span>
                          <span>{salaryInfo.hours} timer</span>
                        </div>
                        <div className="border-t pt-1 mt-1 flex justify-between font-medium">
                          <span>Estimeret løn</span>
                          <span className="text-primary">{salaryInfo.estimatedPay} kr</span>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Månedsløn</span>
                    <span>{salaryInfo.monthlyRate?.toLocaleString("da-DK")} kr/måned</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Note */}
          {timeStamp?.note && (
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Note</p>
              <p className="text-sm">{timeStamp.note}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
