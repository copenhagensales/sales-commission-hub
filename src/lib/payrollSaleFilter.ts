/**
 * Whether a sale counts toward provision on the payroll view.
 * Same rule as get_sales_aggregates_v2: only rejected and cancelled are excluded;
 * missing status counts as approved.
 */
export function countsTowardPayrollProvision(validationStatus: string | null | undefined): boolean {
  const s = validationStatus ?? "approved";
  return s !== "rejected" && s !== "cancelled";
}
