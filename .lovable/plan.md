

# Smartere og mere brugervenlig Schedule Editor

## Hvad er problemet i dag?

Den nuvaerende editor bruger tekniske begreber som "cron expression", "minut-offset" og "kommasepareret" -- det er svart at forstaa for folk der ikke er udviklere. Det er heller ikke tydeligt *hvorfor* man skal saette et offset, eller hvad konsekvensen er.

## Hvad gør de to indstillinger?

- **Sync-frekvens**: Hvor ofte data hentes fra API'et (fx hvert 10. minut = 6 gange i timen)
- **Minut-offset**: *Hvornaar* i timen synkroniseringen starter. Hvis to integrationer begge koerer hvert 10. minut fra minut 0, rammer de API'et samtidig og risikerer at blive blokeret. Et offset paa fx 5 minutter forskyder den ene, saa de aldrig koerer paa samme tid.

## Forslag: Redesign med dagligdags sprog og automatisk anbefaling

### 1. Ny overskrift og forklarende tekst

- Titel: "Planlæg synkronisering"
- Undertekst: "Vælg hvor ofte data skal hentes, og hvornår. Systemet anbefaler automatisk en tidsplan der undgaar konflikter."

### 2. Erstat "Minut-offset" med "Startminut"

- Label: **"Start ved minut"** med hjelpetekst: "Vælg hvilket minut i timen synkroniseringen begynder. Brug et andet minut end andre integrationer paa samme API for at undgaa konflikter."
- I stedet for et frit tekstfelt, vis en Select med relevante vaerdier (0, 1, 2, 3, 4, 5) -- baseret paa frekvensen.

### 3. Automatisk anbefaling ("Anbefalet tidsplan")

- Naar en integration vaelges, beregn automatisk det bedste offset der giver mest afstand til andre integrationer paa samme provider.
- Vis en knap: **"Brug anbefalet"** der udfylder felterne automatisk.
- Vis den anbefalede plan som tekst: fx "Hvert 10. minut, startende ved :03 -- giver 5 minutters afstand til Lovablecph"

### 4. Fjern teknisk cron-visning fra hovedflowet

- Flyt "cron expression" ned i en sammenklappelig "Tekniske detaljer"-sektion (Collapsible)
- I hovedvisningen vis i stedet en menneskelig beskrivelse: **"Koerer 6 gange i timen: :03, :13, :23, :33, :43, :53"**

### 5. Tydeliggoer konflikttjek

- Vis altid konflikttjek (fjern "Preview konflikter"-knappen)
- Brug groen/roed feedback inline: "Ingen konflikter med andre integrationer paa dette API" eller "Advarsel: koerer samtidig med Lovablecph ved minut :01"

## Tekniske aendringer

### ScheduleEditor.tsx -- Komplet redesign af UI

**Nye imports:** Collapsible fra radix, Lightbulb-ikon fra lucide

**Ny funktion: `calculateRecommendedOffset()`**
- Input: valgt integration, frekvens, liste af andre integrationer paa samme provider
- Logik: for hvert muligt startminut (0 til frekvens-1), beregn minimum afstand til alle andre integrationers fire-minutter
- Output: det startminut der giver stoerst minimum-afstand

**UI-struktur:**
```
Planlæg synkronisering
"Vælg hvor ofte data skal hentes..."

[Integration v]  [Frekvens v]  [Start ved minut v]

[Lightbulb] Anbefalet: Hvert 10. min fra :03     [Brug anbefalet]

Tidsplan: Kører 6 gange i timen: :03, :13, :23, :33, :43, :53

[check] Ingen konflikter med andre integrationer på dette API
  -- eller --
[warning] Advarsel: Kører samtidig med Lovablecph ved minut :01

<Collapsible> Tekniske detaljer
  Cron expression: 3,13,23,33,43,53 * * * *
</Collapsible>

                                              [Gem tidsplan]
```

**Startminut-feltet:**
- Select med vaerdier fra 0 til (frekvens - 1)
- Naar frekvens er 10: muligheder er 0-9
- Naar frekvens er 5: muligheder er 0-4
- Default-vaerdi: det anbefalede offset

**Cron-bygning:**
- Baseret paa frekvens + startminut genereres de konkrete minutter
- Fx frekvens=10, start=3 giver: 3,13,23,33,43,53

### cronOverlapDetector.ts -- Ny hjelpefunktion

```typescript
export function findBestOffset(
  frequencyMinutes: number,
  otherSchedules: string[],
  thresholdMinutes: number
): { offset: number; minGap: number }
```

### Filer der aendres
- `src/components/system-stability/ScheduleEditor.tsx` -- UI redesign
- `src/utils/cronOverlapDetector.ts` -- ny `findBestOffset()` funktion

### Ingen database-aendringer

