import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, Award, Star } from "lucide-react";

export interface BonusTiers {
  bonus_tier1_amount: number;
  bonus_tier1_description: string;
  bonus_tier2_amount: number;
  bonus_tier2_description: string;
  bonus_tier3_amount: number;
  bonus_tier3_description: string;
}

interface BonusStaircaseProps {
  tiers: BonusTiers;
  onChange: (tiers: Partial<BonusTiers>) => void;
  salesTarget: number;
}

const TIERS = [
  { pct: 5, icon: Star, color: "text-amber-500", bgColor: "bg-amber-500/10 border-amber-500/30", label: "Trin 1", amountKey: "bonus_tier1_amount" as const, descKey: "bonus_tier1_description" as const },
  { pct: 10, icon: Award, color: "text-blue-500", bgColor: "bg-blue-500/10 border-blue-500/30", label: "Trin 2", amountKey: "bonus_tier2_amount" as const, descKey: "bonus_tier2_description" as const },
  { pct: 15, icon: Trophy, color: "text-emerald-500", bgColor: "bg-emerald-500/10 border-emerald-500/30", label: "Trin 3", amountKey: "bonus_tier3_amount" as const, descKey: "bonus_tier3_description" as const },
];

export function BonusStaircase({ tiers, onChange, salesTarget }: BonusStaircaseProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Bonustrappe (pr. medarbejder)</Label>
      <div className="space-y-2">
        {TIERS.map((tier) => {
          const Icon = tier.icon;
          const target = salesTarget > 0 ? Math.round(salesTarget * (1 + tier.pct / 100)) : 0;
          return (
            <div key={tier.pct} className={`flex items-center gap-3 rounded-lg border p-3 ${tier.bgColor}`}>
              <Icon className={`h-5 w-5 shrink-0 ${tier.color}`} />
              <Badge variant="outline" className="shrink-0 text-xs">+{tier.pct}%</Badge>
              {target > 0 && (
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  ≥{target.toLocaleString("da-DK")}
                </span>
              )}
              <Input
                type="number"
                min={0}
                className="w-20 h-7 text-sm"
                value={tiers[tier.amountKey] || ""}
                onChange={(e) => onChange({ [tier.amountKey]: Number(e.target.value) })}
                placeholder="DKK"
              />
              <span className="text-xs text-muted-foreground shrink-0">kr</span>
              <Input
                className="h-7 text-sm flex-1"
                value={tiers[tier.descKey] || ""}
                onChange={(e) => onChange({ [tier.descKey]: e.target.value })}
                placeholder="Beskrivelse..."
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BonusTiersSummary({ goal }: { goal: any }) {
  const t1 = goal.bonus_tier1_amount ?? 500;
  const t2 = goal.bonus_tier2_amount ?? 750;
  const t3 = goal.bonus_tier3_amount ?? 1000;
  return (
    <span className="text-sm tabular-nums">
      {t1.toLocaleString("da-DK")} → {t2.toLocaleString("da-DK")} → {t3.toLocaleString("da-DK")} kr
    </span>
  );
}
