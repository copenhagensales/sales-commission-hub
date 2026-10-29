// Tekst til infoknappen »Sådan virker Beskeder« (24d2). Kun tekst – ingen logik ud over driftsblokken.
// Ordlyden ejes af ledelsen (Mathias/Kasper) og kan rettes her. 29/10 (Mathias): kun indledning, privatliv, tjek og første slettefrist-punkt – resten fjernet. Versionen noteres i ændringsloggen som bevis for, hvad der blev vist hvornår.
export const BESKEDER_INFO_VERSION = "2026-10-30";
export const BESKEDER_INFO_KNAP_TEKST = "Sådan virker Beskeder";
/** Indledning øverst i arket: forklarer tjekket, før afsnittene henviser til det (Mathias 29/10). */
export const BESKEDER_INFO_INDLEDNING = "Stork tjekker automatisk hver besked for hård tone og personoplysninger, før den leveres til modtageren. Her kan du se, hvad det betyder for dig.";

export interface BeskederInfoStatus {
  /** false = driftsopslaget mangler eller fejlede (useSbDrift status "ukendt"); så loves intet om filer/tekst. */
  kendt: boolean;
  pause: boolean;
  filTilladt: boolean;
}

/** Driftsblokken »Lige nu« i arket: en kendt pause først; ukendt status siges ærligt; derefter lukket filvej; åben drift giver ingen blok. */
export function ligeNuTekster(status?: BeskederInfoStatus): string[] {
  if (!status) return [];
  if (status.pause) return ["Beskeder er på pause: du kan læse, men ikke sende. Din kladde bevares."];
  if (!status.kendt) return ["Driftsstatus kan ikke hentes lige nu. Prøv igen om lidt."];
  if (!status.filTilladt) return ["Filer kan ikke sendes lige nu. Tekstbeskeder virker som normalt."];
  return [];
}

export interface InfoAfsnit {
  id: string;
  titel: string;
  punkter: string[];
}

export const BESKEDER_INFO: InfoAfsnit[] = [
  {
    id: "privat",
    titel: "Dine samtaler er stadig private",
    punkter: [
      "Kun deltagerne i en samtale kan læse den. Det er uændret.",
      "Tjekket er automatisk: et program læser beskeden, før den leveres. Ingen kollega eller leder læser dine beskeder som led i tjekket.",
      "Finder tjekket noget, er det kun dig, der får besked. Modtageren ser bare beskeden, når den er leveret.",
      "Tjekkets logfiler indeholder ingen beskedtekst – kun tekniske koder.",
    ],
  },
  {
    id: "tjek",
    titel: "Tjek før levering",
    punkter: [
      "Når du trykker Send, gemmes beskeden med det samme og vises med et gråt flueben, mens den tjekkes. Det tager som regel få sekunder.",
      "Modtageren ser først beskeden, når tjekket er færdigt.",
      "Tjekket ser efter hård tone og personoplysninger (telefon, e-mail, konto, adresse, helbred, CPR). Finder det noget, får du et kort med »Ret«, »Send alligevel« eller »Fjern fil«. Ingen andre ser beskeden, før du har valgt.",
    ],
  },
  {
    id: "sletning",
    titel: "Slettefrister",
    punkter: [
      "Beskeder og filer med personoplysninger slettes automatisk efter 7 dage. Fristen står på beskeden (»Slettes om 7 dage«) og kan ikke forlænges.",
    ],
  },
];
