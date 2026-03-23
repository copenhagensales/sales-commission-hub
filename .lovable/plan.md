

# Kør enrichment-healer for TDC Erhverv salg

## Hvad
Kald den eksisterende `enrichment-healer` Edge Function i små batches for at berige de ~397 Lovablecph TDC Erhverv salg der allerede har `leadId` i `raw_payload`. Ingen kodeændringer.

## Fremgangsmåde

1. Kald `enrichment-healer` med `maxBatch: 20, turboMode: true` — gentag 3-4 gange med pauser mellem
2. Tjek logs efter hver kørsel for at verificere OPP-numre hentes
3. Gentag indtil alle pending salg er behandlet

## Vigtige forudsætninger
- Kun Lovablecph-salg med `leadId` behandles (eksisterende logik)
- Relatel røres IKKE — de har ingen `leadId` og healeren skipper dem automatisk
- Rate limit: ~20 kald pr. batch med 1.2s delay = sikkert under grænsen

