# Operator-mapping under Mapping-fanen

Fyld operator-boksen ud med to lister, opsat som kampagne-boksen (to sektioner med piller). Ingen sammenligningslogik endnu — den kommer når reglen er forklaret.

## Indhold

**Nuuday (3 værdier)**
eesy, Telmore, Yousee

**Ikke Nuuday (26 værdier)**
3, CBB, Call Me, Companymobile, DUKA (Telenor), Dstny (TDC), Evercall, FLEXII, Flexfone, HALLO, Leasy, Lebara, Lycamobile, Mit Tele Mobil, Mtel, Nettalk, Newly Created, Norlys, Oister, Relatel (TDC), Telenabler, Telenor, UnoTel, Velkommen, greentel

## Teknisk

Fil: `src/pages/vagt-flow/EesyFmDeviations.tsx` (grøn/gul zone — ren UI).

- Tilføj `OPERATORS_NUUDAY` og `OPERATORS_NON_NUUDAY` som konstanter ved siden af `CAMPAIGNS_WITH_EFFECT` (linje 83-99).
- Erstat "Udfyldes senere." i Operator-kortet (linje 1388-1390) med to sektioner: "Nuuday" (blå/grønne piller) og "Ikke Nuuday" (neutrale piller), samme markup-mønster som kampagne-boksen, adskilt af `border-t`.
- Note nederst: sammenligningsreglen tilføjes i næste trin.

Ingen ændringer i `useEesyFmDeviations.ts` i dette trin.
