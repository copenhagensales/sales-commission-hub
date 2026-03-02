

# TDC Opsummering: Tilføj "Pilot Opsummering" variant

## Overblik
Tilføj en toggle øverst på siden så sælgeren kan vælge mellem **Standard opsummering** og **Pilot opsummering**. Pilot-varianten genbruger samme UI-struktur, men med ændrede formuleringer i bestemte sektioner og fjernelse af "Opstart"-punktet.

## Ændringer i detaljer

### 1. Ny state + toggle UI (øverst)
- Tilføj `summaryVariant` state: `"standard" | "pilot"`
- Indsæt en `RadioGroup` eller segmented toggle øverst i formularen (over "Valgfrie sektioner") med valgene "Standard opsummering" og "Pilot opsummering"

### 2. Sektionsændringer i Pilot-varianten

| Sektion | Standard (uændret) | Pilot |
|---|---|---|
| Indledning | ✅ Uændret | ✅ Uændret |
| Grundoplysninger | ✅ Uændret | ✅ Uændret |
| Indhold | ✅ Uændret | ✅ Uændret |
| MV/Datadelingskort | ✅ Uændret | ✅ Uændret |
| Hvis uden Router | ✅ Uændret | ✅ Uændret |
| **Vilkår** | "I er bundet..." + ordrebekr. + tilføj/opsig tekst | Ny formulering: "I er bundet på kontrakten i 36 måneder." + "Inden for 3 hverdage vil i blive kontaktet af min kollega, som vil byde jer velkommen og få hjulpet med nummeroverflytning. Vi har snakket om, at det som udgangspunkt er" |
| **Nummervalg** | Samme valgmuligheder | Nye formuleringer: eksisterende → "(antal) eksisterende numre", mixed → "(antal) eksisterende numre og (antal) nye numre", nye → "Udelukkende nye numre der oprettes" + "Hvilke numre i ønsker, er op til jer, men antallet af abonnementer skal overholdes" |
| **Opstart** | Vises som sektion | **Fjernet fra UI** – erstattet af generisk tekst: "Numrene starter som udgangspunkt op, når bindingen og opsigelsesperioden hos jeres nuværende udbyder udløber..." (altid vist) |
| Tilskud | ✅ Uændret | ✅ Uændret |
| **Omstilling** | "Gennemgå kaldsflow..." (rød) + standard-opgradering | Ny formulering: "I forhold til jeres omstilling og hvordan den skal virke, så er det noget i aftaler med min kollega der ringer og byder jer velkommen." + Standard: "Hvis du får brug for menuvalg i fremtiden, så kan du altid opgradere din omstilling" |

### 3. UI-ændringer i Pilot-mode
- **Opstart-sektionen** skjules i formularen (venstre side)
- **Opstart-validation** springes over (`isOpstartMissing = false` når pilot)
- Nummervalg-labels forbliver de samme – kun output-teksten ændres

### 4. Implementering
Alt sker i **én fil**: `src/pages/TdcOpsummering.tsx`
- Tilføj `summaryVariant` state
- Tilføj toggle-UI øverst
- I `summaryLines` useMemo: branch på `summaryVariant` for Vilkår, Nummervalg, Opstart og Omstilling sektioner
- Skjul Opstart-UI-sektionen når `summaryVariant === "pilot"`
- Opdater validation: spring Opstart over i pilot-mode

