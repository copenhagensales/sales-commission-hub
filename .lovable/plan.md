

## Problem

TDC Erhverv's `cancellation_upload_configs` har `date_column = NULL`. Derfor springer `computeDiff` dato-sammenligningen helt over for TDC-uploads — selvom datokolonnen `Lukkedato` eksisterer i upload-data.

Eksempel fra uploaded_data: `"Lukkedato": "2026-03-12T00:00:00.000Z"`

## Løsning

Opdatér TDC Erhverv's config-record til at sætte `date_column = 'Lukkedato'`:

```sql
UPDATE cancellation_upload_configs 
SET date_column = 'Lukkedato' 
WHERE client_id = '20744525-7466-4b2c-afa7-6ee09a9112b0';
```

Det er den eneste ændring. `parseExcelDate` og `computeDiff` håndterer allerede ISO-formatet `2026-01-09T00:00:00.000Z` korrekt via `yyyy-MM-dd` regex-match.

### Berørte filer
- Ingen kodeændringer — kun en database-opdatering.

### Risiko
**Meget lav** — tilføjer blot den manglende kolonne-mapping som de øvrige klienter allerede har konfigureret.

