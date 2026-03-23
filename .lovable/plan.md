

# Ny fane: Godkendte salg/annulleringer

## Hvad
Tilføj en ny top-fane "Godkendte" på Annulleringer-siden der viser alle godkendte og afviste items fra `cancellation_queue` (status = `approved` eller `rejected`), med tilhørende salgsdata.

## Ændringer

| Fil | Hvad |
|-----|------|
| `src/components/cancellations/ApprovedTab.tsx` | **Ny fil.** Query `cancellation_queue` med `status in ('approved','rejected')`, filtret på `client_id`. Join med `sales` for dato/sælger/OPP. Vis i tabel med søgefelt, sælger-filter, sorterbare kolonner (dato, sælger, OPP, type, status, godkendt af, godkendt dato). Badge for status (Godkendt/Afvist). |
| `src/pages/salary/Cancellations.tsx` | Tilføj "Godkendte" i `visibleTabs` med permission `tab_cancellations_approved`. Import og render `ApprovedTab` med `clientId` prop. |

## Teknisk detalje
- Query: `cancellation_queue` med `.in("status", ["approved", "rejected"])` + `.eq("client_id", clientId)` når sat
- Join `sales` via `sale_id` for `sale_datetime`, `agent_name`, `raw_payload` (OPP)
- Join `employees` via `reviewed_by` for godkenders navn
- Genbruger søgefelt, sælger-filter og sorterbare headers (samme mønster som Afventer/Godkendelseskø)
- Viser upload_type som "Annullering" / "Kurvrettelse"

