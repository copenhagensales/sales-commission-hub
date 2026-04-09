

## Plan: Fix umappede sale_items + needs_mapping badge + auto-rematch

### Hvad ændres — og hvad ændres IKKE

---

### Ændring 1: Rematch-funktionen resolver `needs_mapping` items (Edge Function)

**Fil:** `supabase/functions/rematch-pricing-rules/index.ts`

**Hvad ændres:**
- Tilføj en ny fase **før** den eksisterende logik (linje ~320): Hent alle `sale_items` med `needs_mapping = true` og `product_id IS NULL`. For hver: slå `adversus_product_title` op i `adversus_product_mappings` → hent `product_id`, og opdater rækken med det fundne `product_id` + sæt `needs_mapping = false`.
- Ændr default-filteret (linje 352-355) fra `not("product_id", "is", null)` til at **også** inkludere items der netop fik resolved i fasen ovenfor (de har nu et `product_id`).

**Hvad påvirkes:**
- **KUN** `sale_items` der har `needs_mapping = true` OG `product_id = NULL` — altså de 4 items vi fandt (2x Eesy, 1x Eesy fri data, 1x Meeting CPH sales). Ingen andre items røres.
- Derefter kører normal prisregel-matching som i dag. Resultatet er at `mapped_commission` og `mapped_revenue` sættes baseret på eksisterende prisregler.

**Hvad ændres IKKE:**
- Ingen ændring i hvordan eksisterende items med `product_id` behandles
- Ingen ændring i prisregel-matching logikken
- Ingen ændring i ASE/Relatel-specifikke flows
- Ingen ændring i immediate payment logikken
- Items der allerede har `matched_pricing_rule_id` røres ikke (medmindre du eksplicit kalder funktionen med `product_id` eller `sale_ids`)

---

### Ændring 2: Badge i MG Test (UI-only)

**Fil:** `src/pages/MgTest.tsx`

**Hvad ændres:**
- Tilføj en `useQuery` der tæller `sale_items` med `needs_mapping = true` de seneste 30 dage (read-only SELECT count)
- Vis et advarselsbanner/badge øverst på siden: "X salg mangler produktmapping"

**Hvad påvirkes:**
- Rent UI — ingen data ændres. Kun en visuel indikator.

---

### Ændring 3: Auto-rematch ved ny produktmapping (UI-only trigger)

**Fil:** Identificeres ved at finde den komponent der opretter `adversus_product_mappings`

**Hvad ændres:**
- Efter succesfuld oprettelse/opdatering af en produktmapping i UI'et: kald `supabase.functions.invoke("rematch-pricing-rules")` **uden** `product_id` parameter. Dette trigger kun processing af items med `matched_pricing_rule_id IS NULL` — altså items der ikke allerede har priser.

**Hvad påvirkes:**
- Kun umatchede `sale_items` (dem uden `matched_pricing_rule_id`). Alle eksisterende salg med korrekte priser forbliver uændrede.

---

### Opsummering: Risikovurdering

| Eksisterende data | Påvirkes? |
|---|---|
| Sale items med `matched_pricing_rule_id` | **NEJ** — springes over |
| Sale items med korrekt `product_id` og priser | **NEJ** — kun `needs_mapping=true` items røres |
| Prisregler (product_pricing_rules) | **NEJ** — read-only |
| Produkter (products) | **NEJ** — read-only |
| ASE/Relatel logik | **NEJ** — uændret |
| Immediate payment status | **NEJ** — bevares altid |

**De eneste rækker der opdateres er de 4 `sale_items` med `needs_mapping = true` og `product_id = NULL`.**

