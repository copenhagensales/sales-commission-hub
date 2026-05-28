## Kontekst

Adgang til Adversus-kampagne 114001 (Eesy TM) blev givet tirsdag 26/5. Vi har allerede kørt en 14-dages backfill i dag uden at finde nye salg ud over det ene fra 28/5. Spørgsmålet er om Adversus API'et nu (efter adgang er givet) returnerer historiske salg fra før 26/5, eller om adgangen kun gælder fremadrettet.

## Plan

1. **Kør udvidet backfill: 90 dage tilbage** på Eesy TM-integrationen (`fe87f6eb-dc6a-4209-9a47-d84054381452`)
   - `action: "safe-backfill"`, `datasets: ["sales"]`, `from: 2026-02-27`, `to: 2026-05-28`, `background: true`
   - Idempotent — rører ikke eksisterende salg på andre kampagner

2. **Vent ~60 sek** og tjek `integration_logs` for status/fejl

3. **Verificér resultat** med to queries på `sales` filtreret på `dialer_campaign_id = '114001'`:
   - Antal salg pr. uge de sidste 90 dage
   - Specifik check på det kendte salg fra 22/5 (Emne-ID 1006478073, telefon 42415580)

4. **Konkludér**:
   - Hvis flere salg dukker op → vi har nu komplet historik, og Mathias kan se hvor langt tilbage Adversus rakte
   - Hvis stadig kun salget fra 28/5 → Adversus giver kun adgang fra adgangstidspunktet og frem. Så skal Eesy enten genåbne historikken eller levere data manuelt (CSV-eksport fra deres side)

## Hvad jeg IKKE rører

- Ingen ændringer i pricing, sale_items, mappings eller andre integrationer
- Ingen ændringer i koden — kun edge function-kald + read queries
- Andre kampagner upsertes idempotent og påvirkes ikke

Skal jeg køre det?