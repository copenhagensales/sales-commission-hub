import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, Wifi, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardPeriodSelector, getDefaultPeriod, type PeriodSelection } from "@/components/dashboard/DashboardPeriodSelector";
import { TvKpiCard } from "@/components/dashboard/TvDashboardComponents";
import { isTvMode, useAutoReload } from "@/utils/tvMode";

export default function RelatelProductsBoard() {
  const tvMode = isTvMode();
  useAutoReload(tvMode);

  const [period, setPeriod] = useState<PeriodSelection>(() => getDefaultPeriod("payroll_period"));

  const { data: productData, isLoading } = useQuery({
    queryKey: ["relatel-products", period.from.toISOString(), period.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_relatel_product_counts", {
        p_from: period.from.toISOString(),
        p_to: period.to.toISOString(),
      });
      if (error) throw error;
      const row = data?.[0];
      return {
        mobile_voice: Number(row?.mobile_voice ?? 0),
        mobilt_bredbaand: Number(row?.mobilt_bredbaand ?? 0),
        switch: Number(row?.switch_count ?? 0),
      };
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
