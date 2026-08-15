# Claim/Reimport logges på salget og vises i "Ret salgsregistrering (Leder)"

## Hvad der bygges

1. **Logning ved registrering (Eesy FM)**
   - Den eksisterende Claim/Reimport-checkboks pr. telefonnummer-linje sendes nu med, når salget gemmes.
   - Værdien gemmes som Ja/Nej pr. salg (hver linje = ét salg), så et salg altid har en klar værdi — også når checkboksen ikke er brugt (= Nej).
   - Ingen ændring af pricing, provision eller salgets øvrige felter.

2. **Ikke synlig i rapporter**
   - Værdien tilføjes ingen steder i dagsrapporter eller Rapporter (Ledelse). Ingen RPC'er eller rapport-views ændres.

3. **Vises i "Ret salgsregistrering (Leder)"**
   - Ny kolonne "Claim/Reimport" i salgstabellen med "Ja" (fremhævet badge) eller "Nej" (dæmpet).
   - Ved redigering af et salg bevares værdien uændret (den nulstilles ikke).

4. **Historiske salg påvirkes ikke**
   - Ingen data-opdatering af eksisterende salg. Salg uden feltet læses som Nej (false) i UI'et.



## Teknisk

- Feltet gemmes i `sales.raw_payload` som `fm_claim_reimport: boolean` — samme mønster som `fm_comment`, `fm_product_name` osv. Ingen DB-migration nødvendig.
- `src/hooks/useFieldmarketingSales.ts`: `CreateSaleParams` udvides med `claim_reimport?: boolean`; skrives ind i `raw_payload` som `fm_claim_reimport: sale.claim_reimport === true`.
- `src/pages/vagt-flow/SalesRegistration.tsx`: i `handleSubmit` mappes `selection.claimFlags[index]` med på hver salgsrække (i dag bruges linjens flag kun til kommentar-validering).
- `src/pages/vagt-flow/EditSalesRegistrations.tsx`:
  - `SaleRecord` udvides med `claim_reimport: boolean`, læst fra `payload.fm_claim_reimport === true`.
  - Ny `TableHead`/`TableCell` "Claim/Reimport" i produkt-tabellen.
  - Update-mutationerne spreader allerede `existingPayload`, så feltet bevares; verificeres at ingen gren overskriver det.
- Ingen ændringer i `_shared/pricing-service.ts`, `create_fm_sale_items`, rapport-RPC'er eller dashboards.
