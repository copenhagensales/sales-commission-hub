import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Briefcase, Shield, Users, Laptop, AlertTriangle, Heart, Flame, Leaf } from "lucide-react";

interface Section {
  title: string;
  content: React.ReactNode;
}

interface Category {
  label: string;
  icon: React.ReactNode;
  sections: Section[];
}

const categories: Category[] = [
  {
    label: "Om Copenhagen Sales",
    icon: <BookOpen className="h-4 w-4" />,
    sections: [
      {
        title: "Indledning",
        content: (
          <p>Velkommen til Copenhagen Sales! Vi er glade for at have dig som en del af vores team. Denne håndbog er udarbejdet for at give dig vigtig information om vores virksomhed, politikker, procedurer og dine rettigheder og forpligtelser som medarbejder. Vi opfordrer dig til at læse den grundigt og tage den op som reference, når der er behov for det.</p>
        ),
      },
      {
        title: "Om Copenhagen Sales",
        content: (
          <p>Copenhagen Sales har eksisteret siden 2014, og vi har siden begyndelsen specialiseret os i salg og mødebooking. Vores fokus på kvalitet og dygtige medarbejdere har givet os en stabilitet og en stærk position i branchen, og vi er i dag et team på mere end 80 dedikerede medarbejdere. Vi ved, at fastholdelse af medarbejdere er en stor del af vores succes, hvorfor trivsel og en sund virksomhedskultur er en af vores vigtigste værdier.</p>
        ),
      },
    ],
  },
  {
    label: "Ansættelse & Løn",
    icon: <Briefcase className="h-4 w-4" />,
    sections: [
      {
        title: "Ansættelsesvilkår",
        content: <p>Din ansættelse er baseret på en individuel ansættelseskontrakt, som specificerer din stilling, løn, arbejdstid, ferie, og øvrige betingelser.</p>,
      },
      {
        title: "Arbejdstid",
        content: <p>Arbejdstiderne aftales med din nærmeste leder.</p>,
      },
      {
        title: "Løn",
        content: <p>Din løn udbetales månedligt den sidste hverdag i måneden.</p>,
      },
      {
        title: "Lønudbetaling",
        content: <p>Udbetaling af løn sker den sidste bankdag i måneden. Skifter en medarbejder pengeinstitut, kontonummer eller adresse, skal dette meddeles skriftligt til virksomheden. (Gældende, hvis andet ikke er aftalt i ansættelseskontrakten.)</p>,
      },
      {
        title: "Ferie",
        content: <p>Regler om ferie og afholdelse følger ferielovens bestemmelser. Sommerferie kan afholdes i tre sammenhængende uger i perioden 1. maj – 30. september. Der vil blive taget videst muligt hensyn til alle medarbejdere, dog kan det ikke garanteres at alle ferieønsker opfyldes. Ferie skal meldes senest 14 dage før den ønskes afholdt. (Gældende, hvis andet ikke er aftalt i ansættelseskontrakten.)</p>,
      },
      {
        title: "Ferielukning",
        content: <p>Virksomheden holder ikke ferielukket udover på kalenderbestemte dage, herunder Nytårsdag, Juleaftensdag, Juledag, 2. juledag samt Nytårsaftensdag.</p>,
      },
      {
        title: "Pensionsordning",
        content: <p>Der er ikke pensionsordning i ansættelsesforholdet. Det betales af medarbejderen selv.</p>,
      },
      {
        title: "Skattekort",
        content: <p>Du skal ikke sende dit skattekort til os, da vi selv henter dit skattekort elektronisk hos Skat. Du har selv ansvaret for, at din forskudsregistrering hos Skat er opdateret.</p>,
      },
      {
        title: "Overenskomst",
        content: <p>Copenhagen Sales er ikke omfattet af en overenskomst. Men det står alle medarbejdere frit for selv at være medlem af en fagforening.</p>,
      },
      {
        title: "Timeregistrering",
        content: <p>Ansatte skal registrere sine timer i vores interne system. Det gøres ved at stemple ind når man møder ind og stemple ud når man forlader arbejdet via <a href="/time-stamp" className="text-primary underline hover:text-primary/80">Tidsstempling</a>. (Gældende, hvis andet ikke er aftalt i ansættelseskontrakten.)</p>,
      },
    ],
  },
  {
    label: "Adfærd & Etik",
    icon: <Users className="h-4 w-4" />,
    sections: [
      {
        title: "Opførsel og Etik",
        content: <p>Vi forventer, at alle medarbejdere udviser professionel adfærd på arbejdspladsen. Dette inkluderer respektfuld kommunikation, samarbejde og en positiv tilgang til opgaver.</p>,
      },
      {
        title: "Arbejdstøj og beklædning",
        content: <p>Arbejdstøj og beklædning skal være præsentable internt, mod eksterne samarbejdspartnere og kunder m.m., og det er ledelsen som træffer afgørelse herom.</p>,
      },
      {
        title: "Mobning og Chikane",
        content: (
          <div className="space-y-2">
            <p>Copenhagen Sales har en nultolerancepolitik over for mobning og chikane. Det er vores mål at skabe et sikkert og trygt arbejdsmiljø, hvor alle medarbejdere behandles med respekt og værdighed.</p>
            <p>Chikane omfatter enhver uønsket adfærd, der krænker en persons værdighed, skaber et truende, ydmygende eller fjendtligt arbejdsmiljø. Dette inkluderer både fysisk, verbal og ikke-verbal adfærd, samt digitale kommunikationsformer.</p>
            <p>Vi opfordrer medarbejdere til straks at rapportere enhver form for chikane til deres nærmeste leder, HR-afdelingen eller en anden betroet person i organisationen. Overtrædelse af denne politik kan medføre konsekvenser, herunder opsigelse af ansættelsen.</p>
          </div>
        ),
      },
      {
        title: "Fortrolighed",
        content: <p>Alle medarbejdere er forpligtet til at opretholde fortrolighed om virksomhedens oplysninger, kunder og forretningsaktiviteter både under og efter ansættelsen.</p>,
      },
      {
        title: "Alkohol og rusmidler",
        content: (
          <div className="space-y-2">
            <p>Indtagelse af alkohol eller rusmidler i arbejdstiden er ikke tilladt, hverken på virksomhedens adresse eller hvis man arbejder ude for virksomheden. Er en medarbejder påvirket af alkohol eller andre rusmidler, kan dette medføre hjemsendelse og kan føre til ophævelse af ansættelsesforholdet.</p>
            <p>Alkohol må dog indtages i begrænset omfang i forbindelse med én fyraftensøl, fødselsdage, jubilæer og andre lign. festlige sammenkomster. Ved andre særlige lejligheder kan der gives dispensation af ledelsen.</p>
          </div>
        ),
      },
      {
        title: "Sprog",
        content: <p>Virksomhedens sprog er dansk i tale og skrift.</p>,
      },
      {
        title: "Piercinger og tatoveringer",
        content: <p>Synlige piercinger og tatoveringer frabedes. Vi respekterer at det ikke i alle tilfælde kan skjules – men i det omfang det er muligt så skal det skjules.</p>,
      },
      {
        title: "Rygning",
        content: <p>Der må ikke ryges indvendigt i virksomhedens lokaler. Al rygning skal foregå på udendørsarealer. Dette gælder ligeledes for elektroniske cigaretter med nikotin. Hvis ovenstående ikke overholdes, kan det have ansættelsesretlige konsekvenser.</p>,
      },
      {
        title: "Straffeattest",
        content: <p>Det er en forudsætning for ansættelsen, at der både forud for og igennem tiltrædelses- og ansættelsesdatoen kan forevises en ren straffeattest. Overtrædelse af dette kan medføre ophævelse af ansættelsesforholdet.</p>,
      },
      {
        title: "Politik om børnearbejde og alderskrav",
        content: <p>For at arbejde hos Copenhagen Sales skal du minimum være 18 år ved ansættelsens start.</p>,
      },
    ],
  },
  {
    label: "Praktisk",
    icon: <BookOpen className="h-4 w-4" />,
    sections: [
      {
        title: "Drikkevarer",
        content: <p>Virksomheden stiller gratis kaffe, kakao, the og mælk til rådighed for alle medarbejdere. Der er mulighed for at købe sodavand mm i virksomhedens automat.</p>,
      },
      {
        title: "Pauser",
        content: <p>Der er i en almindelig arbejdsdag indlagt 3 faste pauser: En formiddagspause á 10 minutter, en eftermiddagspause á 10 minutter og frokostpause á 40 min. (Gældende, hvis andet ikke er aftalt i ansættelseskontrakten.)</p>,
      },
      {
        title: "Kantine og frokostordning",
        content: <p>Der er mulighed for tilkøb af frokostordning. Kontakt din nærmeste leder for tilmelding og afmelding.</p>,
      },
      {
        title: "Parkering (cykler)",
        content: <p>Parkering skal foregå i de dertilhørende cykelstativer.</p>,
      },
      {
        title: "Parkering (køretøjer)",
        content: <p>Det er ikke muligt at parkere på virksomhedens pladser. Vi henviser til parkering omkring kontorets område efter de gældende regler.</p>,
      },
      {
        title: "Mobilpolitik",
        content: <p>Det er tilladt at bruge sin mobil i arbejdstiden i begrænset omfang. Vi opfordrer dog til at den kun bruges i pauserne og efter endt arbejdsdag.</p>,
      },
      {
        title: "Sociale medier",
        content: <p>Ved sociale medier forstås Facebook, LinkedIn, X, Youtube el.lign. Sociale medier må ikke anvendes i arbejdstiden medmindre formålet er arbejdsrelateret.</p>,
      },
      {
        title: "Internet brug",
        content: <p>Internetbrug skal foregå i arbejdsrelateret henseende og med omtanke i forhold til enhver form for virus el.lign. Ved enhver mistanke om virus el.lign. skal der straks rettes henvendelse til din nærmeste leder.</p>,
      },
      {
        title: "Orlov",
        content: <p>Periodisk orlov kan aftales med nærmeste leder, hvis det er foreneligt med forholdene på arbejdspladsen i øvrigt.</p>,
      },
      {
        title: "Kørselsgodtgørelse",
        content: <p>Alle medarbejdere, der kører i egen bil for virksomheden, kan få kørselsgodtgørelse efter statens takster. Der skal udfyldes en kørselsrapport, som skal godkendes af ledelsen. (Gældende, hvis andet ikke er aftalt i ansættelseskontrakten.)</p>,
      },
      {
        title: "Leje af biler",
        content: <p>Medarbejderen skal skriftligt anmode nærmeste leder om godkendelse, hvis denne skal leje en bil.</p>,
      },
      {
        title: "Forretningsrejser og refusion",
        content: <p>Alle udlæg til forretningsrejser refunderes af Copenhagen Sales mod fremvisning af bilag.</p>,
      },
      {
        title: "Læge, speciallæge og tandlægebesøg",
        content: <p>Læge, speciallæge og tandlægebesøg skal foregå uden for arbejdstiden og betales af medarbejderen selv. Tidspunkt for frihed til behandling aftales med nærmeste leder. (Gældende, hvis andet ikke er aftalt i ansættelseskontrakten.)</p>,
      },
      {
        title: "Nøgle og/eller adgangskort",
        content: <p>Ved modtagelse af nøgler og/eller adgangskort, skal der underskrives for modtagelsen. I fald nøglerne og/eller adgangskort bortkommer, skal nærmeste leder have besked hurtigst muligt. Ved gentagne forsømmelser kan erstatningsansvar pådrages medarbejderen.</p>,
      },
      {
        title: "Medie og pressepolitik",
        content: <p>Medarbejderen må under ingen omstændigheder udtale sig til medier eller presse uden ledelsens forudgående godkendelse. Medarbejderen må dog henvise medie og/eller presse til ledelsen.</p>,
      },
      {
        title: "Medarbejderudviklingssamtale (MUS)",
        content: <p>MUS foregår en gang om året. Det er ledelsen, der indkalder til samtalen. Indkaldelsen vil blive sendt ud i god tid. Derudover foretages mindre formelle samtaler cirka hver anden måned, eller når behovet måtte opstå.</p>,
      },
      {
        title: "Møder/mødekultur",
        content: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Vi møder velforberedt og til tiden, det være sig til interne som eksterne møder.</li>
            <li>Mobiltelefoner er slukkede eller sat på lydløs, og der bliver ikke læst eller sendt tekstbeskeder under mødet.</li>
            <li>Du er forberedt på at skulle skrive referat eller foretage dig nødvendige notater, og har derfor altid pen og papir med.</li>
            <li>Computer eller andre enheder kan medbringes til referatskrivning, men skal ikke skabe distraktion.</li>
          </ul>
        ),
      },
      {
        title: "Personalefester",
        content: <p>Der afholdes minimum 2 gange årligt personalefest for alle medarbejdere. Sommerfest afholdes i maj/juni og julefrokost afholdes i november/december. Ledelsen fastlægger tid og sted.</p>,
      },
      {
        title: "Henvisningshonorar",
        content: <p>En medarbejder kan modtage et engangsbeløb pålydende 3.000 kr. ved henvisning og efterfølgende ansættelse af en ny medarbejder, såfremt medarbejderen har været ansat i minimum 60 dage. Udbetalingen sker efter nærmere aftale med ledelsen.</p>,
      },
      {
        title: "Sygdom og fravær",
        content: <p>Kan du ikke møde på arbejde på grund af sygdom, skal du senest før mødetid meddele dette til arbejdspladsen. Hvis det er muligt, skal der oplyses, hvor længe sygdommen forventes at vare. (Gældende, hvis andet ikke er aftalt i ansættelseskontrakten.)</p>,
      },
      {
        title: "Forsikring",
        content: <p>Alle medarbejdere er omfattet af den lovpligtige arbejdsskadeforsikring og erhvervsforsikring.</p>,
      },
    ],
  },
  {
    label: "Kontrol & Overvågning",
    icon: <Shield className="h-4 w-4" />,
    sections: [
      {
        title: "Kontrol, overvågning, lagring og backup",
        content: (
          <div className="space-y-2">
            <p>Alle data, der er lagret i virksomhedens systemer, betragtes som virksomhedens ejendom. For at sikre en forsvarlig drift af vores IT-systemer, sker der en løbende overvågning af systemerne.</p>
            <p>Dine e-mails og dokumenter betragtes først og fremmest som arbejdsrelaterede og tilhørende virksomheden. Dette gælder dog ikke mails og dokumenter, der er mærket "privat".</p>
            <p>Virksomhedens data skal altid lagres på de dertil indrettede fællesdrev og systemer. Lokale harddiske, USB-sticks og andre flytbare medier må ikke anvendes, medmindre der foreligger skriftlig godkendelse.</p>
            <p>Private data må ikke lagres på computeren.</p>
          </div>
        ),
      },
    ],
  },
  {
    label: "Trivsel & Inklusion",
    icon: <Heart className="h-4 w-4" />,
    sections: [
      {
        title: "Trivsel og Stresshåndtering",
        content: (
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Trivselsmålinger:</strong> Vi gennemfører regelmæssige undersøgelser for at afdække trivsel og arbejdsglæde.</li>
            <li><strong>Støtte ved stress:</strong> Hvis du føler dig overbelastet, kan du altid tage en fortrolig samtale med din leder. Ved behov kan virksomheden tilbyde professionel støtte som fx psykologhjælp.</li>
            <li><strong>Forebyggelse af stress:</strong> Vi opfordrer alle medarbejdere til at prioritere pauser og løbende kommunikere med deres leder om arbejdsbyrde.</li>
          </ul>
        ),
      },
      {
        title: "Mangfoldighed og Inklusion",
        content: <p>Hos Copenhagen Sales værdsætter vi mangfoldighed og arbejder aktivt for at sikre en inkluderende arbejdsplads. Vi tolererer ingen form for diskrimination på baggrund af køn, alder, race, religion, seksuel orientering, nationalitet eller andre personlige karakteristika.</p>,
      },
      {
        title: "Klageprocedure",
        content: (
          <div className="space-y-2">
            <p>Har du en klage, skal du hurtigst muligt tage kontakt til din nærmeste leder. Er der tale om en seriøs forseelse, opfordrer vi dig til også at sende en beskrivelse på skrift. Hold dig til fakta og vær så objektiv som muligt.</p>
            <p>Involverer sagen din nærmeste leder, kan du sende sagen direkte til Kasper Mikkelsen (km@copenhagensales.dk). Vi vil altid tage en snak inden for 24 timer (mandag til fredag).</p>
          </div>
        ),
      },
      {
        title: "Arbejdsmiljøorganisation (AMO)",
        content: (
          <div className="space-y-2">
            <p>Copenhagen Sales har en arbejdsmiljøorganisation (AMO) for at sikre et godt og sikkert arbejdsmiljø for alle medarbejdere. AMO består af repræsentanter fra både ledelse og medarbejderside.</p>
            <p>Medarbejdere opfordres til at kontakte arbejdsmiljørepræsentanten, hvis de oplever problemer eller har forslag til forbedringer.</p>
            <p>Kontaktperson: William Hoe – ws@copenhagensales.dk</p>
          </div>
        ),
      },
      {
        title: "Psykologi og krisehjælp",
        content: (
          <div className="space-y-2">
            <p>Hos Copenhagen Sales prioriterer vi vores medarbejderes trivsel og sikkerhed – både fysisk og mentalt.</p>
            <p><strong>Krisehjælp:</strong> I tilfælde af akutte krisesituationer kan du få adgang til krisehjælp fra vores samarbejdspartner. Kontakt din nærmeste leder ved behov.</p>
            <p><strong>Psykologisk støtte:</strong> Hvis du oplever stress, konflikter eller andre psykiske udfordringer, kan du henvende dig til din nærmeste leder som vil hjælpe med kontakt.</p>
          </div>
        ),
      },
      {
        title: "Kriser eller alvorlige hændelser",
        content: <p>Alvorlige hændelser skal rapporteres til nærmeste leder. Alvorlige hændelser er magtanvendelse, vold mellem medarbejdere, trusler eller lignende situationer. Myndigheder og presse tager direktøren sig af.</p>,
      },
      {
        title: "Førstehjælpskursus og sikkerhed",
        content: <p>Virksomheden tilbyder alle medarbejdere der ønsker det muligheden for et førstehjælpskursus og/eller suppleringskursus hvert andet år. Andre sikkerhedsmæssige kurser kan aftales som medarbejder og ledelse finder det relevant.</p>,
      },
      {
        title: "Førstehjælpskasse",
        content: <p>Kan findes i køkkenet. Der er det mest nødvendige.</p>,
      },
    ],
  },
  {
    label: "Disciplinære forhold",
    icon: <AlertTriangle className="h-4 w-4" />,
    sections: [
      {
        title: "Trin 1 – Første advarsel",
        content: <p>Hvis adfærd eller præstation er utilfredsstillende, får medarbejderen en skriftlig advarsel. Sådanne advarsler registreres, men ignoreres efter 6 måneder. Medarbejderen vil også blive informeret om, at en endelig skriftlig advarsel kan overvejes, hvis der ikke er nogen vedvarende forbedring.</p>,
      },
      {
        title: "Trin 2 – Endelig skriftlig advarsel",
        content: <p>Hvis overtrædelsen er alvorlig, eller der ikke sker nogen forbedring, gives der en endelig skriftlig advarsel, der inkluderer årsagen og en bemærkning om at handling på trin 3 vil blive taget, hvis ingen forbedring opnås inden for 6 måneder.</p>,
      },
      {
        title: "Trin 3 – Afskedigelse",
        content: <p>Hvis adfærden eller præstationen ikke har forbedret sig, kan medarbejderen blive afskediget.</p>,
      },
      {
        title: "Grov misligholdelse",
        content: (
          <div className="space-y-2">
            <p>Hvis det bekræftes, at en medarbejder har begået en lovovertrædelse af følgende karakter (listen er ikke udtømmende), vil den normale konsekvens være bortvisning:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Tyveri</li>
              <li>Materielle skader</li>
              <li>Svig</li>
              <li>Påvirket af alkohol eller ulovlige stoffer</li>
              <li>Fysisk vold</li>
              <li>Snyd med salg</li>
              <li>Udeblivelse fra arbejde</li>
            </ul>
          </div>
        ),
      },
      {
        title: "Appeller",
        content: <p>En medarbejder, der ønsker at klage over en disciplinær afgørelse, skal gøre det til den navngivne person i organisationen inden for fem arbejdsdage.</p>,
      },
    ],
  },
  {
    label: "IT & Sikkerhed",
    icon: <Laptop className="h-4 w-4" />,
    sections: [
      {
        title: "IT-sikkerhed",
        content: (
          <div className="space-y-2">
            <p>Alle systemer hos Copenhagen Sales er "cloud-baseret" og følger reglerne for sikkerhed. De systemer vi benytter er:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Enreach (ringesystem)</li>
              <li>Adversus (ringesystem)</li>
              <li>Microsoft365</li>
              <li>Copenhagen Sales Platform (internt system)</li>
            </ul>
          </div>
        ),
      },
      {
        title: "Adgangskoder",
        content: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Lav lange passwords – gerne mere end 8 tegn, hvis det ikke er suppleret med fler-faktorautentifikation.</li>
            <li>Genbrug ikke passwords på tværs af tjenester.</li>
            <li>Brug en password-manager til at generere tilfældige passwords på mindst 20 tegn.</li>
            <li>Hav et lille sæt af særligt følsomme tjenester som beskyttes ekstra godt.</li>
          </ul>
        ),
      },
      {
        title: "Adgange",
        content: <p>Som medarbejder har du kun adgang til det mest nødvendige. Er du agent, kan du kun foretage opkald. Er du leder, kan du kun se aktivitet på dit eget team. Ved opsigelse slettes alle dine login og adgange samme dag som du stopper.</p>,
      },
      {
        title: "Adgang til computere",
        content: <p>Computere må kun benyttes til arbejde og arbejdsrelaterede aktiviteter. Du må aldrig bruge computere til ulovlige aktiviteter. Du må ligeledes aldrig installere programmer eller andet uden tilladelse fra ledelsen.</p>,
      },
      {
        title: "Sikkerhed",
        content: <p>Alle computere har Windows 10/11 og opdateres automatisk efter Microsofts anbefalinger.</p>,
      },
      {
        title: "Hacking og mærkelige oplevelser",
        content: (
          <div className="space-y-2">
            <p>Oplever du nogen uheld eller andet med systemer eller computere skal vi have besked. Har du mistanke om at computeren er hacket, skal du altid:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Fjerne internetstikket</li>
              <li>Sluk ikke computeren</li>
              <li>Tag kontakt til nærmeste leder</li>
            </ul>
          </div>
        ),
      },
    ],
  },
  {
    label: "Whistleblowing & Anti-korruption",
    icon: <Shield className="h-4 w-4" />,
    sections: [
      {
        title: "Anti-korruption og gaver",
        content: <p>Du er velkommen til som medarbejder at tage imod gaver fra samarbejdspartnere eller kunder. Dog må værdien aldrig overstige 1.000 kr. Du kan som medarbejder anonymt sende beskeder til ledelsen gennem en formular på hjemmesiden, såfremt du har mistanke om noget ikke foregår reglementeret.</p>,
      },
      {
        title: "Whistleblowing-politik",
        content: (
          <div className="space-y-2">
            <p><strong>Beskyttelse:</strong> Organisationen forpligter sig til at beskytte whistleblowere mod repressalier, chikane eller diskrimination. Anonymitet opretholdes i den udstrækning det er lovligt og praktisk muligt.</p>
            <p><strong>Rapporteringskanaler:</strong> Organisationen har etableret klare og let tilgængelige kanaler til rapportering. <a href="https://copenhagensales.dk/whistleblower" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Brug vores whistleblowerordning her</a>.</p>
            <p><strong>Undersøgelse:</strong> Alle rapporter tages alvorligt, behandles fortroligt og whistleblowere modtager løbende opdateringer om status.</p>
            <p><strong>Konsekvenser:</strong> Bekræftet ulovlig eller uetisk adfærd medfører passende disciplinære og retlige foranstaltninger.</p>
          </div>
        ),
      },
    ],
  },
  {
    label: "Brandsikkerhed & Beredskab",
    icon: <Flame className="h-4 w-4" />,
    sections: [
      {
        title: "Forebyggelse af brand",
        content: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Sørg for, at elektrisk udstyr anvendes korrekt og slukkes efter brug.</li>
            <li>Blokér aldrig nødudgange eller flugtveje.</li>
            <li>Opbevar brandfarlige materialer i henhold til virksomhedens sikkerhedsprocedurer.</li>
            <li>Overhold retningslinjer for rygning.</li>
          </ul>
        ),
      },
      {
        title: "Nødprocedurer ved brand",
        content: (
          <div className="space-y-2">
            <p><strong>Ved opdagelse af brand:</strong> Aktivér den nærmeste brandalarm. Forsøg ikke at slukke branden selv, medmindre det er sikkert. Informér din nærmeste leder straks.</p>
            <p><strong>Evakuering:</strong> Følg de opsatte evakueringsplaner. Bevæg dig hurtigt og roligt mod den nærmeste nødudgang. Hjælp kolleger der har brug for assistance. Saml dig ved det angivne mødested.</p>
            <p><strong>Ved alarm:</strong> Forlad bygningen straks og luk alle døre bag dig.</p>
          </div>
        ),
      },
      {
        title: "Brandslukningsudstyr",
        content: <p>Brandslukningsudstyr som slukningsapparater og brandtæpper er placeret på centrale steder i bygningen. Disse må kun bruges af medarbejdere, der har modtaget instruktion i deres anvendelse.</p>,
      },
      {
        title: "Brandøvelser",
        content: <p>Der afholdes regelmæssige brandøvelser, så alle medarbejdere er bekendt med evakueringsprocedurerne. Deltagelse i disse øvelser er obligatorisk.</p>,
      },
      {
        title: "Ansvarlig for brandsikkerhed",
        content: <p>Kontaktperson: Kasper Mikkelsen, km@copenhagensales.dk</p>,
      },
    ],
  },
  {
    label: "Grønt fokus",
    icon: <Leaf className="h-4 w-4" />,
    sections: [
      {
        title: "Grønt fokus",
        content: <p>Hos Copenhagen Sales ønsker vi at tage hensyn til vores miljø. Vi printer kun hvis det er nødvendigt og tilstræber grønne løsninger. Vores lys er LED og slukker og tænder automatisk. Vi opfordrer alle medarbejdere til at sortere alt affald korrekt. Vi har opstillet pant-spande og en container til pap og papir foran kontoret.</p>,
      },
    ],
  },
];

export function HandbookTabContent() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Medarbejderhåndbog</h2>
          <p className="text-sm text-muted-foreground">Copenhagen Sales – retningslinjer og politikker</p>
        </div>
        <Badge variant="outline" className="text-xs">
          Sidst opdateret: 29. august 2025
        </Badge>
      </div>

      <div className="space-y-4">
        {categories.map((category, catIdx) => (
          <Card key={catIdx}>
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2 font-medium text-sm">
              {category.icon}
              {category.label}
            </div>
            <CardContent className="p-0">
              <Accordion type="multiple">
                {category.sections.map((section, secIdx) => (
                  <AccordionItem key={secIdx} value={`${catIdx}-${secIdx}`} className="px-4">
                    <AccordionTrigger className="text-sm">{section.title}</AccordionTrigger>
                    <AccordionContent>
                      <div className="text-sm text-muted-foreground leading-relaxed">
                        {section.content}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-4">
        Hvis du har spørgsmål til noget i håndbogen, er du altid velkommen til at kontakte din nærmeste leder.
        <br />Medarbejderrepræsentant: William Hoe – ws@copenhagensales.dk
      </p>
    </div>
  );
}
