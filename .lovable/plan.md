# Tryg - Ret salg: fejl ved "Afvis markerede"

## Hvad fejlen skyldes (bekræftet)

Netværksloggen fra din session viser, at knappen sender en skrivning til `tryg_sale_reviews`, som backend afviser med HTTP 409:

```text
POST /rest/v1/tryg_sale_reviews  → 409
{"code":"23503","details":"Key is not present in table \"sale_items\".",
 "message":"... violates foreign key constraint \"tryg_sale_reviews_sale_item_id_fkey\""}
sale_item_id: ffa122b9-… og 698f73f0-…
```

Jeg har slået de to id'er op i databasen: de findes **ikke længere** i `sale_items` (og heller ikke i `sales`). Filips to salg kl. 13:49 har i dag id'erne `35ae2af4-…`, `c799aad1-…`, `dca5bfb6-…`. Med andre ord: siden havde hentet salgslinjer, hvis `sale_items`-rækker efterfølgende blev slettet og genskabt med nye id'er (det sker fx ved prisrematch — `supabase/functions/rematch-pricing-rules/index.ts:924` sletter `sale_items`-rækker). Statussen bliver derfor gemt på et id, der ikke findes, og databasen afviser skrivningen.

Der er ingen fejl i adgang/RLS: din bruger er ejer, og tabellens rettigheder og politikker er korrekte. Tabellen indeholder 0 rækker, fordi alle forsøg er blevet afvist på samme måde.

Adgangen ændres ikke: fortsat kun ejere samt Filip og Annika (dit valg).

## Løsningen: gem status på salget, ikke på salgslinjen

`sales.id` er stabil (salget beholder samme id ved genskabelse af salgslinjer), mens `sale_items.id` ikke er. Jeg har kontrolleret, at hvert Kanvas-salg har præcis én salgslinje (0 salg har flere), så der er ingen tvetydighed ved at skifte nøgle.

1. **Migration** — `tryg_sale_reviews` skiftes til at pege på salget:
   - ny kolonne/nøgle `sale_id uuid primary key references sales(id) on delete cascade`
   - den gamle `sale_item_id`-kolonne og dens fremmednøgle fjernes
   - tabellen er tom (0 rækker), så ingen data mistes og ingen historik påvirkes
   - rettigheder og RLS-politikker bevares uændret (samme adgang som i dag)
2. **`src/hooks/useTrygSaleReviews.ts`** — slår status op og gemmer via `sale_id` i stedet for `sale_item_id`.
3. **`src/pages/reports/TrygEditSales.tsx`** og **`src/components/reports/TrygSalesTable.tsx`** — markering og status-opslag bruger `saleId` som nøgle (feltet findes allerede i `useTrygKanvasSales`).
4. **Tydeligere fejlbesked** — i stedet for "Kunne ikke gemme status" vises den faktiske årsag, og listen genindlæses automatisk, hvis et salg er forsvundet, så du ikke sidder med forældede linjer.

## Ingen ændringer i

Salg, salgslinjer, priser, provision, løn eller rapporter. Kun status-tabellen og siden "Tryg - Ret salg".

## Verificering efter implementering

- Markér Filips to salg fra 13:49 og tryk "Afvis markerede" — de skal flytte til fanen Afviste salg.
- Kontroller i databasen at der ligger to rækker i `tryg_sale_reviews` med korrekt behandler og tidspunkt.
- "Fortryd" på fanen skal sende linjen tilbage til Gennemgang.
