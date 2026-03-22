import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Loader2, TrendingUp, TrendingDown, AlertTriangle, Sparkles, BarChart3, Target, Lightbulb, ArrowLeft, Users, Calendar } from "lucide-react";
import { useClientForecast } from "@/hooks/useClientForecast";
import { supabase } from "@/integrations/supabase/client";
import { generateForecastReportPdf } from "@/utils/forecastReportPdfGenerator";
import { Link } from "react-router-dom";
import type { ForecastResult, ForecastDriver } from "@/types/forecast";


function clientFriendlyLabel(label: string): string {
  return label
    .replace(/churn[-\s]?risiko/gi, "naturlig udskiftning")
    .replace(/\bchurn\b/gi, "teamudskiftning")
    .replace(/etableret churn/gi, "naturlig udskiftning");
}

function clientFriendlyDescription(desc: string): string {
  return desc
    .replace(/churn[-\s]?risiko/gi, "naturlig udskiftning i teamet")
    .replace(/\bchurn\b/gi, "udskiftning")
    .replace(/forhøjet churn/gi, "forventet udskiftning");
}

export default function ForecastClientReport() {
  const [selectedClient, setSelectedClient] = useState("all");
  const [monthOffset, setMonthOffset] = useState(1);

  const { data: clients = [] } = useQuery({
    queryKey: ["forecast-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: forecastData, isLoading } = useClientForecast(selectedClient, monthOffset);
  const { data: forecastDataM2 } = useClientForecast(selectedClient, monthOffset + 1);

  const forecast = forecastData?.forecast;
  const forecastM2 = forecastDataM2?.forecast;

  const clientName = useMemo(() => {
    if (selectedClient === "all") return "Alle kunder";
    return clients.find(c => c.id === selectedClient)?.name || "Kunde";
  }, [selectedClient, clients]);

  const periodLabel = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d.toLocaleDateString("da-DK", { month: "long", year: "numeric" });
  }, [monthOffset]);

  const periodLabelM2 = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset + 1);
    return d.toLocaleDateString("da-DK", { month: "long", year: "numeric" });
  }, [monthOffset]);

  const handleDownloadPdf = () => {
    if (!forecast) return;
    generateForecastReportPdf({
      clientName,
      periodLabel,
      forecast,
      forecastM2: forecastM2 || null,
      periodLabelM2,
    });
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/forecast">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Kunderapport</h1>
              <p className="text-sm text-muted-foreground">Salgsforecast — {clientName}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup type="single" value={String(monthOffset)} onValueChange={(v) => { if (v) setMonthOffset(Number(v)); }} variant="outline" size="sm">
              <ToggleGroupItem value="0">Denne måned</ToggleGroupItem>
              <ToggleGroupItem value="1">Næste måned</ToggleGroupItem>
              <ToggleGroupItem value="2">+2 måneder</ToggleGroupItem>
            </ToggleGroup>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Vælg kunde" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle kunder</SelectItem>
                {clients.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button onClick={handleDownloadPdf} disabled={!forecast || isLoading}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && forecast && (
          <div className="space-y-6" id="forecast-report-content">
            {/* 1. Executive Summary */}
            <ReportExecutiveSummary forecast={forecast} clientName={clientName} periodLabel={periodLabel} monthOffset={monthOffset} />

            {/* 2. Nøgletal */}
            <ReportKeyFigures forecast={forecast} />

            {/* 2.5 Planlagte opstartshold */}
            <ReportCohorts forecast={forecast} />

            {/* 3. Hvad driver forecastet */}
            <ReportDrivers forecast={forecast} />

            {/* 4. Anbefalinger */}
            <ReportRecommendations forecast={forecast} />

            {/* 5. Outlook */}
            <ReportOutlook
              forecast={forecast}
              forecastM2={forecastM2 || null}
              periodLabel={periodLabel}
              periodLabelM2={periodLabelM2}
              monthOffset={monthOffset}
            />
          </div>
        )}
      </div>
    </MainLayout>
  );
}

