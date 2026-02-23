

# Fix: 408 manglende Lønsikring sale_items i ASE-salg

## Problem

408 ASE-salg har Lønsikring-data i deres `raw_payload` (f.eks. `"Lønsikring": "Lønsikring Udvidet"`), men integration-engine oprettede aldrig et Lønsikring sale_item for dem. Kun Salg/Lead-item blev oprettet.

Det betyder ca. 326.400 kr i manglende omsætning (408 x 800 kr per Lønsikring).

### Årsag
Salgene blev processeret af integration-engine FØR de korrekte conditional rules var konfigureret (eller mens extraction logikken ikke matchede). Da engine bruger `ON CONFLICT` og springer over eksisterende salg ved re-sync, bliver de manglende Lønsikring-items aldrig oprettet efterfølgende.

### Fordeling af de 408 salg
- 360 stk: A-kasse salg = Ja, Forening = Fagforening med lønsikring
- 16 stk: A-kasse salg = Ja, Forening = Ase Lønmodtager
- 15 stk: A-kasse salg = Nej, Forening = null (solo Lønsikring)
- 12 stk: A-kasse salg = Nej, Forening = Fagforening med lønsikring (solo Lønsikring)
- 5 stk: Andre kombinationer

## Løsning

### Trin 1: Opret manglende Lønsikring sale_items

Indsæt nye `sale_items` for de 408 salg med:
- `product_id = 'f9a8362f-3839-4247-961c-d5cd1e7cd37d'` (Lønsikring)
- `quantity = 1`
- `mapped_commission = 0` (sættes af rematch)
- `mapped_revenue = 0` (sættes af rematch)

SQL:
```sql
INSERT INTO sale_items (sale_id, product_id, quantity, mapped_commission, mapped_revenue, needs_mapping)
SELECT s.id, 'f9a8362f-3839-4247-961c-d5cd1e7cd37d', 1, 0, 0, true
FROM sales s
WHERE s.source = 'ase'
AND s.sale_datetime >= '2025-09-01'
AND (
  (s.raw_payload->'data'->>'Lønsikring' IS NOT NULL AND s.raw_payload->'data'->>'Lønsikring' != '')
  OR (s.raw_payload->'data'->>'lønsikring' IS NOT NULL AND s.raw_payload->'data'->>'lønsikring' != '')
)
AND NOT EXISTS (
  SELECT 1 FROM sale_items si 
  JOIN products p ON p.id = si.product_id
  WHERE si.sale_id = s.id AND p.name ILIKE '%lønsikring%'
);
```

### Trin 2: Opdater rematch-pricing-rules for case-insensitive key normalisering

Tilføj en `normalizeRawPayloadKeys()` funktion i `rematch-pricing-rules/index.ts` med samme key-mapping som i enreach.ts-adapteren. Denne køres på `rawPayloadData` for ASE-salg FØR enrichment og pricing rule matching.

Tilføj også Lønsikring-variant-korrektion i `determineAseProductId()` så alle Lønsikring-varianter korrigeres til standard-ID'et.

### Trin 3: Kør rematch-pricing-rules

Kald funktionen med `source: "ase"` for at beregne korrekt commission og revenue for alle nye og eksisterende Lønsikring sale_items. Forventet resultat: 400 kr commission / 800 kr revenue per Lønsikring (for dem med Dækningssum >= 6000).

### Forventet effekt
- 408 nye Lønsikring sale_items oprettes
- Ca. 326.400 kr ekstra omsætning synliggøres i dagssedler og dashboards
- Fremtidige syncs opretter automatisk Lønsikring-items korrekt (fix fra forrige ændring)

## Tekniske detaljer

### Fil: `supabase/functions/rematch-pricing-rules/index.ts`

1. Tilføj en `KNOWN_KEY_MAP` og `normalizeRawPayloadKeys()` funktion (identisk mapping som i enreach.ts-adapteren)
2. Tilføj `ASE_LOENSIKRING_PRODUCT_ID` konstant og `LOENSIKRING_VARIANT_IDS` Set
3. Udvid `determineAseProductId()` til at tjekke om `originalProductId` er en Lønsikring-variant
4. I processing-loopet: kør normalisering af rawPayloadData for ASE-salg før enrichment

### Database: INSERT manglende sale_items

Direkte SQL insert af 408 nye sale_items med `needs_mapping = true` så rematch fanger dem.

### Edge function kald

Kør `rematch-pricing-rules` med `source: "ase"` efter deployment.
