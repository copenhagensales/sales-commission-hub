/** Spejl af supabase/functions/_shared/pushText.ts – hold dem ens (testet). */
export const STORKBOOK_TYPER = [
  "storkbook_besked", "storkbook_ros", "storkbook_svar", "storkbook_kommentar",
  "storkbook_reaktion", "storkbook_omtale", "storkbook_begivenhed", "storkbook_tjek",
] as const;
export type StorkbookType = (typeof STORKBOOK_TYPER)[number];
export type PushType = "klub" | "opstart_flag" | "missing_one_on_one" | "compliance" | "test" | StorkbookType;

export const PUSH_TEXT: Record<PushType, { title: string; body: string; url: string }> = {
  klub: { title: "Ny Klub-milepæl", body: "Du har nået et nyt Klub-niveau. Se det i Storkbook.", url: "/storkbook" },
  opstart_flag: { title: "Opstart", body: "En ny sælger på dit hold har brug for en hånd.", url: "/opstartshold" },
  missing_one_on_one: { title: "1-1 mangler", body: "Der mangler ugens 1-1 for nye sælgere.", url: "/opstartshold" },
  compliance: { title: "Compliance", body: "Der er en kritisk compliance-alarm. Åbn Stork for detaljer.", url: "/compliance" },
  test: { title: "Stork", body: "Testnotifikation – det virker.", url: "/" },
  storkbook_besked: { title: "Ny besked", body: "Du har en ny besked i Storkbook.", url: "/storkbook?tab=beskeder" },
  storkbook_ros: { title: "Ros", body: "Du har fået ros i Storkbook.", url: "/storkbook" },
  storkbook_svar: { title: "Svar", body: "Der er kommet svar på dit spørgsmål.", url: "/storkbook" },
  storkbook_kommentar: { title: "Kommentar", body: "Der er en ny kommentar på dit opslag.", url: "/storkbook" },
  storkbook_reaktion: { title: "Reaktion", body: "Der er nye reaktioner på dit opslag.", url: "/storkbook" },
  storkbook_omtale: { title: "Omtale", body: "Du er nævnt i Storkbook.", url: "/storkbook" },
  storkbook_begivenhed: { title: "Begivenhed i morgen", body: "Begivenhed i morgen", url: "/storkbook?tab=begivenheder" },
  storkbook_tjek: { title: "Din besked", body: "Din besked afventer dig", url: "/storkbook?tab=beskeder" },
};

export const PUSH_PREF_TYPES = [
  { key: "klub", label: "Klub-milepæle" },
  { key: "opstart_flag", label: "Opstart: sælger har brug for en hånd" },
  { key: "missing_one_on_one", label: "Manglende 1-1" },
  { key: "compliance", label: "Kritisk compliance" },
] as const;

/** Sælgeren selv må aldrig modtage sit eget opstartsflag. */
export function filterOpstartRecipients(recipientEmployeeIds: string[], flaggedSellerIds: string[]): string[] {
  const flagged = new Set(flaggedSellerIds);
  return recipientEmployeeIds.filter((id) => !flagged.has(id));
}
