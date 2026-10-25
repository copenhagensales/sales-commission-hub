# Plan: mobilfejl findes og rettes systematisk – ikke én ad gangen

## Hvorfor knappen »Åbn Storkbook« svæver
På telefon er der ikke plads til både »Kvæk! …«-teksten og knappen på samme linje. Knappen ryger derfor ned på en ny linje, men den er sat til at stå yderst til højre, så den ender alene ude i højre side. Den er bygget til computer og aldrig tilpasset telefon.

## Hvorfor du har skullet påpege hver fejl
Det er min fejl, ikke din:
- Jeg har rettet præcis det, du har markeret, og kun tjekket det ene sted bagefter. Jeg har ikke gennemgået resten af siden.
- Jeg har ikke haft en fast tjekliste og en automatisk kontrol, der kører på alle sider i telefonbredde. Derfor fanger jeg kun de fejl, du selv finder.
- Flere fejl skyldes de samme få mønstre, fx en overskrift med en knap ved siden af, en række med tal yderst til højre eller lister med for lidt plads. De bør rettes én gang i de fælles dele i stedet for side for side.

## Planen

### 1. Automatisk mobilkontrol af alle sider
Jeg laver et testprogram, der åbner hver side som indlogget bruger i bredderne 360, 393 og 430 og automatisk leder efter:
- vandret skrul på hele siden
- tekst eller bokse, der ligger oven i hinanden
- tekst, der bliver skåret af (bortset fra navne, der bevidst afkortes med »…«)
- knapper, der er mindre end 44 × 44 px
- indhold, der ligger skjult under topbjælken eller bundmenuen
- knapper, der står alene på en linje uden at flugte med andet

Testprogrammet tager også skærmbilleder af hver side. Det gemmes i projektet, så det kan køres igen efter hver ændring.

### 2. Fejlliste
Resultatet bliver én liste pr. side med alle fundne fejl, sorteret efter mønster. Du får listen og skærmbillederne, før jeg retter noget, så du kan se omfanget.

### 3. Ret mønstrene ét sted
- **Overskrift med knap** (som »Kvæk! …« + »Åbn Storkbook«): på telefon står knappen enten i fuld bredde under teksten eller som et lille ikon i overskriften. Det laves som én fælles løsning.
- **Rækker med tal til højre** (liga, rangering, top-lister): fast mønster, hvor tallet aldrig kan presse teksten.
- **Faste bjælker** (topbjælke, bundmenu, »sticky«-bjælker): placeres ét sted, så de aldrig lægger sig over hinanden.
- **Kort og knapgrupper:** fælles afstande og knapbredder på telefon.

### 4. Gennemgang i rækkefølge
1. Forsiden (Hjem)
2. Storkbook
3. Tal / Mine mål
4. Vagter
5. Menu og profil
6. Resten af siderne i menuen

Efter hver side kører testprogrammet igen. En side er først færdig, når den giver 0 fejl i alle tre bredder, og jeg selv har set skærmbillederne.

### 5. Fast kontrol fremover
Testprogrammet bliver en fast del af arbejdet: før jeg siger, at en mobilændring er færdig, kører jeg det på de berørte sider og sender skærmbilleder med. Det skrives ind som en regel i projektet.

## Det ændres ikke
Kun udseende og placering på telefon. Ingen tal, data, rettigheder, login eller sider ændres, og computervisningen forbliver uændret.

## Teknisk
- Playwright-script i `scripts/mobile-audit/` med injiceret session; måler `scrollWidth`, overlappende `getBoundingClientRect` mellem tekstnoder, `scrollWidth > clientWidth` på ikke-truncate-elementer, tapmål < 44 px og elementer under `fixed`-bjælker.
- Fælles løsninger i `src/components/mobile/` (fx `SectionHeader` med handling og `StatRow`), hvorefter de berørte sider skiftes over.
- Ny regel i `AGENTS.md`: mobilændringer kræver en kørsel af testprogrammet med 0 fejl ved 360/393/430 px.
- Mobilstandarden i projektreglerne nævner stadig »Beskeder« og »Mig« i bunden; det afsnit skal opdateres manuelt.
