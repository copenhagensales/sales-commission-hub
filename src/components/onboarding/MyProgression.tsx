import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useWeekExpectations } from "@/hooks/useWeekExpectations";
import { Phone, Target, TrendingUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MyProgressionProps {
  currentWeek: number;
  activityCount?: number;
  balaScore?: number;
  revenue?: number;
}

export function MyProgression({ 
  currentWeek, 
  activityCount = 0, 
  balaScore = 0, 
  revenue = 0 
}: MyProgressionProps) {
  const { data: weeks = [] } = useWeekExpectations();
  
  const weekData = weeks.find(w => w.week_number === currentWeek);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Min Progression
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Three metrics side by side */}
        <div className="grid grid-cols-3 gap-4">
          <MetricCard
            icon={<Phone className="h-4 w-4" />}
            label="Aktivitet"
            value={activityCount}
            suffix="opkald"
            color="blue"
          />
          <MetricCard
            icon={<Target className="h-4 w-4" />}
            label="BALA-score"
            value={balaScore}
            suffix="%"
            color="green"
          />
          <MetricCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Omsætning"
            value={revenue.toLocaleString("da-DK")}
            suffix="kr"
            color="amber"
          />
        </div>
        
        {/* Week-based context text */}
        {weekData && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
            <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              {weekData.progression_text}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  suffix: string;
  color: "blue" | "green" | "amber";
}

function MetricCard({ icon, label, value, suffix, color }: MetricCardProps) {
  const colorClasses = {
    blue: "text-blue-500",
    green: "text-green-500",
    amber: "text-amber-500",
  };
  
  return (
    <div className="text-center p-3 rounded-lg bg-muted/30">
      <div className={cn("flex items-center justify-center gap-1 mb-1", colorClasses[color])}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{suffix}</p>
    </div>
  );
}
