

## Produkt-dropdown i Kurv-rettelser

### Hvad
Tilføj en dropdown i "System data"-kolonnen for kurv-rettelser (basket_difference), så brugeren kan vælge det korrekte produkt, der skal erstatte det nuværende produkt på salget.

### Ændringer i `src/components/cancellations/ApprovalQueueTab.tsx`

**1. Hent produkter for klienten**
- Tilføj en `useQuery` der henter alle produkter fra `products`-tabellen knyttet til klientens kampagner (`client_campaigns` → `sale_items` → `products`, eller direkte fra `products` med relevant filtrering).
- Alternativt: hent produkter fra de eksisterende `saleItems` data + `cancellation_product_mappings` for klienten, så dropdown kun viser relevante produkter.

**2. Lokal state til produkt-override**
- Tilføj `const [productOverrides, setProductOverrides] = useState<Record<string, string>>({})` — map fra queue item id til valgt produktnavn.

**3. UI: Dropdown i "System data"-kolonnen**
- Kun for rækker hvor `upload_type === "basket_difference"` og `status === "pending"`:
  - Vis en `<Select>` dropdown under "Produkter solgt" med de tilgængelige produkter for klienten.
  - Default-value er det nuværende system-produkt (`saleItems[0].product_name`).
  - Ved ændring: gem i `productOverrides[item.id]`.

**4. Godkendelse med det valgte produkt**
- Udvid `approveMutation` til at acceptere en optional `overrideProductName`.
- Når en kurv-rettelse godkendes: brug `productOverrides[item.id]` (hvis sat) som `target_product_name` i stedet for den automatisk resolvede.
- Mutationen skal finde det korrekte `sale_item` baseret på det nuværende produkt og opdatere dets `product_id` til det valgte produkt.

**5. Mutation: Opdater sale_item produkt**
- Ved approve af basket_difference med override:
  1. Find `sale_item` med det nuværende produkt.
  2. Slå det nye produkt op i `products` tabellen (by name).
  3. Opdater `sale_item.product_id` til det nye produkts id.
  4. Opdater `sale_item.adversus_product_title` til det nye produktnavn.
  5. Hent priser for det nye produkt (fra `product_pricing_rules` eller `products` base prices) og opdater `mapped_commission`/`mapped_revenue`.

### Ingen databaseændringer
Alt håndteres med eksisterende tabeller (`products`, `sale_items`, `cancellation_queue`).

### Filer
- `src/components/cancellations/ApprovalQueueTab.tsx`

