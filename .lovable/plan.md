## Problem
v3-filen bruger et bredt navnefilter (`Fri Tale`, `MBB`, `M2M`, …) fordi jeg antog Relatel-produkter uden `client_campaign_id` ikke kunne findes ellers. Det var forkert:

- Filen indeholder **12 Eesy TM** og **6 TDC Erhverv** produkter der ikke er Relatel
- Filen mangler Relatel-produkter der ikke matcher navnefiltret

## Korrekt afgrænsning (samme logik som MgTest bruger)
MgTest's `get_aggregated_product_types` RPC grupperer et produkt under en klient via:
`COALESCE(products.client_campaign_id → clients, sales.client_campaign_id → clients)`

Dvs. et produkt tilhører Relatel hvis:
1. `products.client_campaign_id` peger på en Relatel-kampagne, **ELLER**
2. Produktet er brugt i mindst ét `sale_item` hvor `sales.client_campaign_id` peger på en Relatel-kampagne

Relatel client_id: `0ff8476d-16d8-4150-aee9-48ac90ec962d` (fra `src/utils/clientIds.ts`)

**Resultat:** 190 produkter i alt, **96 med `is_hidden = false`**.

## Output
Ny fil: `/mnt/documents/relatel-produkter-v4.xlsx`

Samme struktur som v3:
- **Fane 1 – Aktuelle satser:** 96 produkter (kun `is_hidden = false`, kun Relatel via MgTest-definitionen)
- **Fane 2 – Historik:** alle pricing-regler for de 96 produkter, sorteret pr. produkt → `effective_from` DESC

Kolonner uændret fra v3.

## Verifikation
1. Bekræft alle 96 produkter matcher MgTest's Relatel-visning (via RPC-logikken).
2. Bekræft ingen produkter fra Eesy TM eller TDC Erhverv er med.
3. Rapportér diff til dig: hvilke produkter der er nye vs. v3, og hvilke der er fjernet.

## Ingen kode-ændringer
Engangs-eksport til `/mnt/documents/`.
