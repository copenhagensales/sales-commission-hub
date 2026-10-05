# TDC Salgsværktøj: tilbud, opsummering og idriftsættelsesmail på én side

## Mål
Én samlet side til TDC Erhverv-sælgere med tre trin. Sælgeren udfylder tilbuddet først. Abonnementer, priser og hardware sendes derefter videre til opsummeringen og idriftsættelsesmailen, så intet skal indtastes to gange.

```text
[1 Tilbud] -> [2 Opsummering] -> [3 Idriftsættelsesmail]
   Faner øverst. Indtastninger bevares, når man skifter fane.
```

## Trin 1: Tilbud (svarer til "Aarhus Arket 2.0")
- **Løsninger:** antal for hvert produkt i grupperne Mobilpakker, Kun EU, Omstilling, 5G Bredbånd/Fiber og Diverse, med priser fra arket.
- **Overblik:** pris pr. måned ekskl. moms, pris inkl. moms (×1,25), muligt tilskud (gavekort) og pris efter tilskud (pris − tilskud/36), som i arket.
- **Provision:** samlet provision ved 0 %, 50 % og 100 % tilskud samt forskellen mellem dem. Vises åbent på siden.
- **Hardware:** liste over TDC Shop-produkter med pris. For hvert produkt vises, hvor mange tilskuddet rækker til. Sælgeren kan markere de produkter, kunden ønsker, og se det resterende budget.

## Trin 2 og 3: Data sendes videre
- Opsummeringen får antal abonnementer, produktnavn og pris pr. måned udfyldt, i stedet for pladsholdere som "(antal + fulde produktnavn …)" og "(beløb)". Tilskudsbeløb og valgt hardware udfyldes også.
- Idriftsættelsesmailen får de valgte abonnementer som linjer under "Numre i løsning", tilskudsbeløbet og den valgte hardware som tilskudsprodukter. Sælgeren skal stadig selv skrive numre og simkort.
- Alt kan rettes manuelt bagefter.

## Adgang
- Ét offentligt link uden login, fx `/tdc-salg`, så det senere kan åbnes fra dialeren. Den interne side i Stork viser det samme.
- De nuværende sider for TDC Opsummering og Idriftsættelse bliver ved med at virke, indtil den nye side er godkendt. Oprydning foreslås bagefter.
- Intet gemmes i databasen. Data ligger kun i browseren, indtil siden lukkes.

## Kendt risiko
- Provisionssatser og indkøbspriser kan ses af alle, der har linket. Det er besluttet.
- Priserne ligger i koden, og ændringer laves af udvikler. Ingen udløbsdato.
- Navnene på abonnementerne i arket (fx "40GB Standard") skal kobles til navnene i mailens rulleliste (fx "Standard mobil (40GB)"). Jeg kobler dem efter bedste vurdering og viser koblingen til godkendelse.

## Tekniske detaljer
- `src/lib/tdcTilbud/catalog.ts`: produkter, priser, tilskud, provision for hvert tilskudsniveau og hardware som én konstant.
- `src/lib/tdcTilbud/calc.ts`: rene beregninger, testet i `calc.test.ts` mod arkets formler, fx F19, G19, H19, I19, F31–I31 og budget/antal hardware.
- En ny samlet side med context-state, der deler data mellem tilbud, `TdcOpsummeringForm` og `TdcIdriftsaettelseForm`. Formularerne får valgfrie startværdier; deres nuværende brug ændres ikke.
- Ny offentlig route i `src/routes/config.tsx` og en intern route under "Mit hjem" med den eksisterende `menu_tdc_opsummering`-rettighed.
- Ingen migration, ingen databasekald og ingen lønberegning. Provisionstallene her er kun vejledende og bruges ikke i Storks lønberegning.
