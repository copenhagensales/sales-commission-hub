import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { LifeBuoy, CalendarClock, CheckCircle2, Users } from "lucide-react";
import {
  RAMP_FLAG_ACTION_TYPES,
  useCanViewRampRiskFlags,
  useCloseRampFlag,
  useLogRampFlagAction,
  useRampRiskFlags,
  useRampRiskSettings,
  type RampFlagActionType,
} from "@/hooks/useRampRiskFlags";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function RampRiskFlags() {
  const { data: canView, isLoading: accessLoading } = useCanViewRampRiskFlags();
  const { data: settings } = useRampRiskSettings();
  const { data: flags = [], isLoading } = useRampRiskFlags();
  const logAction = useLogRampFlagAction();
  const closeFlag = useCloseRampFlag();
  const [selected, setSelected] = useState<Record<string, RampFlagActionType | undefined>>({});

  if (accessLoading) {
    return <div className="text-muted-foreground py-8 text-center">Indlæser…</div>;
  }

  if (!canView) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Denne side er kun for teamledere, assisterende teamledere og ledelsen.
          </p>
        </CardContent>
      </Card>
    );
  }

  const riskFactor = settings?.risk_factor ?? 3;
  const basisSellers = settings?.basis_sellers ?? 34;
  const basisLeavers = settings?.basis_leavers ?? 11;
  const basisLabel = settings?.basis_campaign_label ?? "Eesy TM";

  return (
    <div className="space-y-6">
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5" />
            Nye sælgere der har brug for en hånd
          </CardTitle>
          <CardDescription className="text-foreground">
            Sælgere i denne liste har ca. {riskFactor} gange større risiko for at stoppe inden dag 40
            end de øvrige nye. Baseret på {basisSellers} sælgere og {basisLeavers} afgange på{" "}
            {basisLabel}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Det er en samtale der mangler — ikke en vurdering af sælgeren. Tag fat i dem, registrér
            hvad du gjorde, og luk flaget når det er håndteret. Vi følger, hvor hurtigt der bliver
            taget hånd om listen.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-muted-foreground py-8 text-center">Indlæser listen…</div>
      ) : flags.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Ingen åbne flag lige nu. Dine nye sælgere følger det forventede spor.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {flags.map((flag) => {
            const chosen = selected[flag.id];
            return (
              <Card key={flag.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{flag.employee_name}</CardTitle>
                      <CardDescription>
                        {flag.campaign_name ?? "Ukendt kampagne"} · dag {flag.day_no}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Åbent i {flag.days_open} {flag.days_open === 1 ? "dag" : "dage"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Egne salg</p>
                      <p className="text-2xl font-semibold">{flag.cum_sales}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Typisk spænd på dag {flag.day_no}</p>
                      <p className="text-2xl font-semibold">
                        {Math.round(Number(flag.threshold_value))}
                        {flag.typical_upper != null
                          ? `–${Math.round(Number(flag.typical_upper))}`
                          : ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Flag oprettet</p>
                      <p className="text-2xl font-semibold">{formatDate(flag.created_at)}</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      Registrerede handlinger
                    </p>
                    {flag.actions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Ingen handlinger registreret endnu.</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {flag.actions.map((action, index) => (
                          <li key={`${flag.id}-${index}`} className="flex flex-wrap gap-x-2">
                            <span className="font-medium">{action.action_type}</span>
                            <span className="text-muted-foreground">
                              · {action.performed_by_name ?? "Ukendt"} ·{" "}
                              {formatDate(action.performed_at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={chosen}
                      onValueChange={(value) =>
                        setSelected((prev) => ({ ...prev, [flag.id]: value as RampFlagActionType }))
                      }
                    >
                      <SelectTrigger className="w-full sm:w-64">
                        <SelectValue placeholder="Vælg handling" />
                      </SelectTrigger>
                      <SelectContent>
                        {RAMP_FLAG_ACTION_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      disabled={!chosen || logAction.isPending}
                      onClick={() => {
                        if (!chosen) return;
                        logAction.mutate(
                          { flagId: flag.id, actionType: chosen },
                          {
                            onSuccess: () =>
                              setSelected((prev) => ({ ...prev, [flag.id]: undefined })),
                          },
                        );
                      }}
                    >
                      Registrér handling
                    </Button>
                    <Button
                      variant="outline"
                      disabled={closeFlag.isPending}
                      onClick={() => closeFlag.mutate(flag.id)}
                    >
                      Luk flag
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
