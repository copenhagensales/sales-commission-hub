

## Tilføj udlægsordning-tekst efter tilskudslinjen

### Ændring (kun `src/pages/TdcOpsummering.tsx`, ~linje 220)

Efter linjen:
```
"Du får et tilskud på (beløb), som kan bruges fra kontraktens startdato (dato), hvor det samtidig bliver tilgængeligt i vores selvbetjeningsunivers."
```

Indsæt en tom linje (afsnit) og derefter:
```
"Hvis du har behov for at benytte tilskuddet før denne dato, så har du mulighed for at lave en udlægsordning, hvor du betaler for produktet nu, og derefter får krediteret pengene på datoen, hvor tilskuddet vil blive frigivet. Du kan ikke få refunderet mere end du har lagt ud for."
```

Efterfulgt af endnu en tom linje, så den eksisterende "Vi har talt om, at du skal bruge tilskuddet på disse produkter:" stadig står som separat afsnit.

Da `hasSubsidy`-blokken er fælles for både Standard og Pilot (samme kodesti), dækker ændringen automatisk begge varianter. Kun 5g fri salg er ikke berørt (ingen `hasSubsidy`-rendering der).

### Ikke berørt
- Visningslogik (`hasSubsidy`-gate uændret).
- Øvrige sætninger i tilskudsblokken (rød markør-tekst osv.).

### Filer berørt
- `src/pages/TdcOpsummering.tsx`

