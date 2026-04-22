

## Standard-variant: "Ingen Omstilling" valgt som default

### Ændring (kun `src/pages/TdcOpsummering.tsx`)

Tilføj en `useEffect` der sætter `noOmstilling = true` (og rydder `hasOmstilling`/genskaber `isStandardOmstilling = true`) **når brugeren skifter til Standard-varianten**, hvis ingen omstillings-valg allerede er aktivt.

Konkret logik:
- Når `summaryVariant === "standard"` aktiveres OG hverken `hasOmstilling` eller `noOmstilling` er sat → sæt `noOmstilling = true`.
- Initial state for `noOmstilling` ændres fra `useState(false)` til `useState(true)`, så første load på Standard (default-varianten) viser "Ingen Omstilling" som forvalgt.
- Pilot og Kun 5g fri salg røres ikke — deres egen Omstilling-UI / logik ignorerer `noOmstilling`-flaget visuelt (Pilot bruger en separat toggle-blok; 5g springer hele sektionen over). Validering `isOmstillingMissing` bliver automatisk `false` når `noOmstilling = true`, så advarselsbanneret forsvinder for Standard som ønsket.

### Hvorfor en effect og ikke kun ny default
Kun at ændre `useState(true)` ville også gælde hvis brugeren starter på fx Pilot og senere skifter til Standard efter selv at have ryddet feltet. Effect'en sikrer at Standard altid har et forvalg, men respekterer at brugeren aktivt har valgt "Omstilling inkluderet".

### Ikke berørt
- `TdcOpsummeringPublic.tsx` (kun anvendt af TDC opsummering, men brugeren bekræfter ændringen kun gælder TDC Erhverv-opsummeringen — denne fil ER TDC Erhverv-opsummeringen).  
  Note: `TdcOpsummeringPublic.tsx` er den offentlige spejl-version. Hvis du også vil have ændringen der, så sig til — ellers lader jeg den være urørt jf. din instruks.
- Pilot-grenen, 5g-fri-grenen, øvrig validering, summary-generering, separators.

### Filer berørt
- `src/pages/TdcOpsummering.tsx` (ændre default på `noOmstilling` + tilføj én `useEffect` ved variant-skift)

