

# Fix: Hent ALLE manglende TDC Erhverv salg (uge 8)

## Status nu
- **Uge 7** (Feb 9-14): 109 TDC-salg -- ser komplet ud
- **Uge 8** (Feb 16-21): Kun 31 TDC-salg -- mangler anslaet ~70-80

De 4 specifikke salg fra billederne (lead IDs `910169330`, `910127474`, `966622250`, `966682022`) er blot en del af de mange manglende.

## Rodaarsag
1. **Forkerte kampagne-ID'er i tidligere backfill**: ID `99496` ("TDC Erhverv Kanvas NY") var ikke med
2. **Backfill koerte kun Feb 16**: Feb 17-22 blev aldrig processeret pga. timeout
3. **Daglig sync (`maxRecords: 60`)** tabte salg paa travle dage

## Loesning

### Trin 1: Koer uncapped backfill for HELE uge 8 UDEN kampagne-filter
- Fjern `campaignIds` filter helt saa ALLE salg processeres
- `uncapped: true` for at fjerne maxRecords og lookback-cap
- `datasets: ["sales"]` for at undgaa timeout paa opkaldsdata
- Koer dag-for-dag (6 separate kald, et per dag Feb 16-21) for at undgaa Edge Function timeout

### Trin 2: Verificer efter hver dag
Tjek TDC-salg per dag efter processering. Forventet resultat: ~15-20 TDC-salg per hverdag.

### Trin 3: Genberegn KPIs
Trigger KPI-genberegning efter alle dage er processeret.

## Tekniske detaljer
Ingen kodeaendringer. Vi koerer 6 API-kald til integration-engine:
```text
For hver dag d i [2026-02-16, 17, 18, 19, 20, 21]:
  POST integration-engine {
    action: "safe-backfill",
    integrationId: "26fac751-c2d8-4b5b-a6df-e33a32e3c6e7",
    from: d,
    to: d+1,
    uncapped: true,
    datasets: ["sales"]
  }
```
Upsert-logik sikrer at eksisterende salg ikke duplikeres.
