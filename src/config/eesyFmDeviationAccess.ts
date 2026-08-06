import { useAuth } from "@/hooks/useAuth";

/**
 * Fast allowlist for adgang til "Eesy FM afvigelser (Leder)".
 * Tilføj/fjern mails her — case-insensitiv.
 */
export const EESY_FM_DEVIATION_EMAILS = [
  "jepmunk@gmail.com",
  "wb@copenhagensales.dk",
] as const;

export function hasEesyFmDeviationAccess(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  return EESY_FM_DEVIATION_EMAILS.some((e) => e === lower);
}

export function useEesyFmDeviationAccess(): boolean {
  const { user } = useAuth();
  return hasEesyFmDeviationAccess(user?.email);
}
