import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Phone, Users, Calendar, ArrowUp, ArrowRight, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingProgressionColumnProps {
  currentWeek: number;
  // Activity metrics (leading indicators)
  callsPerWeek?: number;
  conversationsPerWeek?: number;
  meetingsBookedPerWeek?: number;
  // Quality/conversion
  callToMeetingRate?: number;
  meetingToOrderRate?: number;
  // Results
  monthlyRevenue?: number;
  rampTarget?: number;
}

export function OnboardingProgressionColumn({
  currentWeek,
  callsPerWeek = 0,
  conversationsPerWeek = 0,
  meetingsBookedPerWeek = 0,
  callToMeetingRate = 0,
  meetingToOrderRate = 0,
  monthlyRevenue = 0,
  rampTarget = 35000,
}: OnboardingProgressionColumnProps) {
  // Determine status based on revenue vs ramp target
  const progressPercentage = Math.min((monthlyRevenue / rampTarget) * 100, 100);
  const status = progressPercentage >= 100 ? "ahead" : progressPercentage >= 70 ? "on_track" : "needs_focus";
  
  const statusLabels = {
    ahead: { label: "Foran kurven", color: "bg-green-500", textColor: "text-green-600 dark:text-green-400" },
    on_track: { label: "På kurven", color: "bg-primary", textColor: "text-primary" },
    needs_focus: { label: "Kræver fokus (helt normalt)", color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400" },
  };

  const currentStatus = statusLabels[status];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Min Progression
        </CardTitle>
        <p className="text-sm text-muted-foreground">Det vigtigste lige nu</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Activity - Leading Indicators */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">Aktivitet</Badge>
            <span className="text-xs text-muted-foreground">Din "5 km-tid i dag" – det du selv kontrollerer</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MetricBox 
              icon={<Phone className="h-3.5 w-3.5" />}
              label="Kald/uge"
              value={callsPerWeek}
              trend={5}
            />
            <MetricBox 
              icon={<Users className="h-3.5 w-3.5" />}
              label="Samtaler"
              value={conversationsPerWeek}
              trend={2}
            />
            <MetricBox 
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Møder"
              value={meetingsBookedPerWeek}
              trend={1}
            />
          </div>
        </div>

        {/* Quality / Conversion */}
        <div className="space-y-3">
          <Badge variant="outline" className="text-xs">Kvalitet / konvertering</Badge>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground mb-1">Kald → møde</p>
              <div className="flex items-center justify-center gap-1">
                <span className="text-xl font-bold">{callToMeetingRate}%</span>
                {callToMeetingRate > 0 && <ArrowUp className="h-4 w-4 text-green-500" />}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground mb-1">Møde → ordre</p>
              <div className="flex items-center justify-center gap-1">
                <span className="text-xl font-bold">{meetingToOrderRate}%</span>
                {meetingToOrderRate > 0 && <ArrowUp className="h-4 w-4 text-green-500" />}
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-3">
          <Badge variant="outline" className="text-xs">Resultat</Badge>
          <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">Månedlig omsætning</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{monthlyRevenue.toLocaleString("da-DK")}</span>
              <span className="text-sm text-muted-foreground">kr</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Ramp-mål: {rampTarget.toLocaleString("da-DK")} kr</span>
            </div>
            <div className="mt-3">
              <Badge className={cn(currentStatus.color, "text-white")}>
                {currentStatus.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Bottom message */}
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground italic text-center">
            I onboarding vægter aktivitet og læring højere end omsætning.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricBoxProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  trend?: number;
}

function MetricBox({ icon, label, value, trend }: MetricBoxProps) {
  return (
    <div className="p-2 rounded-lg bg-muted/30 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-center justify-center gap-1">
        <span className="text-lg font-bold">{value}</span>
        {trend && trend > 0 && (
          <ArrowUp className="h-3 w-3 text-green-500" />
        )}
      </div>
    </div>
  );
}
