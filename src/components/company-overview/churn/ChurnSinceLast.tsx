import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowDownRight, ArrowUpRight, Plus } from "lucide-react";
import { buildSignals, fmtPct, fmtPp, type ChurnSettings, type DerivedGroup } from "@/lib/churn/metrics";

interface Props {
  teams: DerivedGroup[];
  settings: ChurnSettings;
  onCreateAction?: (teamKey: string) => void;
}

/** UI-04: maks. 3 negative og 2 positive materielle signaler. */
export function ChurnSinceLast({ teams, settings, onCreateAction }: Props) {
  const { negative, positive } = buildSignals(teams, settings);
  const none = negative.length === 0 && positive.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Siden sidst</CardTitle>
        <CardDescription>
          Seneste tre modne startmåneder mod de foregående tre. Kun teams med mindst {settings.minimum_n} startere i
          begge perioder vurderes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {none && (
          <p className="text-sm text-muted-foreground">
            Ingen materielle ændringer på tilstrækkeligt datagrundlag siden sidste periode.
          </p>
        )}

        {negative.map((s) => (
          <div key={`neg-${s.team}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <ArrowUpRight className="h-4 w-4 text-red-500" aria-hidden />
            <span className="font-semibold">{s.team}</span>
            <Badge variant="outline" className="border-red-500/30 text-red-500">
              Forværret {fmtPp(s.deltaPp)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Seneste {fmtPct(s.recent.rate)} · {s.recent.x}/{s.recent.n} — foregående {fmtPct(s.previous.rate)} ·{" "}
              {s.previous.x}/{s.previous.n}
            </span>
            <span className="text-xs text-muted-foreground">
              ≈ {Math.round(s.peopleImpact)} flere exits · {s.multipleCohorts ? "set i flere kohorter" : "kun én kohorte"}
            </span>
            {onCreateAction && (
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => onCreateAction(s.team)}>
                <Plus className="h-3 w-3 mr-1" /> Opret handling
              </Button>
            )}
          </div>
        ))}

        {positive.map((s) => (
          <div
            key={`pos-${s.team}`}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3"
          >
            <ArrowDownRight className="h-4 w-4 text-emerald-500" aria-hidden />
            <span className="font-semibold">{s.team}</span>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">
              Forbedret {fmtPp(s.deltaPp)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Seneste {fmtPct(s.recent.rate)} · {s.recent.x}/{s.recent.n} — foregående {fmtPct(s.previous.rate)} ·{" "}
              {s.previous.x}/{s.previous.n}
            </span>
            <span className="text-xs text-muted-foreground">
              ≈ {Math.abs(Math.round(s.peopleImpact))} undgåede exits ·{" "}
              {s.multipleCohorts ? "set i flere kohorter" : "kun én kohorte"}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
