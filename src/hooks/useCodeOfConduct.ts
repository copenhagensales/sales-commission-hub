import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { differenceInDays } from "date-fns";

export type CocVariant = "salgskonsulent" | "fieldmarketing";

// All 31 questions for Salgskonsulenter (telefonisk salg)
export const SALGSKONSULENT_COC_QUESTIONS = [
  {
    id: 1,
    question: "En kunde beder dig om at slette deres nummer fra vores database og siger tydeligt, at de ikke ønsker at blive kontaktet igen. Hvad gør du?",
    options: [
      'Trykker "kunden ønsker ikke at blive kontaktet" / "må ikke kontaktes"',
      'Trykker "ikke interesseret"',
      'Trykker "telefonsvarer"',
    ],
    correctAnswer: 'Trykker "kunden ønsker ikke at blive kontaktet" / "må ikke kontaktes"',
  },
  {
    id: 2,
    question: 'En kunde er meget flabet og irriterende og beder om at få deres oplysninger slettet. Du vælger i stedet at markere kunden som "telefonsvarer", velvidende at de så bliver ringet op af en kollega. Hvilke konsekvenser kan dette have for dit job i yderste instans?',
    options: [
      "Ingen – jeg siger bare, at det var et uheld",
      "En løftet pegefinger",
      "En advarsel",
      "Bortvisning fra Copenhagen Sales",
    ],
    correctAnswer: "Bortvisning fra Copenhagen Sales",
  },
  {
    id: 3,
    question: "Du skal optage din obligatoriske opsummering af salget. Hvad skal du gøre for at overholde GDPR?",
    options: [
      "Før jeg optager, informerer jeg kunden om, at opsummeringen optages til dokumentation, og spørger om det er okay.",
      "Jeg optager samtalen og fortæller det til kunden, hvis de spørger.",
    ],
    correctAnswer: "Før jeg optager, informerer jeg kunden om, at opsummeringen optages til dokumentation, og spørger om det er okay.",
  },
  {
    id: 4,
    question: "Må du lave et opslag på sociale medier og skrive, at hvis nogen gerne vil have et godt tilbud (din kampagne), så kan de bare kontakte dig – uden at det er godkendt af Copenhagen Sales/kunden?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 5,
    question: "Må du printe og dele flyers ud til dine naboer, hvor de kan få gode tilbud gennem dig – uden at det er godkendt?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 6,
    question: "Du ser en diskussion på nettet, der omhandler et af de produkter, du sælger. Må du skrive i diskussionen, at du arbejder for kunden og kan kontaktes, uden at det er aftalt?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 7,
    question: "Man må gerne opfinde nye produktnavne, så det lyder mere attraktivt for kunden, selvom det ikke er et officielt produktnavn.",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 8,
    question: "Efter et salg er gennemført, må man så gemme personfølsomme oplysninger (fx CPR-nummer, registreringsnummer, kontonummer) på papir eller andre steder end de systemer, kunden og Copenhagen Sales har godkendt?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 9,
    question: "Hvordan informerer du korrekt en kunde om deres annulleringsperiode ved salg til private?",
    options: [
      "Jeg informerer kunden om, at de har 14 dage til at teste, om produktet er det rette for dem.",
      "Jeg informerer kunden om deres 14 dages annullerings-/fortrydelsesret.",
    ],
    correctAnswer: "Jeg informerer kunden om deres 14 dages annullerings-/fortrydelsesret.",
  },
  {
    id: 10,
    question: "Du sælger et produkt, men undlader bevidst at informere om væsentlige detaljer for at få kunden til at købe. Er det i orden?",
    options: [
      "Det er ikke i orden, da vi skal sikre, at kunden får alle væsentlige oplysninger, før de godkender en aftale. Det er vores ansvar at være transparente og give korrekt information.",
      "Det er bare sådan, det er med salg.",
      "Kunden har selv ansvar for at læse en aftale, før de underskriver den eller siger ja.",
    ],
    correctAnswer: "Det er ikke i orden, da vi skal sikre, at kunden får alle væsentlige oplysninger, før de godkender en aftale. Det er vores ansvar at være transparente og give korrekt information.",
  },
  {
    id: 11,
    question: "Må man dele emner mellem kampagner/brands? For eksempel hvis en TDC-kunde spørger om en privat aftale, og du tilbyder at få en kollega fra Eesy til at kontakte dem – uden at kunden udtrykkeligt har sagt ja til det?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 12,
    question: "Må du kontakte en kunde via et telefonnummer, der ikke er i ringesystemet? For eksempel et nummer, du har fået fra en ven eller fundet på sociale medier?",
    options: ["Nej", "Ja"],
    correctAnswer: "Nej",
  },
  {
    id: 13,
    question: "Ved afslutningen af et salgskald skal du huske at lave en opsummering. Hvordan skal den udføres?",
    options: [
      "Opsummeringen skal være 100 % ordret – kunden skal kunne genkende aftalen, og du må ikke ændre indholdet.",
      "Jeg skal kun tage de vigtigste elementer fra opsummeringen og gengive dem med mine egne ord.",
    ],
    correctAnswer: "Opsummeringen skal være 100 % ordret – kunden skal kunne genkende aftalen, og du må ikke ændre indholdet.",
  },
  {
    id: 14,
    question: "Ved afslutningen af et salgskald skal du huske at lave en opsummering. Hvad kan konsekvensen være, hvis du glemmer det?",
    options: [
      "Jeg kan få fratrukket min provision, og hvis der kommer en klage, har Copenhagen Sales ikke mulighed for at bevise, at jeg har gennemført salget korrekt.",
      "Ikke noget, så længe salget er godt.",
    ],
    correctAnswer: "Jeg kan få fratrukket min provision, og hvis der kommer en klage, har Copenhagen Sales ikke mulighed for at bevise, at jeg har gennemført salget korrekt.",
  },
  {
    id: 15,
    question: "Hvad kan konsekvensen være, hvis jeg bevidst lyver eller vildleder en kunde om et produkt?",
    options: [
      "Jeg kan miste mit job og blive bortvist.",
      "Jeg kan blive flyttet over på en anden opgave.",
      "Jeg kan få en advarsel.",
    ],
    correctAnswer: "Jeg kan miste mit job og blive bortvist.",
  },
  {
    id: 16,
    question: "Må vi love noget til en kunde, hvis vi ikke med sikkerhed ved, at vi kan levere det?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 17,
    question: "Hvilke etiske overvejelser skal vi gøre os, når vi sælger produkter eller tjenester til sårbare kunder?",
    options: [
      "Vi skal sikre, at kunden forstår, hvad de siger ja til, og er i stand til at træffe en informeret beslutning. Vi sælger ikke til personer, der lyder berusede, forvirrede, meget gamle eller på anden måde ikke virker i stand til at vurdere deres beslutning.",
      "Så længe kunden er over 18 år og myndig, må vi sælge til dem.",
    ],
    correctAnswer: "Vi skal sikre, at kunden forstår, hvad de siger ja til, og er i stand til at træffe en informeret beslutning. Vi sælger ikke til personer, der lyder berusede, forvirrede, meget gamle eller på anden måde ikke virker i stand til at vurdere deres beslutning.",
  },
  {
    id: 18,
    question: "Du er træt en dag – må du lægge på, så snart kunden tager røret, for at få en pause?",
    options: [
      "Du må aldrig lægge røret på, når kunden tager telefonen! Du skal altid præsentere dig selv, når en kunde besvarer dit opkald, og må derfor ikke afslutte opkaldet uden at have præsenteret dig selv. Manglende efterlevelse af denne regel anses som grov misligholdelse af ansættelsesaftalen.",
      "Det er fint – bare det ikke er for mange gange i træk.",
    ],
    correctAnswer: "Du må aldrig lægge røret på, når kunden tager telefonen! Du skal altid præsentere dig selv, når en kunde besvarer dit opkald, og må derfor ikke afslutte opkaldet uden at have præsenteret dig selv. Manglende efterlevelse af denne regel anses som grov misligholdelse af ansættelsesaftalen.",
  },
  {
    id: 19,
    question: "Du kommer i en diskussion med en meget sur og uhøflig kunde. Hvordan afslutter du samtalen på en professionel måde?",
    options: [
      "Jeg taler til kunden, som kunden taler til mig.",
      "Jeg smider røret på – kunden forstår ikke andet.",
      "Jeg afslutter samtalen høfligt og professionelt, ønsker kunden en god dag og lader mig ikke påvirke af kundens tone.",
    ],
    correctAnswer: "Jeg afslutter samtalen høfligt og professionelt, ønsker kunden en god dag og lader mig ikke påvirke af kundens tone.",
  },
  {
    id: 20,
    question: 'Må du notere "kunden er syg/har diabetes" i CRM for at forstå kundens behov?',
    options: [
      "Ja, hvis det hjælper salget.",
      "Nej, undlad – det er følsomme oplysninger.",
    ],
    correctAnswer: "Nej, undlad – det er følsomme oplysninger.",
  },
  {
    id: 21,
    question: 'En prospect siger: "Kontakt mig ikke mere." Hvad gør du?',
    options: [
      "Stopper e-mails, men ringer fortsat.",
      'Stopper al kontakt og markerer "må ikke kontaktes" i ringesystemet.',
      "Sletter alle data straks uden registrering.",
    ],
    correctAnswer: 'Stopper al kontakt og markerer "må ikke kontaktes" i ringesystemet.',
  },
  {
    id: 22,
    question: "Må jeg selv lægge numre ind i dialeren? Fx fra en person, jeg møder til en familiefest, eller finder online, som jeg tænker kunne blive en god kunde?",
    options: [
      "Ja, det er fint.",
      "Nej, jeg må aldrig selv oprette emner.",
    ],
    correctAnswer: "Nej, jeg må aldrig selv oprette emner.",
  },
  {
    id: 23,
    question: "Jeg har adgang til kundens system og kan tilgå forskellige ting i systemet. Må jeg fx tage emner over fra kundens system og ringe på dem i ringesystemet, selvom det ikke er aftalt?",
    options: [
      "Ja, for kunden er glad for, at jeg er kreativ, og de får nye kunder – det er det vigtigste.",
      "Nej, det er et alvorligt brud på GDPR og virksomhedens regler. Det kan medføre bortvisning og skade kundens tillid.",
      "Ja, men kun hvis ingen opdager det.",
      "Ja, så længe jeg deler salget med virksomheden.",
    ],
    correctAnswer: "Nej, det er et alvorligt brud på GDPR og virksomhedens regler. Det kan medføre bortvisning og skade kundens tillid.",
  },
  {
    id: 24,
    question: 'Du oplever, at en kollega bevidst bryder GDPR- eller adfærdsreglerne (fx ringer på et nummer, der er markeret "må ikke kontaktes"). Hvad er den rigtige handling?',
    options: [
      "Jeg blander mig ikke – det er mellem kollegaen og ledelsen.",
      "Jeg taler med kollegaen og siger, de skal stoppe, men gør ikke mere.",
      "Jeg informerer min teamleder eller nærmeste leder, så virksomheden kan håndtere det korrekt.",
    ],
    correctAnswer: "Jeg informerer min teamleder eller nærmeste leder, så virksomheden kan håndtere det korrekt.",
  },
  {
    id: 25,
    question: "Din kollega har glemt sit login til systemet og beder om at låne dit brugernavn og password. Hvad gør du?",
    options: [
      "Jeg låner selvfølgelig mine login-oplysninger – vi skal jo bare have kampagnen til at køre.",
      "Jeg siger nej, fordi login er personligt, og henviser kollegaen til at få hjælp via de officielle kanaler (leder/IT).",
      "Jeg giver kun mit login, når lederen siger, det er okay.",
    ],
    correctAnswer: "Jeg siger nej, fordi login er personligt, og henviser kollegaen til at få hjælp via de officielle kanaler (leder/IT).",
  },
  {
    id: 26,
    question: "Du opdager, at du kan give dig selv eller en ven/familie en særlig fordel ved at manipulere med et salg (fx ekstra rabat eller gratis produkt), som ikke er aftalt. Hvad gør du?",
    options: [
      "Jeg gør det – det skader jo ikke, og kunden er glad.",
      "Jeg spørger først, om kollegaerne også vil have samme mulighed.",
      "Jeg gør det ikke og informerer min teamleder, hvis jeg er i tvivl – det kan være snyd og illoyal adfærd overfor kunden og samarbejdspartneren.",
    ],
    correctAnswer: "Jeg gør det ikke og informerer min teamleder, hvis jeg er i tvivl – det kan være snyd og illoyal adfærd overfor kunden og samarbejdspartneren.",
  },
  {
    id: 27,
    question: "Du opdager efter samtalen, at du har givet en forkert oplysning til kunden (fx pris, binding eller vilkår). Hvad gør du?",
    options: [
      "Ingenting – kunden opdager det nok ikke.",
      "Jeg kontakter min teamleder med det samme, så vi kan rette op på fejlen og evt. kontakte kunden igen.",
      "Jeg håber, at opsummeringen lyder overbevisende nok.",
    ],
    correctAnswer: "Jeg kontakter min teamleder med det samme, så vi kan rette op på fejlen og evt. kontakte kunden igen.",
  },
  {
    id: 28,
    question: "Du møder på arbejde og kan mærke, at du stadig er påvirket efter en bytur aftenen før (sløv, uklar, måske stadig lidt fuld). Hvad er korrekt?",
    options: [
      "Det er fint, så længe jeg kan tale og sælge.",
      "Jeg informerer min leder og går ikke i gang med at ringe til kunder, når jeg ikke er skarp og professionel.",
      "Jeg tager kun korte kald, hvor jeg ikke sælger noget.",
    ],
    correctAnswer: "Jeg informerer min leder og går ikke i gang med at ringe til kunder, når jeg ikke er skarp og professionel.",
  },
  {
    id: 29,
    question: "Må du kopiere kunders personoplysninger (navn, telefonnummer, aftaleinfo osv.) ind i eksterne værktøjer eller AI-tjenester, som ikke er godkendt af Copenhagen Sales eller kunden?",
    options: [
      "Ja, det er fint, hvis det hjælper mig med at lave et bedre salg.",
      "Kun hvis jeg sletter data bagefter.",
      "Nej, kundedata må kun bruges i de systemer, som Copenhagen Sales og kunden har godkendt.",
    ],
    correctAnswer: "Nej, kundedata må kun bruges i de systemer, som Copenhagen Sales og kunden har godkendt.",
  },
  {
    id: 30,
    question: "Du trænger til en pause, men systemet ringer videre. Hvad er den korrekte måde at tage en pause på?",
    options: [
      "Lade opkaldene gå igennem og lægge røret på, så snart kunden svarer.",
      "Lade telefonen ringe igennem uden at tage den, så systemet selv lægger på.",
      "Bruge de officielle pause-/wrap-up-funktioner i systemet eller aftale en pause med teamlederen.",
    ],
    correctAnswer: "Bruge de officielle pause-/wrap-up-funktioner i systemet eller aftale en pause med teamlederen.",
  },
  {
    id: 31,
    question: "Du har en meget høj annulleringsrate på dine salg. Er det acceptabelt?",
    options: [
      "Nej, det er ikke acceptabelt. Meget høje annulleringsrater betyder, at kundeservice bruger unødig tid på behandling af sager, og det er et tegn på, at salget er lavet dårligt eller utydeligt.",
      "Ja, det er okay – jeg bliver jo bare trukket i provision, så det er kun mit eget problem.",
    ],
    correctAnswer: "Nej, det er ikke acceptabelt. Meget høje annulleringsrater betyder, at kundeservice bruger unødig tid på behandling af sager, og det er et tegn på, at salget er lavet dårligt eller utydeligt.",
  },
];

