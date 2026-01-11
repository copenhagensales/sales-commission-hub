/**
 * Formats a player name as "FirstName L" (first name + last initial)
 * Example: "Kasper Madsen" → "Kasper M"
 */
export function formatPlayerName(
  employee: { first_name?: string | null; last_name?: string | null } | null | undefined
): string {
  if (!employee) return "Ukendt";
  const firstName = employee.first_name || "";
  const lastName = employee.last_name || "";
  if (!firstName && !lastName) return "Ukendt";
  if (!lastName) return firstName;
  const lastInitial = lastName.charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}`;
}
