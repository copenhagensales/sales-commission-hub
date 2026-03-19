import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, Wifi, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardPeriodSelector, getDefaultPeriod, type PeriodSelection } from "@/components/dashboard/DashboardPeriodSelector";
import { TvKpiCard } from "@/components/dashboard/TvDashboardComponents";
import { isTvMode, useAutoReload } from "@/utils/tvMode";
import { getClientId } from "@/utils/clientIds";

const RELATEL_CLIENT_ID = getClientId("Relatel")!;

type ProductCategory = "mobile_voice" | "mobilt_bredbaand" | "switch";

function categorizeProduct(name: string): ProductCategory | null {
  const lower = name.toLowerCase();
  if (lower.includes("fri tale")) return "mobile_voice";
  if (lower.includes("mbb") || lower.includes("mobilt bredbånd") || lower.includes("mobilt bredbaand")) return "mobilt_bredbaand";
  if (lower.includes("switch") || lower.includes("omstillingsbruger") || lower.includes("professional") || lower.includes("contact center")) return "switch";
  return null;
}

export default function RelatelProductsBoard() {
  const tvMode = isTvMode();
  useAutoReload(tvMode);

  const [period, setPeriod] = useState<PeriodSelection>(() => getDefaultPeriod("payroll_period"));

  const { data: productData, isLoading } = useQuery({
    queryKey: ["relatel-products", period.from.toISOString(), period.to.toISOString()],
    queryFn: async () => {
      // Get all client_campaign IDs for Relatel
      const { data: campaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", RELATEL_CLIENT_ID);

      if (!campaigns?.length) return { mobile_voice: 0, mobilt_bredbaand: 0, switch: 0 };

      const campaignIds = campaigns.map((c) => c.id);

      // Fetch sale_items with product names for the period
      const { data: items } = await supabase
        .from("sale_items")
        .select(`
          quantity,
          sale_id,
          product:products!inner(name),
          sale:sales!inner(sale_datetime, validation_status, client_campaign_id)
        `)
        .in("sale.client_campaign_id", campaignIds)
        .gte("sale.sale_datetime", period.from.toISOString())
        .lte("sale.sale_datetime", period.to.toISOString())
        .neq("sale.validation_status", "rejected");

      const counts = { mobile_voice: 0, mobilt_bredbaand: 0, switch: 0 };

      if (items) {
        for (const item of items) {
          const productName = (item.product as any)?.name;
          if (!productName) continue;
          const cat = categorizeProduct(productName);
          if (cat) {
            counts[cat] += item.quantity ?? 1;
          }
        }
      }

      return counts;
    },
    refetchInterval: tvMode ? 60_000 : undefined,
  });

  const counts = productData ?? { mobile_voice: 0, mobilt_bredbaand: 0, switch: 0 };

  const periodLabel = useMemo(() => {
    return period.label;
  }, [period]);

  const kpiGridClass = tvMode
    ? "grid grid-cols-3 gap-8 px-8"
    : "grid grid-cols-1 md:grid-cols-3 gap-4";

  return (
    <DashboardShell>
      <DashboardHeader
        title="Relatel – Produktoversigt"
        subtitle={`Produkter oprettet i perioden: ${periodLabel}`}
        rightContent={
          <DashboardPeriodSelector
            selectedPeriod={period}
            onPeriodChange={setPeriod}
            disabled={tvMode}
          />
        }
      />

      <div className={tvMode ? "mt-8" : "mt-4"}>
        <div className={kpiGridClass}>
          <TvKpiCard
            label="Mobile Voice oprettet"
            value={isLoading ? "..." : counts.mobile_voice}
            sub="Fri Tale produkter"
            tvMode={tvMode}
            icon={Phone}
          />
          <TvKpiCard
            label="Mobilt Bredbånd oprettet"
            value={isLoading ? "..." : counts.mobilt_bredbaand}
            sub="MBB / Mobilt Bredbånd"
            tvMode={tvMode}
            icon={Wifi}
          />
          <TvKpiCard
            label="Switch oprettet"
            value={isLoading ? "..." : counts.switch}
            sub="Switch / Omstilling"
            tvMode={tvMode}
            icon={ArrowRightLeft}
          />
        </div>
      </div>
    </DashboardShell>
  );
}
