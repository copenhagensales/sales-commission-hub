import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";

interface TeamDB {
  teamId: string;
  teamName: string;
  leaderId: string | null;
  leaderName: string;
  revenue: number;
  salaryCosts: number;
  expenses: number;
  db: number;
  leaderSalary: number;
  percentageRate: number;
  minimumSalary: number;
}

interface DBTeamDetailCardProps {
  team: TeamDB;
  onClose: () => void;
}

export function DBTeamDetailCard({ team, onClose }: DBTeamDetailCardProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(amount);

  const calculatedSalary = team.db * (team.percentageRate / 100);
  const usesMinimum = team.leaderSalary === team.minimumSalary && calculatedSalary < team.minimumSalary;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Team: {team.teamName} - Detaljeret DB</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Teamleder:</span> {team.leaderName}
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Omsætning (salg fra kunder)</span>
            <span className="font-medium">{formatCurrency(team.revenue)}</span>
          </div>
          <div className="flex justify-between text-destructive">
            <span>Lønomkostninger (team-provision)</span>
            <span>-{formatCurrency(team.salaryCosts)}</span>
          </div>
          <div className="flex justify-between text-destructive">
            <span>Team-udgifter</span>
            <span>-{formatCurrency(team.expenses)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-medium">
            <span>Dækningsbidrag (DB)</span>
            <span>{formatCurrency(team.db)}</span>
          </div>
        </div>

        <Separator />

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Beregnet løn: {formatCurrency(team.db)} × {team.percentageRate}%</span>
            <span>{formatCurrency(calculatedSalary)}</span>
          </div>
          <div className="flex justify-between">
            <span>Minimumsløn</span>
            <span>{formatCurrency(team.minimumSalary)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-medium text-base">
            <span>UDBETALING {usesMinimum && "(minimum)"}</span>
            <span className="text-primary">{formatCurrency(team.leaderSalary)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
