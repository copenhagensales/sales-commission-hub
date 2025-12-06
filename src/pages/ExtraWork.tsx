import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Clock, Calendar, Timer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO, startOfDay, addDays, subDays } from "date-fns";
import { da } from "date-fns/locale";
import { AddExtraWorkDialog } from "@/components/extra-work/AddExtraWorkDialog";
import { ExtraWorkHistory } from "@/components/extra-work/ExtraWorkHistory";
import { useMyExtraWork } from "@/hooks/useExtraWork";

interface Shift {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  planned_hours: number;
  status: string;
}

export default function ExtraWork() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  // Get employee's shifts (recent and upcoming)
  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ["my-shifts-for-extra-work", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];

      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id")
        .eq("private_email", user.email)
        .maybeSingle();

      if (!employee) return [];

      const today = format(new Date(), "yyyy-MM-dd");
      const sevenDaysAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");
      const sevenDaysAhead = format(addDays(new Date(), 7), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("shift")
        .select("*")
        .eq("employee_id", employee.id)
        .gte("date", sevenDaysAgo)
        .lte("date", sevenDaysAhead)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data as Shift[];
    },
    enabled: !!user?.email,
  });

  // Get extra work for calculation
  const { data: myExtraWork } = useMyExtraWork();

  const handleAddExtraWork = (shift?: Shift) => {
    setSelectedShift(shift || null);
    setDialogOpen(true);
  };

  // Calculate totals
  const calculateDayTotals = (date: string) => {
    const dayShifts = shifts?.filter((s) => s.date === date) || [];
    const dayExtraWork = myExtraWork?.filter((e) => e.date === date && e.status === "approved") || [];
    
    const plannedHours = dayShifts.reduce((sum, s) => sum + (s.planned_hours || 0), 0);
    const extraHours = dayExtraWork.reduce((sum, e) => sum + Number(e.hours), 0);
    
    return {
      plannedHours,
      extraHours,
      totalHours: plannedHours + extraHours,
    };
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ekstra arbejde</h1>
            <p className="text-muted-foreground">
              Registrer ekstra arbejdstimer ud over dine planlagte vagter
            </p>
          </div>
          <Button onClick={() => handleAddExtraWork()}>
            <Plus className="h-4 w-4 mr-2" />
            Tilføj ekstra arbejde
          </Button>
        </div>

        {/* Shifts with extra work buttons */}
        <Card>
          <CardHeader>
            <CardTitle>Mine vagter</CardTitle>
          </CardHeader>
          <CardContent>
            {shiftsLoading ? (
              <div className="animate-pulse text-muted-foreground">Indlæser vagter...</div>
            ) : !shifts || shifts.length === 0 ? (
              <p className="text-muted-foreground">Ingen vagter fundet for de seneste/kommende dage.</p>
            ) : (
              <div className="space-y-3">
                {shifts.map((shift) => {
                  const totals = calculateDayTotals(shift.date);
                  const isToday = shift.date === format(new Date(), "yyyy-MM-dd");
                  const isPast = parseISO(shift.date) < startOfDay(new Date());

                  return (
                    <div
                      key={shift.id}
                      className={`p-4 rounded-lg border ${
                        isToday ? "border-primary bg-primary/5" : "bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {format(parseISO(shift.date), "EEEE d. MMMM", { locale: da })}
                              {isToday && (
                                <span className="ml-2 text-xs text-primary">(i dag)</span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>
                                {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Timer className="h-4 w-4" />
                              <span>{shift.planned_hours?.toFixed(1) || "0"} timer planlagt</span>
                            </div>
                          </div>
                          {totals.extraHours > 0 && (
                            <div className="text-sm text-green-600">
                              + {totals.extraHours.toFixed(1)} timer ekstra (godkendt)
                              <span className="ml-2 font-medium">
                                = {totals.totalHours.toFixed(1)} timer i alt
                              </span>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddExtraWork(shift)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Tilføj ekstra arbejde
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Extra work history */}
        <ExtraWorkHistory />

        {/* Dialog */}
        <AddExtraWorkDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          shiftId={selectedShift?.id}
          defaultDate={selectedShift?.date}
          defaultFromTime={selectedShift?.end_time?.slice(0, 5)}
        />
      </div>
    </MainLayout>
  );
}
