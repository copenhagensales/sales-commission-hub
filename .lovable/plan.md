

# Tilføj lønperiode-navigation til Løn-fanen

## Oversigt

Tilføj mulighed for at bladre frem og tilbage mellem lønperioder i "Løn"-fanen, ved hjælp af den eksisterende `PayrollPeriodSelector`-komponent (pile-knapper med periodevisning).

## Ændringer

### Fil: `src/pages/MyGoals.tsx`

- Tilføj lokal state til at holde den valgte lønperiode for Løn-fanen (med `useState`)
- Importer `PayrollPeriodSelector` fra `@/components/employee/PayrollPeriodSelector`
- Placer `PayrollPeriodSelector` øverst i `TabsContent value="lon"` med en callback der opdaterer periodens state
- Send den valgte periode til `PayrollDayByDay` i stedet for den faste `payrollPeriod` fra `useMemo`

Resultatet bliver en pil-navigation (< periode >) over dagsoversigten, så medarbejderen kan se tidligere lønperioder.

