

# Forbedret "Sync enkelt salg" dialog -- to-trins flow med udvidet soegning

## Oversigt

Dialogen aendres fra et enkelt "Hent og sync"-trin til et to-trins flow:

1. **Trin 1 -- Hent**: Brugeren soeger paa external ID, agent, kunde, telefon eller lead ID. Systemet finder salget i databasen og viser detaljer.
2. **Trin 2 -- Sync**: Brugeren ser salgsdata og kan vaelge at koere enrichment/healing paa det fundne salg.

## Aendringer

### Fil: `src/components/settings/SyncSingleSaleDialog.tsx`

**State-udvidelse:**
- Tilfoej `fetchedSale` state til at holde det fundne salg fra databasen
- Tilfoej `step` state: `"search"` eller `"confirm"`
- Tilfoej `isFetching` state (separat fra `isRunning`)

**Soegning (trin 1):**
- Soegeinput-feltet faar en bredere placeholder: "Soeg paa lead ID, telefon, agent, kunde..."
- "Hent"-knappen soeger i `sales`-tabellen via den eksisterende `search_sales` RPC (oprettet tidligere) ELLER direkte via `.or()` paa `adversus_external_id`, `customer_phone`, `customer_company`, `agent_name`, `agent_email`, `internal_reference`
- Filtrerer ogsaa paa `integration_type` (provider) for at holde resultater relevante
- Viser op til 5 matchende salg i en liste (hvis flere matcher)
- Brugeren klikker paa et salg for at vaelge det

**Visning af fundet salg (trin 1 -> trin 2):**
- Viser kort med noegleinformation:
  - External ID
  - Agent (navn + email)
  - Kunde (firma + telefon)
  - Salgsdato
  - Enrichment status
  - Internal reference (OPP nr)
- "Sync dette salg"-knap bliver aktiv

**Sync (trin 2):**
- Kalder `enrichment-healer` med `saleExternalId` fra det valgte salg
- Viser resultat som foer (healed/failed/skipped)

**Reset:**
- "Soeg igen"-knap nulstiller til trin 1
- Dialog-luk nulstiller alt

### UI-layout

```text
+------------------------------------------+
|  Sync enkelt salg                    [x]  |
|  Hent og heal et specifikt salg...        |
|                                          |
|  Soeg salg                               |
|  [Lead ID, telefon, agent, kunde... ]    |
|                          [Soeg]          |
|                                          |
|  Resultater:                             |
|  +--------------------------------------+|
|  | #12345 | Oscar J. | Firma A | 14:32  ||
|  | #12346 | Oscar J. | Firma B | 15:01  ||
|  +--------------------------------------+|
|                                          |
|  --- efter valg ---                      |
|                                          |
|  Valgt salg:                             |
|  External ID: 12345                      |
|  Agent: Oscar Joergensen                 |
|  Kunde: Firma A (12345678)               |
|  Dato: 2026-02-28 14:32                  |
|  Enrichment: pending                     |
|                                          |
|  [Soeg igen]              [Sync salg]   |
+------------------------------------------+
```

### Tekniske detaljer

- Soegningen bruger Supabase `.or()` paa relevante kolonner + filtrerer paa `integration_type`
- Ingen nye database-migrationer nødvendige (bruger eksisterende kolonner)
- Maks 10 resultater vises for at holde dialogen overskuelig
- Valgt salg gemmes i state og bruges til at kalde enrichment-healer

