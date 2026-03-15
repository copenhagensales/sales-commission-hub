

## Fix: Auto-migrering af skabelon virker ikke

### Problem
Auto-migreringen i `PulseSurveyResults.tsx` bruger `useMemo` til at trigge en mutation (side-effect). `useMemo` er ikke beregnet til side-effects — React kan springe den over eller køre den uventet. Derfor bliver de 4 nye spørgsmål aldrig gemt til databasen.

### Løsning
**`src/pages/PulseSurveyResults.tsx`** — Ændre `useMemo` (linje 178-199) til `useEffect` så migreringen kører korrekt som side-effect:

```typescript
useEffect(() => {
  if (templateInitialized || templateLoading) return;
  // ... same merge/save logic
}, [template, templateLoading, templateInitialized]);
```

Dette sikrer at de 4 manglende spørgsmål (`product_competitiveness_score`, `market_fit_score`, `interest_creation_score`, `campaign_attractiveness_score`) bliver tilføjet til skabelonen i databasen, så de også vises i den offentlige survey og overalt der læser fra skabelonen.

