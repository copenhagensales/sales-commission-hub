# "Slet salg"-knap på fanen "Afviste salg"

## Hvad bygges
- Ny rød knap "Slet salg (n)" ved siden af "Send til Tryg" — kun på fanen "Afviste salg".
- Den sletter præcis de salg der vises på den fane i den valgte periode (samme afgrænsning som "Send til Tryg" bruger).
- Klik åbner en bekræftelsesboks der viser antal salg og de berørte sælgere/tidspunkter. Brugeren skal aktivt bekræfte; sletningen er permanent.
- Efter sletning forsvinder salgene fra boards, rapporter og provisionsgrundlag, og listen genindlæses.
- Knappen er deaktiveret når der ingen afviste salg er i perioden.

## Afgrænsning (sikkerhed)
- Sletningen sker kun på en eksplicit liste af salgs-id'er, som frontenden har hentet gennem det eksisterende Kanvas-filter (produkt "Meeting -- CPH sales Kanvas") + periode + status "rejected" i `tryg_sale_reviews`.
- Ingen bulk-sletning ud fra dato eller produkt alene, ingen sletning ud fra søgning, ingen berøring af andre faner, klienter eller produkter.
- Adgang uændret: kun de brugere der i dag har adgang til "Tryg - Ret salg".

## Konsekvenser (verificeret i databasen)
- Provisionen på disse salg ligger på `sale_items.mapped_commission` (Kanvas-produktet i alt: 6.094 linjer, 593.400 kr provision, 1.635.850 kr omsætning). `sale_items` har ON DELETE CASCADE, så en sletning fjerner **også provisionen** for sælgeren på det salg. Det er hensigten med knappen, men det betyder at løn for en periode ændrer sig, hvis man sletter salg tilbage i tiden.
- Derfor: bekræftelsesboksen viser antal salg, sælgere og **summen af provision og omsætning der forsvinder**, så man ikke ved et uheld ændrer et allerede afregnet løngrundlag.
- `tryg_sale_reviews` og `cancellation_queue` cascader også — statusmarkeringen forsvinder sammen med salget.
- `commission_transactions.sale_id` er ON DELETE SET NULL, men tabellen er tom (0 rækker i hele systemet), så der efterlades ingen løse provisionsposter.

## Teknisk
- `src/hooks/useTrygKanvasSales.ts`: udvid med en mutation der sletter en liste af salgs-id'er (`sales.delete().in("id", ids)`), i batches, og invaliderer `tryg-kanvas-sales`, `tryg-sale-reviews` og `sales-aggregates`.
- `src/pages/reports/TrygEditSales.tsx`: rød `variant="destructive"`-knap i samme række som "Send til Tryg" på fanen "Afviste salg" + `AlertDialog`-bekræftelse (genbruger eksisterende dialogmønster) med antal og periode i teksten samt tydelig advarsel om at handlingen ikke kan fortrydes.
- Ingen migration, ingen RLS-, pricing- eller lønkodeændringer.
