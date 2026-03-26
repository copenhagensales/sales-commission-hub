

## Kolonne-baserede produktbetingelser for annulleringer

### Hvad bygges
Erstat den flade checkbox-baserede produktmapping med et betingelsessystem, hvor man pr. produkt kan definere regler på **flere kolonner** med operatorer (f.eks. "Operator er IKKE Call Me, CBB" + "Subscription Name = Fri tale..."). Gælder for **både annulleringer og kurvrettelser**.

### Database

**Ny tabel: `cancellation_product_conditions`**

```sql
CREATE TABLE cancellation_product_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  column_name text NOT NULL,
  operator text NOT NULL DEFAULT 'any',  -- 'any', 'equals', 'not_equals', 'in', 'not_in'
  values text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
-- Unik: ét produkt har max én betingelse pr. kolonne pr. klient
ALTER TABLE cancellation_product_conditions 
  ADD CONSTRAINT uq_product_column UNIQUE (client_id, product_id, column_name);

ALTER TABLE cancellation_product_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON cancellation_product_conditions 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

Eksisterende `cancellation_product_mappings` bevares for bagudkompatibilitet (Eesy TM bruger dem stadig indtil videre).

### UI-ændringer: `SellerMappingTab.tsx` — ProductMappingSection

**Ny dialog** når man vælger et produkt:

For hver af de 3 kolonner (Operator, Subscription Name, Sales Department) vises:
1. **Operator-dropdown**: "Ligegyldigt" (any) | "Er en af" (in) | "Er ikke en af" (not_in) | "Er lig med" (equals) | "Er ikke lig med" (not_equals)
2. **Værdi-vælger**: Checkboxes med kendte værdier fra uploads (hentes fra `columnValues` som allerede eksisterer i koden) + manuelt input
3. Standard: "Ligegyldigt" (ingen filtrering)

Gem-knappen skriver til `cancellation_product_conditions` (upsert pr. kolonne).

**Tabel-visning** opdateres: Viser betingelser i læsbart format — f.eks. "Operator ≠ Call Me, CBB | Subscription Name = Fri tale..."

### Matching-logik ændringer

**`ApprovalQueueTab.tsx`** (linje ~479-525) — produktresolvering ved godkendelse:

Nuværende logik: slår op i `cancellation_product_mappings` med excel_product_name.
Ny logik:
1. Hent `cancellation_product_conditions` for klienten
2. Grupper betingelser pr. product_id
3. For hver queue-item: evaluer alle produkters betingelser mod `uploaded_data`
4. Hvis et produkt matcher alle betingelser → brug det
5. Fallback til eksisterende `cancellation_product_mappings` for bagudkompatibilitet

**`UploadCancellationsTab.tsx`** — Pass 2 (sælger+dato) matching:

Nuværende `fallback_product_mappings` bruges til at finde produktet. Tilføj condition-baseret resolving som alternativ:
1. Hent conditions for klienten
2. Evaluer Excel-rækkens data mod betingelserne
3. Hvis match → brug det matchede produkt til at finde sale_item

### Evalueringslogik (delt hjælpefunktion)

```typescript
// Ny fil: src/utils/productConditionMatcher.ts
function evaluateConditions(
  conditions: { column_name: string; operator: string; values: string[] }[],
  rowData: Record<string, unknown>
): boolean {
  return conditions.every(c => {
    if (c.operator === 'any') return true;
    const cell = String(getCaseInsensitive(rowData, c.column_name) || '').trim().toLowerCase();
    const vals = c.values.map(v => v.toLowerCase().trim());
    switch (c.operator) {
      case 'equals': return vals.includes(cell);
      case 'not_equals': return !vals.includes(cell);
      case 'in': return vals.includes(cell);
      case 'not_in': return !vals.includes(cell);
      default: return true;
    }
  });
}
```

### Filer der ændres/oprettes
1. **Ny migration** — opret `cancellation_product_conditions`
2. **Ny fil** `src/utils/productConditionMatcher.ts` — delt evalueringslogik
3. **`SellerMappingTab.tsx`** — ny dialog med operatorer + betingelser; opdateret tabelvisning
4. **`ApprovalQueueTab.tsx`** — condition-baseret produktresolvering ved godkendelse
5. **`UploadCancellationsTab.tsx`** — condition-baseret matching i Pass 2

