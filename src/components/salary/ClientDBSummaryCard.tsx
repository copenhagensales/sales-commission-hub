import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronRight, Users, Briefcase, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/calculations/formatting";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface StaffSalaryItem {
  employeeId: string;
  name: string;
  jobTitle: string | null;
  workedHours: number;
  totalSalary: number;
  isHourlyBased: boolean;
}

interface ClientDBSummaryCardProps {
  teamDB: number;
  stabExpenses: number;
  staffSalaries: number;
  netEarnings: number;
  staffSalaryList?: StaffSalaryItem[];
}

export function ClientDBSummaryCard({
  teamDB,
  stabExpenses,
  staffSalaries,
  netEarnings,
  staffSalaryList = [],
}: ClientDBSummaryCardProps) {
  const [isStaffExpanded, setIsStaffExpanded] = useState(false);
  const netPercent = teamDB > 0 ? ((netEarnings / teamDB) * 100).toFixed(1) : "0";

  return (
    <Card className="mt-4 border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          Samlet Oversigt
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Team DB */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Team DB</span>
          <span className={cn(
            "font-semibold tabular-nums",
            teamDB >= 0 ? "text-primary" : "text-destructive"
          )}>
            {formatCurrency(teamDB)}
          </span>
        </div>

        {/* Deductions */}
        <div className="space-y-2 pl-4 border-l-2 border-destructive/30">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">− Stab-udgifter</span>
            <span className="text-destructive tabular-nums">
              -{formatCurrency(stabExpenses)}
            </span>
          </div>
          
          {/* Staff salaries with expandable list */}
          <Collapsible open={isStaffExpanded} onOpenChange={setIsStaffExpanded}>
            <div className="flex justify-between items-center text-sm">
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-auto p-0 text-muted-foreground hover:text-foreground -ml-1"
                >
                  {isStaffExpanded ? (
                    <ChevronDown className="h-3 w-3 mr-1" />
                  ) : (
                    <ChevronRight className="h-3 w-3 mr-1" />
                  )}
                  <Users className="h-3 w-3 mr-1" />
                  Stabslønninger
                </Button>
              </CollapsibleTrigger>
              <span className="text-destructive tabular-nums">
                -{formatCurrency(staffSalaries)}
              </span>
            </div>

            <CollapsibleContent className="mt-2">
              <div className="bg-muted/50 rounded-md p-2 space-y-1.5">
                {staffSalaryList.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Ingen stabslønninger</p>
                ) : (
                  staffSalaryList.map((staff) => (
                    <div 
                      key={staff.employeeId} 
                      className="flex justify-between items-center text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{staff.name}</span>
                        {staff.jobTitle && (
                          <span className="text-muted-foreground">({staff.jobTitle})</span>
                        )}
                        {staff.isHourlyBased && (
                          <span className="flex items-center gap-0.5 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {staff.workedHours.toFixed(1)}t
                          </span>
                        )}
                      </div>
                      <span className="text-destructive tabular-nums">
                        -{formatCurrency(staff.totalSalary)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <Separator className="my-3" />

        {/* Net earnings */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-semibold">NETTO</span>
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded",
              netEarnings >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            )}>
              {netEarnings >= 0 ? "+" : ""}{netPercent}%
            </span>
          </div>
          <span className={cn(
            "text-xl font-bold tabular-nums",
            netEarnings >= 0 ? "text-primary" : "text-destructive"
          )}>
            {formatCurrency(netEarnings)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
