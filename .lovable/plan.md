

## Skjul løste opgaver fra hovedlisten — vis i fold-ud sektion

### Problem
Opgaver med status "resolved" og "wont_fix" vises stadig i hovedlisten, selvom de er færdige.

### Løsning
**Fil: `src/pages/SystemFeedback.tsx`**

1. **Split feedbackList** i to: `activeFeedback` (status != resolved/wont_fix) og `resolvedFeedback` (status == resolved/wont_fix)
2. **Vis kun `activeFeedback`** i hovedtabellen
3. **Tilføj en `Collapsible`-sektion** under tabellen med tekst "Vis løste opgaver (X)" der folder `resolvedFeedback` ud i en tilsvarende tabel
4. **Filtre respekteres stadig** — hvis brugeren vælger status "resolved" i filteret, vises de i hovedlisten som normalt (filteret overrider)

### Tekniske detaljer
- Import `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` fra `@/components/ui/collapsible`
- Import `ChevronDown` ikon til fold-ud knappen
- `useMemo` til at splitte listen: resolved/wont_fix vs. resten
- Når `filterStatus` er sat til "resolved" eller "wont_fix", vises alt i hovedtabellen (ingen split)

