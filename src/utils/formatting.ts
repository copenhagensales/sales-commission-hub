/**
 * Shared display name and initials formatting.
 * Consolidated from 4 identical copies across dashboard files.
 */

import { getDisplayNameOverride } from "@/lib/displayNameOverrides";

/**
 * Format a full name for display: "Kasper M." (first name + last initial).
 * Medarbejdere med et manuelt kort visningsnavn i databasen bruger det i stedet.
 */
export function getDisplayName(name: string): string {
  if (!name) return name;
  const override = getDisplayNameOverride(name);
  if (override) return override;
  const parts = name.trim().split(" ").filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }
  return name;
}

/**
 * Get initials from a full name (e.g. "Kasper Møller" → "KM").
 */
export function getInitials(name: string): string {
  if (!name) return "??";
  const effective = getDisplayNameOverride(name) || name;
  const parts = effective.trim().split(" ").filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return effective.slice(0, 2).toUpperCase();
}
