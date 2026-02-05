import { formatCurrency } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";

interface TeamDB {
  teamId: string;
  teamName: string;
  leaderId: string | null;
  leaderName: string;
  assistantId: string | null;
  assistantName: string;
  revenue: number;
  sellerSalaryCosts: number;
  leaderSalary: number;
  assistantSalary: number;
  expenses: number;
  db: number;
  percentageRate: number;
  minimumSalary: number;
}

interface DBTeamDetailCardProps {
  team: TeamDB;
  onClose: () => void;
}

export function DBTeamDetailCard({ team, onClose }: DBTeamDetailCardProps) {
  // formatCurrency imported from @/lib/calculations

  // Calculate if leader uses minimum salary
  const dbBeforeLeader = team.revenue - team.sellerSalaryCosts - team.expenses;
  const calculatedLeaderSalary = dbBeforeLeader * (team.percentageRate / 100);
  const usesMinimum = team.leaderSalary === team.minimumSalary && calculatedLeaderSalary < team.minimumSalary;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Team: {team.teamName} - Detaljeret DB</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Teamleder</p>
            <p className="font-medium">{team.leaderName}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Assistent</p>
            <p className="font-medium">{team.assistantName}</p>
          </div>
        </div>

        <Separator />

        {/* Revenue and costs breakdown */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground">Omsætning & Omkostninger</h4>
          <div className="flex justify-between">
            <span>Omsætning (salg fra kunder)</span>
            <span className="font-medium">{formatCurrency(team.revenue)}</span>
          </div>
          <div className="flex justify-between text-destructive">
            <span>Sælgerløn (provision)</span>
            <span>-{formatCurrency(team.sellerSalaryCosts)}</span>
          </div>
          <div className="flex justify-between text-destructive">
            <span>Team-udgifter</span>
            <span>-{formatCurrency(team.expenses)}</span>
          </div>
        </div>

        <Separator />

        {/* Salary breakdown */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground">Lønninger</h4>
          
          {/* Leader salary */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Teamleder: {team.leaderName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Beregnet løn: {formatCurrency(dbBeforeLeader)} × {team.percentageRate}%</span>
              <span>{formatCurrency(calculatedLeaderSalary)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Minimumsløn</span>
              <span>{formatCurrency(team.minimumSalary)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-medium">
              <span>Lederløn {usesMinimum && "(minimum)"}</span>
              <span className="text-destructive">-{formatCurrency(team.leaderSalary)}</span>
            </div>
          </div>

          {/* Assistant salary */}
          {team.assistantId && (
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex justify-between">
                <span>Assistentløn: {team.assistantName}</span>
                <span className="text-destructive font-medium">-{formatCurrency(team.assistantSalary)}</span>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Final DB */}
        <div className="bg-primary/10 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="font-medium text-lg">Dækningsbidrag (DB)</span>
            <span className="font-bold text-xl text-primary">{formatCurrency(team.db)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Omsætning − Sælgerløn − Lederløn − Assistentløn − Udgifter
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
