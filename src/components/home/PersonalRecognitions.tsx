import { Star, Award, Zap, CalendarDays, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { PersonalWeekStats } from "@/hooks/usePersonalWeeklyStats";

interface PersonalRecognitionsProps {
  currentWeek: PersonalWeekStats;
  lastWeek: PersonalWeekStats;
}

export function PersonalRecognitions({ currentWeek, lastWeek }: PersonalRecognitionsProps) {
  const formatCommission = (amount: number) => {
    return new Intl.NumberFormat("da-DK", { 
      style: "currency", 
      currency: "DKK", 
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const formatDayName = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    try {
      // Capitalize first letter
      const dayName = format(parseISO(dateStr), "EEEE", { locale: da });
      return dayName.charAt(0).toUpperCase() + dayName.slice(1);
    } catch {
      return dateStr;
    }
  };

  const StatCard = ({ 
    icon: Icon, 
    label, 
    value,
    subValue,
    iconColor,
  }: { 
    icon: React.ElementType; 
    label: string; 
    value: string;
    subValue?: string;
    iconColor: string;
  }) => (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
      <div className={`p-2 rounded-full ${iconColor}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="font-semibold text-sm">{value}</p>
        {subValue && (
          <p className="text-xs text-muted-foreground">{subValue}</p>
        )}
      </div>
    </div>
  );

  const WeekContent = ({ data, isCurrent }: { data: PersonalWeekStats; isCurrent: boolean }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <StatCard
        icon={isCurrent ? Zap : TrendingUp}
        label={isCurrent ? "Tjent denne uge" : "Tjent sidste uge"}
        value={data.weekTotal > 0 ? formatCommission(data.weekTotal) : "–"}
        iconColor={isCurrent 
          ? "bg-orange-100 dark:bg-orange-900/50 text-orange-600"
          : "bg-amber-100 dark:bg-amber-900/50 text-amber-600"
        }
      />
      <StatCard
        icon={isCurrent ? Sparkles : CalendarDays}
        label="Din bedste dag"
        value={data.bestDay ? formatDayName(data.bestDay.date) : "–"}
        subValue={data.bestDay ? formatCommission(data.bestDay.commission) : undefined}
        iconColor={isCurrent
          ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600"
          : "bg-blue-100 dark:bg-blue-900/50 text-blue-600"
        }
      />
    </div>
  );

  return (
    <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Star className="w-4 h-4 text-amber-500" />
          Din uge
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="current" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="current" className="text-xs">Denne uge</TabsTrigger>
            <TabsTrigger value="last" className="text-xs">Sidste uge</TabsTrigger>
          </TabsList>
          <TabsContent value="current" className="mt-0">
            <WeekContent data={currentWeek} isCurrent={true} />
          </TabsContent>
          <TabsContent value="last" className="mt-0">
            <WeekContent data={lastWeek} isCurrent={false} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
