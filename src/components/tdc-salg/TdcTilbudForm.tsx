import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HARDWARE, TILBUD_PRODUCTS } from "@/lib/tdcTilbud/catalog";
import { activeCommission, affordableCount, calcTilbud, fmtKr, type Quantities } from "@/lib/tdcTilbud/calc";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import type { SubsidyPct } from "@/lib/tdcTilbud/prefill";

interface Props {
  products: Quantities;
  hardware: Quantities;
  onProducts: (q: Quantities) => void;
  onHardware: (q: Quantities) => void;
  subsidyPct: SubsidyPct | null;
  onSubsidyPct: (p: SubsidyPct | null) => void;
  campaign: boolean;
  onCampaign: (c: boolean) => void;
}

const groupBy = <T extends { group: string }>(items: T[]) =>
  items.reduce<Record<string, T[]>>((acc, i) => ((acc[i.group] ||= []).push(i), acc), {});

function QtyInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <Input
      type="number"
      min={0}
      inputMode="numeric"
      className="h-8 w-16 text-right"
      value={value || ""}
      placeholder="0"
      onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
    />
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", strong && "font-semibold text-lg")}>{value}</span>
    </div>
  );
}

export function TdcTilbudForm({ products, hardware, onProducts, onHardware, subsidyPct, onSubsidyPct, campaign, onCampaign }: Props) {
  const totals = useMemo(() => calcTilbud(products, hardware, undefined, undefined, { campaign }), [products, hardware, campaign]);
  const productGroups = groupBy(TILBUD_PRODUCTS);
  const hwGroups = groupBy(HARDWARE);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Løsninger</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {Object.entries(productGroups).map(([group, items]) => (
              <div key={group}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                  {items.some((p) => p.nonCampaignCommission) && (
                    <label className="flex items-center gap-2 text-sm font-medium">
                      Kampagne {campaign ? "ja" : "nej"}
                      <Switch checked={campaign} onCheckedChange={onCampaign} aria-label="Kampagne" />
                    </label>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-1 font-medium">Produkt</th>
                        <th className="py-1 text-right font-medium">Pris/md</th>
                        <th className="py-1 text-right font-medium">Tilskud</th>
                        <th className="py-1 text-right font-medium">Prov. 0/50/100 %</th>
                        <th className="py-1 text-right font-medium">Antal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <tr key={p.id} className="border-t border-border/50">
                          <td className="py-1.5">{p.name}</td>
                          <td className="py-1.5 text-right tabular-nums">{p.priceUnknown ? "–" : p.price.toLocaleString("da-DK")}</td>
                          <td className="py-1.5 text-right tabular-nums">{p.subsidy ? p.subsidy.toLocaleString("da-DK") : "–"}</td>
                          <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                            {p.countsInCommission === false ? "–" : activeCommission(p, campaign).join(" / ")}
                          </td>
                          <td className="py-1.5 flex justify-end">
                            <QtyInput value={products[p.id] ?? 0} onChange={(n) => onProducts({ ...products, [p.id]: n })} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hardware (TDC Shop)</CardTitle>
            <p className="text-sm text-muted-foreground">"Kan få" = hvor mange stk. det resterende budget rækker til.</p>
          </CardHeader>
          <CardContent className="gap-6 md:columns-2">
            {Object.entries(hwGroups).map(([group, items]) => (
              <div key={group} className="mb-6 break-inside-avoid">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                <table className="w-full text-sm">
                  <tbody>
                    {items.map((h) => {
                      const can = affordableCount(totals.remainingBudget, h.price);
                      return (
                        <tr key={h.id} className="border-t border-border/50">
                          <td className="py-1.5 pr-2">{h.name}</td>
                          <td className="py-1.5 text-right tabular-nums">{h.price.toLocaleString("da-DK")}</td>
                          <td className={cn("py-1.5 px-2 text-right tabular-nums text-xs", can ? "text-primary" : "text-muted-foreground")}>
                            {can} stk
                          </td>
                          <td className="py-1.5 flex justify-end">
                            <QtyInput value={hardware[h.id] ?? 0} onChange={(n) => onHardware({ ...hardware, [h.id]: n })} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 lg:sticky lg:top-4 self-start">
        <Card>
          <CardHeader><CardTitle>Vores aftale</CardTitle></CardHeader>
          <CardContent>
            <Stat label="Pris pr. md. ekskl. moms" value={fmtKr(totals.price)} strong />
            <Stat label="Pris pr. md. inkl. moms" value={fmtKr(totals.priceInclVat)} />
            <Stat label="Muligt tilskud (gavekort)" value={fmtKr(totals.subsidy)} strong />
            <Stat label="Pris − tilskud/36 md." value={fmtKr(totals.priceAfterSubsidy)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Provision</CardTitle></CardHeader>
          <CardContent>
            <Stat label="Ingen tilskud" value={fmtKr(totals.commission[0])} strong />
            <Stat label="Halv tilskud" value={fmtKr(totals.commission[1])} />
            <Stat label="Fuld tilskud" value={fmtKr(totals.commission[2])} />
            <Stat label="Difference (ingen − halv)" value={fmtKr(totals.commissionDiff)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tilskud</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-3 grid grid-cols-3 gap-2" role="group" aria-label="Tilskud til kunden">
              {([0, 50, 100] as const).map((pct) => (
                <button
                  key={pct}
                  type="button"
                  aria-pressed={subsidyPct === pct}
                  onClick={() => onSubsidyPct(subsidyPct === pct ? null : pct)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    subsidyPct === pct
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {pct} %
                </button>
              ))}
            </div>
            {subsidyPct !== null && subsidyPct > 0 && (
              <Stat label={`Kunden får (${subsidyPct} %)`} value={fmtKr((totals.subsidy * subsidyPct) / 100)} strong />
            )}
            <Stat label="Budget (fuldt tilskud)" value={fmtKr(totals.subsidy)} />
            <Stat label="Valgt hardware" value={fmtKr(totals.hardwareSpent)} />
            <div className={cn(totals.remainingBudget < 0 && "text-destructive")}>
              <Stat label="Resterende budget" value={fmtKr(totals.remainingBudget)} strong />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
