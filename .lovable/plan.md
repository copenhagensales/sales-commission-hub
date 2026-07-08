## Mål
På "Ansøgninger pr. uge" skal vi ikke kun se volumen, men også kvaliteten: hvor mange af ugens ansøgere endte som ansat, og hvad er konverteringsraten.

## Anbefalet løsning — ComposedChart med bar + linje

Én graf, to lag:

1. **Bar (venstre y-akse):** Ansøgninger pr. uge. Beholder nuværende grønne bar, men splittes visuelt:
   - Mørkegrøn nederst = antal fra ugen der blev `hired`
   - Lysegrøn ovenpå = resten (ikke-ansatte endnu)
   - Label ovenpå viser stadig totalen (fx `34`)
2. **Linje (højre y-akse, 0–100%):** Konverteringsrate = `hired / total` for ugen. Vises som en tynd linje med prikker og procent-label.
3. **Tooltip:** Uge X · Ansøgninger: 34 · Ansat: 3 · Konvertering: 8,8%

Hvorfor denne form:
- Bevarer den visuelle volumen-læsning brugerne allerede kender.
- Konverteringslinjen gør det tydeligt når mange ansøgninger ≠ god kvalitet (høj bar, lav linje = advarsel).
- Ingen ekstra graf, ingen ekstra klik.

### Modning-advarsel
Nyere uger har naturligt lavere konvertering, fordi kandidaterne ikke har nået at gennemgå flowet endnu. Derfor:
- De sidste 2 uger markeres visuelt (stiplet linje-segment + lille "i" tooltip: "Kandidater er stadig i proces — konvertering kan stige").
- Konverteringen beregnes stadig, men brugerne advares mod at drage konklusioner for tidligt.

### Periodevalg
Beholder 5/10/25/50 uger som i dag. Ingen ændring.

## Tekniske detaljer

**Fil:** `src/pages/recruitment/RecruitmentDashboard.tsx`

**Data (`weeklyChartData`, linje 306–332):** Udvid map så hver uge også indeholder:
- `hired` = antal `candidates` med `created_at` i ugen OG `status === 'hired'`
- `conversionRate` = `total > 0 ? (hired/total)*100 : null` (null så linjen ikke rammer 0 for tomme uger)
- `isRecent` = ugen er en af de 2 seneste (til stiplet segment)

**Chart:** Skift fra `BarChart` til `ComposedChart` fra recharts. Tilføj:
- `<YAxis yAxisId="left">` (volumen) og `<YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%">`
- `<Bar dataKey="hired" stackId="a" yAxisId="left">` (mørkegrøn, `hsl(var(--primary))`)
- `<Bar dataKey="notHired" stackId="a" yAxisId="left">` (lysegrøn, `hsl(var(--primary) / 0.35)`)
- `<Line dataKey="conversionRate" yAxisId="right" stroke="hsl(var(--accent-foreground))" strokeWidth={2} dot />` med `strokeDasharray` betinget via segment
- LabelList på total (top af stack) og procent på linje-prikker

**chartConfig:** Tilføj `hired`, `notHired`, `conversionRate` entries.

**Ingen ændringer** i backend, RLS, hooks eller andre komponenter. Ren frontend/præsentation. Grøn zone.

## Alternativer (fravalgt)
- **Separat linjegraf under:** Kræver dobbelt så meget plads og tvinger øjet til at hoppe. Fravalgt.
- **Kun tal i tooltip:** Skjuler indsigten — brugeren skal hovere for at se problemet. Fravalgt.
- **Farvekodede bars efter konverteringsrate (rød/gul/grøn):** Blander to dimensioner i én farve og bliver svær at læse. Fravalgt.
