/**
 * Shared display name and initials formatting.
 * Consolidated from 4 identical copies across dashboard files.
 */

/**
 * Format a full name for display: "Kasper M." (first name + last initial).
 */
export function getDisplayName(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }
  return name;
}

/**
 * Get initials from a full name (e.g. "Kasper Møller" → "KM").
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
