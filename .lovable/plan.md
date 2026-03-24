

# Fix: Tillad sælger-matching for alle umatchede rækker

## Problem
Pass 2 (sælger+dato+produkt matching) springer rækker over der har et telefonnummer (linje 896: `if (excelPhone) return`). Det betyder at rækker med telefonnummer som IKKE matchede i Pass 1 aldrig forsøges matchet via sælgernavn. Screenshottet viser at 5GI-rækker faktisk HAR telefonnumre, men de matcher ikke via telefon fordi 5GI ikke har en "Telefon Abo" i raw_payload.

## Ændring

### `UploadCancellationsTab.tsx` — Linje ~891-896

Fjern begrænsningen der skipper rækker med telefonnummer i Pass 2. I stedet: kør Pass 2 for alle rækker der **ikke allerede er matchet i Pass 1**.

**Før:**
```typescript
const excelPhone = rawExcelPhone ? normalizePhone(String(rawExcelPhone)) : "";
if (excelPhone) return; // has phone → should have been matched in pass 1
```

**Efter:**
```typescript
// Skip — allerede matchet i pass 1 (uanset om den har telefon)
// Rækker med telefon der IKKE matchede i pass 1 kan stadig matches via sælger+dato
```

Det er en enkelt linje der skal fjernes (linje 896). Resten af Pass 2-logikken forbliver uændret — den tjekker allerede `if (matchedIndicesLocal.has(idx)) return` på linje 892.

## Resultat
Rækker som "5G Internet Ubegrænset data" med telefonnummer 61547715 der ikke matcher nogen "Telefon Abo" i raw_payload → falder nu igennem til Pass 2 → matches via sælgernavn + dato + produktnavn.

