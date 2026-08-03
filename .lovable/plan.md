# Kun "5G Internet" kan vælges ved callback-registrering

## Rod-årsag (verificeret)

Det er ikke callback-flowet. Callback bruger samme produktforespørgsel som normal registrering (`src/pages/vagt-flow/SalesRegistration.tsx:252-273`), som nu filtrerer på `.eq("is_active", true)`.

Bookingen i skærmbilledet (Vildsund Kræmmermarked, Eesy FM) hænger på kampagnen **Eesy marked**. Der er 9 produkter på kampagnen, og kun 1 er aktivt:

```text
Eesy marked
  aktiv:   5G Internet                                    (updated 15/5-2026)
  inaktiv: Eesy 99 med/uden første måned (Nuuday/IKKE)    (4 stk — dine, bevidst udgået)
  inaktiv: Eesy med/uden første måned (Nuuday/IKKE)       (4 stk — updated_at 11/3-2026)
```

De fire "Eesy med/uden første måned" på **Eesy marked** blev sat inaktive **11. marts 2026** — altså ikke af dig i dag. Det er efter alt at dømme en produktfletning der deaktiverede marked-varianterne, mens de identisk navngivne varianter på **Eesy gaden** blev holdt aktive. Det er derfor du i MG Test ser navne-par hvor den ene har "Inaktiv"-badge og den anden ikke har.

Så ja — din antagelse holder: sælgerne har indtil nu kunnet vælge produkter der i databasen var inaktive. Konsekvensen var ikke kun kosmetisk: DB-triggeren `create_fm_sale_items` matcher kun på `is_active = true`, så marked-salg blev matchet mod **gaden**-varianten og fik gaden/COOP-satser i stedet for markedssatser. Det er præcis Vorbasse-fejlen.

## Løsning

Fix i data, ikke i kode. Filtret virker som aftalt.

1. Sæt `is_active = true` på de fire produkter på kampagnen **Eesy marked** (id `0835d092-2504-43e4-b818-55d4dd7ddedb`):
   - Eesy med første måned (Nuuday) / (IKKE Nuuday)
   - Eesy uden første måned (Nuuday) / (IKKE Nuuday)
2. De fire "Eesy 99"-produkter forbliver inaktive — de skal ikke sælges længere.
3. Ingen ændring af priser, prisregler eller eksisterende `sale_items`. Kun `is_active`-flaget.

Derefter kan sælgere igen vælge de fire produkter — både i normal registrering og i callback-mode — og triggeren matcher nye marked-salg mod de rigtige marked-satser i stedet for gaden/COOP.

## Bemærkning til opfølgning

Nye salg bliver først korrekte fra reaktiveringen. Gamle Vorbasse-salg kræver stadig den separat aftalte backfill af `mapped_commission`/`mapped_revenue`.

## Zone

Gul: dataændring på `products.is_active` (ikke prisregler, ikke løn, intet slettes). Ingen kodeændringer nødvendige.
