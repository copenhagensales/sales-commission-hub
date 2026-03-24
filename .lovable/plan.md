

# Fix: 0 produkt-matches — Debug og robusthed

## Analyse

Jeg har undersøgt data og kode. Salg i databasen har `customer_phone` udfyldt (f.eks. `20971200`, `50399450`), og `raw_payload.data` indeholder `Telefon Abo1: 20971200` osv. Matchinglogikken ser korrekt ud i princippet.

**Mest sandsynlige årsag**: Kolonnenavne i Excel-filen matcher ikke præcist konfigurationen. F.eks. kan filen have "Annulled sales" (lille s) mens config har "Annulled Sales", eller "Telefon abo1" i stedet for "Telefon Abo1". Når `row.originalRow["Annulled Sales"]` slås op og kolonnen hedder noget lidt anderledes, returnerer den `undefined` → alle rækker filtreres væk → 0 phones → 0 matches.

## Ændringer

### UploadCancellationsTab.tsx

1. **Case-insensitive kolonne-opslag**: Tilføj en hjælpefunktion `getColumnValue(row, columnName)` der laver case-insensitive + trim-match mod rækkens keys. Brug den i:
   - Filtreringslogikken (linje ~632)
   - Phone-indsamling fra `phoneColumn` (linje ~642)
   - Phone-indsamling fra `product_phone_mappings` (linje ~647)
   - Alle andre kolonne-opslag (company, opp, member number)

2. **Debug console.log**: Tilføj midlertidig logging i `handleMatch`:
   - Antal rækker efter filter
   - Antal unikke telefonnumre indsamlet
   - Antal kandidatsalg hentet fra DB
   - Første par eksempler på telefonnumre fra fil vs. DB (for at se om de matcher)

3. **Case-insensitive kolonne-matching i `applyConfig`**: Når config anvender kolonnenavne (f.eks. "Phone Number"), find den faktiske kolonne i `columns[]` via case-insensitive match.

### Konkret hjælpefunktion
```typescript
function getColValue(row: Record<string, unknown>, colName: string): unknown {
  if (row[colName] !== undefined) return row[colName];
  const lower = colName.toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.toLowerCase() === lower) return row[k];
  }
  return undefined;
}
```

Bruges overalt i stedet for direkte `row.originalRow[phoneColumn]`.

