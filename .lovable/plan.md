# Godkend-funktion på Claims/Reimport

## Hvad
"Godkend"-knappen får funktion: lederen markerer et claim/reimport-salg som godkendt, så man kan skelne mellem behandlede og ubehandlede claims.

- Klik på "Godkend" → rækken markeres som godkendt (grønt "Godkendt"-badge med dato og navn på den der godkendte).
- På en godkendt række skifter knappen til "Fortryd" så en fejlmarkering kan rulles tilbage.
- Ny status-kolonne "Status" i tabellen: "Godkendt (dd/MM · Navn)" eller "Afventer".
- Filter-pille øverst: Alle / Afventer / Godkendt, så lederen hurtigt kan se det uafklarede.
- Markeringen vises udelukkende her på Claims/Reimport-fanen — den påvirker ikke pricing, løn, dagsrapporter eller "Ret salgsregistrering".

## Teknisk
- Lagring på selve salget i `sales.raw_payload` (ingen skemaændring, historik bevares):
  - `fm_claim_approved: boolean`
  - `fm_claim_approved_at: ISO-timestamp`
  - `fm_claim_approved_by: employee_master_data.id`
  - `fm_claim_approved_by_name: string` (læsevenlig i log/UI)
  - Salg uden feltet behandles som "Afventer" (ingen backfill).
- `src/hooks/useEesyFmClaimSales.ts`:
  - Query udvides til at mappe `approved`, `approvedAt`, `approvedByName` (navn slås op via samme `employee_master_data`-batch som sælgere, med payload-navn som fallback).
  - Ny mutation-hook `useSetEesyFmClaimApproval` i samme fil: læser eksisterende `raw_payload`, merger godkendelsesfelterne ind (bevarer alt andet), skriver via `supabase.from("sales").update(...)`, og invaliderer `["eesy-fm-claim-sales"]`.
  - Godkender-id hentes fra nuværende bruger via eksisterende employee-lookup-mønster (`useCurrentEmployee`/`get_current_employee_id`).
- `src/pages/vagt-flow/EesyFmDeviations.tsx`:
  - "Godkend"/"Fortryd" kalder mutationen med spinner/disabled under kald og toast ved succes/fejl.
  - Statuskolonne + statusfilter (`alle | pending | approved`) tilføjes i claims-visningen; sortering på salgsdato/sælger bevares.
- RLS: `sales` har allerede UPDATE-policy `Managers can update sales` (`is_manager_or_above`), så ledersiden kan skrive uden ændringer.
- Ingen ændring i pricing/løn/`sale_items` — kun `raw_payload`-felter der ikke læses af nogen beregning.
