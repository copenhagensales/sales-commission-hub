# TDC Salgsværktøj: automatisk overførsel i stedet for knap

## Mål
Knappen "Overfør til opsummering og mail" fjernes. Data fra tilbuddet kommer automatisk med.

## Sådan virker det
- **Opsummering:** opdateres med det samme, når sælgeren ændrer antal, tilskud eller hardware i tilbuddet. Opsummeringen bliver lavet ud fra felterne, så der er ingen tekst, der kan gå tabt.
- **Idriftsættelsesmail:** opdateres, når man skifter til fanen, og kun hvis tilbuddet er ændret siden sidst. Det sker ikke løbende, mens man skriver.
  - Abonnementslinjerne opdateres efter tilbuddet. Det, sælgeren allerede har skrevet i en linje (nummer/navn, simkort, "Nyt"), bliver stående, så længe linjen stadig findes.
  - Fjerner man abonnementer i tilbuddet, slettes de sidste linjer af den type. Tilføjer man abonnementer, kommer der nye tomme linjer.
  - Tilskudsbeløbet og hardwarelinjerne erstattes kun, hvis sælgeren ikke selv har rettet dem i mailen. Ellers beholdes sælgerens tekst.
- Ændringerne vises i en lille besked: "Mailen er opdateret ud fra tilbuddet".

## Ikke ændret
TDC Opsummering og TDC Idriftsættelsesmail som selvstændige sider. Intet gemmes i databasen.

## Tekniske detaljer
- `TdcSalgTool.tsx`: fjern `transfer` og `mailKey`. `prefill = useMemo(buildPrefill(products, hardware))` sendes direkte til `TdcOpsummeringForm`.
- Mailen: `syncedPrefill` gemmes i state og sættes i `onValueChange`, når tab bliver `"mail"` og prefill afviger (sammenlign med JSON). `TdcIdriftsaettelseForm` får en ny valgfri effekt på `prefill`, der flettes ind i eksisterende rækker efter indeks og abonnementstype, i stedet for at blive genmonteret. Rækker uden prefill og den selvstændige side er uændrede.
- `TdcTilbudForm.tsx`: fjern knappen og `onTransfer`-prop.
- Ingen migration, ingen lønlogik.
