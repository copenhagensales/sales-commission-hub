

# Plan: Ny fane "Provisionssatser" på MgTest-siden

## Formål
En read-only oversigt hvor man vælger en kunde og ser alle produkter med deres effektive provisionssatser — inkl. eventuelle kampagne-specifikke prisregler.

## Design

Fanen viser:
1. **Kunde-vælger** (Select dropdown med alle kunder)
2. **Produkttabel** med kolonnerne:
   - Produktnavn
   - Base provision (fra `products.commission_dkk`)
   - Base omsætning (fra `products.revenue_dkk`)
   - Antal aktive prisregler (link/expand til detaljer)
3. **Ekspanderbar sektion** per produkt der viser aktive `product_pricing_rules` med:
   - Regelnavn
   - Provision / Omsætning
   - Prioritet
   - Kampagne-binding (hvis relevant)

```text
┌─────────────────────────────────────────────┐
│  Kunde: [▼ Eesy FM                        ] │
├─────────────────────────────────────────────┤
│  Produkt          Base Prov  Base Oms  Regler│
│  ▶ 5G Internet      300 kr    650 kr    2   │
│  ▼ Eesy 99 m/1.md   200 kr    950 kr    2   │
│    ├ Adversus regel  200 kr    950 kr  p:0   │
│    └ Enreach regel   355 kr    950 kr  p:0   │
│  ▶ Eesy 99 u/1.md   220 kr   1000 kr    2   │
└─────────────────────────────────────────────┘
```

## Tekniske ændringer

### 1. Ny komponent: `src/components/mg-test/CommissionRatesTab.tsx`
- Henter kunder fra `clients` tabellen
- Henter produkter filtreret via `products → client_campaigns → clients`
- Henter aktive `product_pricing_rules` for de viste produkter
- Viser alt i en ekspanderbar tabel
- Rent read-only — ingen mutations

### 2. Opdater `src/pages/MgTest.tsx`
- Tilføj ny `TabsTrigger value="commission-rates"` med label "Provisionssatser"
- Tilføj `TabsContent` der renderer `<CommissionRatesTab />`

### Datahentning (3 queries)
1. `SELECT id, name FROM clients ORDER BY name`
2. `SELECT p.*, cc.client_id FROM products p JOIN client_campaigns cc ON p.client_campaign_id = cc.id WHERE cc.client_id = :selectedClient AND p.is_hidden = false`
3. `SELECT pr.* FROM product_pricing_rules pr WHERE pr.product_id IN (:productIds) AND pr.is_active = true ORDER BY pr.priority DESC`

Ingen nye tabeller eller migrationer nødvendige.

