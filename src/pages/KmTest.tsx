import { MainLayout } from "@/components/layout/MainLayout";
import { FinancialKpiCard } from "@/components/km-test/FinancialKpiCard";
import { CostBreakdownChart } from "@/components/km-test/CostBreakdownChart";
import { YearComparisonChart } from "@/components/km-test/YearComparisonChart";
import { ForecastTable } from "@/components/km-test/ForecastTable";
import { CostDetailsTable } from "@/components/km-test/CostDetailsTable";
import { PerformanceChart } from "@/components/km-test/PerformanceChart";
import { MonthlyFixedCostsCard } from "@/components/km-test/MonthlyFixedCostsCard";
import { summaryData, totalFixedCosts, totalFixedCostsPreviousYear, monthlyFixedCosts } from "@/data/financialData";
import { TrendingUp, Wallet, PiggyBank, BarChart3 } from "lucide-react";

export default function KmTest() {
  const contributionMarginPct = (summaryData.contributionMargin / summaryData.revenue) * 100;
  const profitMarginPct = (summaryData.resultBeforeTax / summaryData.revenue) * 100;

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold tracking-tight">Økonomi Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {summaryData.period} • Copenhagen Sales ApS
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FinancialKpiCard
            title="Omsætning"
            value={summaryData.revenue}
            previousYear={summaryData.revenuePreviousYear}
            subtitle="Year-to-date"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <FinancialKpiCard
            title="Dækningsbidrag"
            value={summaryData.contributionMargin}
            previousYear={summaryData.contributionMarginPreviousYear}
            subtitle={`${contributionMarginPct.toFixed(1)}% af omsætning`}
            icon={<Wallet className="h-5 w-5" />}
          />
          <FinancialKpiCard
            title="Faste omk. pr. md."
            value={monthlyFixedCosts}
            previousYear={totalFixedCostsPreviousYear / summaryData.months}
            subtitle="Ekskl. løn"
            invertTrend
            icon={<BarChart3 className="h-5 w-5" />}
          />
          <FinancialKpiCard
            title="Resultat før skat"
            value={summaryData.resultBeforeTax}
            previousYear={summaryData.resultBeforeTaxPreviousYear}
            subtitle={`${profitMarginPct.toFixed(1)}% overskudsgrad`}
            icon={<PiggyBank className="h-5 w-5" />}
          />
        </div>

        {/* Performance Chart + Fixed Costs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PerformanceChart />
          </div>
          <MonthlyFixedCostsCard />
        </div>

        {/* Forecast Table */}
        <ForecastTable />

        {/* Charts Row */}
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
