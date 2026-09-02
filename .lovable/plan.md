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
- `sales` er forælder til `sale_items`, `tryg_sale_reviews` og `cancellation_queue` med ON DELETE CASCADE — de tilhørende linjer forsvinder sammen med salget.
- `commission_transactions.sale_id` er ON DELETE SET NULL. Der findes i dag 0 provisionsposter og 0 annulleringsposter på Kanvas-produktet, så sletningen efterlader ingen løse provisionsposter. Sletning af salg med provisionsposter vil ikke være muligt uden en bevidst udvidelse.

## Teknisk
- `src/hooks/useTrygKanvasSales.ts`: udvid med en mutation der sletter en liste af salgs-id'er (`sales.delete().in("id", ids)`), i batches, og invaliderer `tryg-kanvas-sales`, `tryg-sale-reviews` og `sales-aggregates`.
- `src/pages/reports/TrygEditSales.tsx`: rød `variant="destructive"`-knap i samme række som "Send til Tryg" på fanen "Afviste salg" + `AlertDialog`-bekræftelse (genbruger eksisterende dialogmønster) med antal og periode i teksten samt tydelig advarsel om at handlingen ikke kan fortrydes.
- Ingen migration, ingen RLS-, pricing- eller lønkodeændringer.
