# Ny afvigelsestype: "Produkt"

## Regel
En række markeres som afvigelse af typen **Produkt**, hvis begge er sande for den matchede PowerBI-række:

- Kolonne E (Subscription Name) er "Fri tale + 60 GB data (5G) (6 mdr. binding)"
- Operator er en Nuuday-operator (eesy, Telmore, Yousee)

Er operatoren ikke-Nuuday, er kombinationen i orden.

## Sammenspil med de eksisterende typer
- Produkt-tjekket kører sideordnet med kampagne- og operator-tjekket. En række kan bryde flere regler, og kolonnen "Afvigelse" viser dem samlet, fx "Kampagne + Produkt" eller "Produkt".
- En række er kun konform (og havner i "Salg uden afvigelser") hvis alle tre regler holder.
- Tastselv-produktet "5G Internet" er fortsat undtaget alle tjek — også dette nye.
- "Mangler i PowerBI" er uberørt.

## Teknisk
- Kun `src/hooks/useEesyFmDeviations.ts` ændres (gul zone: read-only sammenligning, ingen pricing/løn, ingen DB-ændring).
- Ny konstant `PRODUCT_FLAG_SUBSCRIPTION = norm("Fri tale + 60 GB data (5G) (6 mdr. binding)")` og hjælper `productMatchesOperator(subscriptionName, operator)` → false når subscription matcher konstanten og `isNuudayOperator(operator)` er true, ellers true.
- `okMatch`-søgningen udvides med `productMatchesOperator(m.subscriptionName, m.operator)`.
- Label-opbygningen udvides med `if (!productMatchesOperator(first.subscriptionName, first.operator)) labels.push("Produkt")`; fallback-teksten forbliver "Kampagne".
- Normalisering genbruger den eksisterende `norm`-hjælper, så variationer i mellemrum/tegn og accenter rammer samme værdi.
- Ingen ændringer i `EesyFmDeviations.tsx` — kolonner og filtre er uændrede.
