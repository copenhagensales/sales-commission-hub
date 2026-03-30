

## Fix: Scope breaks og targetProductName til kun Eesy TM

### Problem
De to `break`-statements (linje 1148 og 1152) og `targetProductName`-logikken blev implementeret uden Eesy TM-guard — de påvirker **alle klienter** der bruger `productPhoneMappings`. Det er forkert.

### Ændringer

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`**

**1. Tilføj `isEesyTM` flag** (før Pass 1 loopet, ca. linje 1080):
```typescript
const isEesyTM = selectedClientId === CLIENT_IDS["Eesy TM"];
```

**2. Scope inner break til Eesy TM** (linje 1148):
```
// Nuværende:
break;
// Ny:
if (isEesyTM) break;
```

**3. Scope outer break til Eesy TM** (linje 1152):
```
// Nuværende:
if (matchedIndicesLocal.has(idx)) break;
// Ny:
if (isEesyTM && matchedIndicesLocal.has(idx)) break;
```

**4. Brug faktisk produktnavn for Eesy TM** (linje 1143):
```
// Nuværende:
targetProductName: mapping.productName,
// Ny:
targetProductName: isEesyTM
  ? (matchingItem?.adversus_product_title || mapping.productName)
  : mapping.productName,
```

### Konsekvens
- **Andre klienter**: Helt uberørte — ingen breaks, original targetProductName
- **Eesy TM**: Kun ét match per Excel-række, og godkendelseskøen viser det korrekte produktnavn (ikke "Abonnement1")

