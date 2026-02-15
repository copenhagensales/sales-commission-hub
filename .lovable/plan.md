

# Vis alle salg uanset status

## Problem
Queryen i `ManualCancellationsTab.tsx` filtrerer cancelled salg fra med `.neq("validation_status", "cancelled")`. Det betyder at annullerede og afviste salg ikke vises.

## Loesning
Fjern `.neq("validation_status", "cancelled")` linjen fra sales-queryen i `ManualCancellationsTab.tsx` (linje 68), saa alle salg vises uanset status (pending, approved, rejected, cancelled).

## Fil der aendres
- `src/components/cancellations/ManualCancellationsTab.tsx` - fjern status-filteret fra queryen

