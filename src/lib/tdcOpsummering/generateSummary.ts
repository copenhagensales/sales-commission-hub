/**
 * TDC Opsummering – ren tekstgenerator.
 * Single source of truth for både intern (/tdc-opsummering) og offentlig (/tdc-public).
 * Ingen React, ingen Supabase.
 */

export interface SummaryLine {
  text: string;
  isRed?: boolean;
}

export type MbbType = "mobilevoice" | "datadelingskort" | null;
export type NumberChoice = "existing" | "mixed" | "new";
export type StartupChoice = "asap" | "specific";
export type SummaryVariant = "standard" | "pilot" | "5g-fri";

export interface SummaryState {
  isEnglish: boolean;
  summaryVariant: SummaryVariant;
  mbbType: MbbType;
  includeWithoutRouter: boolean;
  numberChoice: NumberChoice | null;
  startupChoice: StartupChoice | null;
  hasSubsidy: boolean;
  hasOmstilling: boolean;
  isStandardOmstilling: boolean;
}

export const TRANSLATIONS: Record<string, string> = {
  "For at sikre, at der ikke opstår misforståelser, vil jeg lige opsummere aftalen med dig. Jeg skal gøre opmærksom på, at samtalen nu optages.":
    "To ensure there are no misunderstandings, I would like to summarise the agreement with you. Please note that the call is now being recorded.",
  "Aftalen bliver oprettet i (firmanavn) med CVR-nummer (CVR-nummer). Kontaktpersonen er (navn), og det telefonnummer vi benytter, er (telefonnummer).":
    "The agreement will be set up under (company name) with CVR number (CVR number). The contact person is (name), and the phone number we will use is (phone number).",
  "Du får (antal + fulde produktnavn + datamængde) til en månedlig pris på (beløb) kr. ekskl. moms.":
    "You will receive (quantity + full product name + data allowance) at a monthly price of (amount) excl. VAT.",
  "Du får (antal + fulde produktnavn + hastighedsbegrænsning) til en månedlig pris på (beløb) kr. ekskl. moms.":
    "You will receive (quantity + full product name + speed limitation) at a monthly price of (amount) excl. VAT.",
  "Der oprettes et mobilt bredbånd gennem et mobilabonnement. Det får et fiktivt nummer, som vil fremgå i din ordrebekræftelse.":
    "A mobile broadband connection will be set up through a mobile subscription. It will be assigned a fictitious number, which will appear in your order confirmation.",
  "Det mobile bredbånd oprettes som et datadelingskort, som deler data med mobilabonnementet/puljen, det er tilknyttet. Derfor står det ikke som et selvstændigt abonnement på fremtidige fakturaer.":
    "The mobile broadband will be set up as a data sharing card, which shares data with the mobile subscription/pool it is linked to. Therefore, it will not appear as a separate subscription on future invoices.",
  "Der medfølger ikke en router til abonnementet, så du skal selv sørge for en router.":
    "A router is not included with the subscription, so you will need to provide your own router.",
  "I er bundet på kontrakten i 36 måneder.":
    "You are bound by the contract for 36 months.",
  "Abonnementet har 12 måneders binding og derefter 3 måneders opsigelse. Du modtager en ordrebekræftelse inden for 14 dage, hvori opstartsdatoerne fremgår. Vi kan ikke opsige dit nuværende internet for dig, vi anbefaler derfor at du matcher opsigelsen med vores oprettelsesdato der fremgår i ordrebekræftelsen.":
    "The subscription has a 12-month commitment period followed by 3 months' notice. You will receive an order confirmation within 14 days, which will include the start dates. We are unable to cancel your current internet service on your behalf; we therefore recommend that you align the cancellation with our activation date as stated in the order confirmation.",
  "Inden for 7 hverdage vil i blive kontaktet af min kollega, som vil byde jer velkommen og få hjulpet med nummeroverflytning.":
    "Within 7 business days, you will be contacted by a colleague of mine who will welcome you and assist with the number porting process.",
  "Vi har snakket om, at det som udgangspunkt er":
    "We have discussed that the starting point is",
  "(antal) eksisterende numre":
    "(quantity) existing numbers",
  "(antal) eksisterende numre og (antal) nye numre":
    "(quantity) existing numbers and (quantity) new numbers",
  "Udelukkende nye numre der oprettes":
    "Exclusively new numbers to be created",
  "Hvilke numre i ønsker, er op til jer, men antallet af abonnementer skal overholdes":
    "Which numbers you choose is up to you, but the total number of subscriptions must be maintained.",
  "Numrene starter som udgangspunkt op, når bindingen og opsigelsesperioden hos jeres nuværende udbyder udløber. Vi bestræber os på en samlet opstart, men datoerne for nummerflytning afhænger af jeres nuværende udbyder.":
    "The numbers will, as a starting point, be activated once the commitment and notice period with your current provider expires. We will aim for a simultaneous activation, but the dates for number porting depend on your current provider.",
  "Jeg vil lige bede dig bekræfte, at det er følgende numre, der skal indgå i aftalen: [X, Y, Z].":
    "I would like to ask you to confirm that the following numbers are to be included in the agreement: [X, Y, Z].",
  "Jeg vil lige bede dig bekræfte, at de numre, der skal indgå i aftalen, er [X, Y, Z], og at vi derudover opretter (antal) nye mobilnumre.":
    "I would like to ask you to confirm that the numbers to be included in the agreement are [X, Y, Z], and that we will additionally set up (quantity) new mobile numbers.",
  "Jeg vil lige bede dig bekræfte, at du ikke ønsker at flytte eksisterende numre med over, og at løsningen derfor udelukkende skal bestå af nye mobilnumre.":
    "I would like to ask you to confirm that you do not wish to transfer any existing numbers, and that the solution will therefore consist exclusively of new mobile numbers.",
  "Dine nye numre starter (hurtigst muligt eller på bestemt dato).":
    "Your new numbers will be activated (as soon as possible or on a specific date).",
  "Vi opsiger kun de numre, vi har aftalt, bliver overflyttet. Internet og produkter uden et nummer tilkoblet skal du derfor selv opsige.":
    "We will only cancel the numbers that we have agreed will be ported. Internet services and products without an associated number must be cancelled by you.",
  "Da vi opretter nye abonnementer opsiger vi derfor intet du måtte have ved andre udbydere.":
    "As we are setting up new subscriptions, we will not cancel anything you may have with other providers.",
  "Numrene starter op, når bindingen og opsigelsesperioden hos jeres nuværende udbyder udløber. Vi bestræber os på en samlet opstart, men datoerne for nummerflytning afhænger af jeres nuværende udbyder.":
    "The numbers will be activated once the commitment and notice period with your current provider expires. We will aim for a simultaneous activation, but the dates for number porting depend on your current provider.",
  "Vi har aftalt, at numrene flyttes den (dato). Hvis det ligger før jeres nuværende udbyders bindings- eller opsigelsesperiode, kan de opkræve et gebyr for tidlig udtrædelse.":
    "We have agreed that the numbers will be ported on (date). If this falls before the end of your current provider's commitment or notice period, they may charge an early termination fee.",
  "Du modtager en ordrebekræftelse inden for 14 dage, hvori opstartsdatoerne fremgår.":
    "You will receive an order confirmation within 14 days, which will include the activation dates.",
  "Det er muligt at tilføje ekstra abonnementer til samme priser som står i kontrakten i hele kontraktperioden. Det er også muligt at opsige abonnementer i perioden med 3 måneders varsel, hvilket muliggør løbende udskiftning af numre og op- og nedgradering af abonnementer, så længe den samlede månedlige pris overholdes.":
    "It is possible to add additional subscriptions at the same prices as stated in the contract throughout the contract period. It is also possible to cancel subscriptions during the period with 3 months' notice, which allows for ongoing replacement of numbers as well as upgrading and downgrading of subscriptions, as long as the total monthly price is maintained.",
  "Du får et tilskud på (beløb), som kan bruges fra kontraktens startdato (dato), hvor det samtidig bliver tilgængeligt i vores selvbetjeningsunivers.":
    "You will receive a subsidy of (amount), which can be used from the contract start date (date), at which point it will also become available in our self-service portal.",
  "Hvis du har behov for at benytte tilskuddet før denne dato, så har du mulighed for at lave en udlægsordning, hvor du betaler for produktet nu, og derefter får krediteret pengene på datoen, hvor tilskuddet vil blive frigivet. Du kan ikke få refunderet mere end du har lagt ud for.":
    "If you need to use the subsidy before this date, you have the option of an advance payment arrangement, where you pay for the product now and are then credited the amount on the date the subsidy is released. You cannot be refunded more than you have paid out.",
  "Vi har talt om, at du skal bruge tilskuddet på disse produkter:":
    "We have discussed that you will use the subsidy for the following products:",
  "(Nævn produkt og gigabyte, samt deres pris og eventuel resterende egenbetaling - Hvis router nævn også forbindelsestype 4G/5G)":
    "(Mention product and gigabytes, as well as their price and any remaining out-of-pocket payment – If a router, also mention connection type 4G/5G)",
  "Tilskuddet bruges som rabatkode i vores webshop, hvor vi altid bestræber os på at have lageret fyldt. Jeg kan ikke foretage bestillingen for dig, det gør du selv via shoppen.":
    "The subsidy is used as a discount code in our webshop, where we always aim to keep the stock full. I cannot place the order for you; you do so yourself via the shop.",
  "I forhold til jeres omstilling og hvordan den skal virke, så er det noget i aftaler med min kollega der ringer og byder jer velkommen.":
    "Regarding your switchboard and how it should work, this is something you will arrange with the colleague who calls to welcome you.",
  "Gennemgå kaldsflow (Når man ringer på hovednummeret, hvad sker der så?) Gennemgå hardware (Hvad for noget udstyr skal kunden bruge til omstillingen)":
    "Review the call flow (When someone calls the main number, what happens?) Review hardware (What equipment does the customer need for the switchboard?)",
  "Hvis du i fremtiden for brug får menuvalg, er det muligt at tilkøbe.":
    "If you need call menu options in the future, it is possible to purchase this as an add-on.",
  "Har du nogle spørgsmål til mig?":
    "Do you have any questions for me?",
};

