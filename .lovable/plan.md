

# Re-match efter sælger-mapping + flyt til godkendelseskø

## Overblik
Når brugeren tildeler en medarbejder i "Fejl i match", skal systemet automatisk forsøge at re-matche alle rækker med det sælgernavn. Hvis et salg findes, flyttes rækken fra `unmatched_rows` til `cancellation_queue` (status: `pending`) — klar til godkendelse i Godkendelseskøen.

## Ændringer i `MatchErrorsSubTab.tsx`

### 1. Hent upload-konfiguration og kampagner
- Fetch `cancellation_upload_configs` for `clientId` → `date_column`, `fallback_product_mappings`
- Fetch `client_campaigns` for `clientId` → bruges til at scope salgs-søgningen

### 2. Udvid `upsertMapping` mutation med re-match logik
Efter mapping er gemt:
1. Slå `work_email` op for den valgte medarbejder
2. For alle rækker i `rows` med det pågældende sælgernavn:
   - Parse datoen fra `date_column` i rækkens `rowData`
   - Søg i `sales` (via `agent_email` + dato + klientens kampagner)
   - Hvis fallback_product_mappings findes: match også på produkt (ligesom PASS 2 i upload-flowet)
3. For hvert match:
   - Insert i `cancellation_queue` med `import_id`, `sale_id`, `upload_type`, `status: "pending"`, `uploaded_data`, `client_id`
   - Fjern rækken fra `unmatched_rows` i `cancellation_imports` (opdater JSON-arrayet)
4. Invalidér queries: `match-errors`, `cancellation-queue`, `active-import`

### 3. UI feedback
- Toast med antal rækker matchet: "3 rækker matchet og sendt til godkendelseskøen"
- Rækker der matches forsvinder fra tabellen ved næste refetch
- Rækker uden match forbliver med besked: "Ingen salg fundet"

## Teknisk flow
```text
Bruger vælger medarbejder i dropdown
  → upsert mapping i cancellation_seller_mappings
  → hent work_email for medarbejder
  → for hver row med samme sælgernavn:
      → parse dato fra rowData[date_column]
      → query sales WHERE agent_email = work_email AND sale_date = dato
      → if match:
          → INSERT cancellation_queue (pending)
          → UPDATE cancellation_imports: fjern row fra unmatched_rows[]
  → invalidér queries
  → vis toast med resultat
```

## Fil
`src/components/cancellations/MatchErrorsSubTab.tsx`