// Backwards-compat alias used elsewhere
export const CODE_OF_CONDUCT_QUESTIONS = SALGSKONSULENT_COC_QUESTIONS;

// Field marketing questions (gadesalg / fysisk kundekontakt)
export const FIELDMARKETING_COC_QUESTIONS = [
  {
    id: 1,
    question: "Du står på din lokation og en forbipasserende stopper og spørger til vores tilbud. Hvordan starter du samtalen korrekt?",
    options: [
      "Jeg præsenterer mig selv med navn, hvilket firma jeg arbejder for, og hvilken kunde jeg står for – inden jeg går videre.",
      "Jeg går direkte til pitchen, så jeg ikke spilder kundens tid.",
      "Jeg venter på, at kunden selv spørger, hvem jeg er.",
    ],
    correctAnswer: "Jeg præsenterer mig selv med navn, hvilket firma jeg arbejder for, og hvilken kunde jeg står for – inden jeg går videre.",
  },
  {
    id: 2,
    question: "En kunde siger tydeligt 'nej tak' og går videre. Må du følge efter eller kalde igen for at overbevise dem?",
    options: [
      "Ja, ét ekstra forsøg er fair.",
      "Nej. Et nej er et nej – jeg respekterer det og lader kunden gå.",
    ],
    correctAnswer: "Nej. Et nej er et nej – jeg respekterer det og lader kunden gå.",
  },
  {
    id: 3,
    question: "Du indsamler kundens oplysninger på tablet/papir for at oprette et salg. Hvad er korrekt ift. GDPR?",
    options: [
      "Jeg viser kunden, hvilke oplysninger der bliver registreret, og forklarer kort, hvad de bruges til, før de godkender.",
      "Jeg skriver bare hurtigt – kunden ved godt, det er normalt.",
      "Jeg tager et billede af deres sygesikringsbevis/kørekort, så det går hurtigere.",
    ],
    correctAnswer: "Jeg viser kunden, hvilke oplysninger der bliver registreret, og forklarer kort, hvad de bruges til, før de godkender.",
  },
  {
    id: 4,
    question: "Må du tage et foto af kundens ID (sygesikringskort, kørekort, pas) med din private telefon for at huske oplysningerne?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 5,
    question: "Du har papir-tilmeldinger med kundedata fra dagen. Hvad gør du efter shift?",
    options: [
      "Tager dem med hjem og afleverer dem ved næste shift.",
      "Lægger dem i bilen, så de er klar til i morgen.",
      "Afleverer/uploader dem til kontoret samme dag efter aftalt procedure – ingen kundedata må opbevares privat.",
    ],
    correctAnswer: "Afleverer/uploader dem til kontoret samme dag efter aftalt procedure – ingen kundedata må opbevares privat.",
  },
  {
    id: 6,
    question: "Du møder berusede kunder, kunder der virker forvirrede, eller meget gamle personer, der ikke helt forstår tilbuddet. Må du lave et salg på dem?",
    options: [
      "Ja, hvis de skriver under, er det deres eget ansvar.",
      "Nej. Vi sælger ikke til personer, der ikke er i stand til at træffe en informeret beslutning.",
    ],
    correctAnswer: "Nej. Vi sælger ikke til personer, der ikke er i stand til at træffe en informeret beslutning.",
  },
  {
    id: 7,
    question: "En mindreårig (under 18) viser interesse og vil gerne tegne sig for et abonnement. Hvad gør du?",
    options: [
      "Laver salget og noterer at en forælder vil betale.",
      "Forklarer venligt at de skal være myndige for at indgå aftalen, og laver ikke salget.",
      "Beder om forældrenes telefonnummer og ringer dem op.",
    ],
    correctAnswer: "Forklarer venligt at de skal være myndige for at indgå aftalen, og laver ikke salget.",
  },
  {
    id: 8,
    question: "Centerlederen i shoppingcentret beder dig flytte din stand, fordi I står for tæt på en indgang. Hvad gør du?",
    options: [
      "Jeg ignorerer det – vi har en aftale om lokationen.",
      "Jeg flytter os med det samme og informerer min leder. Centerlederens anvisninger på lokationen skal altid følges.",
      "Jeg bliver stående og siger, at jeg lige ringer til min chef.",
    ],
    correctAnswer: "Jeg flytter os med det samme og informerer min leder. Centerlederens anvisninger på lokationen skal altid følges.",
  },
  {
    id: 9,
    question: "Må du blokere indgange, gangarealer eller flugtveje med banner, stand eller dig selv for at få bedre kontakt til forbipasserende?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 10,
    question: "Du står på din lokation og en kollega tilbyder dig en øl, fordi I har en lang dag. Må du drikke?",
    options: [
      "Ja, én øl er ok.",
      "Nej. På arbejde – uanset om det er på gaden eller i et center – er du firmaets ansigt udadtil. Alkohol er ikke tilladt.",
    ],
    correctAnswer: "Nej. På arbejde – uanset om det er på gaden eller i et center – er du firmaets ansigt udadtil. Alkohol er ikke tilladt.",
  },
  {
    id: 11,
    question: "Hvad er korrekt ift. dit udseende og din adfærd på lokationen?",
    options: [
      "Jeg bruger den udleverede uniform/dresscode, holder en professionel tone, undgår at sidde og kigge i mobilen og er aktiv på standen.",
      "Det er fint at sidde med mobilen, så længe jeg kigger op, når nogen kommer.",
      "Jeg kan have private samtaler med venner og familie ved standen.",
    ],
    correctAnswer: "Jeg bruger den udleverede uniform/dresscode, holder en professionel tone, undgår at sidde og kigge i mobilen og er aktiv på standen.",
  },
  {
    id: 12,
    question: "En kunde bliver vred eller meget højlydt og generer andre forbipasserende. Hvad gør du?",
    options: [
      "Jeg svarer igen i samme tone, så de kan se vi ikke lader os pille ved.",
      "Jeg forbliver rolig og professionel, afslutter samtalen høfligt og kontakter min leder hvis det eskalerer.",
      "Jeg ringer 112 med det samme.",
    ],
    correctAnswer: "Jeg forbliver rolig og professionel, afslutter samtalen høfligt og kontakter min leder hvis det eskalerer.",
  },
  {
    id: 13,
    question: "En kunde vil klage over dig eller produktet. Hvad er korrekt?",
    options: [
      "Jeg afviser klagen og forklarer at de selv skrev under.",
      "Jeg lytter, undskylder for oplevelsen, noterer kontaktoplysninger og videregiver klagen til min leder/kontoret samme dag.",
      "Jeg sletter deres aftale, så de ikke kan klage.",
    ],
    correctAnswer: "Jeg lytter, undskylder for oplevelsen, noterer kontaktoplysninger og videregiver klagen til min leder/kontoret samme dag.",
  },
  {
    id: 14,
    question: "Må du tilbyde rabatter, gratis produkter eller særlige vilkår, som ikke er en del af den officielle kampagne, for at lukke et salg?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 15,
    question: "Du undlader bevidst at fortælle om bindingsperiode, pris efter intro-tilbud eller andre væsentlige vilkår, fordi du ved at kunden så ikke køber. Er det i orden?",
    options: [
      "Ja, det er sælgers ansvar at lukke handlen.",
      "Nej. Vi skal altid være transparente om alle væsentlige vilkår – ellers er salget ugyldigt og kan koste mig jobbet.",
    ],
    correctAnswer: "Nej. Vi skal altid være transparente om alle væsentlige vilkår – ellers er salget ugyldigt og kan koste mig jobbet.",
  },
  {
    id: 16,
    question: "Hvordan informerer du korrekt en privat kunde om fortrydelsesretten?",
    options: [
      "Jeg fortæller kunden at de har 14 dage til at teste produktet og se om de kan lide det.",
      "Jeg fortæller kunden om deres 14 dages fortrydelsesret/annulleringsret efter forbrugeraftaleloven.",
    ],
    correctAnswer: "Jeg fortæller kunden om deres 14 dages fortrydelsesret/annulleringsret efter forbrugeraftaleloven.",
  },
  {
    id: 17,
    question: "Må du fotografere kunderne på lokationen og lægge billederne på dine egne sociale medier?",
    options: [
      "Ja, hvis de smiler til kameraet.",
      "Nej, ikke uden udtrykkeligt skriftligt samtykke fra hver person der er identificerbar på billedet.",
    ],
    correctAnswer: "Nej, ikke uden udtrykkeligt skriftligt samtykke fra hver person der er identificerbar på billedet.",
  },
  {
    id: 18,
    question: "Må du lave opslag på dine private sociale medier hvor du tilbyder kampagnen direkte til venner/familie og beder dem skrive til dig – uden at det er godkendt af Copenhagen Sales og kunden?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 19,
    question: "Du opdager efter et salg at du har skrevet en forkert pris eller forkerte vilkår på aftalen. Hvad gør du?",
    options: [
      "Ingenting – de opdager det nok ikke.",
      "Jeg kontakter min leder/kontoret med det samme så vi kan rette op og evt. kontakte kunden.",
      "Jeg sletter aftalen og opretter en ny.",
    ],
    correctAnswer: "Jeg kontakter min leder/kontoret med det samme så vi kan rette op og evt. kontakte kunden.",
  },
  {
    id: 20,
    question: "Du opdager at en kollega laver fiktive salg, opretter sig selv som kunde, eller tilmelder familie/venner uden deres viden for at hæve provisionen. Hvad gør du?",
    options: [
      "Jeg blander mig ikke.",
      "Jeg taler med kollegaen og lader det være.",
      "Jeg informerer min leder. Det er svindel og kan medføre bortvisning og politianmeldelse.",
    ],
    correctAnswer: "Jeg informerer min leder. Det er svindel og kan medføre bortvisning og politianmeldelse.",
  },
  {
    id: 21,
    question: "Må du selv oprette et salg på en kunde du 'kender godt vil have det' uden at have talt med dem på lokationen?",
    options: ["Ja", "Nej"],
    correctAnswer: "Nej",
  },
  {
    id: 22,
    question: "Må du kopiere kundens personoplysninger ind i eksterne værktøjer (egne notater, ChatGPT, Google Sheets, WhatsApp osv.) som ikke er godkendt af Copenhagen Sales eller kunden?",
    options: [
      "Ja, hvis jeg sletter det bagefter.",
      "Nej, kundedata må kun behandles i de systemer som Copenhagen Sales og kunden har godkendt.",
    ],
    correctAnswer: "Nej, kundedata må kun behandles i de systemer som Copenhagen Sales og kunden har godkendt.",
  },
  {
    id: 23,
    question: "Du møder på arbejde og er stadig påvirket fra dagen før (træt, sløv, evt. stadig promille). Hvad er korrekt?",
    options: [
      "Det er fint, så længe jeg kan stå op.",
      "Jeg melder mig syg/kontakter min leder. Jeg står ikke ude og repræsenterer firmaet i den tilstand.",
      "Jeg drikker en energidrik og kører på.",
    ],
    correctAnswer: "Jeg melder mig syg/kontakter min leder. Jeg står ikke ude og repræsenterer firmaet i den tilstand.",
  },
  {
    id: 24,
    question: "Hvad gør du ved shift-afslutning ift. rapportering?",
    options: [
      "Jeg går hjem og sender en besked i morgen.",
      "Jeg afleverer dagsrapport/registreringer som aftalt med min leder samme dag og sikrer at alt kundedata er overgivet korrekt.",
      "Jeg gemmer rapporten på min telefon til ugen er slut.",
    ],
    correctAnswer: "Jeg afleverer dagsrapport/registreringer som aftalt med min leder samme dag og sikrer at alt kundedata er overgivet korrekt.",
  },
  {
    id: 25,
    question: "Hvad er konsekvensen hvis du bevidst lyver, vildleder eller laver fiktive salg som fieldmarketing-konsulent?",
    options: [
      "En advarsel.",
      "En løftet pegefinger.",
      "Bortvisning fra Copenhagen Sales – og potentielt politianmeldelse hvis der er tale om svindel.",
    ],
    correctAnswer: "Bortvisning fra Copenhagen Sales – og potentielt politianmeldelse hvis der er tale om svindel.",
  },
];

