

# Fix: Kundetarget vises ikke i rapporten (dato-mismatch)

## Problem
Targets i `client_monthly_targets` er gemt med `period_start = '2026-03-31'` (sidste dag i måneden), men både Forecast.tsx og ForecastClientReport.tsx søger med `period_start = '2026-03-01'` (første dag). De matcher aldrig.

## Løsning
Dobbelt fix — ret de eksisterende data OG gør rapporten mere robust:

| Ændring | Hvad |
|---------|------|
| **Database migration** | Opdater eksisterende rækker: `UPDATE client_monthly_targets SET period_start = date_trunc('month', period_start)::date` — så `2026-03-31` → `2026-03-01`. |
| **ForecastClientReport.tsx** | Ingen kodeændring nødvendig — den beregner allerede korrekt `YYYY-MM-01`. |

Alternativt, hvis dataene bevidst blev gemt med dag-31, kan vi i stedet ændre query'en til at matche på måned+år i stedet for eksakt dato. Men da Forecast.tsx upsert'er med dag-1, er den korrekte fix at rette de eksisterende data.

