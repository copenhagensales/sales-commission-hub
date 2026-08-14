# Forsiden (/home) — AAA visuelt løft

Samme brand (mørk baggrund, CPH-grøn accent, eksisterende tokens). Ingen ændring i data, beregninger eller rettigheder. Fokus øverst: **min egen performance**.

## Hvad der er galt i dag

Verificeret i koden:

- `src/pages/Home.tsx` er 877 linjer med layout, event-CRUD-dialog, fødselsdags-logik og queries blandet sammen. Hele forsiden re-renderer på hver dialog-tilstand.
- Fire konkurrerende visuelle sprog i samme view: hero med gradient-glow, to kort med `border-0 shadow-lg bg-card/80`, et kort med `border-l-4 border-l-primary`, og et emoji-tungt fejrings-banner (`🎂 🎉 🎈`). Ingen fælles kort-grammatik.
- Hero'en (`HeroPerformanceCard.tsx`, 378 linjer) bruger emoji som performance-signal (`🔥 🏆 💪 📈 🚀`) og tekstbeskeder som "Du er on fire!". Det læser som en forbrugerapp, ikke som et arbejdsværktøj.
- Skærmbilledet viser hero'en næsten tom ved 0 kr: en stor grå ring, ét tal, to knapper — al plads bruges, ingen information gives.
- Spacing er ad hoc (`space-y-3 md:space-y-6`, `gap-3 md:gap-4`, `px-3 md:px-6`) i stedet for én rytme.
- Højre kolonne "Dine seneste 10 dage" viser en tom graf med 0 kr/dag uden empty state.

## Designprincipper for løsningen

1. **Én kort-grammatik.** Alle kort: samme radius, samme 1px `border-border/60`, samme `bg-card/60` + backdrop-blur, samme header-højde. Ingen `border-0 shadow-lg` blandet med `border-l-4`.
2. **Tal frem for emoji.** Performance signaleres med farve, vægt og retning (op/ned-pil, delta mod forventet tempo), ikke med 🔥. Emoji beholdes udelukkende i fødselsdags/jubilæums-rækken hvor de hører til.
3. **Information i stedet for pynt.** Hero'ens plads bruges til fire faktiske tal, også når provision er 0.
4. **Rolig bevægelse.** Number roll-up beholdes men kortes til 600 ms og respekterer `prefers-reduced-motion`. Ingen pulserende glows.
5. **Én rytme.** 4/8/16/24 px skala, konsekvent `gap-4` desktop / `gap-3` mobil.

## Ny opbygning

```text
┌─────────────────────────────────────────────────────────┐
│ God eftermiddag, Kasper            15. jun – 14. jul    │
│                                                          │
│  0 kr            Mål 25.000     Tempo 0 kr/dag   Ferie   │
│  provision       ▁▁▁▁▁▁▁ 0%     skal: 1.190      0 kr    │
│  [ Sæt dit mål → ]  [ Tilmeld liga ]                     │
└─────────────────────────────────────────────────────────┘
┌───────────────────────────┐ ┌───────────────────────────┐
│ Din liga-position         │ │ Seneste 10 dage           │
│ 1 Thorbjørn    30.727 kr  │ │ ▁▃▂▅▁▇▂▄▃▆   snit 0 kr    │
│ 2 August       26.625 kr  │ │ bedste dag · nuldage      │
│ 3 Fanny        25.565 kr  │ │                           │
│ ── du: #12     8.400 kr   │ │ (tydelig empty state)     │
└───────────────────────────┘ └───────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Kommende begivenheder                              +    │
│ 28 AUG  DHL LØBET   17:00 Fælledparken  19 ✓  [ja][nej] │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ 🎂 Fødselsdage & jubilæer  (uændret indhold, ny styling)│
└─────────────────────────────────────────────────────────┘
```

Konkrete ændringer:

- **Hero:** progress-ringen erstattes af en vandret, segmenteret målbar under hovedtallet, og pladsen til højre bruges til tre metrics: mål, dagligt tempo påkrævet, optjente feriepenge. Periodelabel (lønperiode 15.–14.) vises eksplicit øverst til højre, så tallet altid har kontekst. CTA'er bliver én primær + én sekundær ghost-knap.
- **Liga-kortet:** tilføjer en "du"-række under top 3, så kortet også siger noget når man ikke er i top 3. Samme rækkehøjde og talkolonne-alignment (`tabular-nums`) som resten.
- **10-dages-kortet:** rigtig empty state ("Ingen salg registreret i perioden") i stedet for en tom akse, og to støttetal: snit og bedste dag.
- **Begivenheder:** dato-badge, titel, metadata og ja/nej-knapper i én fast rækkehøjde. Samme kort-ramme som de øvrige.
- **Fejringer:** flyttes ned som én kompakt sektion; gradient-banneret fjernes.

## Teknisk

- Ny fælles wrapper `src/components/home/HomeCard.tsx` (ramme, header med ikon + titel + valgfri højre-slot). Alle fire forsidekort bruger den — ét sted at ændre kort-udtryk.
- `HeroPerformanceCard.tsx` omskrives: emoji/tier-logikken og ringen ryger ud, metrics-rækken ind. Props udvides med `periodLabel`, `dailyNeeded`, `remainingDays` — alle beregnes af eksisterende `getPayrollPeriod()` og allerede hentede data. Ingen nye queries.
- Event-opret-dialogen (ca. 200 linjer JSX) flyttes fra `Home.tsx` til `src/components/home/AddEventDialog.tsx`. Ren udflytning, samme mutation og felter.
- Fejringssektionen flyttes til `src/components/home/CelebrationsCard.tsx`.
- `Home.tsx` falder fra 877 til ca. 350 linjer og indeholder derefter kun data + komposition.
- Al styling via eksisterende tokens (`--card`, `--border`, `--primary`, `--success`, `--warning`, `--muted-foreground`). Ingen nye farver, ingen hardkodede hex/`text-white`.
- Mobil: hero-metrics stables 2×2; `StickyPerformanceBar` beholdes uændret.
- Zone: grøn (kun styling/layout/præsentation). Ingen DB-migration, ingen RLS, ingen ændring i provisions- eller timeberegning.

## Verificering før færdigmelding

- Playwright-screenshot af `/home` i 1280 px og 390 px bredde, både med og uden mål sat.
- Kontrasttjek på hero-metrics og målbar i mørkt tema.
- Bekræftelse af at `tsgo` er ren og at ingen filer uden for `src/pages/Home.tsx` + `src/components/home/` er rørt.
