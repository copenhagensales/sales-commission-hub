# Kun "5G Internet" kan vælges ved callback-registrering

## Rod-årsag (verificeret)

Det er ikke callback-flowet der er galt. Callback bruger samme produktforespørgsel som normal registrering (`src/pages/vagt-flow/SalesRegistration.tsx:252-273`), som siden sidste ændring filtrerer på `.eq("is_active", true)`.

Bookingen i skærmbilledet (Vildsund Kræmmermarked, Eesy FM) hænger på kampagnen **Eesy marked**. Databasen viser at 8 af 9 produkter på den kampagne står med `is_active = false`:

```text
Eesy marked (9 produkter, 1 aktivt)
  aktiv:   5G Internet
  inaktiv: Eesy 99 med/uden første måned (Nuuday / IKKE Nuuday)   (4 stk)
  inaktiv: Eesy med/uden første måned (Nuuday / IKKE Nuuday)      (4 stk)
```

Til sammenligning har **Eesy gaden** de samme fire "Eesy med/uden første måned"-produkter aktive.

Det er præcis de samme inaktive produkter som gav Vorbasse-problemet: DB-triggeren `create_fm_sale_items` matcher kun produkter med `is_active = true`, så salg på Eesy marked fik ingen/forkerte `sale_items`. Filtret i UI'et gør nu blot problemet synligt i stedet for stille.

## Løsning

Fix i data, ikke i kode. Filtret virker som aftalt — produkterne er fejlagtigt inaktive.

1. Sæt `is_active = true` på de 8 produkter på kampagnen **Eesy marked** (id `0835d092-2504-43e4-b818-55d4dd7ddedb`):
   - Eesy med første måned (Nuuday) / (IKKE Nuuday)
   - Eesy uden første måned (Nuuday) / (IKKE Nuuday)
   - Eesy 99 med første måned (Nuuday) / (IKKE Nuuday)
   - Eesy 99 uden første måned (Nuuday) / (IKKE Nuuday)
2. Ingen ændring af priser, regler eller eksisterende `sale_items` — kun `is_active`-flaget.
3. Derefter kan sælgere igen vælge produkterne både i normal registrering og i callback-mode, og triggeren kan matche nye salg korrekt.

## Åbent spørgsmål inden udførelse

Skal alle 8 reaktiveres, eller er "Eesy 99"-varianterne (4 stk) bevidst udgået? Hvis de er udgået, reaktiverer vi kun de fire "Eesy med/uden første måned".

## Zone

Gul: dataændring på `products.is_active` (ikke pricing-regler, ikke løn, intet slettes). Ingen kodeændringer nødvendige.
