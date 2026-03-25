

# Synliggør fejl i match antal på aktivt upload-kort

## Ændring

| Fil | Ændring |
|-----|---------|
| `src/components/cancellations/ApprovalQueueTab.tsx` | Tilføj ekstra Badge med match-fejl antal på det aktive import-kort |

## Detaljer
- Tilføj en ny `Badge` ved siden af den eksisterende "X rækker afventer" badge (linje 1023-1026)
- Badgen viser `matchErrorsCount` med teksten "X fejl i match" og et `AlertTriangle`-ikon i orange/warning-farve
- Vises kun hvis `matchErrorsCount > 0`
- Bruger den allerede eksisterende `matchErrorsCount` query (linje 711-726), ingen ny datahentning nødvendig