// ─── Section Components (kundevendt sprog, ingen jargon) ──────────────────

function ReportExecutiveSummary({ forecast, clientName, periodLabel, monthOffset }: {
  forecast: ForecastResult; clientName: string; periodLabel: string; monthOffset: number;
}) {
  const total = forecast.totalSalesExpected;
  const numEmployees = forecast.establishedEmployees.length;
  const numCohorts = forecast.cohorts.filter(c => c.forecastSales > 0).length;
  const absLoss = forecast.absenceLoss;
  const churnLoss = forecast.churnLoss + (forecast.establishedChurnLoss || 0);
  const isCurrentPeriod = monthOffset === 0;
  const hasActual = isCurrentPeriod && forecast.actualSalesToDate !== undefined && forecast.actualSalesToDate > 0;

  const teamParts: string[] = [];
  if (numEmployees > 0) teamParts.push(`${numEmployees} etablerede sælgere`);
  if (numCohorts > 0) teamParts.push(`${numCohorts} opstartshold`);

  const driverTexts: string[] = [];
  if (absLoss > 0) driverTexts.push(`fravær reducerer med ${absLoss} salg`);
  if (churnLoss > 0) driverTexts.push(`forventet naturlig udskiftning i teamet reducerer med ${churnLoss} salg`);

  const holidayDriver = forecast.drivers.find(d => d.key === "holidays");
  const holidayCount = holidayDriver ? parseInt(holidayDriver.value) || 0 : 0;
  if (holidayCount > 0) driverTexts.push(`${holidayCount} helligdage i perioden`);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      <CardContent className="p-6">
        <div className="flex gap-4">
          <div className="p-3 rounded-xl bg-primary/10 h-fit">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Salgsforecast — {periodLabel}</p>
              <p className="text-sm text-muted-foreground">{clientName}</p>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-4xl font-bold tracking-tight">{total.toLocaleString("da-DK")}</span>
              <span className="text-base text-muted-foreground">forventede salg</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {hasActual && `Der er allerede lavet ${forecast.actualSalesToDate!.toLocaleString("da-DK")} salg, og vi forventer yderligere ${forecast.remainingForecast!.toLocaleString("da-DK")} i de resterende ${forecast.daysRemaining} arbejdsdage. `}
              Forecastet er baseret på {teamParts.join(" og ")}.
              {" "}Det forventede interval er {forecast.totalSalesLow.toLocaleString("da-DK")}–{forecast.totalSalesHigh.toLocaleString("da-DK")} salg.
            </p>
            {driverTexts.length > 0 && (
              <p className="text-sm text-muted-foreground">
                De vigtigste faktorer: {driverTexts.join(", ")}.
              </p>
            )}
            {monthOffset >= 2 && (
              <p className="text-xs text-amber-600 font-medium">
                ⚠ Dette forecast er retningsgivende og mere usikkert end kortere perioder.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportKeyFigures({ forecast }: { forecast: ForecastResult }) {
  const churnTotal = forecast.churnLoss + (forecast.establishedChurnLoss || 0);
  const cohortSales = forecast.cohorts.reduce((s, c) => s + c.forecastSales, 0);
  const topPerformers = forecast.establishedEmployees
    .filter(e => e.forecastSales + (e.actualSales || 0) > 0)
    .sort((a, b) => (b.forecastSales + (b.actualSales || 0)) - (a.forecastSales + (a.actualSales || 0)))
    .slice(0, 5);
  const topSales = topPerformers.reduce((s, e) => s + e.forecastSales + (e.actualSales || 0), 0);

  const figures = [
    { label: "Forventet salg", value: forecast.totalSalesExpected.toLocaleString("da-DK"), sub: `Interval: ${forecast.totalSalesLow.toLocaleString("da-DK")}–${forecast.totalSalesHigh.toLocaleString("da-DK")}` },
    { label: "Aktive sælgere", value: String(Math.round(forecast.totalHeads)), sub: `${forecast.establishedEmployees.length} etablerede` },
    { label: "Forventede timer", value: Math.round(forecast.totalHours).toLocaleString("da-DK"), sub: "Justeret for fravær" },
  ];

  const negatives = [
    { label: "Fraværseffekt", value: `-${forecast.absenceLoss}`, desc: "Planlagt og forventet fravær" },
    { label: "Teamudskiftning", value: `-${churnTotal}`, desc: "Indregnet naturlig udskiftning i teamet" },
  ].filter(n => parseInt(n.value) !== 0);

  const positives = [
    ...(cohortSales > 0 ? [{ label: "Nye hold", value: `+${cohortSales}`, desc: `${forecast.cohorts.length} opstartshold` }] : []),
    ...(topSales > 0 ? [{ label: "Top-performere (top 5)", value: `${topSales}`, desc: "Salg fra de 5 stærkeste sælgere" }] : []),
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          Nøgletal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-4">
          {figures.map(f => (
            <div key={f.label} className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-2xl font-bold">{f.value}</p>
              <p className="text-xs text-muted-foreground font-medium">{f.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{f.sub}</p>
            </div>
          ))}
        </div>

        {negatives.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Negative effekter</p>
            <div className="space-y-2">
              {negatives.map(n => (
                <div key={n.label} className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/5">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    <span className="text-sm">{n.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-destructive">{n.value} salg</span>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {positives.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Positive effekter</p>
            <div className="space-y-2">
              {positives.map(p => (
                <div key={p.label} className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/10">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm">{p.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-emerald-600">{p.value} salg</span>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportCohorts({ forecast }: { forecast: ForecastResult }) {
  const activeCohorts = forecast.cohorts.filter(c => c.forecastSales > 0 || c.plannedHeadcount > 0);
  if (activeCohorts.length === 0) return null;

  const totalCohortSales = activeCohorts.reduce((s, c) => s + c.forecastSales, 0);
  const totalHeads = activeCohorts.reduce((s, c) => s + c.plannedHeadcount, 0);

  function getRampLabel(rampFactor: number): string {
    if (rampFactor <= 0.2) return "Opstartsfase (15%)";
    if (rampFactor <= 0.4) return "Tidlig fase (35%)";
    if (rampFactor <= 0.7) return "Optrapning (60%)";
    if (rampFactor <= 0.9) return "Næsten fuld kapacitet (85%)";
    return "Fuld kapacitet";
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Planlagte opstartshold
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Der er planlagt {activeCohorts.length} opstartshold med i alt {totalHeads} nye sælgere, som forventes at bidrage med {totalCohortSales} salg i perioden.
          Nye hold er indregnet i det samlede forecast med gradvis optrapning.
        </p>
        <div className="space-y-2">
          {activeCohorts.map((cohort) => (
            <div key={cohort.cohortId} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{cohort.plannedHeadcount} sælgere</span>
                    <Badge variant="outline" className="text-xs">
                      <Calendar className="h-3 w-3 mr-1" />
                      Start: {new Date(cohort.startDate).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" })}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {getRampLabel(cohort.rampFactor)}
                    </Badge>
                  </div>
                  {cohort.note && (
                    <p className="text-xs text-muted-foreground mt-0.5">{cohort.note}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold">{cohort.forecastSales} salg</span>
                <p className="text-xs text-muted-foreground">{Math.round(cohort.effectiveHeads)} effektive</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ReportDrivers({ forecast }: { forecast: ForecastResult }) {
  const positiveDrivers = forecast.drivers.filter(d => d.impact === "positive");
  const negativeDrivers = forecast.drivers.filter(d => d.impact === "negative");

  if (forecast.drivers.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Hvad driver forecastet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {positiveDrivers.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Positivt</p>
            {positiveDrivers.map(d => (
              <div key={d.key} className="mb-2">
                <p className="text-sm font-medium">{clientFriendlyLabel(d.label)}</p>
                <p className="text-sm text-muted-foreground">{clientFriendlyDescription(d.description)}</p>
              </div>
            ))}
          </div>
        )}
        {negativeDrivers.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-2">Negativt</p>
            {negativeDrivers.map(d => (
              <div key={d.key} className="mb-2">
                <p className="text-sm font-medium">{clientFriendlyLabel(d.label)}</p>
                <p className="text-sm text-muted-foreground">{clientFriendlyDescription(d.description)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportRecommendations({ forecast }: { forecast: ForecastResult }) {
  const recommendations: { icon: typeof AlertTriangle; title: string; text: string }[] = [];
  const employees = forecast.establishedEmployees;
  const avgSph = employees.length > 0 ? employees.reduce((s, e) => s + e.expectedSph, 0) / employees.length : 0;

  const churnLossTotal = forecast.churnLoss + (forecast.establishedChurnLoss || 0);
  if (churnLossTotal > 0) {
    recommendations.push({
      icon: AlertTriangle,
      title: "Fastholdelse",
      text: `Vi har indregnet en forventet naturlig udskiftning i teamet svarende til ${churnLossTotal} salg. Tæt lederkontakt og tidlig opfølgning kan reducere denne effekt.`,
    });
  }

  if (forecast.absenceLoss > 15) {
    recommendations.push({
      icon: TrendingDown,
      title: "Fravær",
      text: `Fravær påvirker forecastet med ${forecast.absenceLoss} tabte salg. Det kan være relevant at se på planlægning, vikardækning eller mønstre i bestemte uger.`,
    });
  }

  const lowPerformers = employees.filter(e => e.expectedSph < avgSph * 0.5 && e.expectedSph > 0);
  if (lowPerformers.length > 0) {
    recommendations.push({
      icon: TrendingUp,
      title: "Performance-løft",
      text: `${lowPerformers.length} sælger${lowPerformers.length > 1 ? "e" : ""} performer væsentligt under teamgennemsnittet. Coaching eller ekstra træning kan løfte output.`,
    });
  }

  if (recommendations.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Anbefalinger
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Vi anbefaler at fokusere på:</p>
        {recommendations.map((rec, i) => {
          const Icon = rec.icon;
          return (
            <div key={i} className="pl-4 border-l-2 border-primary/20">
              <p className="text-sm font-semibold">{rec.title}</p>
              <p className="text-sm text-muted-foreground">{rec.text}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ReportOutlook({ forecast, forecastM2, periodLabel, periodLabelM2, monthOffset }: {
  forecast: ForecastResult;
  forecastM2: ForecastResult | null;
  periodLabel: string;
  periodLabelM2: string;
  monthOffset: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Outlook</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-lg bg-muted/30">
          <p className="text-sm font-semibold capitalize">{periodLabel}</p>
          <p className="text-lg font-bold">{forecast.totalSalesExpected.toLocaleString("da-DK")} salg</p>
          <p className="text-xs text-muted-foreground">
            Interval: {forecast.totalSalesLow.toLocaleString("da-DK")}–{forecast.totalSalesHigh.toLocaleString("da-DK")}
          </p>
        </div>

        {forecastM2 && (
          <div className="p-3 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/20">
            <p className="text-sm font-semibold capitalize">{periodLabelM2}</p>
            <p className="text-lg font-bold">{forecastM2.totalSalesExpected.toLocaleString("da-DK")} salg</p>
            <p className="text-xs text-muted-foreground">
              Interval: {forecastM2.totalSalesLow.toLocaleString("da-DK")}–{forecastM2.totalSalesHigh.toLocaleString("da-DK")}
            </p>
            <p className="text-xs text-amber-600 mt-1">
              ⚠ Retningsgivende — mere usikkert pga. længere tidshorisont.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
