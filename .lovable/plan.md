

## Fix: Kun ét match per Excel-række i Pass 1 for Eesy TM

### Problem
Når et telefonnummer optræder i FLERE Abo-felter på det samme salg (f.eks. "Telefon Abo1" OG "Telefon Abo2" begge har samme nummer), opretter Pass 1 ét match per felt — altså to annulleringer for den samme Excel-række. Brugeren ser derfor to produkter i godkendelseskøen, selvom der kun bør være ét.

### Årsag
I Pass 1 (linje ~1120-1149) itererer koden over ALLE `productPhoneMappings` for hvert salg uden at stoppe efter første match. Dedup-nøglen `saleId|productName` er unik per mapping, så begge passerer.

### Løsning
Tilføj et `break` efter første phone-match per sale i Pass 1, så kun DET FØRSTE matchende Abo-felt bruges. Derudover tilføj en per-row dedup (`matchedIndicesLocal.has(idx)`) guard, så en Excel-række kun kan producere ét match i alt.

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`** (linje ~1126-1149)

Ændring:
```typescript
// After line 1126: if (excelPhone === payloadPhone) {
//   ... push to productMatched ...
//   Add break to stop matching more Abo fields on same sale
    break; // Only one cancellation per Excel row per sale
  }
}
// Also break out of sales loop after first match for this row
```

Konkret: Når en Excel-række finder sit første telefon-match (Abo1, Abo2 eller Abo3), stopper den straks — ingen yderligere matches oprettes for den række.

### Konsekvens
- Hver Excel-række producerer præcis ÉT match i godkendelseskøen
- Det første matchende Abo-felt (typisk Abo1) vinder
- Ingen ændringer i database eller andre faner

