

## Dagsbonus altid tilgængelig i kontekstmenuen

### Problem
Dagsbonus-sektionen i vagtplanens kontekstmenu er kun synlig når den automatiske berettigelseslogik (team + klient-konfiguration + antal dage) tillader det. Brugeren skal altid kunne tilføje og fjerne dagsbonus manuelt.

### Hvad ændres

**Fil: `src/pages/shift-planning/ShiftOverview.tsx`**

Linje ~1611-1656: Den eksisterende bonus-sektion opdeles i to dele:

1. **Manuel bonus-sektion (altid synlig)**
   - Vises altid efter "Se info"-knappen, adskilt med en separator
   - Hvis bonus allerede er udbetalt for datoen: Vis "Fjern bonus (X kr)" med grøn baggrund
   - Hvis ingen bonus: Vis "Tilføj dagsbonus" som åbner en input-dialog til beløb

2. **Automatisk bonus-info (kun synlig når berettigelsesregler matcher)**
   - Den eksisterende visning af "X/Y dage brugt" og berettigelses-info beholdes som en informationslinje under den manuelle sektion
   - Vises kun når der er konfigureret regler for medarbejderen

### Ny dialog til manuelt bonus-beløb

Når "Tilføj dagsbonus" trykkes og der ikke er en automatisk berettigelse med et beløb, åbnes en `Dialog` med:
- Overskrift: "Tilføj dagsbonus"
- Undertekst: Medarbejdernavn og dato
- Input-felt: Beløb i kr (number input, default evt. fra bonusEligibility.amount hvis tilgængeligt)
- Knapper: "Annuller" og "Tilføj"

Hvis der ER en automatisk berettigelse med beløb, bruges beløbet direkte (som i dag) uden dialog.

### Tekniske detaljer

Nye state-variabler tilføjes:

```text
bonusDialogOpen: boolean
bonusDialogEmployeeId: string
bonusDialogDate: string
bonusAmount: number (input-felt)
```

Kontekstmenu-strukturen ændres fra:

```text
[Se info]
--- (kun hvis berettiget) ---
Dagsbonus (X/Y dage brugt)
  [Fjern bonus] eller [Udbetal bonus] eller [Ikke berettiget tekst]
```

Til:

```text
[Se info]
--- separator (altid) ---
  [Fjern bonus (X kr)]          <-- hvis bonus allerede udbetalt
  [Tilføj dagsbonus]            <-- hvis ingen bonus (åbner dialog eller bruger auto-beløb)
  (X/Y dage brugt)              <-- kun hvis automatisk konfiguration findes
```

Genbruger eksisterende `createDailyBonus` og `deleteDailyBonus` mutationer -- ingen nye API-kald eller tabeller nødvendige.
