# Kampagner uden effekt i Mapping-fanen

Udfyld sektionen "Kampagner uden effekt" under Mapping med den leverede liste, i samme pille-stil som "Kampagner med effekt" (neutral/grå i stedet for grøn).

## Indhold (13 kampagner)

"1 måneds gratis abonnement" bliver liggende under "Kampagner med effekt" og udelades her.

- 10% rabat
- 10% rabat kampagne med vouchers
- 20% rabat
- 20% rabat kampagne med vouchers
- 25% rabat
- 35% i 2026
- 35% rabat
- 6 måneder gratis
- 9% rabat på marked
- Giver 1 md. til 0 kr. (opgørelse)
- Giver 15% rabat på abonnementet
- Halv pris i 3 måneder
- Unknown Campaign Name

## Teknisk

- `src/pages/vagt-flow/EesyFmDeviations.tsx`: ny konstant `CAMPAIGNS_WITHOUT_EFFECT` ved siden af `CAMPAIGNS_WITH_EFFECT` (linje 83).
- Erstat teksten "Udfyldes senere." i sektionen "Kampagner uden effekt" med en `flex flex-wrap gap-2` liste af piller, der mapper over konstanten. Styling: `border-border/60 bg-muted/40 text-muted-foreground`.
- Ingen ændring i afvigelseslogik — kun visning. Sammenligningsreglen kommer i næste trin.