export function getQuestionsForVariant(variant: CocVariant) {
  return variant === "fieldmarketing" ? FIELDMARKETING_COC_QUESTIONS : SALGSKONSULENT_COC_QUESTIONS;
}

// Check if quiz has expired (every 2 months = 60 days)
function isQuizExpired(passedAt: string): boolean {
  const passedDate = new Date(passedAt);
  const daysSincePassed = differenceInDays(new Date(), passedDate);
  return daysSincePassed >= 60;
}

function isWithinInitialGracePeriod(employmentStartDate: string | null): boolean {
  if (!employmentStartDate) return false;
  const startDate = new Date(employmentStartDate);
  const daysSinceStart = differenceInDays(new Date(), startDate);
  return daysSinceStart < 14;
}

function getDeadlineDate(passedAt: string | null, employmentStartDate: string | null): Date {
  const now = new Date();
  if (employmentStartDate) {
    const startDate = new Date(employmentStartDate);
    const daysSinceStart = differenceInDays(now, startDate);
    if (daysSinceStart < 14) {
      const deadlineDate = new Date(startDate);
      deadlineDate.setDate(deadlineDate.getDate() + 21);
      return deadlineDate;
    }
  }
  if (passedAt) {
    const expiryDate = new Date(passedAt);
    expiryDate.setDate(expiryDate.getDate() + 60);
    expiryDate.setDate(expiryDate.getDate() + 7);
    return expiryDate;
  }
  const deadlineDate = new Date();
  deadlineDate.setDate(deadlineDate.getDate() + 7);
  return deadlineDate;
}

