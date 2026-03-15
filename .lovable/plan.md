

## UX-optimering af pulsmålingen

### Identificerede problemer

1. **Survey fatigue** — 17 separate kort giver en endeløs scroll-oplevelse. Ingen fornemmelse af fremgang.
2. **Ingen sektionering** — Spørgsmål om ledelse, trivsel, produkt og kampagne blandes uden logisk gruppering.
3. **Redundant hjælpetekst** — "1 = Slet ikke, 10 = I meget høj grad" gentages næsten identisk på hvert kort.
4. **Ingen fremdriftsindikator** — Brugeren aner ikke om de er 20% eller 80% igennem.
5. **Demografiske spørgsmål midt i flowet** — Team og anciennitet bør samles i starten som "kom i gang"-trin.
6. **Intro-tekst er for lang** — Anonymitetsbudskabet drukner i tekstvæggen.
7. **Scale-knapper** — Funktionelle men kunne have tydeligere endpoint-labels direkte ved skalaen.

### Foreslåede ændringer

**1. Gruppér spørgsmål i sektioner med overskrifter**
Reducér fra 17 kort til logiske sektioner med farvede overskrifter:
- **Din baggrund** (team + anciennitet — samlet i ét kort)
- **Anbefaling** (NPS + kommentar)
- **Ledelse og udvikling** (udvikling, ledelse, anerkendelse, lederens tid)
- **Trivsel og kultur** (energi, seriøsitet, trivsel, psykologisk tryghed)
- **Produkt og kampagne** (produktkonkurrenceevne, markedsmatch, interesse, kampagneattraktivitet + kampagneforbedring)
- **Afsluttende** (forbedringsforslag + submit)

Hver sektion får flere spørgsmål i **samme kort** med tydelig separator.

**2. Tilføj fremdriftslinje (progress bar)**
- Simpel progress bar øverst der viser andel besvaret (baseret på udfyldte felter / totalt antal).
- Sticky øverst i viewporten så den altid er synlig.

**3. Forenklet intro**
- Kort, scanbar tekst med 3 bullet points i stedet for lange afsnit.
- Nøglebudskab: "Anonym. 3-5 minutter. Bruges kun til forbedring."

**4. Inline endpoint-labels på skalaer**
- Vis lav-label til venstre og høj-label til højre direkte ved knapperne i stedet for som separat hjælpetekst.
- Fjern den repetitive "1 = X, 10 = Y" linje.

**5. Fjern individuel nummerering**
- Drop "4. Udvikling og træning", "5. Teamlederens ledelse" osv. — sektionsoverskrifterne giver tilstrækkelig kontekst.
- Gør spørgsmålsteksten til den primære label.

### Teknisk scope

**Filer:**
- `src/pages/PulseSurvey.tsx` — Omstrukturer render-logik til sektioner, tilføj progress bar, forenkl intro
- `src/pages/PublicPulseSurvey.tsx` — Tilsvarende ændringer for den offentlige version

**Ingen database-ændringer.** Kun UI/layout-refaktor.

### Resultat
```text
FØR:                          EFTER:
┌─────────────┐              ┌─────────────────┐
│ Intro (lang)│              │ Intro (3 bullets)│
├─────────────┤              │ ▓▓▓░░░░░░ 30%   │
│ Team        │              ├─────────────────┤
├─────────────┤              │ § Din baggrund   │
│ NPS         │              │  Team + Ancienni.│
├─────────────┤              ├─────────────────┤
│ NPS comment │              │ § Anbefaling     │
├─────────────┤              │  NPS + Kommentar │
│ Anciennitet │              ├─────────────────┤
├─────────────┤              │ § Ledelse        │
│ Spørgsmål 4 │              │  Q4, Q5, Q6, Q9 │
├─────────────┤              ├─────────────────┤
│ Spørgsmål 5 │              │ § Trivsel        │
├─────────────┤              │  Q7, Q8, Q10, Q11│
│ ...12 mere  │              ├─────────────────┤
├─────────────┤              │ § Produkt        │
│ Submit      │              │  Q12-Q15 + tekst │
└─────────────┘              ├─────────────────┤
                             │ Forslag + Submit │
                             └─────────────────┘
```

