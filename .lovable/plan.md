Tilføj "(+ N fiber)" grå tekst ved siden af tallet i KPI-kortene "Salg i dag", "Salg denne uge", "Salg denne måned" og "Salg lønperiode" på TDC Erhverv – Overblik. Ikke på "Salg/time (løn)".

## Tælle-logik
Antal = sum af `sale_items.quantity` for fiber-produkter EXCL. Lead-varianter:
- Lukket salg HAP (`ed0ea287…`)
- Fuldt salg HAP (`c63708fc…`)
- Lukket salg VOK (`34518fa2…`)
- Fuldt salg VOK (`25e393c0…`)

Ekskluderer `e63c9da4…` (Lead Provi HAP) og `bd6ae50b…` (Lead Provi VOK). Ekskluderer annullerede items (`is_cancelled = false`), samme mønster som `useFiberBoardStats`.

## Ændringer

**1. `src/config/fiberBoardPoints.ts`**
Tilføj eksporteret konstant `FIBER_SALE_PRODUCT_IDS` (de 4 non-lead produkt-IDs), så tælling er adskilt fra point-map og ikke afhænger af lead-flag.

**2. `src/hooks/useFiberSalesCount.ts` (ny)**
Simpel React Query-hook der returnerer total `quantity` for de 4 produkt-IDs i en given periode. Pagineret ligesom `useFiberBoardStats`. `staleTime: 60s`, `refetchInterval: 120s`.

**3. `src/components/dashboard/ClientDashboard.tsx`**
- Kald `useFiberSalesCount` for today/week/month/payroll (kun når `showFiber`).
- Tilføj helper `fiberSuffix(count)` → `<span className="text-lg font-normal text-muted-foreground ml-2">(+{count} fiber)</span>` når count > 0.
- Kombinér med eksisterende `switchSuffix` via fragment i `suffix`-feltet for de fire KPI-kort. "Salg/time (løn)" røres ikke.

Grøn zone (præsentation + read-only aggregat).
