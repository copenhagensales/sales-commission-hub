# Fjern placeholder-tekst under Mapping

Under fanen Mapping står der to identiske hjælpelinjer:

"Selve sammenligningsreglen mod interne salg tilføjes i næste trin."

De er ikke længere relevante, da sammenligningsreglerne er implementeret.

## Ændring

`src/pages/vagt-flow/EesyFmDeviations.tsx`
- Fjern afsnittet i bunden af kortet "Kampagne-mapping" (linje 1446-1448).
- Fjern det tilsvarende afsnit i bunden af kortet "Operator-mapping" (linje 1494-1496).

Ingen anden logik eller layout ændres.
