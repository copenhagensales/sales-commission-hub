import { MainLayout } from "@/components/layout/MainLayout";
import { FinancialKpiCard } from "@/components/km-test/FinancialKpiCard";
import { CostBreakdownChart } from "@/components/km-test/CostBreakdownChart";
import { YearComparisonChart } from "@/components/km-test/YearComparisonChart";
import { ForecastTable } from "@/components/km-test/ForecastTable";
import { CostDetailsTable } from "@/components/km-test/CostDetailsTable";
import { summaryData, totalFixedCosts, totalFixedCostsPreviousYear } from "@/data/financialData";

export default function KmTest() {
  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Økonomi Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Resultatopgørelse {summaryData.period} • Copenhagen Sales ApS
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FinancialKpiCard
            title="Omsætning"
            value={summaryData.revenue}
            previousYear={summaryData.revenuePreviousYear}
            subtitle="Year-to-date"
          />
          <FinancialKpiCard
            title="Dækningsbidrag"
            value={summaryData.contributionMargin}
            previousYear={summaryData.contributionMarginPreviousYear}
            subtitle={`${((summaryData.contributionMargin / summaryData.revenue) * 100).toFixed(1)}% af omsætning`}
          />
          <FinancialKpiCard
            title="Faste omkostninger"
            value={totalFixedCosts}
            previousYear={totalFixedCostsPreviousYear}
            subtitle="Løn + kapacitetsomk."
            invertTrend
          />
          <FinancialKpiCard
            title="Resultat før skat"
            value={summaryData.resultBeforeTax}
            previousYear={summaryData.resultBeforeTaxPreviousYear}
            subtitle={`${((summaryData.resultBeforeTax / summaryData.revenue) * 100).toFixed(1)}% overskudsgrad`}
          />
        </div>

        {/* Forecast Table */}
        <ForecastTable />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CostBreakdownChart />
          <YearComparisonChart />
        </div>

        {/* Cost Details */}
        <CostDetailsTable />
      </div>
    </MainLayout>
  );
}
