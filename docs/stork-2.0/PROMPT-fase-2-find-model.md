# Stork 2.0 — Find den bedste struktur

Du er én af fire aktører der hver giver uafhængigt input til samme spørgsmål. De andre er Claude.ai, Claude Code, Lovable og Codex. Mathias sammenligner svarene bagefter og træffer beslutningen selv.

**Lad dig ikke påvirke af hvad du tror de andre vil sige. Giv dit ærlige bedste bud.**

---

## Sådan arbejder du med denne opgave

Det her er en stor opgave der kræver fokus. Det Mathias forventer er ikke et hurtigt svar — det er et grundigt svar.

### Før du svarer

- Læs alle vedhæftede og pullede dokumenter **helt** og forstå dem — særligt logikkerne og de strukturelle problemer i 1.0. Du skal kunne henvise konkret til specifikke logikker og problemer i dit svar. Hvis du ikke kan, har du ikke læst grundigt nok.
- Tag noter undervejs. Identificér Storks reelle strukturelle problemer — ikke bare gentag overskrifterne fra dokumenterne.
- Hvis du opdager du ikke har data nok til at svare grundigt — stop og rapportér det. Fabrikér ikke.
- Hvis nogle filer mangler eller pull fejler — stop. Vi finder ud af det før du fortsætter.

### Mens du tænker

- **Forsøg ikke at fitte Stork ind i en skabelon-arkitektur.** "Hexagonal", "modulær monolit", "microservices", "event sourcing", "CQRS" — det er navne på mønstre, ikke begrundelser. Hvis dit første svar er et kendt arkitektur-navn, udfordr dig selv: hvad er det reelt der løser Storks problem? Hvorfor passer det navn?
- Sid med ubehaget når en åben beslutning ikke har et oplagt svar. Lad ikke det presse dig til en hurtig konklusion.
- Test din model mod realistiske scenarier:
  - Ville den stadig holde hvis Stork voksede 5x?
  - Hvis to nye klienter krævede helt forskellige salgsflows?
  - Hvis et helt nyt forretningsområde (fx uddannelses-platform) skulle tilføjes?
  - Hvis et team af 200+ ansatte skal supporteres?
  - Hvis Mathias eller Kasper trådte væk i 6 måneder, kunne en ny ejer overtage?

### Mens du skriver

- **Citér konkret** når du henviser til 1.0-problemer. Fil + linje fra snapshot-filerne, eller logik-nummer fra `storks-logikker.md`. "Det ser ud som" og "der er ofte" er ikke evidens.
- Hvis du er ved at skrive en påstand uden konkret kilde — slet det eller markér det som hypotese.
- **Pakke-fraser ud:** "interessant problem", "kompleks udfordring", "det er klart at", "selvfølgelig", "som vi alle ved". Slet og omformulér.
- Hvis du producerer noget for at fylde format-kravet — slet det. Mindre og skarpere er bedre end fyld.
- Når du foreslår en konkret mekanisme (fx "RLS håndhæver permissions"), gå et niveau dybere: hvad sker der præcist, hvilke tabeller, hvilke regler.

### Når du tror du er færdig

- Læs dit svar igennem og udfordr det. Find svagheder, antagelser der måske ikke holder, steder hvor du har valgt et hurtigt svar. Hvis du efter ærlig søgning ikke finder nogen — sig det. Men en kompleks model er sjældent uden svagheder.
- Tjek: har jeg taget stilling til det Mathias rent faktisk vil vide, eller har jeg svaret på et nemmere spørgsmål?
- Tjek: er der steder hvor jeg har valgt et hurtigt svar fordi det rigtige var ubehageligt at sidde med?
- Tjek: kan jeg begrunde hvert konkret valg, eller er nogle bare standard?

---

## Hvad denne opgave er — og ikke er

**Det er fase 2: find løsning.** Ikke fase 1 (undersøg) og ikke fase 3 (byg).

Mathias vil ikke have en lappe-løsning på 1.0. Han vil bygge Stork 2.0 ud fra visionen. Tænk stort. Tænk rigtigt. Brug ikke kræfter på hvordan det implementeres, hvor lang tid det tager, eller hvilken migration-strategi der skal bruges. Det er fase 3.

**Lige nu: hvilken model skal Stork 2.0 bygges efter?**

