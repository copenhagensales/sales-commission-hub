# Rediger-knap på Claims/Reimport åbner redigeringsboks

## Hvad der bygges

En pop up-boks når man klikker "Rediger" på en række under Claims/Reimport. Boksen viser salget og gør det muligt at rette:

- **Produkt** — dropdown med kun Eesy FM-produkter (aktive, ikke skjulte)
- **Sælger** — dropdown med aktive medarbejdere
- **Dato/tid** — salgets tidspunkt
- **Mobil/telefonnummer**
- **Notat/kommentar**
- **Fjern Claim/Reimport-registrering** — afkrydsning; når den fjernes, forsvinder salget fra Claims/Reimport-listen (salget slettes ikke)

Gem-knap opdaterer salget centralt, så ændringen slår igennem overalt i Stork (dagsrapporter, Ret salgsregistrering, tavler, provision). Annuller lukker uden ændringer.

Godkendelses-status (Godkendt/Afventer) røres ikke af redigeringen.

## Adfærd ved produktændring

Ændres produktet, genberegnes salgets provision og omsætning efter samme fremgang som i "Ret salgsregistrering (Leder)": salgets linjer genskabes via prisreglerne. Ændres kun sælger, dato, telefon, notat eller claim-markering, røres provisionen ikke.

## Teknisk

- `src/hooks/useEesyFmClaimSales.ts`: ny `useUpdateEesyFmClaimSale`-mutation.
  - Læser eksisterende `raw_payload`, spreader den og sætter `fm_product_name`, `fm_seller_id`, `fm_comment` samt `fm_claim_reimport` (false hvis fjernet). Opdaterer `sale_datetime` og `customer_phone` på `sales`.
  - Kun ved produktændring: slet `sale_items` for salget og kald `rematch-pricing-rules` med `sale_ids: [id]` — identisk med `updateSale` i `EditSalesRegistrations.tsx:271-306`.
  - Invaliderer `eesy-fm-claim-sales`, `fm-sales-edit`, `fieldmarketing-sales` og sales-aggregat-keys.
  - `EesyFmClaimSale` udvides med `productName` (findes), `comment` og `phone` (findes) — tilføj `sellerId` er allerede med.
- Nye/genbrugte lookups i samme hook-fil:
  - Eesy FM-produkter: `products` joinet via `client_campaigns.client_id = 9a92ea4c-…` med `is_active = true`, `is_hidden` ikke sat, dubletter på navn fjernet, sorteret dansk.
  - Sælgere: `employee_master_data` (id, navn) aktive, sorteret.
- `src/pages/vagt-flow/EesyFmDeviations.tsx`: ny `ClaimEditDialog`-komponent i filen (Dialog + Select/Input/Textarea/Checkbox fra ui). "Rediger"-knappen sætter dialog-state med rækken; ingen ændring af Godkend/Slet.
- Ingen DB-migration. Ingen ændring i pricing-motor, `_shared/pricing-service.ts` eller rapport-RPC'er.
