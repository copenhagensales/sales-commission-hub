

## Opdater opgrader-sætning i Standard og Pilot

### Ændring (kun `src/pages/TdcOpsummering.tsx`)

Erstat strengen:
```
"Hvis du får brug for menuvalg i fremtiden, så kan du altid opgradere din omstilling"
```
med:
```
"Hvis du i fremtiden for brug får menuvalg, er det muligt at tilkøbe."
```

Gælder begge steder hvor sætningen optræder (Standard-grenen og Pilot-grenen i `Omstilling`-blokken). Al eksisterende vis-/skjul-logik (`isStandardOmstilling`, `hasOmstilling`, Pilot vs. Standard) forbliver uændret.

### Ikke berørt
- Kun 5g fri salg, øvrige felter, toggles, validering.

### Filer berørt
- `src/pages/TdcOpsummering.tsx`