export function generateSummary(state: SummaryState): SummaryLine[] {
  const {
    isEnglish,
    summaryVariant,
    mbbType,
    includeWithoutRouter,
    numberChoice,
    startupChoice,
    hasSubsidy,
    hasOmstilling,
    isStandardOmstilling,
  } = state;

  const isPilot = summaryVariant === "pilot";
  const kun5gFriSalg = summaryVariant === "5g-fri";
  const t = (da: string) => (isEnglish ? TRANSLATIONS[da] ?? da : da);
  const lines: SummaryLine[] = [];

  // Kun 5g Fri Salg shortcut
  if (kun5gFriSalg) {
    lines.push({ text: t("For at sikre, at der ikke opstår misforståelser, vil jeg lige opsummere aftalen med dig. Jeg skal gøre opmærksom på, at samtalen nu optages.") });
    lines.push({ text: "" });
    lines.push({ text: t("Aftalen bliver oprettet i (firmanavn) med CVR-nummer (CVR-nummer). Kontaktpersonen er (navn), og det telefonnummer vi benytter, er (telefonnummer).") });
    lines.push({ text: "" });
    lines.push({ text: t("Du får (antal + fulde produktnavn + hastighedsbegrænsning) til en månedlig pris på (beløb) kr. ekskl. moms.") });
    lines.push({ text: "" });
    lines.push({ text: t("Abonnementet har 12 måneders binding og derefter 3 måneders opsigelse. Du modtager en ordrebekræftelse inden for 14 dage, hvori opstartsdatoerne fremgår. Vi kan ikke opsige dit nuværende internet for dig, vi anbefaler derfor at du matcher opsigelsen med vores oprettelsesdato der fremgår i ordrebekræftelsen.") });
    lines.push({ text: "" });
    lines.push({ text: t("Har du nogle spørgsmål til mig?") });
    return lines;
  }

  // 1. Introduction
  lines.push({ text: t("For at sikre, at der ikke opstår misforståelser, vil jeg lige opsummere aftalen med dig. Jeg skal gøre opmærksom på, at samtalen nu optages.") });
  lines.push({ text: "" });

  // 2. Basic info
  lines.push({ text: t("Aftalen bliver oprettet i (firmanavn) med CVR-nummer (CVR-nummer). Kontaktpersonen er (navn), og det telefonnummer vi benytter, er (telefonnummer).") });
  lines.push({ text: "" });

  // 3. Product line
  lines.push({ text: t("Du får (antal + fulde produktnavn + datamængde) til en månedlig pris på (beløb) kr. ekskl. moms.") });
  lines.push({ text: "" });

  if (mbbType === "mobilevoice") {
    lines.push({ text: t("Der oprettes et mobilt bredbånd gennem et mobilabonnement. Det får et fiktivt nummer, som vil fremgå i din ordrebekræftelse.") });
    lines.push({ text: "" });
  }
  if (mbbType === "datadelingskort") {
    lines.push({ text: t("Det mobile bredbånd oprettes som et datadelingskort, som deler data med mobilabonnementet/puljen, det er tilknyttet. Derfor står det ikke som et selvstændigt abonnement på fremtidige fakturaer.") });
    lines.push({ text: "" });
  }
  if (mbbType && includeWithoutRouter) {
    lines.push({ text: t("Der medfølger ikke en router til abonnementet, så du skal selv sørge for en router.") });
    lines.push({ text: "" });
  }

  // Vilkår
  lines.push({ text: t("I er bundet på kontrakten i 36 måneder.") });
  lines.push({ text: "" });

  if (isPilot) {
    lines.push({ text: t("Inden for 7 hverdage vil i blive kontaktet af min kollega, som vil byde jer velkommen og få hjulpet med nummeroverflytning.") });
    lines.push({ text: "" });

    if (numberChoice === "existing") {
      lines.push({ text: t("Vi har snakket om, at det som udgangspunkt er") });
      lines.push({ text: t("(antal) eksisterende numre") });
      lines.push({ text: "" });
    } else if (numberChoice === "mixed") {
      lines.push({ text: t("Vi har snakket om, at det som udgangspunkt er") });
      lines.push({ text: t("(antal) eksisterende numre og (antal) nye numre") });
      lines.push({ text: "" });
    } else if (numberChoice === "new") {
      lines.push({ text: t("Vi har snakket om, at det som udgangspunkt er") });
      lines.push({ text: t("Udelukkende nye numre der oprettes") });
      lines.push({ text: "" });
    }

    if (numberChoice) {
      lines.push({ text: t("Hvilke numre i ønsker, er op til jer, men antallet af abonnementer skal overholdes") });
      lines.push({ text: "" });
    }

    if (numberChoice && numberChoice !== "new") {
      lines.push({ text: t("Numrene starter som udgangspunkt op, når bindingen og opsigelsesperioden hos jeres nuværende udbyder udløber. Vi bestræber os på en samlet opstart, men datoerne for nummerflytning afhænger af jeres nuværende udbyder.") });
      lines.push({ text: "" });
    }
  } else {
    if (numberChoice === "existing") {
      lines.push({ text: t("Jeg vil lige bede dig bekræfte, at det er følgende numre, der skal indgå i aftalen: [X, Y, Z].") });
      lines.push({ text: "" });
    } else if (numberChoice === "mixed") {
      lines.push({ text: t("Jeg vil lige bede dig bekræfte, at de numre, der skal indgå i aftalen, er [X, Y, Z], og at vi derudover opretter (antal) nye mobilnumre.") });
      lines.push({ text: "" });
    } else if (numberChoice === "new") {
      lines.push({ text: t("Jeg vil lige bede dig bekræfte, at du ikke ønsker at flytte eksisterende numre med over, og at løsningen derfor udelukkende skal bestå af nye mobilnumre.") });
      lines.push({ text: "" });
    }

    if (numberChoice === "new") {
      lines.push({ text: t("Dine nye numre starter (hurtigst muligt eller på bestemt dato).") });
      lines.push({ text: "" });
    }

    if (numberChoice === "existing" || numberChoice === "mixed") {
      lines.push({ text: t("Vi opsiger kun de numre, vi har aftalt, bliver overflyttet. Internet og produkter uden et nummer tilkoblet skal du derfor selv opsige.") });
      lines.push({ text: "" });
    }
    if (numberChoice === "new") {
      lines.push({ text: t("Da vi opretter nye abonnementer opsiger vi derfor intet du måtte have ved andre udbydere.") });
      lines.push({ text: "" });
    }

    if (numberChoice === "existing" || numberChoice === "mixed") {
      if (startupChoice === "asap") {
        lines.push({ text: t("Numrene starter op, når bindingen og opsigelsesperioden hos jeres nuværende udbyder udløber. Vi bestræber os på en samlet opstart, men datoerne for nummerflytning afhænger af jeres nuværende udbyder.") });
        lines.push({ text: "" });
      } else if (startupChoice === "specific") {
        lines.push({ text: t("Vi har aftalt, at numrene flyttes den (dato). Hvis det ligger før jeres nuværende udbyders bindings- eller opsigelsesperiode, kan de opkræve et gebyr for tidlig udtrædelse.") });
        lines.push({ text: "" });
      }
    }

    lines.push({ text: t("Du modtager en ordrebekræftelse inden for 14 dage, hvori opstartsdatoerne fremgår.") });
    lines.push({ text: "" });
  }

  // Tilføj/opsig
  lines.push({ text: t("Det er muligt at tilføje ekstra abonnementer til samme priser som står i kontrakten i hele kontraktperioden. Det er også muligt at opsige abonnementer i perioden med 3 måneders varsel, hvilket muliggør løbende udskiftning af numre og op- og nedgradering af abonnementer, så længe den samlede månedlige pris overholdes.") });
  lines.push({ text: "" });

  // Subsidy
  if (hasSubsidy) {
    lines.push({ text: t("Du får et tilskud på (beløb), som kan bruges fra kontraktens startdato (dato), hvor det samtidig bliver tilgængeligt i vores selvbetjeningsunivers.") });
    lines.push({ text: "" });
    lines.push({ text: t("Hvis du har behov for at benytte tilskuddet før denne dato, så har du mulighed for at lave en udlægsordning, hvor du betaler for produktet nu, og derefter får krediteret pengene på datoen, hvor tilskuddet vil blive frigivet. Du kan ikke få refunderet mere end du har lagt ud for.") });
    lines.push({ text: "" });
    lines.push({ text: t("Vi har talt om, at du skal bruge tilskuddet på disse produkter:") });
    lines.push({ text: "" });
    lines.push({ text: t("(Nævn produkt og gigabyte, samt deres pris og eventuel resterende egenbetaling - Hvis router nævn også forbindelsestype 4G/5G)"), isRed: true });
    lines.push({ text: "" });
    lines.push({ text: t("Tilskuddet bruges som rabatkode i vores webshop, hvor vi altid bestræber os på at have lageret fyldt. Jeg kan ikke foretage bestillingen for dig, det gør du selv via shoppen.") });
    lines.push({ text: "" });
  }

  // Omstilling
  if (isPilot) {
    lines.push({ text: t("I forhold til jeres omstilling og hvordan den skal virke, så er det noget i aftaler med min kollega der ringer og byder jer velkommen.") });
    lines.push({ text: "" });
    if (isStandardOmstilling) {
      lines.push({ text: t("Hvis du i fremtiden for brug får menuvalg, er det muligt at tilkøbe.") });
      lines.push({ text: "" });
    }
  } else if (hasOmstilling) {
    lines.push({ text: t("Gennemgå kaldsflow (Når man ringer på hovednummeret, hvad sker der så?) Gennemgå hardware (Hvad for noget udstyr skal kunden bruge til omstillingen)"), isRed: true });
    lines.push({ text: "" });
    if (isStandardOmstilling) {
      lines.push({ text: t("Hvis du i fremtiden for brug får menuvalg, er det muligt at tilkøbe.") });
      lines.push({ text: "" });
    }
  }

  lines.push({ text: t("Har du nogle spørgsmål til mig?") });

  return lines;
}
