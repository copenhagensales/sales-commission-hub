# Trafiklys-farver på TDC Månedsmål

Farverne bliver et rigtigt trafiklys: grøn = over target, gul = på target, rød = bagud. Samme tærskler bruges både til det store indekstal på fælles mål og til sælgerbarerne.

## Nye tærskler (indeks)

```text
indeks >= 105        -> "foran"    grøn
indeks 95-104        -> "on-track" gul
indeks 85-94         -> "efter"    amber/orange
indeks < 85          -> "bagud"    rød
```

Bemærk konsekvensen: en sælger præcis på target bliver gul, ikke grøn. Det er meningen med modellen — grøn er forbeholdt dem der ligger foran. Hvis du vil have "efter" og "bagud" slået sammen til én rød, siger du til.

## Ændringer

`src/lib/boardProgress.ts`
- `INDEKS_FORAN` ændres 110 -> 105, `INDEKS_ON_TRACK` bliver 95 (uændret), `INDEKS_EFTER` 85 (uændret).
- `statusTextClass` / `statusFillClass`: `foran` -> grøn, `on-track` -> gul, `efter` -> orange, `bagud` -> rød, `ukendt` -> neutral.
- Tests i `src/lib/boardProgress.test.ts` opdateres til de nye statusgrænser.

`src/pages/dashboards/TdcMonthlyGoalBoard.tsx`
- Ingen ny logik. Indekstallet og sælgerbarerne bruger allerede `statusTextClass` / `statusFillClass`, så de følger automatisk de nye farver.
- Gab-tallet ("bagud/foran på dagen") forbliver neutralt lyst som i dag.

## Zone

Grøn zone: kun boards og præsentation. Ingen ændringer i hooks, data, pricing eller lønlogik.
