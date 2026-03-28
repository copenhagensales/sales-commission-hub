

## Fix: Synkroniser filter-logik korrekt

### Problem nu
Forrige ændring fjernede `uploadType !== "both"` fra handleMatch → filteret anvendes altid → kun 199 annulleringsrækker sendes til matching → kun 183 matcher.

Begge steder (handleMatch OG filteredDataForPreview) skal have **samme** logik.

### Løsning i `src/components/cancellations/UploadCancellationsTab.tsx`

**1. Gendan `uploadType !== "both"` i handleMatch (linje 774)**
```typescript
const filteredData = (uploadType !== "both" && cfgFilterColumn !== "__none__" && cfgFilterValue.trim())
```
Tilbage til original — ved "both" springes filteret over, alle 1550 rækker bruges.

**2. Tilføj samme guard i filteredDataForPreview (linje 1551)**
```typescript
let data = (uploadType !== "both" && previewFilterColumn !== "__none__" && previewFilterValue.trim())
```
Nu bruger preview præcis samme logik som handleMatch.

**3. Beregn unmatchedRows fra filteredDataForPreview (linje 1574)**
```typescript
const unmatchedRows = filteredDataForPreview.filter(row => !matchedRowIndices.has(row.originalIndex));
```
Unmatched = rækker der passerede filter+junk men ikke matchede. **Ingen separat excluded-kategori** — alt der ikke matcher er "umatchet".

### Resultat (uploadType="both")
- Filter springes over → alle 1550 rækker (minus junk) bruges
- Matched: ~1307, Unmatched: ~243 (inkl. de 199 kurvrettelser der ikke matchede)
- 1307 + 243 = 1550 ✓
- Ingen "excluded" badge/tab — kun matched og unmatched

