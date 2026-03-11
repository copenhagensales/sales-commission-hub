

## Problem
Måned 1 viser kunstigt lavt gennemsnit (3.804 kr) fordi medarbejdere der startede midt/sent i måneden kun har få dages salg, men tæller fuldt med i gennemsnittet. En medarbejder der starter d. 28. har kun 2-3 dages salg men trækker gennemsnittet ned som om det var en fuld måned.

## Løsning: Minimumskrav + proportional justering

### 1. Ekskludér ufuldstændige første måneder
Hvis en medarbejder starter **efter d. 10** i en måned, tæller den måned IKKE som deres "måned 1" — deres måned 1 bliver i stedet den næste fulde kalendermåned. Dermed sikres at alle har mindst ~20 dages salgsdata i hver bucket.

### 2. Ekskludér ufuldstændige sidste måneder
Tilsvarende: Hvis en medarbejder stopper midt i en måned (eller vi er midt i indeværende måned), medregnes den ufuldstændige måned ikke.

### 3. Filtrér juli og december (allerede godkendt)

### 4. Inkludér alle medarbejdere (aktive + stoppede, allerede godkendt)

### Ændringer i `TenureEarningsChart.tsx`

**Data-hentning:**
- Fjern `is_active`-filter
- Hent også `employment_end_date` for at kende stoppede medarbejderes slutdato

**Beregningslogik (i forEach-loopet):**
- Beregn `dayOfMonthStarted = startDate.getDate()`
- Hvis `tenureMonth === 1` og `dayOfMonthStarted > 10`: skip (ufuldstændig første måned), og forskyd alle tenure-months med -1
- Skip juli/december (`saleMonth.getMonth() === 6 || === 11`)
- Skip indeværende (ufuldstændige) måned
- Skip slutmåned hvis medarbejder stoppede før d. 20 i den måned

**Undertekst:** Tilføj note om at ufuldstændige måneder og feriemåneder er udeladt.

### Resultat
Gennemsnittet per anciennitetsmåned afspejler kun medarbejdere med (næsten) fulde måneders salgsdata, hvilket giver et retvisende billede af den forventede udvikling.

