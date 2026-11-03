/** Godkendte snapshots: direkte refusion hører kun til Coop direkte. */
export const COOP_DIRECT_REPORT = "Coop direkte";

export interface ApprovedRefundRow {
  locationName?: string;
  refundAmount?: number;
  refundPerDay?: number;
  surchargeRefundableAmount?: number;
}

export function approvedRowRefund(locationType: string, row: ApprovedRefundRow): number {
  if (locationType !== COOP_DIRECT_REPORT) return 0;
  return Number(row.refundAmount ?? row.surchargeRefundableAmount) || 0;
}

export function coopOnlyRefund(summary: {
  refundableAmount: number;
  coopRefundableAmount?: number;
  directRefunds?: Array<{ amount: number }>;
}): number {
  return summary.coopRefundableAmount ?? Math.max(0,
    summary.refundableAmount - (summary.directRefunds ?? []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0));
}