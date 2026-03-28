

## Plan: Auto-gem udgifter ved ændring

### Hvad der ændres

Fjern "Gem"-knappen og indfør debounced auto-save, så hver gang brugeren ændrer et beløb eller en note, gemmes ændringen automatisk efter ~800ms inaktivitet.

### Ændringer i `src/components/billing/ExpenseReportTab.tsx`

1. **Tilføj debounce** — brug `useRef` med `setTimeout` til at debounce saves (800ms)
2. **`updateRow`** opdaterer local state og trigger debounced save af den specifikke række (upsert af én kategori)
3. **Fjern `isDirty` state og "Gem"-knappen** fra UI
4. **Mutation** ændres til at upserte én enkelt række i stedet for alle rækker
5. **Toast** viser diskret "Gemt" ved succes (evt. kun ved fejl for at undgå spam)
6. **Fjern `Save`-import** fra lucide-react

### Teknisk detalje

```typescript
const saveTimeoutRef = useRef<NodeJS.Timeout>();

const debouncedSave = (category: string, amount: number, note: string) => {
  clearTimeout(saveTimeoutRef.current);
  saveTimeoutRef.current = setTimeout(() => {
    saveSingleMutation.mutate({ category, amount, note });
  }, 800);
};
```

Mutation upsert'er kun den ændrede kategori. Ingen toast ved succes (undgå spam), kun ved fejl.

### Fil

| Fil | Handling |
|-----|---------|
| `src/components/billing/ExpenseReportTab.tsx` | Debounced auto-save, fjern Gem-knap |

