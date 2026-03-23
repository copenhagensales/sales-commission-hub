

# Fix: Gem alle upload-rækker per OPP (ikke kun Total-rækken)

## Problem
TDC's Excel har flere rækker per OPP — én pr. produkt + en "Total"-række. Men `uploadedRowByOpp` er en `Map<string, Record>` der kun gemmer **den sidste række** per OPP. Resultatet er at `uploaded_data` altid indeholder "Produkt: Total" i stedet for de faktiske produkter.

## Løsning

### 1. `UploadCancellationsTab.tsx` — Gem alle rækker per OPP
- Ændr `uploadedRowByOpp` fra `Map<string, Record>` til `Map<string, Record[]>` (array af alle rækker)
- `findUploadedRow` returnerer et samlet objekt med:
  - Alle felter fra Total-rækken (omsætning, CPO osv.)
  - Et nyt felt `_product_rows` med de individuelle produktrækker (hvor "Produkt" ikke er "Total")
- Gem dette samlede objekt som `uploaded_data` på queue-items

### 2. `ApprovalQueueTab.tsx` — Vis produkter fra upload
- I `buildUploadedPreview`: Check for `_product_rows` i `uploadedData`
- Hvis det findes: vis produktnavnene som badges (fra "Produkt"-kolonnen i hver produktrække)
- Vis stadig omsætning/CPO fra Total-rækken

### Resultat
Godkendelseskøen vil vise f.eks.:
```text
Upload: Mobil 0%, Mobilt Bredbånd 50%, Fastnet 100%
CPO Total: 10600
```
I stedet for bare "Produkt: Total"

| Fil | Ændring |
|-----|---------|
| `UploadCancellationsTab.tsx` | Saml alle upload-rækker per OPP i ét objekt med `_product_rows` |
| `ApprovalQueueTab.tsx` | Vis produktnavne fra `_product_rows` i uploaded preview |