async function resolveEmployeeIds(email: string): Promise<string[]> {
  const lowerEmail = email.toLowerCase();
  const { data, error } = await supabase
    .from("employee_master_data")
    .select("id")
    .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`);
  if (error) {
    console.error("Error resolving employee ids:", error);
    return [];
  }
  return (data ?? []).map((e) => e.id);
}

// Detect variant for current user from job_title
export function useUserCocVariant() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-coc-variant", user?.email],
    queryFn: async (): Promise<CocVariant> => {
      if (!user?.email) return "salgskonsulent";
      const lowerEmail = user.email.toLowerCase();
      const { data } = await supabase
        .from("employee_master_data")
        .select("job_title")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .eq("is_active", true)
        .maybeSingle();
      return data?.job_title === "Fieldmarketing" ? "fieldmarketing" : "salgskonsulent";
    },
    enabled: !!user?.email,
    staleTime: 60000,
  });
}

export function useCodeOfConductCompletion(variant: CocVariant = "salgskonsulent") {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["code-of-conduct-completion", user?.id, variant],
    queryFn: async () => {
      if (!user?.email) return null;

      const employeeIds = await resolveEmployeeIds(user.email);
      if (employeeIds.length === 0) return null;

      const { data, error } = await supabase
        .from("code_of_conduct_completions")
        .select("*")
        .in("employee_id", employeeIds)
        .eq("quiz_variant", variant)
        .order("passed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data && isQuizExpired(data.passed_at)) {
        return { ...data, isExpired: true };
      }
      return data ? { ...data, isExpired: false } : null;
    },
    enabled: !!user,
  });
}

export function useCodeOfConductCurrentAttempt(variant: CocVariant = "salgskonsulent") {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["code-of-conduct-current-attempt", user?.id, variant],
    queryFn: async () => {
      if (!user?.email) return null;

      const lowerEmail = user.email.toLowerCase();
      const { data: employee, error: employeeError } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (employeeError) {
        console.error("Error fetching employee:", employeeError);
        return null;
      }
      if (!employee) return null;

      const { data: completion } = await supabase
        .from("code_of_conduct_completions")
        .select("passed_at")
        .eq("employee_id", employee.id)
        .eq("quiz_variant", variant)
        .maybeSingle();

      if (completion && !isQuizExpired(completion.passed_at)) {
        return null;
      }

      const { data: latestAttempt, error } = await supabase
        .from("code_of_conduct_attempts")
        .select("*")
        .eq("employee_id", employee.id)
        .eq("quiz_variant", variant)
        .eq("passed", false)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return latestAttempt;
    },
    enabled: !!user,
  });
}

interface SubmitCodeOfConductParams {
  answers: Record<number, string>;
  questionsToAnswer: number[];
  variant?: CocVariant;
}

export function useSubmitCodeOfConduct() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ answers, questionsToAnswer, variant = "salgskonsulent" }: SubmitCodeOfConductParams) => {
      if (!user?.email) throw new Error("Not authenticated");

      const lowerEmail = user.email.toLowerCase();
      const { data: employee, error: employeeError } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_email")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (employeeError) throw new Error("Error finding employee");
      if (!employee) throw new Error("Employee not found");

      let ipAddress = "Unknown";
      try {
        const ipResponse = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;
      } catch (e) {
        console.warn("Could not fetch IP address");
      }

      const userAgent = navigator.userAgent;
      const questionsForVariant = getQuestionsForVariant(variant);

      const wrongQuestionNumbers: number[] = [];
      for (const questionId of questionsToAnswer) {
        const question = questionsForVariant.find(q => q.id === questionId);
        if (question && answers[questionId] !== question.correctAnswer) {
          wrongQuestionNumbers.push(questionId);
        }
      }

      const passed = wrongQuestionNumbers.length === 0;

      const { data: previousAttempts } = await supabase
        .from("code_of_conduct_attempts")
        .select("attempt_number")
        .eq("employee_id", employee.id)
        .eq("quiz_variant", variant)
        .order("attempt_number", { ascending: false })
        .limit(1);

      const attemptNumber = (previousAttempts?.[0]?.attempt_number || 0) + 1;

      const { error: attemptError } = await supabase
        .from("code_of_conduct_attempts")
        .insert({
          employee_id: employee.id,
          attempt_number: attemptNumber,
          answers,
          wrong_question_numbers: wrongQuestionNumbers,
          passed,
          ip_address: ipAddress,
          user_agent: userAgent,
          quiz_variant: variant,
        } as any);

      if (attemptError) throw attemptError;

      if (passed) {
        const { error: completionError } = await supabase
          .from("code_of_conduct_completions")
          .upsert({
            employee_id: employee.id,
            passed_at: new Date().toISOString(),
            quiz_variant: variant,
          } as any, {
            onConflict: "employee_id,quiz_variant",
          });

        if (completionError) throw completionError;

        await supabase
          .from("code_of_conduct_reminders")
          .update({ acknowledged_at: new Date().toISOString() })
          .eq("employee_id", employee.id)
          .eq("quiz_variant", variant)
          .is("acknowledged_at", null);
      }

      return { passed, wrongQuestionNumbers };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["code-of-conduct-completion"] });
      queryClient.invalidateQueries({ queryKey: ["code-of-conduct-current-attempt"] });
      queryClient.invalidateQueries({ queryKey: ["code-of-conduct-lock"] });
      queryClient.invalidateQueries({ queryKey: ["code-of-conduct-reminder"] });
    },
  });
}

export function useCodeOfConductLock(variant: CocVariant = "salgskonsulent") {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["code-of-conduct-lock", user?.id, variant],
    queryFn: async () => {
      if (!user?.email) return { isLocked: false, daysRemaining: null as number | null, isRequired: false };

      const { data: hasValid } = await supabase.rpc("has_valid_code_of_conduct_completion", {
        _variant: variant,
      } as any);
      if (hasValid === true) {
        return { isLocked: false, daysRemaining: null as number | null, isRequired: false };
      }

      const employeeIds = await resolveEmployeeIds(user.email);
      if (employeeIds.length === 0) {
        return { isLocked: false, daysRemaining: null as number | null, isRequired: false };
      }

      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("job_title, employment_start_date")
        .in("id", employeeIds)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const requiredJobTitle = variant === "fieldmarketing" ? "Fieldmarketing" : "Salgskonsulent";
      if (!employee || employee.job_title !== requiredJobTitle) {
        return { isLocked: false, daysRemaining: null as number | null, isRequired: false };
      }

      if (isWithinInitialGracePeriod(employee.employment_start_date)) {
        const startDate = new Date(employee.employment_start_date!);
        const daysSinceStart = differenceInDays(new Date(), startDate);
        return { isLocked: false, daysRemaining: 14 - daysSinceStart, isRequired: false };
      }

      const { data: completion } = await supabase
        .from("code_of_conduct_completions")
        .select("passed_at")
        .in("employee_id", employeeIds)
        .eq("quiz_variant", variant)
        .order("passed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (completion && !isQuizExpired(completion.passed_at)) {
        const daysSincePassed = differenceInDays(new Date(), new Date(completion.passed_at));
        return { isLocked: false, daysRemaining: Math.max(0, 60 - daysSincePassed), isRequired: false };
      }

      const deadlineDate = getDeadlineDate(completion?.passed_at || null, employee.employment_start_date);
      const daysRemaining = differenceInDays(deadlineDate, new Date());

      const { data: reminder } = await supabase
        .from("code_of_conduct_reminders")
        .select("id, snoozed_until, acknowledged_at")
        .in("employee_id", employeeIds)
        .eq("quiz_variant", variant)
        .is("acknowledged_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const reminderLock = !!(reminder?.snoozed_until && new Date(reminder.snoozed_until).getTime() <= Date.now());
      const sevenDayLock = daysRemaining <= 0;

      return { isLocked: sevenDayLock || reminderLock, daysRemaining: Math.max(0, daysRemaining), isRequired: true };
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  return {
    isLocked: data?.isLocked ?? false,
    daysRemaining: data?.daysRemaining ?? null,
    isRequired: data?.isRequired ?? false,
    isLoading,
  };
}

export function useIsSalgskonsulent() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-salgskonsulent", user?.email],
    queryFn: async () => {
      if (!user?.email) return false;

      const lowerEmail = user.email.toLowerCase();
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("job_title")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Error checking salgskonsulent status:", error);
        return false;
      }

      return data?.job_title === "Salgskonsulent";
    },
    enabled: !!user?.email,
    staleTime: 60000,
  });
}
