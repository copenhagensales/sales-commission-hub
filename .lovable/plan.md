

# Plan: Fix provision, vis inaktive medarbejdere, og ret diet-visning

## Problemer

1. **Manglende provision**: Hook'en bruger `kpi_cached_values` som kun indeholder data for den aktuelle loenperiode. Historiske perioder viser 0.
2. **Inaktive medarbejdere skjules**: `.eq("is_active", true)` filtrerer dem vaek.
3. **Diet viser 0 kr.**: Data findes i `booking_diet` tabellen (bekraeftet - fx Oscar og Josefine har 300 kr/dag). Query'en ser korrekt ud, men der kan vaere et timing/caching-problem. Vi sikrer at det virker korrekt.

## Aendringer

### Fil: `src/hooks/useSellerSalariesCached.ts`

**1. Fjern `is_active` filter**
- Fjern `.eq("is_active", true)` saa baade aktive og inaktive medarbejdere vises.
- Tilfoej `is_active` til select-felterne.

**2. Erstat KPI-cache med reel salgsdata for provision**
- Fjern query til `kpi_cached_values` (som kun har aktuel periode).
- Tilfoej queries der henter:
  1. `employee_agent_mapping` med `agents(email)` for at linke medarbejdere til salg.
  2. `sales` + `sale_items(mapped_commission)` filtreret paa den valgte periode og agent-emails.
- Beregn provision per medarbejder ved at summere `mapped_commission`.
- Dette foelger samme moenster som `PayrollDayByDay.tsx`.

**3. Tilfoej `isActive` til SellerData interface**

### Fil: `src/components/salary/SellerSalariesTab.tsx`

**Vis aktiv/inaktiv-status**
- Inaktive medarbejdere vises med nedtonet tekst og en "(Inaktiv)" badge.

---

## Teknisk data-flow for provision

```text
employee_master_data
  -> employee_agent_mapping -> agents(email)
  -> sales (confirmation_date i perioden, ikke annulleret)
  -> sale_items(mapped_commission)
  -> sum per employee_id
```

## Diet data-flow (allerede implementeret, verificeret)

```text
booking_diet tabellen
  -> filtreret paa employee_id + date i perioden
  -> sum af amount per medarbejder
  (Bekraeftet data: Oscar og Josefine har 4x 300 kr i feb 2026)
```

## Filaendringer

| Fil | Aendring |
|-----|---------|
| `src/hooks/useSellerSalariesCached.ts` | Fjern is_active filter, erstat KPI-cache med salgsdata, tilfoej isActive |
| `src/components/salary/SellerSalariesTab.tsx` | Vis aktiv/inaktiv markering |

