

# Vis antal per produkt i "Uploadet data" for TDC Erhverv

## Problem
"Uploadet data"-kolonnen viser kun produktnavne kommasepareret (f.eks. "MOBIL PROFESSIONEL 100GB, STANDARD OMSTILLING"), men ikke antal. Data indeholder allerede `Antal` per produkt i `_product_rows`.

## Løsning
Opdater `buildUploadedPreview` i `ApprovalQueueTab.tsx` til at inkludere antal per produkt for TDC Erhverv.

### Ændring i `buildUploadedPreview` (linje 280-287)
Når `clientId === TDC_ERHVERV_CLIENT_ID` og `_product_rows` er tilgængelig:
- Vis hvert produkt med dets antal, f.eks. `MOBIL PROFESSIONEL 100GB ×2, STANDARD OMSTILLING ×1`
- Antal hentes fra `Antal`-feltet i hver product row
- Hvis `Antal` mangler eller er 1, vises produktet uden `×1` for at holde det rent
- For andre klienter forbliver visningen uændret

### Teknisk detalje
```text
// Nuværende: "MOBIL PROFESSIONEL 100GB, STANDARD OMSTILLING"
// Ny (TDC Erhverv): "MOBIL PROFESSIONEL 100GB ×2, STANDARD OMSTILLING ×1"
```

Kun én fil ændres: `src/components/cancellations/ApprovalQueueTab.tsx`, ca. 5 linjer i `buildUploadedPreview`.

