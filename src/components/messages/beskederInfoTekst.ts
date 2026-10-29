// Tekst til infoknappen »Sådan virker Beskeder« (24d2). Kun tekst – ingen logik ud over driftsblokken.
// Ordlyden ejes af ledelsen (Mathias/Kasper) og kan rettes her. Versionen noteres i ændringsloggen som bevis for, hvad der blev vist hvornår.
export const BESKEDER_INFO_VERSION = "2026-10-29";
export const BESKEDER_INFO_KNAP_TEKST = "Sådan virker Beskeder";

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
      "Tjekket er automatisk. Ingen kollega eller leder læser dine beskeder som led i tjekket.",
      "Resultatet af tjekket vises kun for dig. Modtageren ser bare beskeden, når den er leveret.",
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
      "CPR-numre må skrives i en besked og følger samme 7-dages regel. En fil, der indeholder et CPR-nummer, kan ikke sendes – fjern filen eller ret den.",
    ],
  },
  {
    id: "filer",
    titel: "Filer",
    punkter: [
      "Du kan sende billeder (JPEG, PNG, WebP, GIF) op til 10 MB og tekstfiler op til 20 KB. PDF, Word og Excel kan ikke sendes i chatten.",
      "Filer åbnes kun inde i Stork. Der er ingen offentlige links.",
      "Genindlæser du siden, mens en fil ligger i en uafsendt kladde, kan appen bede dig vælge filen igen.",
    ],
  },
  {
    id: "vedligehold",
    titel: "Vedligeholdelse",
    punkter: [
      "I korte perioder kan filer være lukket, eller beskeder sat på pause. Appen viser det ved skrivefeltet eller som et banner. Din kladde bevares.",
      "Har du en gammel fane åben, så genindlæs siden, hvis afsendelse afvises.",
    ],
  },
  {
    id: "uaendret",
    titel: "Det, der ikke ændrer sig",
    punkter: [
      "Opslag, kommentarer, begivenheder og ros er uændrede. Hvem der kan skrive til hvem, er uændret.",
      "Push og mail virker som før. Ny push-type: »Din besked afventer dig«.",
    ],
  },
  {
    id: "spoergsmaal",
    titel: "Spørgsmål",
    punkter: ["Brug Feedback i Stork, eller spørg din leder."],
  },
];
