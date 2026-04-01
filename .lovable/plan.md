
## Konsolideret plan: Merge Wizard + Post-Merge Visning + Systemdækkende Filter

Planen dækker **tre dele** — del 1 (wizard redesign) er allerede implementeret. Del 2 og 3 skal bygges nu.

---

### Del 1: Merge Wizard (DONE)
4-trins wizard med prisregeladministration og produktnavngivning — allerede implementeret i `ProductMergeDialog.tsx`.

---

### Del 2: Post-Merge Produktvisning — Sammensatte produkter med til/frakobling

#### `src/pages/MgTest.tsx`
- Tilføj query for merged children: `products WHERE merged_into_product_id IS NOT NULL`, grupperet i `Map<targetId, children[]>`
- Filtrer child-produkter væk fra `aggregatedProducts` (skip hvis product.id findes i children-sættet)
- Vis `GitMerge`-ikon + badge med child-count på parent-produkter
- Klik toggler expanderbar `MergedProductChildren`-komponent under rækken
- State: `expandedMergeProducts: Set<string>`

#### `src/components/mg-test/MergedProductChildren.tsx` (ny)
- Props: `targetProductId`, `clientCampaignId`
- Query: `products WHERE merged_into_product_id = targetId`
- Per child: navn, external_product_code, "Frakobl"-knap
- **Frakobl**: `update products SET merged_into_product_id = null, is_active = true WHERE id = childId`
- **Tilkobl**: dropdown med produkter fra samme kunde (`.is("merged_into_product_id", null).eq("is_active", true)`) → sæt `merged_into_product_id = targetId, is_active = false`, flyt `adversus_product_mappings` og `sale_items` til target
- Invalidér relevante queries efter mutation

---

### Del 3: Systemdækkende filter — Merged children skjules overalt

Tilføj `.is("merged_into_product_id", null)` til produkt-queries i:

| Fil | Kontekst |
|-----|----------|
| `src/pages/vagt-flow/SalesRegistration.tsx` | Produktvalg ved salgsregistrering |
| `src/pages/vagt-flow/EditSalesRegistrations.tsx` | Produktliste ved redigering |
| `src/components/cancellations/AddProductSection.tsx` | Tilføj produkt til opsigelse |
| `src/components/cancellations/SellerMappingTab.tsx` | Produktliste til sælger-mapping |
| `src/components/cancellations/ApprovalQueueTab.tsx` | Produktliste i approval queue |
| `src/pages/MgTest.tsx` manualProducts query | Skjul children i manuelt tilføjede produkter |
| `supabase/functions/sync-adversus/index.ts` | Product-matching ved sync, så nye salg mappes til target |

#### Ingen ændring nødvendig i:
- `pricing-service.ts` — henter per product_id, sale_items peger allerede på target
- `rematch-pricing-rules` — opererer på eksisterende product_ids
- Dashboards/rapporter — aggregerer på `sale_items.product_id` som allerede er flyttet

---

### Filer der ændres (del 2+3)
1. `src/pages/MgTest.tsx` — children query, filtrering, merge-ikon, expanderbar sektion
2. `src/components/mg-test/MergedProductChildren.tsx` (ny) — child-liste med frakobl/tilkobl
3. `src/pages/vagt-flow/SalesRegistration.tsx` — merged-filter
4. `src/pages/vagt-flow/EditSalesRegistrations.tsx` — merged-filter
5. `src/components/cancellations/AddProductSection.tsx` — merged-filter
6. `src/components/cancellations/SellerMappingTab.tsx` — merged-filter
7. `src/components/cancellations/ApprovalQueueTab.tsx` — merged-filter
8. `supabase/functions/sync-adversus/index.ts` — merged-filter ved product-matching
9. `.lovable/plan.md` — opdatér med konsolideret plan
