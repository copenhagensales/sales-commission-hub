

# Ensret kontrakt-preview med formelt papir-layout

## Problem
Admin-previewet i `Contracts.tsx` (linje 664-667) bruger `CONTRACT_PROSE_CLASSES` med dark mode tokens og en `bg-card` baggrund. Det matcher ikke det formelle hvide papir-look fra underskriftssiden.

## Løsning
Opdater previewet i `Contracts.tsx` til at bruge samme hvide papir-styling som underskriftssiden:

1. **`src/pages/Contracts.tsx`** (~linje 664-667):
   - Erstat `CONTRACT_PROSE_CLASSES` med `CONTRACT_PROSE_SIGN_CLASSES`
   - Skift container fra `bg-card` til `bg-white` med shadow
   - Tilføj `rounded-lg shadow-lg` for papir-effekt

Dette sikrer at alle kontrakter — uanset type (salgskonsulent, NDA, ansættelse) — vises med samme formelle layout i både preview og underskrift.

