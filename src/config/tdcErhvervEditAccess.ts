/**
 * Manuel allowlist til siden "TDC Erhverv - ret salg".
 *
 * Adgang gives normalt via medlemskab af TDC Erhverv-teamet. Denne liste er
 * undtagelsen for ledere der sidder på et andet team (fx Stab), men skal kunne
 * rette TDC Erhverv-salg. Både arbejds- og privat-mail er med, så adgangen
 * virker uanset hvilken e-mail de er logget ind med.
 */
export const TDC_ERHVERV_EDIT_ALLOWLIST: string[] = [
  // Johannes Hedebrink – Assisterende Teamleder TM
  "joh@copenhagensales.dk",
  "johannestornberg@gmail.com",
  // Rasmus Emil Hansen – Teamleder
  "rh@copenhagensales.dk",
  "rasmus@bjerrum.nu",
];

/** True hvis e-mailen står på allowlisten (case-insensitivt). */
export function hasTdcErhvervEditAccess(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return TDC_ERHVERV_EDIT_ALLOWLIST.some((e) => e.toLowerCase() === normalized);
}
