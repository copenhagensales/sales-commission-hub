# Ny startfane på "Tryg - Ret salg": Alle United-salg

## Hvad brugeren får

Når siden åbnes, vises en ny fane **"United-salg"** som standard (i stedet for Kanvas-møder). Kanvas-møder og "Alle tryg & alka salg" ligger fortsat som knapper ved siden af og er uændrede.

Den nye fane viser alle salg på de kunder der hører til teamet **United**, for den valgte dag — dagens dato som standard, med datovælger så man kan gå tilbage i tiden. Nyeste salg øverst.

Kolonner som på Kanvas-møder: Tid, Sælgernavn, Telefon, Antal, Produktnavn — plus en kunde-kolonne, og telefonsøgning i toppen.

Der er **ingen** faner med Gennemgang / Afviste / Godkendte, og **ingen** Afvis/Godkend/Markér. I stedet to knapper pr. linje:

- **Slet salg** (rød): sletter salget permanent fra Stork. Bekræftelsesboks viser sælger, tidspunkt, produkt og hvor meget provision og omsætning der forsvinder, samt at handlingen ikke kan fortrydes. Efter sletning forsvinder salget fra rapporter, boards og provisionsgrundlag.
- **Ret**: åbner en boks hvor man kan ændre **salgsdato/tid**, **sælger** og **produkt**. Ved skift af produkt genberegnes provision og omsætning efter de gældende prisregler — så det ændrer sælgerens løngrundlag for perioden. Det står tydeligt i boksen før man gemmer.

Adgang er uændret: kun ejere og de i forvejen godkendte adresser.

## Vigtigt at være klar over

Både sletning og retning påvirker løn- og provisionsgrundlag med tilbagevirkende kraft. Hvis man retter et salg tilbage i en lønperiode der allerede er afregnet, ændrer beløbene sig i rapporterne. Der er ingen fortryd-knap.

## Teknisk

**Ny hook `src/hooks/useUnitedSales.ts`**
1. Slår teamet United op (`teams` efter navn, som `UnitedDashboard.tsx` gør) → `team_clients` → kunde-id'er.
2. `client_campaigns` for disse kunder → kampagne-id'er + kundenavn pr. kampagne.
3. Henter dagens salg i to spor og forener på `sale_items.id`, præcis som `useTrygAlkaSales.ts`: (a) `sales.client_campaign_id` i kampagnelisten, (b) `products.client_campaign_id` i kampagnelisten med dagsfilter på `sales.sale_datetime`. Sælgernavn via `employee_master_data.work_email` med fallback til `agent_name`/`agent_email`.
4. Returnerer samme form som `TrygAlkaSale` (inkl. `clientName`, `mappedCommission`, `mappedRevenue`) + `productId` og `agentEmail` som "Ret"-boksen har brug for.

**Ny edge function `update-sale-line`** (skriver, med auth-tjek svarende til den eksisterende adgang til siden):
- Input: `sale_id`, `sale_item_id`, valgfrit `sale_datetime`, `agent_email`, `product_id`.
- Opdaterer `sales.sale_datetime` / `sales.agent_email` (+ `agent_name` nulstilles så navneopslag gælder) og `sale_items.product_id`.
- Genberegner `mapped_commission`, `mapped_revenue` og `matched_pricing_rule_id` for netop den ene salgslinje ved at kalde den eksisterende `supabase/functions/_shared/pricing-service.ts` — ingen ny pricing-logik og ingen ændring i den fil, så frontend/edge forbliver 1:1.
- Returnerer de nye beløb, så UI kan vise dem.

**Ny hook `src/hooks/useUpdateUnitedSale.ts`**: kalder funktionen og invaliderer `united-sales`, `tryg-kanvas-sales`, `sales-aggregates`, `sales`.

**Sletning**: genbruger `useDeleteTrygKanvasSale` (hard delete på `sales`, cascade rydder `sale_items`).

**UI**
- `src/components/reports/TrygSalesTable.tsx`: ny `mode: "edit"` med to knapper (Slet salg, Ret) og valgfri kunde-kolonne. `review`- og `status`-modes røres ikke.
- `src/pages/reports/TrygEditSales.tsx`: `view`-state udvides med `"united"` og sættes som default. Ny knap "United-salg" først i knapperækken. Ny sektion med datovælger, telefonsøgning, tabel i `edit`-mode, `AlertDialog` til sletning og en `Dialog` til "Ret" (dato/tid-vælger, sælger-vælger fra aktive medarbejdere, produkt-vælger fra kundens produkter).

Ingen migrationer, ingen ændringer i RLS, prisregler, lønberegning eller eksisterende faner.

## Åbent spørgsmål
Sælger-vælgeren: skal den kun vise medarbejdere i teamet United, eller alle aktive medarbejdere? Planen som skrevet viser alle aktive.
