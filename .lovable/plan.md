

## Skjul pilot opstart-tekst når "Kun nye numre" er valgt

### Ændring (kun `src/pages/TdcOpsummering.tsx`, linje 239-241)

Wrap pilot opstart-linjen i en betingelse, så den kun vises når `numberChoice` er `"existing"` eller `"mixed"` — ikke når `"new"` er valgt:

```ts
if (numberChoice && numberChoice !== "new") {
  lines.push({ text: t("Numrene starter som udgangspunkt op, når bindingen og opsigelsesperioden hos jeres nuværende udbyder udløber. Vi bestræber os på en samlet opstart, men datoerne for nummerflytning afhænger af jeres nuværende udbyder.") });
  lines.push({ text: "" });
}
```

Dækker både dansk og engelsk automatisk via `t()`-helperen.

### Ikke berørt
- Standard- og 5g-varianter.
- Øvrige pilot-linjer (welcome call, nummervalg, "Hvilke numre i ønsker…").
- Oversættelses-map, toggle, validering.

### Filer berørt
- `src/pages/TdcOpsummering.tsx`

