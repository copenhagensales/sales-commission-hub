

## Fix: Synkroniser filter-logik og flyt excluded → unmatched

### Ændringer i `src/components/cancellations/UploadCancellationsTab.tsx`

**1. Fjern `uploadType !== "both"` fra handleMatch (linje 774)**

Ændre:
```typescript
const filteredData = (uploadType !== "both" && cfgFilterColumn !== "__none__" && cfgFilterValue.trim())
```
Til:
```typescript
const filteredData = (cfgFilterColumn !== "__none__" && cfgFilterValue.trim())
```

Dette sikrer at config-filteret (f.eks. "Annulled Sales = 1") altid anvendes under matching — uanset uploadType.

**2. Fjern excluded-badge og excluded-tab fra UI (linje 1835-1843 + 1972-2008)**

Slet den separate "ikke-uploadede rækker" badge og dens tab-indhold. De ekskluderede rækker er reelt bare umatchede kurvrettelser og hører under "umatchede rækker".

**3. Inkluder excluded rækker i unmatchedRows (linje 1574)**

Ændre beregningen så `unmatchedRows` inkluderer ALLE rækker der ikke matches — både dem fra `filteredDataForPreview` og de filtrerede/junk rækker:

```typescript
const unmatchedRows = parsedData.filter(row => !matchedRowIndices.has(row.originalIndex));
const unmatchedCount = unmatchedRows.length;
```

Dette giver: matched + unmatched = total parsedData (1550). Unmatched-tabellen viser alle 243 rækker (44 + 199).

**4. Fjern excludedRows/excludedCount beregning (linje 1576-1578)**

Ikke længere nødvendig.

**5. Fjern `"excluded"` fra previewTab type (linje 1579)**

```typescript
const [previewTab, setPreviewTab] = useState<"matched" | "unmatched" | "seller_unmatched">("matched");
```

### Resultat
- Badge: `1307 matchede salg | 243 umatchede rækker`
- Alle rækker er synlige — ingen forsvinder
- 1307 + 243 = 1550 ✓

