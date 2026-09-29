/** Kun cifre, uden dansk landekode foran (0045 / 45). */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0045")) return digits.slice(4);
  if (digits.startsWith("45") && digits.length > 8) return digits.slice(2);
  return digits;
}

/** Visning: 8 danske cifre uden mellemrum/præfiks; ellers originalværdien uændret. */
export function formatDanishPhone(value: string | null | undefined): string {
  if (!value) return "";
  const n = normalizePhone(value);
  return n.length === 8 ? n : value;
}
