/**
 * Resolves which sales agent emails belong to an employee.
 * Mapped agent emails win; if none exist, fall back to the work email.
 */
export function resolveEmployeeSalesEmails(
  mappedEmails: Array<string | null | undefined>,
  workEmail: string | null | undefined,
): string[] {
  const mapped = Array.from(
    new Set(mappedEmails.filter((e): e is string => !!e).map((e) => e.trim().toLowerCase())),
  );
  if (mapped.length > 0) return mapped;
  const fallback = workEmail?.trim().toLowerCase();
  return fallback ? [fallback] : [];
}
