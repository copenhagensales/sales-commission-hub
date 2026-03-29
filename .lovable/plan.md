

## Filtrer produkt-dropdown til kun target-produktet

### Problem
Dropdown'en viser alle produkter for klienten. Den bør kun vise det produkt, som upload-data har resolvet til (`target_product_name`), da det er det eneste valg der giver et korrekt match.

### Ændring i `src/components/cancellations/ApprovalQueueTab.tsx`

**Erstat den nuværende dropdown-logik (ca. linje 1289-1305):**
- I stedet for at iterere over alle `clientProducts`, filtrer listen til kun at inkludere produkter hvis `name` matcher `item.target_product_name`.
- Hvis `target_product_name` ikke matcher noget i `clientProducts` (edge case), vis alle som fallback.

Konkret: Ændr `clientProducts.map(...)` til `clientProducts.filter(p => p.name === item.target_product_name).map(...)` med fallback til fuld liste hvis ingen match.

### Effekt
- Brugeren kan kun vælge det produkt, som upload-data specificerer — det produkt der vil give "Korrekt match".
- Ingen irrelevante produkter i dropdown'en.

