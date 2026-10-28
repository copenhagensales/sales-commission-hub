import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, X } from "lucide-react";
import { SkeletonCard } from "@/components/mobile";
import { cn } from "@/lib/utils";
import { useOpstartsholdListe, useOpstartsholdDage } from "@/hooks/useOpstartshold";
import { bygHold, kumuleret, type HoldData } from "@/lib/opstartshold";
import { todayInCopenhagen } from "@/lib/qualityDates";

const FARVER = ["hsl(var(--chart-2))", "hsl(var(--primary))", "hsl(var(--chart-1))", "hsl(var(--chart-3))", "hsl(var(--destructive))", "hsl(var(--chart-4))"];
const datoTekst = (d: string) => { const [y, m, dd] = d.split("-"); return `${Number(dd)}/${Number(m)}-${y.slice(2)}`; };
const pct = (x: number) => `${Math.round(x * 100)} %`;

export default function Opstartshold() {
  const idag = todayInCopenhagen();
  const liste = useOpstartsholdListe();
  const [valgt, setValgt] = useState<string[] | null>(null);
  const [adHoc, setAdHoc] = useState<string[]>([]);
  const [nyDato, setNyDato] = useState("");
  const [dage, setDage] = useState(10);

  const startede = (liste.data ?? []).filter((h) => h.start <= idag && h.antal > 0);
  const kohorter = valgt ?? startede.slice(0, 6).map((h) => h.noegle);
  const data = useOpstartsholdDage(kohorter, adHoc, dage);
  const hold = useMemo(() => bygHold(data.data ?? [], idag).sort((a, b) => b.start.localeCompare(a.start)), [data.data, idag]);
  const maks = Math.max(1, ...hold.flatMap((h) => h.dage.map((d) => d.linjer)));

  const skift = (id: string) => setValgt((v) => { const cur = v ?? kohorter; return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]; });

  return (
    <div className="space-y-4 min-w-0">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Hold og periode</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Antal arbejdsdage">
            {[10, 20, 40].map((n) => (
              <Button key={n} size="sm" variant={dage === n ? "default" : "outline"} className="min-h-11 min-w-11" onClick={() => setDage(n)}>{n} dage</Button>
            ))}
          </div>
          {liste.isError ? (
            <div className="flex items-center gap-2"><p className="text-sm text-muted-foreground">Kunne ikke hente hold</p>
              <Button size="sm" variant="outline" className="min-h-11" onClick={() => void liste.refetch()}>Prøv igen</Button></div>
          ) : liste.isLoading ? <SkeletonCard /> : (
            <ul className="max-h-60 overflow-y-auto divide-y rounded border">
              {startede.map((h) => (
                <li key={h.noegle}>
                  <label className="flex min-h-11 items-center gap-3 px-3 py-1 cursor-pointer">
                    <Checkbox checked={kohorter.includes(h.noegle)} onCheckedChange={() => skift(h.noegle)} />
                    <span className="min-w-0 flex-1 truncate text-[15px]">{h.navn}</span>
                    <span className="shrink-0 text-[14px] text-muted-foreground">{datoTekst(h.start)} · {h.antal}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-0 flex-col gap-1 text-[14px]">
              Hold uden kohorte (startdato)
              <Input type="date" value={nyDato} max={idag} onChange={(e) => setNyDato(e.target.value)} className="min-h-11 text-[16px]" />
            </label>
            <Button variant="outline" className="min-h-11" disabled={!nyDato || adHoc.includes(nyDato)} onClick={() => { setAdHoc((a) => [...a, nyDato]); setNyDato(""); }}>Tilføj</Button>
          </div>
          {adHoc.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {adHoc.map((d) => (
                <Button key={d} size="sm" variant="secondary" className="min-h-11" onClick={() => setAdHoc((a) => a.filter((x) => x !== d))} aria-label={`Fjern start ${datoTekst(d)}`}>
                  Start {datoTekst(d)} <X className="ml-1 h-4 w-4" />
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {data.isError ? (
        <Card><CardContent className="py-6 flex items-center gap-2"><p className="text-sm text-muted-foreground">Kunne ikke hente tallene</p>
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => void data.refetch()}>Prøv igen</Button></CardContent></Card>
      ) : data.isLoading ? <SkeletonCard /> : hold.length === 0 ? (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">Vælg mindst ét hold.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Linjer pr. arbejdsdag</CardTitle></CardHeader>
            <CardContent className="p-2 md:p-6">
              <div className="max-w-full overflow-x-auto rounded border">
                <table className="w-full border-collapse text-[14px]">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="sticky left-0 z-10 bg-muted p-2 text-left font-medium">Dag</th>
                      {hold.map((h) => (
                        <th key={h.noegle} className="min-w-[110px] p-2 text-left font-medium align-bottom">
                          <span className="block truncate max-w-[160px]">{h.navn}</span>
                          <span className="block text-muted-foreground font-normal">{datoTekst(h.start)} · {h.startere}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: dage }, (_, i) => i + 1).map((n) => (
                      <tr key={n} className="border-t">
                        <th className="sticky left-0 z-10 bg-card p-2 text-left font-medium">{n}</th>
                        {hold.map((h) => <DagCelle key={h.noegle} d={h.dage.find((x) => x.dag === n)} maks={maks} />)}
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-muted/30">
                      <th className="sticky left-0 z-10 bg-muted p-2 text-left font-medium">I alt</th>
                      {hold.map((h) => (
                        <td key={h.noegle} className="p-2 align-top">
                          <div className="text-lg font-semibold tabular-nums">{h.total.linjer}</div>
                          {h.total.hiper > 0 && <div className="text-muted-foreground">heraf H {h.total.hiper}</div>}
                          <div>{pct(h.total.pctSnit)} i snit</div>
                          <div>{h.total.prStarter.toFixed(1).replace(".", ",")} pr. starter</div>
                          <div className="text-muted-foreground">{h.total.tilbage} af {h.startere} tilbage</div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Kumuleret</CardTitle></CardHeader>
            <CardContent className="p-2 md:p-6">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={kumuleret(hold, dage)} margin={{ left: -16, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="dag" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {hold.map((h, i) => (
                      <Line key={h.noegle} type="monotone" dataKey={h.noegle} name={`${h.navn} (${datoTekst(h.start)})`} stroke={FARVER[i % FARVER.length]} strokeWidth={2} dot={false} connectNulls={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {hold.map((h) => <SaelgerListe key={h.noegle} h={h} />)}
          </div>
        </>
      )}
    </div>
  );
}

function DagCelle({ d, maks }: { d: HoldData["dage"][number] | undefined; maks: number }) {
  if (!d || d.fremtid) return <td className="p-2 text-muted-foreground">–</td>;
  const styrke = d.linjer ? 0.12 + 0.7 * (d.linjer / maks) : 0;
  const moerk = styrke > 0.5;
  return (
    <td className={cn("p-2 align-top", d.frafald > 0 && "ring-2 ring-inset ring-destructive")}
      style={{ backgroundColor: styrke ? `hsl(var(--success) / ${styrke})` : undefined }}>
      <div className={cn("text-lg font-semibold tabular-nums", moerk && "text-success-foreground")}>{d.linjer}</div>
      <div className={cn("text-[14px]", moerk ? "text-success-foreground" : "text-muted-foreground")}>
        {d.hiper > 0 && <span>heraf H {d.hiper} · </span>}{pct(d.pct)}
      </div>
      <div className={cn("text-[14px]", moerk ? "text-success-foreground" : "text-muted-foreground")}>
        {d.ansatte} af {d.ansatte + 0 > 0 ? d.ansatte + 0 : 0}
        {d.frafald > 0 && <span className="font-semibold text-destructive"> (−{d.frafald})</span>}
      </div>
      {d.foreloebig && <div className="text-[14px] italic">foreløbig</div>}
    </td>
  );
}

function SaelgerListe({ h }: { h: HoldData }) {
  const maks = Math.max(1, ...h.saelgere.flatMap((s) => s.dage.map((d) => d.eesy + d.hiper)));
  return (
    <Collapsible>
      <Card>
        <CollapsibleTrigger asChild>
          <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 p-4 text-left">
            <span className="min-w-0 truncate font-medium">Sælgere – {h.navn} ({datoTekst(h.start)})</span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="divide-y border-t">
            {h.saelgere.map((s) => (
              <li key={s.id} className={cn("p-3 space-y-2", s.slut && "text-muted-foreground")}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="min-w-0 truncate font-medium">{s.navn}</span>
                  <span className="text-[14px] tabular-nums">
                    {s.linjer} linjer{s.hiper > 0 && ` · heraf H ${s.hiper}`} · {s.arbejdsdage} dage · {s.prDag.toFixed(1).replace(".", ",")}/dag
                  </span>
                </div>
                {s.slut && <p className="text-[14px]">Stoppet {datoTekst(s.slut)}</p>}
                <div className="flex h-12 items-end gap-0.5" aria-label={`Linjer pr. dag for ${s.navn}`}>
                  {s.dage.map((d) => (
                    <div key={d.dag} className="flex flex-1 min-w-0 flex-col justify-end" title={`Dag ${d.dag}: ${d.eesy} Eesy, ${d.hiper} Hiper`}>
                      {d.hiper > 0 && <div className="bg-chart-3 rounded-t-sm" style={{ height: `${(d.hiper / maks) * 48}px`, backgroundColor: "hsl(var(--chart-3))" }} />}
                      <div style={{ height: `${(d.eesy / maks) * 48}px`, backgroundColor: "hsl(var(--success))" }} className={cn(d.hiper === 0 && "rounded-t-sm")} />
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
