/**
 * Faste push-tekster. Må aldrig indeholde beløb, tal, navne eller kundedetaljer.
 * Kopieret 1:1 til src/lib/push/pushText.ts for test – hold dem ens.
 */
export type PushType = "klub" | "opstart_flag" | "missing_one_on_one" | "compliance" | "test";

export const PUSH_TEXT: Record<PushType, { title: string; body: string; url: string }> = {
  klub: { title: "Ny Klub-milepæl", body: "Du har nået et nyt Klub-niveau. Se det i Storkbook.", url: "/storkbook" },
  opstart_flag: { title: "Opstart", body: "En ny sælger på dit hold har brug for en hånd.", url: "/opstartshold" },
  missing_one_on_one: { title: "1-1 mangler", body: "Der mangler ugens 1-1 for nye sælgere.", url: "/opstartshold" },
  compliance: { title: "Compliance", body: "Der er en kritisk compliance-alarm. Åbn Stork for detaljer.", url: "/compliance" },
  test: { title: "Stork", body: "Testnotifikation – det virker.", url: "/" },
};
