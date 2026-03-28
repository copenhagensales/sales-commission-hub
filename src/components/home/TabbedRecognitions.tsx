import { Star, Award, Zap, CalendarDays, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";

interface RecognitionPerson {
  name: string;
  commission: number;
  team: string | null;
  date?: string;
}

interface WeekRecognition {
  topWeekly: RecognitionPerson | null;
  bestDay: RecognitionPerson | null;
}

interface TabbedRecognitionsProps {
  currentWeek: WeekRecognition;
  lastWeek: WeekRecognition;
}

export function TabbedRecognitions({ currentWeek, lastWeek }: TabbedRecognitionsProps) {
  const formatCommission = (amount: number) => {
    return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(amount);
  };

  const formatShortName = (fullName: string | null | undefined) => {
    if (!fullName) return "Ukendt";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${firstName} ${lastInitial}`;
  };

  const formatDateShort = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    try {
      return format(parseISO(dateStr), "EEEE", { locale: da });
    } catch {
      return dateStr;
    }
  };

  const RecognitionRow = ({ 
    icon: Icon, 
    label, 
    person, 
    iconColor,
    showDate = false
  }: { 
    icon: React.ElementType; 
    label: string; 
    person: RecognitionPerson | null;
    iconColor: string;
    showDate?: boolean;
  }) => (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
      <div className={`p-2 rounded-full ${iconColor}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-semibold text-sm truncate">
            {formatShortName(person?.name) || "Ingen data"}
          </p>
          {person?.team && (
            <Badge variant="secondary" className="text-[10px] px-1.5">{person.team}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {person ? (
            showDate && person.date 
              ? `${formatDateShort(person.date)} - ${formatCommission(person.commission)}`
              : formatCommission(person.commission)
          ) : "–"}
        </p>
      </div>
    </div>
  );

  const WeekContent = ({ data, isCurrent }: { data: WeekRecognition; isCurrent: boolean }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <RecognitionRow
        icon={isCurrent ? Zap : Award}
        label="Top medarbejder"
        person={data.topWeekly}
        iconColor={isCurrent 
          ? "bg-orange-100 dark:bg-orange-900/50 text-orange-600"
          : "bg-amber-100 dark:bg-amber-900/50 text-amber-600"
        }
      />
      <RecognitionRow
        icon={isCurrent ? Sparkles : CalendarDays}
        label="Bedste dag"
        person={data.bestDay}
        iconColor={isCurrent
          ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600"
          : "bg-blue-100 dark:bg-blue-900/50 text-blue-600"
        }
        showDate
      />
    </div>
  );

  return (
    <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Star className="w-4 h-4 text-amber-500" />
          Anerkendelser
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
