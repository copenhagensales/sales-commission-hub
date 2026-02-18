export type MetricContractVersion = "v1";

/**
 * Canonical metric contract for dashboard KPI calculations.
 *
 * IMPORTANT:
 * - All cache pipelines and frontend KPI gateways must use these definitions.
 * - Direct/raw list views (recent sales/export/admin) may still query source tables,
 *   but KPI cards should map to this contract.
 */
export const METRIC_CONTRACT = {
  version: "v1" as MetricContractVersion,
  timezone: "Europe/Copenhagen",
  metrics: {
    sales_count: {
      description: "Number of sold units where product counts_as_sale is true",
      sourceDateField: "sale_datetime",
      excludesStatuses: ["draft", "cancelled"],
    },
    total_revenue: {
      description: "Sum of mapped_revenue or matched pricing-rule revenue",
      sourceDateField: "sale_datetime",
      excludesStatuses: ["draft", "cancelled"],
    },
    total_commission: {
      description: "Sum of mapped_commission or matched pricing-rule commission",
      sourceDateField: "sale_datetime",
      excludesStatuses: ["draft", "cancelled"],
    },
  },
  periods: {
    today: "calendar day in Europe/Copenhagen",
    week: "ISO week in Europe/Copenhagen",
    month: "calendar month in Europe/Copenhagen",
    payroll: "company payroll period (configured centrally)",
  },
} as const;

export type CanonicalMetricName = keyof typeof METRIC_CONTRACT.metrics;

export function getMetricContractVersion(): MetricContractVersion {
  return METRIC_CONTRACT.version;
}
