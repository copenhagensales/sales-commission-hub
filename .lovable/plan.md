

## Fix: Eesy TM — Sælger+Dato fallback når produkt ikke kan resolves

### Problem
Når Excel-kolonnen indeholder en annulleringsårsag (f.eks. "Brug af fortrydelsesret") i stedet for et produktnavn, returnerer linje 1549 tidligt fordi `resolvedProductTitle` er null — selvom sælger og dato matcher perfekt. Dette rammer kun Eesy TM, da andre kunder har korrekte produktnavne i deres uploads.

### Løsning

**`src/components/cancellations/UploadCancellationsTab.tsx`** — Pass 2 (~linje 1549)

**Kun for Eesy TM** (`selectedClientId === CLIENT_IDS["Eesy TM"]`):

1. **Ændr early-return** på linje 1549: Hvis `resolvedProductTitle` er null men `excelSeller` og `excelDate` er tilgængelige, og kunden er Eesy TM → fortsæt i stedet for at returnere.

2. **Sælger+Dato fallback-blok** (ny kode efter den eksisterende logik):
   - Filtrer `candidateSales` på `agentEmail` + eksakt dato-match.
   - **1 kandidat**: Match automatisk. Brug salgets første item's `adversus_product_title` som både `targetProductName` og `realProductName`.
   - **Flere kandidater**: Tilføj til `unmatchedSellers` for manuel håndtering.
   - **0 kandidater**: Tilføj til `unmatchedSellers`.

3. **Eksisterende logik uændret** for alle andre kunder og for Eesy TM-rækker hvor produktet resolves korrekt.

### Ændring i kode (pseudokode)
```text
Linje 1549:
- if (!resolvedProductTitle || !excelSeller || !excelDate) return;
+ if (!resolvedProductTitle && !(selectedClientId === CLIENT_IDS["Eesy TM"] && excelSeller && excelDate)) return;
+ if (!excelSeller || !excelDate) return;

Efter linje 1715 (slutningen af else-blokken), tilføj:
  if (!resolvedProductTitle && selectedClientId === CLIENT_IDS["Eesy TM"]) {
    // Sælger+dato fallback — find kandidater uden produktkrav
    const dateCandidates = candidateSales.filter(sale => {
      if (existingIds.has(sale.id)) return false;
      if ((sale.agent_email||"").toLowerCase() !== agentEmail) return false;
      const sd = new Date(sale.sale_datetime);
      return excelDateObj.getFullYear() === sd.getFullYear()
          && excelDateObj.getMonth() === sd.getMonth()
          && excelDateObj.getDate() === sd.getDate();
    });
    if (dateCandidates.length === 1) {
      // Auto-match med salgets produkt
      → push til productMatched med salgets item-data
    } else {
      → push til unmatchedSellers
    }
  }
```