Alt er på bordet. Inklusive stamme-grene-modellen som Mathias har arbejdet med — hvis du finder noget bedre, foreslå det. De fire besluttede principper og de 15 forretningsregler står fast (se nedenfor). Alt andet er åbent.

---

## Før du svarer — pull og læs

**1. Pull seneste version fra GitHub:**

```
git fetch --all && git pull origin main
```

**Hvis du ikke har git-adgang** (fx Codex eller Claude.ai): bed Mathias om at uploade `docs/bibel.md`, `CLAUDE.md`, `docs/system-snapshot.md`, `docs/ui-snapshot.md` og `docs/cross-reference.md` manuelt før du fortsætter.

**2. Læs i denne rækkefølge:**

Fra GitHub-repoet (efter pull):
- `docs/bibel.md` — fundament og principper
- `CLAUDE.md` — teknisk forlængelse
- `docs/system-snapshot.md` — komplet Supabase-snapshot (skema, RLS, RPC'er, edge functions, triggers)
- `docs/ui-snapshot.md` — frontend-kortlægning
- `docs/cross-reference.md` — krydsreferencer mellem kode, tabeller og hooks

Vedhæftet denne prompt:
- `dokument-1-forstaaelse.md` — komplet kortlægning af Stork i dag + visionen for 2.0
- `storks-logikker.md` — 28 logikker (mekanisk beskrivelse)
- `stork-logikker-til-gennemgang.md` — Mathias' tænkning i 14 sektioner

---

## Opgaven

Foreslå den bedste samlede model for Stork 2.0.

Modellen skal dække:
- **Hvordan systemet er opdelt** — moduler, domæner, services, lag, kasser, eller hvad du foreslår. Inkluder hvordan funktionaliteten grupperes konceptuelt.
- **Hvordan delene hænger sammen** — afhængigheder, kommunikation mellem dele, hvor ansvaret ligger
- **Hvor data lever** — én database, flere, hvordan data deles eller isoleres
- **Hvordan permissions og identitet fungerer** rent (rolle × team × medarbejder, identitet på tværs af systemer)
- **Hvordan livscyklus håndteres** — salg, lønperiode, identitet, pricing, klient/produkt
- **Hvordan integrationer modelleres** — Adversus, Enreach, e-conomic, M365, Twilio
- **Hvordan compliance er indbygget** — GDPR, EU AI Act, bogføringslov, arbejdsmiljølov
- **Hvordan UI styrer systemet** uden at bryde det

---

## Kontekst om Stork 1.0

Bygget på 5 måneder med Lovable som primær builder. ~290k LOC TypeScript, 267 tabeller, 7-8 systemer der deler én database. Fungerer i drift med 100+ daglige brugere.

**Strukturelle problemer i 1.0** (verificér detaljer i snapshot-filerne):
- 146 komponenter kalder Supabase direkte (bryder service-lag-princippet)
- 69 hardkodede rolle-referencer i 8 filer
- Dobbelt sandhed på identitet (job-title→role hardkodet parallelt med DB-drevet position_id→role)
- Tre identiteter for én person (`employee_master_data`, `agents`, `sales.agent_email`) uden FK-integritet
- Pricing-logik duplikeret frontend + edge, holdes 1:1 manuelt
- 95+ memory-noter er ad-hoc viden der burde være struktur

**Stork præsenterer sig som ét system, men er reelt 7-8 systemer der deler database og login** (CRM, løn, HR, rekruttering, FM-booking, salgsvalidering, compliance, bogføringsbridge, BI/dashboard, telefoni). De er bygget i lag — CRM + løn er stammen, alt andet er podet på over tid.

---

## Det der står fast

Du må ikke foreslå en model der bryder noget af det følgende.

**Fire besluttede principper for 2.0:**
1. **UI-styrbarhed.** Data og værdier styres i UI; system og beregninger ligger i kode.
2. **Superadmin-system.** Mindst 2 hardkodede; resten konfigurerbart i UI.
3. **Dashboards som selvstændigt modul.** Eget rettighedssystem, TV-link som spejl.
4. **Fundament i kode.** KPI-definitioner, pricing, attribution og lønberegning kan ikke ændres fra UI.

**15 forretningsregler fra biblen** (læs `docs/bibel.md` og `dokument-1-forstaaelse.md` DEL 3 for fuld liste). Centrale: databasen er sandheden, historik bevares altid, lønperiode låses, single source of truth også i koden, data-adgang går gennem service-lag, ferie anmodes 5 uger før, forståelse før handling.

**Status-modellen** (fra `dokument-1-forstaaelse.md` DEL 3.3):
- Sales = pending + annulleret + godkendt + afvist (egne tilstande)
- Annullering er separat dimension der krydser livscyklus, ikke en fase
- Lønperiode er separat dimension fra salgets livscyklus

---

## Vurderingskriterier — alle skal opfyldes

Din anbefalede model skal kunne begrundes mod hvert af disse fire kriterier separat. Begrund eksplicit i sektion 2 nedenfor.

1. **Vedligeholdelig af to partnere** (Mathias + Kasper) med AI som primært arbejdsredskab. Ikke et team af udviklere.
2. **Skalerbar** fra nuværende 100+ ansatte og 13 dashboards til 200+ ansatte og potentielt nye applikationer (uddannelses-miljø, andre forretningsinitiativer).
3. **Compliance-sikker** — GDPR, EU AI Act, bogføringsloven (5 års opbevaring), arbejdsmiljøloven (AMO).
4. **Håndhævelig over tid.** Det er det der smuldrede i 1.0 — god intention, ingen håndhævelse. Modellen skal indeholde mekanismer der gør at strukturen ikke smuldrer over tid og iterationer.

---

## Format på dit svar

Brug nøjagtigt denne struktur så Mathias kan sammenligne med de tre andre svar.

### 1. Anbefalet model

Beskriv hele modellen i prosa. Hvad er dens fundament? Hvordan er systemet opdelt? Hvordan hænger delene sammen? Hvor lever data? Hvordan håndteres identitet, permissions, livscyklus? Hvordan ser integration-laget ud? Hvordan er compliance indbygget?

Ikke kode. Ikke pseudo-kode. Ikke ASCII-diagrammer. Prosa og lister. 800-1500 ord.

### 2. Hvorfor netop denne model

Begrund mod hvert af de fire vurderingskriterier separat. Vær konkret — ikke "den er skalerbar" men hvorfor og hvordan.

- Vedligeholdelig af to partnere med AI
- Skalerbar
- Compliance-sikker
- Håndhævelig over tid

### 3. Håndhævelses-mekanismer

Det er det der smuldrede i 1.0. Hvordan sikrer din model at strukturen står fast over tid? Konkrete mekanismer — type-system, RLS, runtime-checks, linter-regler, code-review-gates, andet. Beskriv hvad der **tvinger** compliance, ikke bare hvad der opmuntrer til den.

### 4. Risici og blinde pletter

Hvad kan gå galt med din anbefaling? Hvor er du mest usikker? Hvilke antagelser bygger den på som måske ikke holder? Vær kritisk over for dit eget forslag.

### 5. Hvad du ikke har taget stilling til

Vær eksplicit. Hvor mangler du data eller kontekst? Hvilke beslutninger ligger uden for din model og bør Mathias træffe selv?

### 6. Alternativer du fravalgte

Mindst to andre modeller du overvejede og hvorfor du fravalgte dem. Det giver Mathias indblik i din tænkning, ikke kun konklusionen.

### 7. Proces-rapport

Vis hvordan du gik til opgaven. Ikke en selvros — en kortfattet redegørelse:

- Hvilke dokumenter læste du i hvilken rækkefølge? Hvor brugte du mest tænke-tid?
- Hvilke iterationer gennemgik dit forslag? Hvad ændrede du undervejs?
- Hvor opstod kernen i din anbefaling — hvilken specifik indsigt eller observation tippede dig?
- Hvor er du mindst tilfreds med dit eget svar?

---

## Regler

- Ingen kode, ingen filer ændret, ingen migrations skrevet
- Ingen migration-strategi (det er fase 3)
- Ingen tidsestimater eller ressourcekrav (også fase 3)
- Citér konkret når du henviser til 1.0-problemer — fil + linje fra snapshot-filerne, eller logik-nummer fra `storks-logikker.md`
- Hvis du ikke ved noget — sig det. Fabrikér ikke.
- Hold dig til prosa og lister. Ingen ASCII-diagrammer.
- Skriv på dansk
- Sigt efter 3000-5000 ord samlet inkl. proces-rapport. Kort nok til at læses, langt nok til at begrunde.
- Ingen pakke-fraser
- Ingen skabelon-arkitekturer uden konkret begrundelse

Mathias træffer beslutningen. Du leverer input.
