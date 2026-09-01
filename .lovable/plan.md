# Fix: runtime-fejl på TDC Månedsmål-tavlen

## Symptom
`Uncaught TypeError: Cannot read properties of undefined (reading 'length')` i `src/pages/dashboards/TdcMonthlyGoalBoard.tsx`, når tavlen renderes.

## Rod-årsag (bekræftet i koden)
Linje 124: `{(data?.days.length ?? 0) > 0 && (` — optional chaining dækker kun `data`, ikke `days`. Findes et `data`-objekt i React Query-cachen fra før `days` blev tilføjet til `useTdcMonthlyGoal` (samme queryKey `["tdc-monthly-goal", <måned>]`), er `data.days` `undefined`, og `.length` kaster. Samme mønster bruges på linje 158 for `data?.sellers.length`.

## Ændring
Kun `src/pages/dashboards/TdcMonthlyGoalBoard.tsx` (grøn zone, ren præsentation):

- `data?.days.length` → `data?.days?.length`, og `data!.days.map(...)` → `(data.days ?? []).map(...)`.
- `data?.sellers.length` → `data?.sellers?.length`, og `data!.sellers` → `data.sellers ?? []`.

Ingen ændring i beregningslogik, hook, edge function eller data.

## Verifikation
Åbn `/dashboards/tdc-monthly-goal` og bekræft at tavlen renderer uden konsolfejl, at dagsboksene vises, og at fælles- og individuelle mål er uændrede.

## Note om baseline (dit spørgsmål)
Baseline er 850 / 22 hverdage i september 2026 = 38,64 pr. hverdag (vises afrundet som 39). Ingen ændring foreslået her.
