# Tryg - Ret salg: tre faner med gennemgang, afviste og godkendte salg

## Formål
Siden får tre faner, så en behandlet linje flytter fra gennemgang til enten afviste eller godkendte salg. Status gemmes i databasen, så den er den samme for alle brugere og bevares over tid.

## Faner

1. **Gennemgang** — præcis den nuværende tabel, men viser kun linjer uden status endnu. Knapperne Afvis / Godkend (og bulk-knapperne) sætter status.
2. **Afviste salg** — linjer markeret afvist på den valgte dag.
3. **Godkendte salg** — linjer markeret godkendt på den valgte dag.

Datovælgeren og telefon-søgningen gælder alle tre faner. Fane 2 og 3 genbruger samme kolonner, men uden handlingsknapper og markering — i stedet vises to ekstra kolonner: **Behandlet af** og **Tidspunkt**. Hver fane viser antal i overskriften.

## Adfærd
- Afvis/Godkend ændrer eller sletter ikke salget — kun status. Al salgs- og provisionslogik er urørt.
- En linje kan omvurderes: på fane 2 og 3 tilføjes en "Fortryd"-knap, der fjerner statussen og sender linjen tilbage til Gennemgang.
- Bulk-knapperne "Godkend markerede" / "Afvis markerede" sætter status på alle markerede linjer i én handling.
- Adgang uændret: kun ejere og de whitelistede adresser (samme `useTrygEditAccess`).

## Teknisk

**Ny tabel** `public.tryg_sale_reviews` (der findes ingen review-tabel i dag):
- `sale_item_id uuid primary key` (peger på `sale_items.id`, cascade delete)
- `status text not null check (status in ('approved','rejected'))`
- `reviewed_by uuid` + `reviewed_by_name text` (navn cachet til visning)
- `reviewed_at timestamptz not null default now()`, `updated_at`
- GRANT SELECT/INSERT/UPDATE/DELETE til `authenticated`, ALL til `service_role`; RLS slået til med politik der kræver samme adgang som siden (ejer via `has_role`/eksisterende ejer-funktion). Ingen `anon`-adgang.

**Kode**
- `src/hooks/useTrygSaleReviews.ts` (ny): henter status for dagens sale_item_ids + mutations `setReview` (upsert) og `clearReview` (delete), invalidere `["tryg-sale-reviews"]`.
- `src/pages/reports/TrygEditSales.tsx`: shadcn `Tabs` omkring tabellen; udtræk tabellen til en genbrugelig `TrygSalesTable`-del med props for kolonner/handlinger, så de tre faner deler skabelon. Filtrering af salg pr. status sker i frontend ud fra status-map'et.
- Ingen ændringer i `useTrygKanvasSales`-forespørgslen, pricing, løn eller rapport-RPC'er.

## Risici
Kun ny tabel og UI. Ingen skrivning til `sales`/`sale_items`, så ingen påvirkning af omsætning, provision eller eksisterende rapporter.
