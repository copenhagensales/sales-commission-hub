/**
 * Display helpers for sales rows that have passed their campaign retention
 * deadline. The cleanup job sets customer_company = "Anonymiseret" and clears
 * phone, OPP number and Sales ID/CVR on the deadline, so an empty external
 * reference on such a row means "removed by design", not "missing data".
 *
 * Presentation only — no report groups or joins use the external references.
 */
export const ANONYMIZED_LABEL = "Anonymiseret";

export function isAnonymizedSaleRow(row: { customer_company?: string | null }): boolean {
  return (row.customer_company ?? "").trim() === ANONYMIZED_LABEL;
}

/** Shows the external reference, or the anonymised marker after the deadline. */
export function displayExternalReference(
  value: string | null | undefined,
  row: { customer_company?: string | null }
): string {
  if (value !== null && value !== undefined && String(value).trim() !== "") {
    return String(value);
  }
  return isAnonymizedSaleRow(row) ? ANONYMIZED_LABEL : "";
}
