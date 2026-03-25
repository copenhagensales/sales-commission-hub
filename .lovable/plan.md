

## Optimering af annulleringssystemet — samlet plan

### Identificerede flaskehalse

**1. Dobbelt-query på `cancellation_queue` (linje 330-361)**
Systemet henter alle felter i ét kald, derefter henter `uploaded_data`, `opp_group`, `client_id` for de **samme rækker** via `.in("id", queueIds)`. Det er en komplet unødvendig roundtrip med tungt JSON-payload.

**2. `raw_payload` hentes for alle salg (linje 368)**
Det tunge JSON-felt hentes for samtlige salg, men bruges kun til `extractOpp()`. OPP-nummer kan i stedet tages fra `opp_group` som allerede hentes fra queue.

**3. Sekventielle database-kald**
`configs`-queryen (linje 380-395) venter på `importsResult`, men kunne paralleliseres bedre. `products`-queryen (linje 397-402) venter på `saleItemsResult`.

**4. Ingen pagination i UI**
Op til 500 rækker hentes og renderes på én gang — ingen client-side pagination.

**5. `approveMutation` laver N+1 queries (linje 498-567)**
Ved godkendelse af produkt-level items loopes der med individuelle database-kald per queue item — henter `sale_items`, `products`, updater items, checker remaining items. Alt sekventielt.

**6. `matchErrorsCount`-query henter alle imports (linje 711-727)**
Henter `unmatched_rows` (JSON array) for **alle** imports for kunden bare for at tælle. Tungt payload for en simpel count.

**7. `activeImport`-query laver to separate kald (linje 685-707)**
Henter 10 imports, derefter checker pending items — kunne kombineres.

---

### Plan

#### Ændring 1: Kombiner de to `cancellation_queue`-kald
**Fil:** `ApprovalQueueTab.tsx` (linje 333-361)

Inkluder `uploaded_data, opp_group, client_id` i den første `.select()`. Fjern hele den anden forespørgsel og `extendedDataMap`.

```text
FØR: 2 roundtrips (basis + extended)
EFTER: 1 roundtrip med alle felter
```

#### Ændring 2: Fjern `raw_payload` fra sales-query
**Fil:** `ApprovalQueueTab.tsx` (linje 368)

Fjern `raw_payload` fra select. I mapping-logikken (linje 437), brug `opp_group` fra queue i stedet for `extractOpp(sale?.raw_payload)`.

```text
FØR: Henter stort JSON for alle salg
EFTER: Bruger opp_group som allerede er tilgængeligt
```

#### Ændring 3: Paralleliser configs + products med sales
**Fil:** `ApprovalQueueTab.tsx` (linje 366-402)

Flyt `configIds`-udledning og configs-fetch ind i Promise.all ved at lave en to-trins tilgang: først hent queue + imports parallelt, udled IDs, derefter hent sales + saleItems + configs + products parallelt.

#### Ændring 4: Chunk store `.in()`-kald
**Fil:** `ApprovalQueueTab.tsx`

Brug `fetchByIds` fra `supabasePagination.ts` for sales og sale_items queries, så vi undgår URI-længde-problemer ved mange IDs.

#### Ændring 5: Client-side pagination
**Fil:** `ApprovalQueueTab.tsx`

Tilføj simpel client-side pagination (50 rækker per side) til tabellen med `Pagination`-komponent fra `@/components/ui/pagination`. Reducer `.limit(500)` til `.limit(200)` da brugeren aldrig ser 500 på én gang.

#### Ændring 6: Optimer `approveMutation` med batch-updates
**Fil:** `ApprovalQueueTab.tsx` (linje 498-567)

Samle alle queue item IDs og hent sale_items + products i ét kald i stedet for N individuelle kald. Brug `.in()` til batch-updates i stedet for loops.

#### Ændring 7: Optimer `matchErrorsCount` med count-query
**Fil:** `ApprovalQueueTab.tsx` (linje 711-727)

I stedet for at hente alle `unmatched_rows` JSON og tælle client-side, brug en mere effektiv tilgang: hent kun imports der har non-null unmatched_rows og brug array_length eller lignende.

---

### Forventet resultat
- **~50-60% hurtigere** initial load (fjerner dobbelt-query + raw_payload + bedre parallelisering)
- **Bedre UX** med pagination (hurtigere rendering, mindre DOM)
- **Mere robust** ved store datasæt (chunked queries)
- **Hurtigere godkendelse** (batch i stedet for N+1)
- Ingen funktionelle ændringer i UI

### Filer der ændres
- `src/components/cancellations/ApprovalQueueTab.tsx`

