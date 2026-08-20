import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserMinus, TrendingDown, TrendingUp, Minus, AlertTriangle, ShieldCheck, Eye } from "lucide-react";
import { fmtMonth, fmtPct, fmtPp, rate, STATUS_CLASSES, type ChurnMetricsPayload, type DerivedGroup } from "@/lib/churn/metrics";

interface Props {
  payload: ChurnMetricsPayload;
  company: DerivedGroup;
}

function Frac({ x, n }: { x: number; n: number }) {
  return (
    <span className="text-xs text-muted-foreground">
      {x}/{n}
    </span>
  );
}

/** UI-03: præcis fem KPI-kort. Alle procenter vises med tæller/nævner (G-05). */
export function ChurnKpiCards({ payload, company }: Props) {
  const s = payload.settings;
  const hasTarget = s.target_60d_rate !== null && s.target_60d_rate !== undefined;
  const delta = company.deltaPp;
  const TrendIcon = delta === null ? Minus : delta < 0 ? TrendingDown : delta > 0 ? TrendingUp : Minus;
  const trendClass =
    delta === null ? "text-muted-foreground" : delta < 0 ? "text-emerald-500" : delta > 0 ? "text-red-500" : "text-muted-foreground";

  const r14 = rate(payload.horizon_14.x, payload.horizon_14.n);
  const r30 = rate(payload.horizon_30.x, payload.horizon_30.n);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
      {/* Kort 1 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">60-dages tidligt frafald</CardTitle>
          <UserMinus className="h-4 w-4 text-primary" aria-hidden />
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="text-3xl font-bold">{fmtPct(company.rate)}</div>
          <Frac x={company.exits} n={company.starters} />
          <div className="text-xs text-muted-foreground">
            {hasTarget ? (
              <>
                Mål {fmtPct(s.target_60d_rate)} · afvigelse {fmtPp(company.gapPp)}
              </>
            ) : (
              "Mål ikke sat"
            )}
          </div>
          <Badge variant="outline" className={`text-xs ${STATUS_CLASSES[company.status.key]}`}>
            {company.status.label}
          </Badge>
          <div className="text-xs text-muted-foreground">
            Seneste modne startmåned: {payload.latest_mature_month ? fmtMonth(payload.latest_mature_month) : "Data mangler"}
          </div>
        </CardContent>
      </Card>

      {/* Kort 2 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Seneste momentum</CardTitle>
          <TrendIcon className={`h-4 w-4 ${trendClass}`} aria-hidden />
        </CardHeader>
        <CardContent className="space-y-1">
          <div className={`text-3xl font-bold ${trendClass}`}>{fmtPp(delta)}</div>
          <div className="text-xs text-muted-foreground">
            Seneste 3: {fmtPct(company.recent.rate)} · {company.recent.x}/{company.recent.n}
          </div>
          <div className="text-xs text-muted-foreground">
            Foregående 3: {fmtPct(company.previous.rate)} · {company.previous.x}/{company.previous.n}
          </div>
          {(company.recent.n < s.minimum_n || company.previous.n < s.minimum_n) && (
            <Badge variant="outline" className={`text-xs ${STATUS_CLASSES.grey}`}>
              Lavt datagrundlag
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Kort 3 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Merfrafald mod mål</CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-500" aria-hidden />
        </CardHeader>
        <CardContent className="space-y-1">
          {hasTarget && company.excessExits !== null ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-left focus:outline-none focus:ring-2 focus:ring-ring rounded">
                  <div className="text-3xl font-bold">{company.excessExits.toFixed(1).replace(".", ",")}</div>
                  <div className="text-xs text-muted-foreground">
                    Faktiske exits {company.exits} · forventet ved mål {company.expectedExitsAtTarget?.toFixed(1).replace(".", ",")}
                  </div>
                  <div className="text-xs text-muted-foreground">≈ {Math.round(company.excessExits)} personer</div>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {company.starters} startere × {fmtPct(s.target_60d_rate)} = {company.expectedExitsAtTarget?.toFixed(1)} forventede exits.
                Merfrafald = {company.exits} − {company.expectedExitsAtTarget?.toFixed(1)}.
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="text-sm text-muted-foreground">Mål ikke sat</div>
          )}
        </CardContent>
      </Card>

      {/* Kort 4 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Fastholdt efter 60 dage</CardTitle>
          <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden />
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="text-3xl font-bold">{company.retained}</div>
          <div className="text-xs text-muted-foreground">
            Fastholdelse {fmtPct(company.retentionRate)} · {company.retained}/{company.starters}
          </div>
          <div className="text-xs text-muted-foreground">
            {company.startersPerRetained !== null
              ? `${company.startersPerRetained.toFixed(2).replace(".", ",")} startere pr. fastholdt`
              : "Startere pr. fastholdt kan ikke beregnes"}
          </div>
        </CardContent>
      </Card>

      {/* Kort 5 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Under observation</CardTitle>
          <Eye className="h-4 w-4 text-primary" aria-hidden />
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dag 0-13</span>
            <span className="font-semibold">{payload.observation.d0_13}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dag 14-29</span>
            <span className="font-semibold">{payload.observation.d14_29}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dag 30-59</span>
            <span className="font-semibold">{payload.observation.d30_59}</span>
          </div>
          <div className="flex justify-between border-t pt-1">
            <span className="text-muted-foreground">Kommende startere</span>
            <span className="font-semibold">{payload.upcoming_starters}</span>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Disse medarbejdere er valide, men deres endelige 60-dages udfald er endnu ikke kendt.
          </p>
          <div className="text-xs text-muted-foreground border-t pt-1">
            14-dages: {fmtPct(r14)} · {payload.horizon_14.x}/{payload.horizon_14.n} — 30-dages: {fmtPct(r30)} ·{" "}
            {payload.horizon_30.x}/{payload.horizon_30.n}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
