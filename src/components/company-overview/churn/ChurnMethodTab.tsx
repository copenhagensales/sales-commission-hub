import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { fmtMonth, fmtPct, rate, type ChurnMetricsPayload, type DerivedGroup } from "@/lib/churn/metrics";
import { useChurnSettings, useUpdateChurnSettings } from "@/hooks/useChurnDashboard";
import { HistoricalTenureStats } from "@/components/company-overview/HistoricalTenureStats";
import { NewHireChurnKpi } from "@/components/company-overview/NewHireChurnKpi";

interface Props {
  payload: ChurnMetricsPayload;
  teams: DerivedGroup[];
  canEdit: boolean;
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between border-b last:border-0 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function ChurnMethodTab({ payload, teams, canEdit }: Props) {
  const q = payload.quality;
  const hb = payload.headcount_bridge;
  const { data: settingsRow } = useChurnSettings();
  const update = useUpdateChurnSettings();
  const [target, setTarget] = useState<string>("");
  const [minN, setMinN] = useState<string>("");

  const teamStarters = teams.filter((t) => t.key !== "Øvrige / ukendt team").reduce((s, t) => s + t.starters, 0);
  const unknownStarters = teams.filter((t) => t.key === "Øvrige / ukendt team").reduce((s, t) => s + t.starters, 0);
  const teamExits = teams.filter((t) => t.key !== "Øvrige / ukendt team").reduce((s, t) => s + t.exits, 0);
  const unknownExits = teams.filter((t) => t.key === "Øvrige / ukendt team").reduce((s, t) => s + t.exits, 0);
  const leaderStarters = payload.leader_totals.reduce((s, l) => s + l.starters, 0);
  const leaderExits = payload.leader_totals.reduce((s, l) => s + l.exits, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Metode</CardTitle>
          <CardDescription>Definitioner bag de officielle tal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Ansættelsesforløb</strong> er analyseenheden. En genansættelse er et nyt
            forløb. Nuværende medarbejdere og historiske ansættelser samles i ét renset datagrundlag.
          </p>
          <p>
            <strong className="text-foreground">Moden kohorte:</strong> en startmåned indgår først, når månedens sidste
            dag plus {payload.settings.official_horizon_days} kalenderdage er nået. Den officielle KPI bruger de{" "}
            {payload.settings.official_month_count} seneste fuldt modne startmåneder — her{" "}
            {payload.mature_months.length} måneder ({fmtMonth(payload.mature_months[0])} til{" "}
            {fmtMonth(payload.latest_mature_month)}).
          </p>
          <p>
            <strong className="text-foreground">Dag 60:</strong> exit på dag 0 til og med dag 60 tæller i tælleren. Dag
            61 tæller ikke.
          </p>
          <p>
            <strong className="text-foreground">Vægtning:</strong> alle samlede rater er sum af exits divideret med sum
            af startere — aldrig gennemsnit af månedsprocenter.
          </p>
          <p>
            <strong className="text-foreground">Seneste 3 mod foregående 3:</strong> de tre seneste modne startmåneder
            mod de tre forudgående, vist i procentpoint.
          </p>
          <p>
            <strong className="text-foreground">Mål:</strong>{" "}
            {payload.settings.target_60d_rate === null
              ? "ikke sat — merfrafald og statusfarver er derfor neutrale."
              : fmtPct(payload.settings.target_60d_rate)}
            . <strong className="text-foreground">Små-n-regel:</strong> under {payload.settings.minimum_n} startere vises
            tal, men uden konklusion. <strong className="text-foreground">Merfrafald</strong> = faktiske exits minus
            startere × mål.
          </p>
          <p>
            Dataskæring: {payload.as_of_date} ({payload.timezone}, kilde: {payload.as_of_source}).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Indstillinger</CardTitle>
          <CardDescription>Mål og datagrundlagsgrænse styrer status, farver og konklusioner.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <Label htmlFor="target">Mål for 60-dages tidligt frafald (%)</Label>
            <Input
              id="target"
              type="number"
              step="0.1"
              placeholder={settingsRow?.target_60d_rate?.toString() ?? "Ikke sat"}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="minn">Minimum datagrundlag (n)</Label>
            <Input
              id="minn"
              type="number"
              placeholder={settingsRow?.minimum_n?.toString() ?? "15"}
              value={minN}
              onChange={(e) => setMinN(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <Button
            disabled={!canEdit || !settingsRow || (target === "" && minN === "")}
            onClick={() =>
              settingsRow &&
              update.mutate({
                id: settingsRow.id,
                ...(target !== "" ? { target_60d_rate: Number(target) } : {}),
                ...(minN !== "" ? { minimum_n: Number(minN) } : {}),
              })
            }
          >
            Gem indstillinger
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Afstemningsbridge</CardTitle>
            <CardDescription>Fra bruttopopulation til officiel KPI-population.</CardDescription>
          </CardHeader>
          <CardContent>
            <Row label="Alle ansættelsesrækker" value={q.total_rows} />
            <Row label="− Dubletter" value={-q.duplicates} />
            <Row label="− Manglende startdato" value={-q.missing_start_date} />
            <Row label="− Fremtidig startdato" value={-q.future_start} />
            <Row label="− Exit før start" value={-q.exit_before_start} />
            <Row label="− Uden for scope (stab)" value={-q.outside_scope} />
            <Row label="= Valide ansættelsesforløb" value={q.valid_spells_n} />
            <Row
              label="− Ikke 60-dages modne (uden for de valgte modne startmåneder)"
              value={-(q.valid_spells_n - payload.company.starters)}
            />
            <Row label="= 60-dages kvalificerede ansættelsesforløb" value={payload.company.starters} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Headcount-afstemning</CardTitle>
            <CardDescription>Forskellen mellem de headcount-begreber siden viser.</CardDescription>
          </CardHeader>
          <CardContent>
            <Row label="Alle aktive profiler" value={hb.all_active_profiles} />
            <Row label="− Kommende startere" value={-hb.upcoming_starters} />
            <Row label="− Stab / uden for scope" value={-hb.staff_out_of_scope} />
            <Row label="− Ukendt eller ugyldig dato" value={-hb.invalid_dates} />
            <Row label="= Officielt operationelt headcount" value={hb.official_headcount} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teamafstemning</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Sum af viste teams (startere)" value={teamStarters} />
            <Row label="Øvrige / ukendt team (startere)" value={unknownStarters} />
            <Row label="Total (startere)" value={payload.company.starters} />
            <Row label="Afvigelse (startere)" value={teamStarters + unknownStarters - payload.company.starters} />
            <Row label="Sum af viste teams (exits)" value={teamExits} />
            <Row label="Øvrige / ukendt team (exits)" value={unknownExits} />
            <Row label="Total (exits)" value={payload.company.exits} />
            <Row label="Afvigelse (exits)" value={teamExits + unknownExits - payload.company.exits} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lederafstemning</CardTitle>
            <CardDescription>Historisk lederdata mangler — alle forløb ligger under &quot;Ukendt leder&quot;.</CardDescription>
          </CardHeader>
          <CardContent>
            <Row label="Sum af ledere (startere)" value={leaderStarters} />
            <Row label="Total (startere)" value={payload.company.starters} />
            <Row label="Afvigelse (startere)" value={leaderStarters - payload.company.starters} />
            <Row label="Sum af ledere (exits)" value={leaderExits} />
            <Row label="Total (exits)" value={payload.company.exits} />
            <Row label="Afvigelse (exits)" value={leaderExits - payload.company.exits} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datakvalitet</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Dubletter" value={q.duplicates} />
            <Row label="Manglende startdato" value={q.missing_start_date} />
            <Row label="Fremtidige startere" value={q.future_start} />
            <Row label="Exit før start" value={q.exit_before_start} />
            <Row label="Ukendt team" value={q.unknown_team} />
            <Row label="Ukendt leder" value={q.unknown_leader} />
            <Row label="Ukendt stopårsag" value={q.unknown_exit_reason} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datakvalitetsprocenter</CardTitle>
          </CardHeader>
          <CardContent>
            <Row
              label="Andel med kendt team"
              value={fmtPct(rate(q.valid_spells_n - q.unknown_team, q.valid_spells_n))}
            />
            <Row
              label="Andel med kendt leder"
              value={fmtPct(rate(q.valid_spells_n - q.unknown_leader, q.valid_spells_n))}
            />
            <Row
              label="Andel med kendt stopårsag"
              value={fmtPct(rate(q.total_exits_all - q.unknown_exit_reason, q.total_exits_all))}
            />
            <Row label="Andel valide ansættelsesforløb" value={fmtPct(rate(q.valid_spells_n, q.total_rows))} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All-history-tal (ikke officiel KPI)</CardTitle>
          <CardDescription>
            Historiske visninger uden kohorte-afgrænsning. De må ikke bruges som headline-KPI eller teamstatus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            <AccordionItem value="all-history">
              <AccordionTrigger>Vis historiske opgørelser</AccordionTrigger>
              <AccordionContent className="space-y-6">
                <HistoricalTenureStats />
                <NewHireChurnKpi />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
