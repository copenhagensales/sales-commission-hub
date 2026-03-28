

## Plan: "Begge" upload-type for Eesy FM — automatisk type per række

### Koncept
Tilføj en tredje knap **"Begge"** i Step 1. Ingen ekstra vælger — logikken er hardcoded: kolonnen **"Annulled Sales"** afgør typen. Har den en værdi → `cancellation`. Tom → `basket_difference`. Brugeren skal bare uploade filen.

### Ændringer i `src/components/cancellations/UploadCancellationsTab.tsx`

**1. Udvid `uploadType` state (linje ~470)**
```typescript
useState<"cancellation" | "basket_difference" | "both">("cancellation")
```

**2. Tilføj "Begge"-knap i Step 1 (linje ~1612)**
- Tredje knap med `Layers` ikon, titel "Begge", beskrivelse "Én fil med annulleringer og kurvrettelser"
- Grid → `grid-cols-3`

**3. Per-række type i queue-insert (linje ~1430)**
Når `uploadType === "both"`:
```typescript
const annulledVal = String(getCaseInsensitive(sale.uploadedRowData, "Annulled Sales") || "").trim();
const rowUploadType = annulledVal ? "cancellation" : "basket_difference";
```
Brug `rowUploadType` i stedet for `uploadType` i queue-item og import-log.

**4. Preview-badge**
I preview-tabellen, vis en badge per række: "Annullering" (rød) eller "Kurvrettelse" (orange) baseret på "Annulled Sales"-kolonnen.

**5. Import-log**
`cancellation_imports.upload_type` sættes til `"both"` for tracking.

### Ingen DB-migration nødvendig
`upload_type` er allerede TEXT — "both" er en gyldig værdi. Ingen ny kolonne behøves da type-kolonnen altid er "Annulled Sales" for denne use case.

### Rækkefølge
1. Udvid state type + tilføj "Begge"-knap
2. Opdatér queue-insert med per-række type-logik
3. Tilføj preview-badge

