

## Produktmerge-funktion

### Koncept
En merge-funktion der samler flere produktvarianter (f.eks. 5 versioner af "Fri tale + 100 GB data (5G)") til ét primært produkt. Det primære produkt beholder sine priser og regler, mens de sekundære produkter peger hen til det.

### Datamodel (ny tabel + kolonne)

**Ny kolonne på `products`:**
- `merged_into_product_id UUID REFERENCES products(id)` — NULL = selvstændigt produkt, sat = dette produkt er merget ind i et andet

**Ny tabel `product_merge_history`** (audit log):
- `id`, `source_product_id`, `target_product_id`, `merged_by`, `merged_at`, `adversus_mappings_moved INT`, `sale_items_moved INT`, `pricing_rules_moved INT`

### Merge-logik (hvad sker ved merge)

Når produkt A, B, C merges ind i produkt T (target):

1. **`adversus_product_mappings`**: Alle mappings fra A/B/C peger nu på T (`UPDATE SET product_id = T`)
2. **`sale_items`**: Alle sale_items med `product_id` = A/B/C opdateres til T
3. **`product_pricing_rules`**: Regler fra A/B/C flyttes til T (eller slettes hvis T allerede har dem)
4. **`cancellation_product_mappings`**: Opdater `product_id` fra A/B/C til T
5. **`product_campaign_overrides`**: Opdater `product_id` fra A/B/C til T
6. **Source-produkter**: Markér A/B/C med `merged_into_product_id = T` og `is_active = false`
7. **Audit**: Indsæt rækker i `product_merge_history`

### UI-flow

**Placering**: Produktfanen i MgTest, filtreret per kunde (som nu).

1. Brugeren vælger flere produkter via checkboxes
2. Ny knap **"Merge produkter"** aktiveres når 2+ produkter er valgt
3. Åbner en **merge-dialog** der viser:
   - Liste over valgte produkter med navn og antal tilknyttede sales
   - Dropdown til at vælge **target-produkt** (hvilket produkt de andre merges ind i)
   - Forhåndsvisning: "X adversus-mappings, Y sale_items, Z prisregler vil blive opdateret"
4. Bekræftelsesknap udfører merge
5. Mergede produkter forsvinder fra listen (da `is_active = false`) men kan ses via et "Vis mergede" toggle

### Filer der ændres

| Fil | Ændring |
|-----|---------|
| **Migration SQL** | Ny kolonne `merged_into_product_id` på `products`, ny tabel `product_merge_history` |
| **`src/components/mg-test/ProductMergeDialog.tsx`** | Ny komponent: merge-dialog med target-valg, preview og bekræftelse |
| **`src/pages/MgTest.tsx`** | Tilføj checkbox-selection state, "Merge"-knap, og dialog-integration i produkttabellen |

### Sikkerhed
- Merge kører som multiple updates i rækkefølge (ikke en DB-funktion, da vi bruger client-side Supabase)
- Mergede produkter kan **ikke** slettes (de har historik-reference)
- Merge er **irreversibel** i UI, men data bevares via audit-tabellen

### Vigtige edge cases
- Et produkt der allerede er merget kan ikke merges igen
- Target-produktet skal tilhøre samme `client_campaign_id`
- Eksisterende prisregler på source-produkter: brugeren vælger om de skal flyttes eller slettes

