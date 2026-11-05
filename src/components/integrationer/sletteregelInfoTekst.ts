// SR2: infoknappens tekst for Sletteregler-fanen (byggeproces §4: brugerinformation ligger i appen; ordlyden ejes af ledelsen).
export const SLETTEREGEL_INFO_VERSION = "2026-11-04";
export const SLETTEREGEL_INFO_KNAP_TEKST = "Sådan virker sletteregler";
export const SLETTEREGEL_INFO_INDLEDNING =
  "Intet hentes, før hver datatype har en sletteregel. Klienten er reglen; kampagne og kolonne er undtagelser. Der findes ingen standardfrister.";

export const SLETTEREGEL_INFO: { id: string; titel: string; punkter: string[] }[] = [
  {
    id: "trin",
    titel: "De fire trin",
    punkter: [
      "Kladde: du taster en frist i dage. Intet ændrer sig endnu.",
      "Prøvet: Stork tæller, hvad fristen rammer i dag – kald, kunder, emner, sessions, hændelser og salg – og sammenligner med den gældende regel.",
      "Godkendt: ejer bekræfter tallene.",
      "Aktiv: superadmin aktiverer med en begrundelse. Fristen gælder fra næste hentning; oprydning og salgsrensning følger fra næste nat.",
    ],
  },
  {
    id: "hvem",
    titel: "Hvem må hvad",
    punkter: [
      "Ledere kan se reglerne.",
      "Ejer opretter, prøver og godkender.",
      "Kun superadmin aktiverer eller fjerner en regel. Databasen afviser alt andet, uanset hvor klikket kommer fra.",
    ],
  },
  {
    id: "ord",
    titel: "Ordene på fanen",
    punkter: [
      "Fra klient: kampagnen følger klientens frist – også nye kampagner under klienten.",
      "Egen: kampagnen har sin egen frist (undtagelse) og følger ikke klienten.",
      "Hentes ikke: kampagnen er bevidst fravalgt, fx klientens egne brugere. Porten henter intet, og eksisterende rækker røres ikke.",
      "Mangler regel: kampagnen hentes ikke, før den er koblet til en klientkampagne med frist – eller afgjort »hentes ikke«.",
    ],
  },
  {
    id: "ryd",
    titel: "Hvad ryddes",
    punkter: [
      "Kampagnefristen afgør hvornår. Kolonnens klassifikation afgør hvad: tekniske felter og forretningstal beholdes; identifikatorer, personoplysninger og ikke-klassificerede felter ryddes.",
      "En kortere kolonnefrist går forud for kampagnens.",
      "Samme frist bruges af salgsrensningen. Rensningstype vælges under Compliance › Opbevaring.",
    ],
  },
];
