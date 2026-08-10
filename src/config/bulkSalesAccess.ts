/**
 * Eksplicit allowlist for "Bulk Salg (Leder)" under Tast selv salg.
 * Ejere har altid adgang; herudover kun disse adresser.
 * Samme liste findes i supabase/functions/manual-sales/index.ts
 * (edge functions kan ikke importere fra src/).
 */
export const BULK_SALES_EMAILS: readonly string[] = [
  "fk@copenhagensales.dk",
  "filipkirketerp@gmail.com",
];

export function isBulkSalesEmail(email?: string | null): boolean {
  if (!email) return false;
  return BULK_SALES_EMAILS.includes(email.trim().toLowerCase());
}
