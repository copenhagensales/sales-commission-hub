# TDC-shop-teksten vises kun ved terminaltilskud

## Hvad ændres
Teksten "I kan på https://shop.tdc.dk/ se hvilket hardware vi udbyder …" kommer kun med i idriftsættelsesmailen, når "Terminaltilskud" er slået til. Uden terminaltilskud udelades den.

Det gælder for både omstilling og mobile-only, fordi de bruger samme mailskabelon.

## Ikke ændret
Tilskudsafsnittet, de øvrige tekster i mailen, tilbud, opsummering, priser og provision. Der gemmes ikke noget i databasen.

## Tekniske detaljer
- Kun `src/components/tdc-idriftsaettelse/TdcIdriftsaettelseForm.tsx` ændres: linje 126–127 (`shop`) flyttes ind i den eksisterende `if (f.hasSubsidy)`-blok (linje 111), så shop-teksten følger samme betingelse som "Tilskud:"-afsnittet.
- Router-tilfældet: Hvis en router kræver tilskud, vises tilskudsfeltet som valgt (`hasSubsidy || needsRouter`). Til mailen sendes `hasSubsidy || needsRouter` i stedet for `hasSubsidy`, så tilskud og shop-tekst vises på samme måde som i formularen.
