# Slet-funktion på Eesy FM afvigelser

Aktiver de tre "Slet"-knapper under **Eesy FM afvigelser (Leder)** — "Afvigelser — oversigt", "Mangler i PowerBI" og "Claims/Reimport" — med samme adfærd som "Slet" under **Ret salgsregistrering (Leder)**, plus en bekræftelses-popup.

## Adfærd

Knapperne er i dag rene UI-knapper uden `onClick` (`EesyFmDeviations.tsx:893-900` og `:988-998`).

Ny adfærd:
1. Klik på "Slet" åbner en lille bekræftelsesdialog (AlertDialog) med sælgernavn, dato, produkt og telefonnummer.
2. Valgmuligheder: **Annuller** (lukker uden ændring) og **Bekræft sletning** (rød).
3. Ved bekræftelse slettes salget fra `sales` — samme hard delete som i `EditSalesRegistrations.tsx:320-327`.
4. Toast ved succes/fejl, og listen opdateres automatisk.

Vigtigt at være klar over (samme konsekvens som den eksisterende slet-knap): sletningen er permanent. `sale_items` fjernes automatisk med, så provision og omsætning forsvinder fra sælgerens løn, tavler, dagsrapporter og aggregeringer. Der er ingen fortryd-mulighed.

## Teknisk

- Ny mutation `useDeleteEesyFmSale` i `src/hooks/useEesyFmClaimSales.ts`:
  - `supabase.from("sales").delete().eq("id", saleId)`.
  - Invaliderer samme cache-nøgler som `useUpdateEesyFmClaimSale` (`eesy-fm-claim-sales`, `eesy-fm-stork-sales`, `eesy-fm-claim-phones`, `fm-sales-edit`, `fieldmarketing-sales`, `sales-aggregates`), så rækken forsvinder fra alle tre visninger med det samme.
- I `DeviationsPanel` (`src/pages/vagt-flow/EesyFmDeviations.tsx`):
  - Ny state `deleteTarget: { id, sellerName, saleDatetime, productName, phone } | null`.
  - `onClick` på begge "Slet"-knapper sætter `deleteTarget` (afvigelsesrækker via den eksisterende `deviationRowToClaimSale`-form, claims-rækker direkte).
  - Én fælles `AlertDialog` i bunden af panelet med `AlertDialogAction` (destructive) + `AlertDialogCancel`; knappen viser spinner mens mutationen kører.
- Ingen ændringer i database, RLS eller pricing-logik. `sales`-DELETE-politikken er den samme som "Ret salgsregistrering (Leder)" allerede bruger.
