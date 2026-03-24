

# Redigerbar fradragsdato for annulleringer

## Problem
Der er ingen kolonne der viser hvilken lønperiode en annullering trækkes i, og datoen kan ikke ændres.

## Løsning

### 1. Database: Tilføj `deduction_date` kolonne
Tilføj en nullable `deduction_date` (type `date`) til `cancellation_queue`. Default til `reviewed_at::date` når den er null — så eksisterende data virker uden migration af gamle rækker.

### 2. UI: Ny kolonne "Trækkes i" med redigerbar dato

**`src/components/cancellations/ApprovedTab.tsx`**:
- Importér `getPayrollPeriod` fra `@/lib/calculations/dates`
- Tilføj kolonne **"Trækkes i"** efter Status-kolonnen
- For godkendte sager: vis lønperioden beregnet fra `deduction_date` (eller `reviewed_at` som fallback), f.eks. "15. mar – 14. apr"
- Gør datoen klikbar med en date picker popover — ved valg af ny dato opdateres `deduction_date` i databasen og lønperioden genberegnes
- For afviste sager: vis "-" (ingen fradrag)
- Brug `useMutation` til at opdatere `cancellation_queue.deduction_date` og invalidér queryen

### Teknisk flow
1. Bruger klikker på lønperiode-teksten → popover med kalender åbner
2. Bruger vælger ny dato → `UPDATE cancellation_queue SET deduction_date = '...' WHERE id = '...'`
3. Lønperioden genberegnes og vises med det samme

