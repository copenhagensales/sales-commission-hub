

# Fix: Fjern 1000-rækkers begrænsning på rådata

## Problem
Database-klienten (SDK) har en standard-grænse på 1000 rækker per forespørgsel. SQL-funktionen `get_sales_report_raw` har ingen LIMIT, men SDK'en afskærer resultatet.

## Datakilde
Rådata hentes fra `sale_items` JOIN `sales` JOIN `products` JOIN `client_campaigns` — filtreret på klient og periode, kun produkter med `counts_as_sale = true`.

## Løsning
I `ReportsManagement.tsx`: Erstat det nuværende `supabase.rpc(...)` kald med pagineret fetching der henter alle rækker i batches af 1000 (via `.range(offset, offset + pageSize - 1)` eller ved at bruge den eksisterende `fetchAllRows`-helper fra `src/utils/supabasePagination.ts`).

Da det er et RPC-kald (ikke en table query), kan vi ikke bruge `.range()` direkte. I stedet:
- Tilføj `LIMIT` og `OFFSET` parametre til `get_sales_report_raw` SQL-funktionen
- Loop i frontend indtil færre end `pageSize` rækker returneres
- Eller alternativt: kald RPC'en med en ekstra parameter `p_limit` sat til fx 10000 (realistisk max for en lønperiode)

Den simpleste løsning: Kald RPC'en via en POST med `.csv()` header eller tilføj pagination-parametre til funktionen.

**Anbefalet tilgang:** Opdater SQL-funktionen til at accepte `p_limit int DEFAULT 10000` og `p_offset int DEFAULT 0`, og loop i frontend med batches.

