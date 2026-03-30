

## Fix Eesy TM match-fejl: Tillad Pass 2 fallback + automatisk re-match

### Problem
36 rækker sidder fast i "Fejl i match" fordi Pass 2 (sælger+dato) blokerer rækker med telefonnummer. Brugeren vil have dem re-matchet **uden ny upload**.

### Løsning (2 dele)

**A) Fjern Pass 2 guard — kun for Eesy TM**
- **Fil:** `src/components/cancellations/UploadCancellationsTab.tsx`
- Linje ~1486: Ændr `return`-guarden så den kun gælder for klienter der **ikke** er Eesy TM.
- Rækker med telefonnummer for Eesy TM fortsætter nu til sælger+dato matching som fallback.

```typescript
// Før:
if (!isExcluded2 && !isEesyTm5g) return;

// Efter:
const isEesyTm = selectedClientId === CLIENT_IDS["Eesy TM"];
if (!isExcluded2 && !isEesyTm5g && !isEesyTm) return;
```

**B) "Re-match alle" knap i MatchErrorsSubTab — kun for Eesy TM**
- **Fil:** `src/components/cancellations/MatchErrorsSubTab.tsx`
- Tilføj en "Re-match alle" knap der kun vises for Eesy TM.
- Logikken itererer over alle match-fejl rækker og kører den eksisterende re-match logik (sælger+dato søgning mod `sales` tabellen).
- For hver matchet række: indsæt i `cancellation_queue` og fjern fra `unmatched_rows`.
- Toast med resultat: "X af Y rækker matchet".

### Scope
- 2 filer ændres
- Ingen databaseændringer
- Ingen ny upload nødvendig

