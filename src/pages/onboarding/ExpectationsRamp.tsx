import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWeekExpectations } from "@/hooks/useWeekExpectations";
import { CheckCircle2, XCircle, Target, Lightbulb, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ExpectationsRamp() {
  const { data: weeks = [], isLoading } = useWeekExpectations();

  if (isLoading) {
    return <div className="text-muted-foreground py-8 text-center">Indlæser forventninger...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Intro Section */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-xl">Forventninger & Ramp</CardTitle>
          <CardDescription className="text-base text-foreground/80">
            De første 3 uger er onboarding. Det betyder, at vi måler dig på <strong>adfærd, læring og progression</strong> – ikke kun på kroner.
            <br />
            <span className="italic">Følger du processen og tager feedback, kommer resultaterne.</span>
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Week Cards */}
      <div className="space-y-6">
        {weeks.map((week) => (
          <WeekCard key={week.id} week={week} />
        ))}
      </div>
    </div>
  );
}

interface WeekCardProps {
  week: {
    week_number: number;
    title: string;
    color: string;
    measure_on: string[];
    do_not_measure_on: string[];
    good_day_definition: string;
    note: string | null;
    we_expect: string[];
    we_dont_expect: string[];
    good_week_criteria: string[];
  };
}

function WeekCard({ week }: WeekCardProps) {
  const weekEmoji = week.week_number === 1 ? "🟢" : week.week_number === 2 ? "🟡" : "🔵";
  
  return (
    <Card className="overflow-hidden">
      <CardHeader 
        className="border-b"
        style={{ backgroundColor: `${week.color}15` }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{weekEmoji}</span>
          <div>
            <CardTitle className="text-lg">{week.title}</CardTitle>
            <CardDescription>
              Fokus: {week.week_number === 1 ? "Tryghed + komme i gang" : 
                     week.week_number === 2 ? "Mere struktur + bedre kvalitet" : 
                     "Eje samtalen selv"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* What we expect */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Det forventer vi af dig
            </h4>
            <ul className="space-y-2">
              {week.we_expect.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          
          {/* What we don't expect */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-4 w-4" />
              Det forventer vi ikke
            </h4>
            <ul className="space-y-2">
              {week.we_dont_expect.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-muted-foreground mt-0.5">–</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        {/* Good week criteria */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="font-semibold flex items-center gap-2" style={{ color: week.color }}>
            <Target className="h-4 w-4" />
            En god uge {week.week_number} er, når
          </h4>
          <ul className="space-y-2">
            {week.good_week_criteria.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <span style={{ color: week.color }}>•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        
        {/* Note */}
        {week.note && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Vigtigt</p>
              <p className="text-sm text-muted-foreground">{week.note}</p>
            </div>
          </div>
        )}
        
        {/* Measure badges */}
        <div className="flex flex-wrap gap-2 pt-2">
          {week.measure_on.map((tag, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
